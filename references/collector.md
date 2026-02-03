# OpenTelemetry Collector: Pipeline Configuration & Components

## Overview

The OpenTelemetry Collector is a vendor-agnostic telemetry pipeline that receives, processes, and exports observability data. This reference provides deep technical guidance on pipeline anatomy, processor ordering, memory management, and production stability patterns.

## Table of Contents

1. [Pipeline Anatomy](#pipeline-anatomy)
2. [Core vs Contrib Components](#core-vs-contrib-components)
3. [Processor Ordering: The Critical Path](#processor-ordering-the-critical-path)
4. [Memory Limiter: Preventing OOM Kills](#memory-limiter-preventing-oom-kills)
5. [Persistent Queues: Preventing Data Loss](#persistent-queues-preventing-data-loss)
6. [Batch Processor: Network Optimization](#batch-processor-network-optimization)
7. [Extensions](#extensions)
8. [Configuration Patterns](#configuration-patterns)
9. [Component Docs & Example Configs](#component-docs--example-configs)
9. [Component Docs & Example Configs](#component-docs--example-configs)

---

## Pipeline Anatomy

A collector **pipeline** consists of three stages:

```
Receivers → Processors → Exporters
```

### Receivers

**Receivers** are the entry points for data. They listen on network endpoints or pull data from sources.

Common receivers:
- `otlp`: Receives OTLP (gRPC/HTTP) - **Use this by default**
- `prometheus`: Scrapes Prometheus metrics
- `jaeger`: Receives Jaeger traces (legacy)
- `zipkin`: Receives Zipkin traces (legacy)
- `filelog`: Reads log files from disk
- `hostmetrics`: Collects host-level metrics (CPU, memory, disk)

### Processors

**Processors** transform, filter, enrich, or drop data. They execute **in order**.

Critical processors:
- `memory_limiter`: **Must be first** - Prevents OOM
- `batch`: **Should be near end** - Reduces network calls
- `k8sattributes`: Enriches with K8s metadata
- `transform`: Applies OTTL transformations
- `filter`: Drops spans/metrics based on conditions
- `tail_sampling`: Intelligent sampling decisions (stateful)
- `attributes`: Adds/removes/hashes attributes
- `resource`: Modifies resource attributes

### Exporters

**Exporters** send data to backends.

Common exporters:
- `otlp`: Exports to OTLP-compatible backends
- `prometheus`: Exposes metrics for Prometheus scraping
- `jaeger`: Exports to Jaeger (legacy)
- `loadbalancing`: Routes to multiple backends with consistent hashing
- `logging`: Outputs to stdout (debug only)
- `file`: Writes to disk (debug only)

### Pipeline Definition

```yaml
service:
  pipelines:
    traces:
      receivers: [otlp, jaeger]
      processors: [memory_limiter, batch]
      exporters: [otlp]
    
    metrics:
      receivers: [otlp, prometheus]
      processors: [memory_limiter, batch]
      exporters: [otlp]
    
    logs:
      receivers: [otlp, filelog]
      processors: [memory_limiter, k8sattributes, batch]
      exporters: [otlp]
```

**Key Rule**: Each pipeline type (traces, metrics, logs) is independent.

---

## Core vs Contrib Components

### Core Distribution

The `opentelemetry-collector` (core) contains **stable, vendor-neutral** components:
- Basic receivers: `otlp`, `prometheus`
- Basic processors: `batch`, `memory_limiter`
- Basic exporters: `otlp`, `logging`

**Stability**: Production-ready

### Contrib Distribution

The `opentelemetry-collector-contrib` contains **extended** components:
- Advanced processors: `tail_sampling`, `transform`, `k8sattributes`
- Cloud-specific exporters: `awsxray`, `googlecloud`, `azuremonitor`
- Specialized receivers: `filelog`, `kafkareceiver`, `sqlquery`

**Stability**: Varies (Alpha/Beta/Stable)

### Checking Component Stability

⚠️ **Always verify component stability before production use**:

1. Check the [otelcol-contrib registry](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/VERSIONING.md)
2. Look for stability badges:
   - **Stable**: Production-ready, backward compatibility guaranteed
   - **Beta**: Feature-complete, but may have breaking changes
   - **Alpha**: Experimental, expect breaking changes
   - **Development**: Not for production use

### Best Practice: Custom Builds with OCB

For production, use the **OpenTelemetry Collector Builder (OCB)** to create lean binaries:

```yaml
# builder-config.yaml
dist:
  name: otelcol-custom
  description: Custom OpenTelemetry Collector
  output_path: ./dist

receivers:
  - gomod: go.opentelemetry.io/collector/receiver/otlpreceiver v0.100.0
  - gomod: github.com/open-telemetry/opentelemetry-collector-contrib/receiver/filelogreceiver v0.100.0

processors:
  - gomod: go.opentelemetry.io/collector/processor/batchprocessor v0.100.0
  - gomod: go.opentelemetry.io/collector/processor/memorylimiterprocessor v0.100.0
  - gomod: github.com/open-telemetry/opentelemetry-collector-contrib/processor/k8sattributesprocessor v0.100.0

exporters:
  - gomod: go.opentelemetry.io/collector/exporter/otlpexporter v0.100.0
```

**Benefits**:
✅ Smaller binary size (50-100 MB vs 500+ MB)
✅ Reduced attack surface
✅ Only include components you actually use

---

## Processor Ordering: The Critical Path

**The order of processors in the pipeline is not arbitrary.** Incorrect ordering leads to OOM kills, wasted CPU, and data integrity issues.

### The Mandatory Order

| Order | Processor | Function | Criticality | Rationale |
|-------|-----------|----------|-------------|-----------|
| **1** | `memory_limiter` | Prevents OOM | **Critical** | Must be first. If placed later, data has already consumed heap space before the limiter checks. Placing it first enables backpressure to receivers. |
| **2** | `extensions` (auth) | Validates access | **High** | Reject unauthorized traffic immediately, before spending CPU on processing. |
| **3** | `sampling` (head) | Reduces volume | **High** | If using probabilistic sampling, do it early. Dropping 90% of traces saves CPU on subsequent processors. |
| **4** | `k8sattributes` | Enriches metadata | **Medium** | Adds context (Pod, Namespace, Node) needed for filtering and routing in later steps. Requires RBAC permissions. |
| **5** | `transform` / `filter` | Modifies/drops data | **Medium** | Apply OTTL transformations to scrub, rename, or drop specific spans/metrics. |
| **6** | `redaction` / `attributes` | Sanitizes PII | **Critical (Compliance)** | Must happen before batching or exporting to ensure sensitive data never leaves the collector. |
| **7** | `batch` | Optimizes network | **High** | Compresses data into chunks. Must be near the end. If placed before filtering, the batcher processes data that is eventually discarded. |

### Example Configuration

```yaml
processors:
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 20
  
  k8sattributes:
    auth_type: "serviceAccount"
    extract:
      metadata:
        - k8s.pod.name
        - k8s.namespace.name
        - k8s.node.name
  
  filter:
    traces:
      span:
        - 'attributes["http.target"] == "/health"'  # Drop health checks
  
  attributes:
    actions:
      - key: credit_card
        action: delete  # PII redaction
  
  batch:
    timeout: 10s
    send_batch_size: 1024

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, k8sattributes, filter, attributes, batch]
      exporters: [otlp]
```

## Component Docs & Example Configs

The OpenTelemetry Collector Contrib repository contains extended components and curated example configurations. Always verify component stability and pin to released versions.

### Contrib Stability & Registry

⚠️ **Check stability before production use**: https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/VERSIONING.md

Component stability badges:
- **Stable**: Production-ready, backward compatibility guaranteed
- **Beta**: Feature-complete, may have breaking changes
- **Alpha**: Experimental, expect breaking changes
- **Development**: Not for production use

### Component Directories (Contrib)

- **[Receivers](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver)**: Entry points for telemetry data (filelogreceiver, kafkareceiver, sqlqueryreceiver, etc.)
- **[Processors](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor)**: Transform, filter, and enrich data (transformprocessor, filterprocessor, k8sattributesprocessor, tailsamplingprocessor, etc.)
- **[Exporters](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter)**: Send data to backends (loadbalancingexporter, awsxrayexporter, googlecloudexporter, azuremonitorexporter, etc.)

Each component directory contains a README with configuration examples, stability level, and usage guidance.

### Key Contrib Components

| Component | Purpose | Stability | Link |
|-----------|---------|-----------|------|
| **transformprocessor** | Apply OTTL transformations | Stable | [Docs](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/transformprocessor) |
| **filterprocessor** | Drop spans/metrics based on conditions | Stable | [Docs](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/filterprocessor) |
| **k8sattributesprocessor** | Enrich with Kubernetes metadata | Beta | [Docs](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/k8sattributesprocessor) |
| **tailsamplingprocessor** | Intelligent sampling decisions | Beta | [Docs](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor) |
| **filelogreceiver** | Read logs from disk | Beta | [Docs](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/filelogreceiver) |
| **loadbalancingexporter** | Route to multiple backends with consistent hashing | Beta | [Docs](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/loadbalancingexporter) |

### Example Configurations

**Main examples directory**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/examples

### Pick the Right Example

Browse the [examples/ directory](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/examples) for curated collector configurations. Common use cases include:

| Use Case | Example Type | Description |
|----------|-------------|-------------|
| **Gateway with tail sampling** | Gateway deployment | Stateful sampling across traces, requires sticky sessions with loadbalancing exporter |
| **Kubernetes node agents** | Agent/DaemonSet | Lightweight per-node collectors, hostmetrics, log collection |
| **Log collection from files** | Filelog receiver | Parse and enrich logs from disk, multiline support |
| **K8s metadata enrichment** | k8sattributes processor | Add pod/namespace/node attributes to telemetry |
| **Basic debugging** | Logging exporter | Output telemetry to stdout for troubleshooting |

**Best Practice**: Pin to released tags (e.g., `v0.100.0+`) matching your collector version instead of using `main` branch. This ensures production stability and avoids unexpected breaking changes.

### Validation

- **Validate configs**: `otelcol-contrib validate --config config.yaml` to catch deprecated/invalid settings before deployment.

### Common Ordering Mistakes

❌ **Batch before filter**: Wastes memory batching data that will be dropped
❌ **Memory limiter not first**: Limiter checks after data is already in memory
❌ **Redaction after export**: Sensitive data has already left the collector
❌ **Sampling after enrichment**: Wasted CPU adding attributes to dropped spans

---

## Memory Limiter: Preventing OOM Kills

The `memory_limiter` is the **single most important processor** for collector stability.

### How It Works

1. **Check interval**: Every N seconds, the collector checks current memory usage
2. **Soft limit (spike)**: If memory exceeds `limit - spike_limit`, the collector stops accepting new data (applies backpressure)
3. **Hard limit**: If memory exceeds `limit`, the collector forces garbage collection and drops data

### Configuration

```yaml
processors:
  memory_limiter:
    check_interval: 1s           # How often to check (1s recommended)
    limit_mib: 1800              # Hard limit in MiB
    spike_limit_mib: 300         # Buffer for spikes (typically 15-20% of limit)
    limit_percentage: 80         # Alternative: percentage of total memory
    spike_limit_percentage: 20   # Alternative: spike as percentage
```

### Sizing Strategy

**For containerized deployments**:

1. **Determine container memory limit** (e.g., 2048 MiB)
2. **Reserve for OS overhead** (e.g., 200 MiB)
3. **Set limit_mib** = Container limit - Reserve = 1848 MiB
4. **Set spike_limit_mib** = 20% of limit = ~370 MiB

**Example**:

```yaml
# Kubernetes container spec
resources:
  limits:
    memory: 2Gi  # 2048 MiB

# Collector config
processors:
  memory_limiter:
    limit_mib: 1800       # 2048 - 248 (reserve)
    spike_limit_mib: 360  # 20% buffer
    check_interval: 1s
```

### Using Percentages (Recommended)

```yaml
processors:
  memory_limiter:
    limit_percentage: 80         # Use 80% of total memory
    spike_limit_percentage: 20   # 20% buffer for bursts
    check_interval: 1s
```

**Why 80%?**: Leaves headroom for Go runtime overhead, internal buffers, and JIT allocations.

### Backpressure Behavior

When the limiter triggers:
1. **Receivers stop accepting data**: gRPC receivers return `RESOURCE_EXHAUSTED` (HTTP 503)
2. **Upstream clients retry**: SDKs and agents implement exponential backoff
3. **Memory pressure decreases**: As exporters flush data, memory drops below the limit
4. **Normal operation resumes**: Receivers begin accepting data again

**Key Point**: Backpressure is **not data loss**—it's intelligent rate limiting.

### High-Throughput Tuning

For systems >10k RPS:
- Decrease `check_interval` to `500ms` for faster reaction
- Increase `spike_limit_percentage` to `25%` to handle bursts
- Monitor `otelcol_processor_refused_spans` metric

---

## Persistent Queues: Preventing Data Loss

By default, exporters use **in-memory queues**. If the backend is down and the queue fills, **data is dropped**.

### The Problem

```
Backend outage → Exporter queue fills → New data is dropped
```

### The Solution: file_storage Extension

The `file_storage` extension persists queue data to disk (Write-Ahead Log).

### Configuration

```yaml
extensions:
  file_storage:
    directory: /var/lib/otelcol/file_storage
    timeout: 1s
    compaction:
      on_start: true                    # Clean up on startup
      directory: /tmp/otel_compaction
      max_transaction_size: 65_536      # 64KB chunks

exporters:
  otlp:
    endpoint: backend.example.com:4317
    sending_queue:
      enabled: true
      num_consumers: 10
      queue_size: 5000                  # Max batches (not spans)
      storage: file_storage             # Reference to extension
    retry_on_failure:
      enabled: true
      initial_interval: 5s
      max_interval: 30s
      max_elapsed_time: 5m

service:
  extensions: [file_storage]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

### How It Works

1. **Normal operation**: Data flows through the in-memory queue
2. **Backend unavailable**: Exporter detects failure (HTTP 503, connection refused)
3. **Spill to disk**: New batches are written to `/var/lib/otelcol/file_storage`
4. **Retry logic**: Exporter retries with exponential backoff
5. **Backend recovers**: Disk data is replayed, then normal operation resumes

### Storage Requirements

The disk space required depends on:
- **Throughput**: 10k spans/sec × 1KB/span × 3600s = ~36 GB/hour
- **Downtime window**: 1-hour outage = 36 GB

**Formula**:
```
Disk Space (GB) = (Spans/sec × Span Size KB × Downtime Seconds) / 1,000,000
```

### Kubernetes Persistent Volume

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: otel-gateway-storage
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi  # Size for 1-hour buffer at 10k RPS
  storageClassName: gp3  # AWS: gp3, GCP: pd-ssd
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-gateway
spec:
  template:
    spec:
      containers:
      - name: otel-collector
        volumeMounts:
        - name: storage
          mountPath: /var/lib/otelcol
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: otel-gateway-storage
```

### Monitoring Persistent Queues

Watch these metrics:
- `otelcol_exporter_queue_size`: Current queue depth
- `otelcol_exporter_queue_capacity`: Max queue size
- `otelcol_exporter_send_failed_spans`: Failed exports (triggers disk writes)

**Alert**: `queue_size / queue_capacity > 0.8` → Backend is struggling

### Limitations

⚠️ **Disk space is not unlimited**: The collector does not enforce a hard cap on disk usage in older versions. You must:
- Size the PV correctly (e.g., 50-100 GB)
- Monitor disk usage: `df -h /var/lib/otelcol`
- Set up alerts for disk space exhaustion

---

## Batch Processor: Network Optimization

The `batch` processor is critical for reducing network overhead.

### Why Batching Matters

**Without batching**:
- 10,000 spans/sec → 10,000 HTTP requests/sec
- Backend overwhelmed with small requests
- High CPU overhead (TLS handshakes, HTTP headers)

**With batching** (batch size = 100):
- 10,000 spans/sec → 100 HTTP requests/sec
- 99% reduction in network calls

### Configuration

```yaml
processors:
  batch:
    timeout: 10s              # Max wait time before sending
    send_batch_size: 1024     # Max items per batch
    send_batch_max_size: 2048 # Hard limit (emergency flush)
```

### Tuning Parameters

| Parameter | Low Latency (Real-time) | High Throughput (Batch) |
|-----------|-------------------------|--------------------------|
| `timeout` | 1s | 30s |
| `send_batch_size` | 256 | 4096 |
| `send_batch_max_size` | 512 | 8192 |

### Trade-offs

- **Shorter timeout**: Lower latency, more network calls
- **Longer timeout**: Higher latency, fewer network calls, better compression
- **Larger batch size**: Better compression, more memory usage

### Best Practice

✅ Start with defaults: `timeout: 10s`, `send_batch_size: 1024`
✅ Monitor backend response times and adjust
✅ Always place `batch` near the end of the processor chain

---

## Extensions

Extensions provide capabilities outside the pipeline:

| Extension | Purpose | Port | Security Risk |
|-----------|---------|------|---------------|
| `health_check` | Readiness/liveness probes | 13133 | Low (bind to localhost) |
| `pprof` | CPU/memory profiling | 1777 | **High** (exposes internal state) |
| `zpages` | Live debugging UI | 55679 | **High** (exposes traces in-flight) |
| `file_storage` | Persistent queues | N/A | Low (disk I/O only) |

### Configuration

```yaml
extensions:
  health_check:
    endpoint: "localhost:13133"  # Bind to localhost in shared networks
  
  pprof:
    endpoint: "localhost:1777"   # Never bind to 0.0.0.0 in production
  
  file_storage:
    directory: /var/lib/otelcol/file_storage

service:
  extensions: [health_check, file_storage]
```

### Security Warning

⚠️ **Never expose pprof or zpages on 0.0.0.0 in production**:
- `pprof` exposes heap dumps and can trigger CPU profiling (DoS risk)
- `zpages` exposes live trace data (may contain PII)

**Best practice**:
- Bind to `localhost:PORT` and use `kubectl port-forward` for debugging
- Use Kubernetes `NetworkPolicy` to block external access

---

## Configuration Patterns

### Minimal Production Config

```yaml
extensions:
  health_check:
    endpoint: "localhost:13133"
  file_storage:
    directory: /var/lib/otelcol/file_storage

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: "0.0.0.0:4317"

processors:
  memory_limiter:
    limit_percentage: 80
    spike_limit_percentage: 20
    check_interval: 1s
  
  batch:
    timeout: 10s
    send_batch_size: 1024

exporters:
  otlp:
    endpoint: backend.example.com:4317
    sending_queue:
      enabled: true
      storage: file_storage
      queue_size: 5000
    retry_on_failure:
      enabled: true

service:
  extensions: [health_check, file_storage]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

### High-Traffic Production Config

```yaml
processors:
  memory_limiter:
    check_interval: 500ms      # Faster checks
    limit_percentage: 80
    spike_limit_percentage: 25 # Larger buffer
  
  batch:
    timeout: 30s                # Longer batching
    send_batch_size: 4096       # Larger batches
  
  filter:
    traces:
      span:
        - 'attributes["http.target"] == "/health"'
        - 'attributes["http.target"] == "/metrics"'

exporters:
  otlp:
    endpoint: backend.example.com:4317
    sending_queue:
      enabled: true
      storage: file_storage
      queue_size: 10000          # Larger queue
      num_consumers: 20          # More parallel exports
    retry_on_failure:
      enabled: true
      max_elapsed_time: 10m      # Longer retry window
```

---

## Reference Links

- **Collector Documentation**: https://opentelemetry.io/docs/collector/
- **Configuration Reference**: https://opentelemetry.io/docs/collector/configuration/
- **Component Reference**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver
- **Processor Documentation**: https://opentelemetry.io/docs/collector/transforming-telemetry/
- **OTTL Language**: https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/pkg/ottl/README.md

---

## Summary

✅ Always use `memory_limiter` as the **first processor**
✅ Always use `batch` processor near the **end** of the chain
✅ Enable `file_storage` for production to prevent data loss
✅ Check component **stability levels** before production use
✅ Use **OCB** to build custom, lean collector binaries
✅ Monitor `otelcol_exporter_send_failed_spans` for data loss
✅ Never expose `pprof` or `zpages` on `0.0.0.0`

**The collector is not just a forwarder—it's a high-performance data processing pipeline that requires careful configuration for production resilience.**
