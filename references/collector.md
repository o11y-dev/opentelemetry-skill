# OpenTelemetry Collector: Pipeline Configuration & Components

## Overview

The OpenTelemetry Collector is a vendor-agnostic telemetry pipeline that receives, processes, and exports observability data. This reference provides deep technical guidance on pipeline anatomy, processor ordering, memory management, and production stability patterns.

## Table of Contents

1. [Pipeline Anatomy](#pipeline-anatomy)
2. [Core vs Contrib Components](#core-vs-contrib-components)
3. [Processor Ordering: The Critical Path](#processor-ordering-the-critical-path)
4. [Component Docs & Example Configs](#component-docs--example-configs)
5. [Auditing Existing Collector Configurations](#auditing-existing-collector-configurations)
6. [Memory Limiter: Preventing OOM Kills](#memory-limiter-preventing-oom-kills)
7. [Persistent Queues: Preventing Data Loss](#persistent-queues-preventing-data-loss)
8. [Resiliency: Message Queues (Kafka)](#resiliency-message-queues-kafka)
9. [Batch Processor: Network Optimization](#batch-processor-network-optimization)
10. [Extensions](#extensions)
11. [Configuration Management](#configuration-management)
12. [Configuration Patterns](#configuration-patterns)

---

## Pipeline Anatomy

A collector **pipeline** consists of three stages, with an optional fourth component — **Connectors** — that bridge two pipelines:

```
Receivers → Processors → Exporters
                              ↓
                         [Connector]   ← acts as Exporter on source pipeline
                              ↓
                         [Connector]   ← acts as Receiver on destination pipeline
                              ↓
Receivers → Processors → Exporters
```

For simple single-pipeline flows:

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
  - **⚠️ Stateful Processor Note**: Stateful processors like `tail_sampling` and `spanmetrics` require sticky routing (routing all spans of a trace to the same collector instance). Pair with `loadbalancing` exporter using deterministic routing keys (e.g., `traceID`) to preserve stickiness.
- `attributes`: Adds/removes/hashes attributes
- `resource`: Modifies resource attributes

### Exporters

**Exporters** send data to backends.

Common exporters:
- `otlp`: Exports to OTLP-compatible backends
- `prometheus`: Exposes metrics for Prometheus scraping
- `jaeger`: Exports to Jaeger (legacy)
- `loadbalancing`: Routes to multiple backends with consistent hashing
  - **⚠️ Routing Key Requirement**: The `routing_key` must be a stable, deterministic string (e.g., `traceID`, `tenant_id`, `cluster`). Convert non-string routing attributes to normalized strings before hashing to avoid shard churn and ensure even load distribution.
- `logging`: Outputs to stdout (debug only)
- `file`: Writes to disk (debug only)

### Connectors

**Connectors** bridge two pipelines by acting simultaneously as an exporter on the source pipeline and a receiver on the destination pipeline. They enable cross-pipeline signal routing and aggregation (e.g., generating metrics from traces) without external tools.

Key connectors:
- `spanmetrics`: Generates R.E.D. metrics (Rate, Errors, Duration) from trace spans — **Beta**
- `servicegraph`: Builds service dependency graph metrics from traces — **Beta**
- `routing`: Routes signals to different pipelines based on attribute values — **Alpha**
- `failover`: Automatic failover between pipelines on errors — **Alpha**
- `count`: Counts signals as metrics — **Alpha**
- `signaltometrics`: Converts any signal to metrics via OTTL expressions — **Alpha**

See [connectors.md](connectors.md) for full configuration examples and patterns.

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
  - gomod: go.opentelemetry.io/collector/receiver/otlpreceiver v0.151.0
  - gomod: github.com/open-telemetry/opentelemetry-collector-contrib/receiver/filelogreceiver v0.151.0

processors:
  - gomod: go.opentelemetry.io/collector/processor/batchprocessor v0.151.0
  - gomod: go.opentelemetry.io/collector/processor/memorylimiterprocessor v0.151.0
  - gomod: github.com/open-telemetry/opentelemetry-collector-contrib/processor/k8sattributesprocessor v0.151.0

exporters:
  - gomod: go.opentelemetry.io/collector/exporter/otlpexporter v0.151.0
```

**Benefits**:
✅ Smaller binary size (50-100 MB vs 500+ MB)
✅ Reduced attack surface
✅ Only include components you actually use

### ⚠️ Minimum Go Version: Go 1.25 (Breaking Change in v0.146.0)

Starting with Collector **v0.146.0** (released February 2025), the minimum required Go version is **Go 1.25**. This is a breaking change for any custom collector builds or OCB-based distributions compiled with an older Go toolchain. Upgrade your Go toolchain to 1.25+ before building or upgrading to v0.146.0+.

Reference: [Collector v0.146.0 release notes](https://github.com/open-telemetry/opentelemetry-collector/releases/tag/v0.146.0)

### `cmd/builder` — New `init` Subcommand (Experimental)

The `cmd/builder` (OCB) tool introduced an experimental **`init` subcommand** in v0.146.0 that scaffolds a new custom collector project with a starter `builder-config.yaml` and directory structure:

```bash
ocb init --output-path ./my-collector
```

This is useful for bootstrapping a new custom distribution without manually writing configuration from scratch.

### ⚠️ `cmd/builder` — Relative Paths in Generated Go Modules (Breaking Change in v0.151.0)

Starting with **v0.151.0**, the `cmd/builder` (OCB) tool generates `replace` statements in the Go module with **relative paths by default** (previously absolute). This change allows the generated collector source to be tracked as a portable artifact and built on any machine.

**If you rely on absolute paths** in generated `replace` statements, set the new flag in your builder config:

```yaml
dist:
  use_absolute_replace_paths: true
```

Reference: [Collector v0.151.0 release notes](https://github.com/open-telemetry/opentelemetry-collector/releases/tag/v0.151.0)

### Declarative `service.telemetry.resource` Configuration (v0.151.0+)

Starting with **v0.151.0**, the `service.telemetry.resource` section accepts a declarative schema with explicit name/value pairs and an optional `schema_url`:

```yaml
service:
  telemetry:
    resource:
      schema_url: https://opentelemetry.io/schemas/1.38.0
      attributes:
        - name: service.name
          value: my-collector
        - name: host.name
          value: collector-host
```

The legacy inline attribute map format is still supported for backward compatibility:

```yaml
service:
  telemetry:
    resource:
      service.name: my-collector
      host.name: collector-host
```

> **Note**: `resource.detectors` is accepted for forward compatibility in v0.151.0 but is not yet applied by the collector.

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
        - 'attributes["url.path"] == "/health"'  # Drop health checks
  
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
| **pprofreceiver** | Receive pprof-formatted profiles | Alpha | [Docs](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/pprofreceiver) |
| **loadbalancingexporter** | Route to multiple backends with consistent hashing | Beta | [Docs](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/loadbalancingexporter) |
| **resourcedetectionprocessor** | Detect and attach resource attributes (cloud, host, K8s) | Beta | [Docs](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/resourcedetectionprocessor) |
| **prometheusremotewriteexporter** | Export metrics via Prometheus Remote Write | Beta | [Docs](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/prometheusremotewriteexporter) |

> ⚠️ **Prometheus Remote Write — InstrumentationScope attributes not exported**: The `prometheusremotewriteexporter` does **not** include `otel.scope.name` / `otel.scope.version` as Prometheus labels by default ([#45266](https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/45266)). If downstream consumers need to distinguish metrics by instrumentation scope, use the native `otlpexporter` instead, or enrich the metric resource/data-point attributes before export using a `transform` processor.
>
> ⚠️ **Profiles signal is public Alpha**: OpenTelemetry Profiles entered public Alpha in Collector `v0.148.0+`. Use it for evaluation and early integration work, not critical production commitments yet. The current practical path is the `pprofreceiver` plus normal collector enrichment/transform processors (for example, `k8sattributes` and OTTL), and you should verify that your backend can ingest OTLP Profiles before standardizing on it.

### Example Configurations

**Main examples directory**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/examples

### Pick the Right Example

Browse the [examples/ directory](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/examples) for curated collector configurations. Common use cases include:

| Use Case | Example Type | Description |
|----------|-------------|-------------|
| **Gateway with tail sampling** | Gateway deployment | Stateful sampling across traces, requires consistent routing (e.g., via loadbalancing exporter) |
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

## Auditing Existing Collector Configurations

When reviewing an existing collector config or Helm values file, do more than syntax validation. Most production failures come from **cross-field contradictions** that still parse successfully.

### Review Checklist

| Check | What to compare | Why it matters |
|-------|-----------------|----------------|
| **Processor chain** | `memory_limiter` first, `batch` near the end, every declared processor referenced by a pipeline | Correct ordering prevents OOMs and wasted work; unreferenced processors create dead config that misleads reviewers |
| **Memory envelope** | `memory_limiter.limit_mib` / `limit_percentage` vs container memory limit | A limiter above the pod limit cannot protect the collector from cgroup OOM kills |
| **Stateful processing** | `tail_sampling`, `spanmetrics`, `servicegraph` vs replica count/HPA and routing | Stateful processors break when traces/related spans are split across replicas |
| **Metric temporality/state** | `deltatocumulative`, `cumulativetodelta`, source temporality, backend expectation, and replica/restart behavior | Temporality conversion is stateful; restarts or non-sticky routing can create resets or incorrect cumulative series |
| **Exporter durability** | `retry_on_failure`, `sending_queue`, `file_storage`, and stated outage tolerance | No retry + no queue means guaranteed loss during backend or network faults |
| **Queue storage backend** | `file_storage` access mode, storage class, and whether the filesystem is local vs RWX/networked | Persistent queues need locking-safe local block storage; EFS/NFS/RWX can corrupt or stall queue state |
| **OTTL/filter correctness** | Attribute names, types, nil guards, and regex use | Real-world breakages often come from bool-vs-string mismatches or stale semantic convention keys |
| **Kubernetes rollout consistency** | `replicaCount`, HPA `minReplicas`, PodDisruptionBudget, `maxUnavailable`, and `hostPort` usage | Valid YAML can still be unschedulable, non-evictable, or incompatible with scaled Deployments |

### Common Audit Findings

#### 1. Memory limiter larger than the pod limit

```yaml
# Bad: collector will hit the container limit first
resources:
  limits:
    memory: 666Mi

processors:
  memory_limiter:
    limit_mib: 1500
    spike_limit_mib: 512
```

```yaml
# Better: leave runtime headroom and let the limiter trigger first
resources:
  limits:
    memory: 2Gi

processors:
  memory_limiter:
    limit_percentage: 80
    spike_limit_percentage: 20
```

**Rule**: Keep the limiter below the pod limit and reserve roughly 15-30% for Go runtime overhead, queues, and transient buffers.

#### 2. Tail sampling on scaled gateways without sticky routing

If a Deployment can scale above one replica, a regular ClusterIP Service is **not enough** for `tail_sampling`. You need an upstream `loadbalancing` exporter with `routing_key: traceID` and a Headless Service for the gateway tier. Otherwise traces fragment across pods and sampling decisions are wrong.

#### 3. Retry disabled and no durable queue

If `retry_on_failure.enabled: false` and there is no `sending_queue` backed by `file_storage`, the collector will drop data whenever the backend is unavailable. Treat this as an explicit durability trade-off that needs confirmation, not as a neutral default.

#### 4. OTTL/filter type mismatches

```yaml
# Bad: writes a boolean, later treats it as a regex target string
transform/flag:
  trace_statements:
    - context: span
      statements:
        - set(attributes["is_error"], true) where attributes["http.response.status_code"] >= 400

filter/drop:
  traces:
    span:
      - not IsMatch(attributes["is_error"], "true")
```

```yaml
# Better: compare booleans as booleans
filter/drop:
  traces:
    span:
      - attributes["is_error"] != true
```

Also prefer current semantic convention keys such as `http.response.status_code` over legacy ad hoc names like `http.status_code`.

#### 5. Metric temporality conversion without a state plan

```yaml
processors:
  deltatocumulative:
    max_stale: 1m

service:
  pipelines:
    metrics:
      processors: [deltatocumulative, batch]

autoscaling:
  enabled: true
  maxReplicas: 6
```

`deltatocumulative` and `cumulativetodelta` keep per-timeseries state in memory. On restart, scale-out, or whenever a timeseries lands on a different replica, the converted series can reset or become inconsistent. Only use them when:

- the source temporality is known,
- the backend expectation is known,
- and the routing/restart behavior makes the reset semantics acceptable.

On generic OTLP gateway tiers, prefer matching source temporality to backend expectations instead of converting in the middle unless you have a clear reason to do otherwise.

#### 6. `file_storage` on RWX or network filesystems

A queue is not "durable" just because it writes to disk. The `file_storage` extension uses bbolt and needs local locking-safe storage. In Kubernetes, treat these as audit findings:

- `ReadWriteMany` PVCs
- EFS / NFS / SMB / CephFS-backed storage classes
- designs that imply multiple pods share the same queue directory

Prefer per-replica `ReadWriteOnce` block volumes. See the filesystem compatibility notes in [Persistent Queues: Preventing Data Loss](#persistent-queues-preventing-data-loss).

#### 7. Dead config

A processor/exporter/extension that is declared but unused is not harmless documentation. It creates false confidence during reviews because operators assume the behavior is active. During audits, verify every named component appears in at least one pipeline or `service.extensions`.

### Audit Questions to Ask Explicitly

1. Is data loss during backend outages acceptable here?
2. Can this collector ever run more than one replica?
3. What is the actual pod memory limit, and does the limiter stay below it?
4. Is `hostPort` intentionally required for node-local traffic, or is a normal Service sufficient?
5. Are the transform/filter expressions using the same attribute names and types end-to-end?
6. Are temporality-conversion processors (`deltatocumulative` / `cumulativetodelta`) actually required, and can their per-timeseries state survive this routing/scaling model?
7. Is `file_storage` backed by a local block volume (`ReadWriteOnce`), not RWX/network storage?

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

⚠️ **Never set `limit_mib` above the pod/container memory limit.** If the cgroup limit is lower than the memory limiter threshold, Kubernetes kills the process before the collector can apply backpressure or forced GC.

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
      on_rebound: false                 # ⚠️ Keep false — bbolt v1.4.3 nil pointer crash risk (otelcol-contrib#46489)
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

### `otelcol_exporter_send_failed` — Error Detail Attributes (v0.146.0+)

When telemetry level is set to `Detailed`, the `otelcol_exporter_send_failed` metrics now include two additional attributes:

- **`error.type`**: The class of error (e.g., network timeout, HTTP 5xx, connection refused), useful for routing alerts to the right on-call team.
- **`error.permanent`**: Boolean indicating whether the failure is permanent (no retry will succeed) vs transient (retry may recover).

This allows operators to distinguish **transient export failures** (backend temporarily unavailable — safe to retry) from **permanent failures** (data format or auth errors — retrying wastes resources).

```yaml
service:
  telemetry:
    metrics:
      level: Detailed
```

### Limitations

⚠️ **Disk space is not unlimited**: The collector does not enforce a hard cap on disk usage in older versions. You must:
- Size the PV correctly (e.g., 50-100 GB)
- Monitor disk usage: `df -h /var/lib/otelcol`
- Set up alerts for disk space exhaustion

### ⚠️ Filesystem Compatibility: Critical Storage Backend Requirements

The `file_storage` extension uses [bbolt](https://github.com/etcd-io/bbolt) (`go.etcd.io/bbolt`) as its storage engine. bbolt relies on `mmap()` for memory-mapped I/O and POSIX `flock()` for exclusive file locking. These kernel-level primitives have strict filesystem requirements that are **NOT met** by network or distributed filesystems. Using an incompatible filesystem can result in **silent data corruption**, crashes (SIGBUS/SIGSEGV), or split-brain locking failures with no error messages.

#### Compatibility Matrix

| Filesystem | Type | mmap Support | flock Support | Verdict |
|---|---|---|---|---|
| ext4 / xfs | Local | Full | Full | ✅ Supported |
| AWS EBS (gp3/io2) | Block device | Full | Full | ✅ Supported |
| GCP Persistent Disk | Block device | Full | Full | ✅ Supported |
| Azure Managed Disk | Block device | Full | Full | ✅ Supported |
| AWS EFS | NFS v4.1 | Partial | Advisory only | ❌ NOT Supported — risk of silent corruption |
| NFS v3/v4 | Network | Partial | Advisory only | ❌ NOT Supported — flock is advisory, not mandatory |
| SMB/CIFS | Network | Partial | No | ❌ NOT Supported |
| GlusterFS | Distributed | Partial | Varies | ❌ NOT Supported |
| CephFS | Distributed | Partial | Varies | ⚠️ Not recommended |

#### Known Upstream Issues

- [bbolt#71](https://github.com/etcd-io/bbolt/issues/71) — SIGBUS/SIGSEGV on mmap errors
- [bbolt#562](https://github.com/etcd-io/bbolt/issues/562) — ext4 fast-commit corruption on Linux 5.10–5.15
- [otelcol-contrib#35899](https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/35899) — file_storage does not recover gracefully from corruption
- [otelcol-contrib#46489](https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/46489) — Nil pointer crash when bbolt reopen fails during `on_rebound` compaction (bbolt v1.4.3, affects `file_storage` users with `compaction.on_rebound: true`)
- The bbolt README explicitly warns: "Bolt uses an exclusive write lock on the database file so it cannot be shared by multiple processes"

#### Kubernetes Volume Guidance

⚠️ **`accessModes: ReadWriteMany` (RWX) volumes almost always imply a network filesystem and MUST NOT be used with `file_storage`.** `ReadWriteOnce` (RWO) backed by a block device (EBS gp3, GCP pd-ssd, Azure Managed Disk) is the only supported configuration.

```yaml
spec:
  accessModes:
    - ReadWriteOnce        # RWX (ReadWriteMany) is NOT safe — implies NFS/EFS
  storageClassName: gp3   # AWS EBS gp3; use pd-ssd (GCP) or managed-premium (Azure)
  resources:
    requests:
      storage: 50Gi
```

#### ext4 Fast-Commit Warning

Linux kernel versions 5.10–5.15 with ext4 fast-commit enabled can corrupt bbolt databases. Fixes were backported to 5.10.94+, 5.15.17+, 5.15.27+, and are included in 5.17+. If you are running a kernel in this range, verify your kernel patch level or disable fast-commit (`tune2fs -O ^fast_commit /dev/...`). See the [bbolt README Known Issues](https://github.com/etcd-io/bbolt#known-issues) section.

#### bbolt v1.4.3 — on_rebound Compaction Crash Risk

bbolt **v1.4.3** has a known nil pointer panic when a database reopen fails during `on_rebound` compaction. This manifests as a collector crash (not a graceful shutdown) when the storage file becomes transiently unavailable at compaction time.

**Mitigation**: Do **not** set `compaction.on_rebound: true` in `file_storage` until this is resolved upstream. Use `on_start: true` only:

```yaml
extensions:
  file_storage:
    directory: /var/lib/otelcol/file_storage
    timeout: 1s
    compaction:
      on_start: true     # ✅ Safe
      on_rebound: false  # ⚠️ Avoid with bbolt v1.4.3 — risk of nil pointer crash
      directory: /tmp/otel_compaction
```

Track upstream fix: [otelcol-contrib#46489](https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/46489)

Upgrading to **bbolt v1.4.3** does **not** relax the mmap/flock filesystem requirements above. Keep using local block-backed volumes (ext4/xfs, EBS, PD, Managed Disk) and avoid NFS/EFS/SMB/CephFS for `file_storage`, even on the latest bbolt release.

#### bbolt Security Advisory Watch (GO-2026-4923 / CVE-2026-33817)

The bbolt maintainers are tracking a security fix release request in [bbolt#1187](https://github.com/etcd-io/bbolt/issues/1187). Until a patched bbolt line is published and adopted by the collector distribution you run:

- Keep collectors and node OS images on the latest patched builds from your vendor
- Restrict `file_storage` directory permissions to the collector user (`0700`) and avoid hostPath sharing
- Keep regular backups/snapshots for stateful collector volumes so corruption or compromise is recoverable

When the upstream patch lands, prefer collector builds that vendor the fixed bbolt version and remove temporary exception handling only after validation in staging.

---

## Resiliency: Message Queues (Kafka)

The OTel resiliency model has three tiers:

1. **Sending Queue** — in-memory buffer (covered by `sending_queue`)
2. **Persistent Storage/WAL** — disk-based durability (covered by `file_storage`)
3. **Message Queue** — durable broker between collector tiers (Kafka)

Kafka as a durability layer is the standard pattern for **cross-AZ, cross-region, or high-throughput** deployments where disk-based WAL is insufficient.

### When to Use Kafka

| Scenario | Recommended Tier | Reason |
|----------|-----------------|--------|
| Single-region, short outages (<1h) | file_storage (Tier 2) | Simpler, lower ops overhead |
| Cross-AZ or cross-region hops | Kafka (Tier 3) | Survives collector crashes, node failures |
| Multi-datacenter fan-in | Kafka (Tier 3) | Decouples producer and consumer tiers |
| Throughput >50k spans/sec | Kafka (Tier 3) | Disk I/O limits on single-node WAL |
| Compliance / long retention (>24h) | Kafka (Tier 3) | Configurable topic retention |

### Architecture: Agent → Kafka → Gateway

```
[App] → [OTel Agent] → [Kafka Topic: otel.traces] → [OTel Gateway] → [Backend]
```

This decouples the ingest tier (agents) from the processing tier (gateways), enabling independent scaling and fault isolation.

### Agent Configuration (Kafka Exporter)

```yaml
exporters:
  kafka:
    brokers:
      - kafka-broker-1.example.com:9092
      - kafka-broker-2.example.com:9092
    topic: otel.traces          # dedicated topic per signal type
    encoding: otlp_proto        # use OTLP binary encoding (recommended)
    producer:
      compression: snappy       # good balance of speed and ratio
      required_acks: wait_for_all  # durability: all ISR replicas must ack
      max_message_bytes: 1000000   # 1 MB max message size
    auth:
      sasl:
        username: ${env:KAFKA_USERNAME}
        password: ${env:KAFKA_PASSWORD}
        mechanism: SCRAM-SHA-512
      tls:
        insecure: false
    retry_on_failure:
      enabled: true
      initial_interval: 5s
      max_elapsed_time: 5m
    sending_queue:
      enabled: true
      queue_size: 5000

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [kafka]
```

### Gateway Configuration (Kafka Receiver)

```yaml
receivers:
  kafka:
    brokers:
      - kafka-broker-1.example.com:9092
      - kafka-broker-2.example.com:9092
    topic: otel.traces
    group_id: otel-gateway-consumer-group  # enables consumer group parallelism
    encoding: otlp_proto
    auth:
      sasl:
        username: ${env:KAFKA_USERNAME}
        password: ${env:KAFKA_PASSWORD}
        mechanism: SCRAM-SHA-512
      tls:
        insecure: false
    initial_offset: latest          # or "earliest" for replay

exporters:
  otlp:
    endpoint: backend.example.com:4317
    sending_queue:
      enabled: true
      storage: file_storage         # Tier 2 as backup within the gateway
      queue_size: 10000

service:
  extensions: [file_storage]
  pipelines:
    traces:
      receivers: [kafka]
      processors: [memory_limiter, k8sattributes, tail_sampling, batch]
      exporters: [otlp]
```

### Kafka Topic Configuration (Recommended)

```bash
# Create topics with appropriate retention and replication
kafka-topics.sh --create \
  --bootstrap-server kafka:9092 \
  --topic otel.traces \
  --partitions 12 \               # scale with gateway replicas
  --replication-factor 3 \        # 3 replicas for HA
  --config retention.ms=86400000 \ # 24-hour retention
  --config compression.type=snappy

kafka-topics.sh --create --bootstrap-server kafka:9092 \
  --topic otel.metrics --partitions 6 --replication-factor 3

kafka-topics.sh --create --bootstrap-server kafka:9092 \
  --topic otel.logs --partitions 12 --replication-factor 3
```

### Scaling: Partitions ↔ Consumer Parallelism

Each Kafka partition is consumed by **one gateway replica** at a time. Scale partitions to match your gateway replica count:

```
Partitions ≥ Max Gateway Replicas
```

**Example**: 3 gateway replicas → at least 3 partitions per topic.

### ⚠️ Encoding Warning

Always use `encoding: otlp_proto` (binary OTLP) rather than `otlp_json` for production. JSON encoding is 3-5× larger and significantly slower to parse.

### Stability

| Component | Stability |
|-----------|-----------|
| `kafkaexporter` | Beta |
| `kafkareceiver` | Beta |

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

> 📋 **Emerging specification — max batch size for push metrics exporters**: The OpenTelemetry specification has an active proposal ([#4852](https://github.com/open-telemetry/opentelemetry-specification/issues/4852)) to introduce a standardized `max_batch_size` configuration at the **metrics exporter** level (OTLP push exporters), independently of the `batch` processor. When stabilized, this will allow backends to enforce per-export request size limits without requiring a shared pipeline-level batch processor. Until then, use `send_batch_max_size` in the `batch` processor or `max_size_items` in the exporter's `sending_queue.batch` (v0.147.0+) to cap request sizes.

---

## Extensions

Extensions provide capabilities outside the pipeline:

| Extension | Purpose | Port | Security Risk |
|-----------|---------|------|---------------|
| `health_check` | Readiness/liveness probes | 13133 | Low (bind to localhost) |
| `pprof` | CPU/memory profiling | 1777 | **High** (exposes internal state) |
| `zpages` | Live debugging UI | 55679 | **High** (exposes traces in-flight) |
| `file_storage` | Persistent queues | N/A | Low (disk I/O only) |

### Debug Exporter — `output_paths` Configuration

The `debug` exporter (replacement for the deprecated `logging` exporter) now supports an `output_paths` configuration option, allowing output to be directed to one or more file paths in addition to stdout. This is useful for capturing debug output to a file without redirecting the entire collector process:

```yaml
exporters:
  debug:
    verbosity: detailed
    output_paths:
      - stdout
      - /tmp/otelcol-debug.log
```

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

## Configuration Management

Modern collector deployments use several configuration features that simplify operations and improve security.

### Multi-File Configuration Merging

Split large configurations across multiple files and merge them at startup:

```bash
# Merge base config with environment-specific overrides
otelcol --config=file:base.yaml --config=file:env-prod.yaml

# Or use glob patterns
otelcol --config=file:/etc/otelcol/base.yaml --config=file:/etc/otelcol/conf.d/*.yaml
```

**Merge rules**: Later files override earlier ones for scalar values; maps are deep-merged.

**Use case**: Separate base pipeline config from per-environment exporter endpoints, credentials, or sampling rates.

```yaml
# base.yaml — pipeline structure (shared across all environments)
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

# env-prod.yaml — production-specific overrides
exporters:
  otlp:
    endpoint: prod-backend.example.com:4317
    tls:
      insecure: false
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

### Environment Variable Syntax with Defaults

Use the `${env:VAR:-default}` syntax to provide fallback values when environment variables are not set:

```yaml
exporters:
  otlp:
    endpoint: ${env:OTLP_ENDPOINT:-localhost:4317}   # fallback to localhost
    headers:
      authorization: "Bearer ${env:OTLP_TOKEN:-}"    # empty string if unset

processors:
  memory_limiter:
    limit_mib: ${env:MEMORY_LIMIT_MIB:-1800}
    spike_limit_mib: ${env:MEMORY_SPIKE_MIB:-360}
    check_interval: 1s
```

⚠️ **Use `${env:VAR}` (not `$VAR` or `${VAR}`)** — the `env:` prefix is required in all collector versions v0.84.0+. The legacy `$VAR` syntax is deprecated. The `:-default` fallback syntax (e.g., `${env:VAR:-default}`) is supported since v0.84.0.

### Inline Exporter Batching (`sending_queue: batch:`)

In v0.147.0+, the exporter's `sending_queue` supports an inline `batch` sub-configuration that controls how items are batched before being placed in the queue — separate from the `batch` processor:

```yaml
exporters:
  otlp:
    endpoint: backend.example.com:4317
    sending_queue:
      enabled: true
      storage: file_storage
      queue_size: 5000
      batch:
        flush_timeout: 200ms        # max wait before sending
        min_size_items: 100         # target batch size (items)
        max_size_items: 500         # hard limit per send
```

This is useful when you want per-exporter batching behavior without adding a shared `batch` processor (e.g., different backends have different optimal batch sizes).

### Diagnostic Commands

The `otelcol` binary provides built-in commands for debugging and validation:

```bash
# List all available components in the current binary
otelcol components

# Validate a configuration file (catch syntax/semantic errors before deploy)
otelcol validate --config=file:config.yaml

# Print the effective merged configuration (useful for debugging multi-file merges)
otelcol print-config --config=file:base.yaml --config=file:env-prod.yaml
```

**Best Practice**: Always run `otelcol validate` in CI before deploying configuration changes to production.

```yaml
# In Kubernetes init container or pre-deploy step
initContainers:
- name: validate-config
  image: otel/opentelemetry-collector-contrib:0.147.0
  command: ["otelcol-contrib", "validate", "--config=/etc/otelcol/config.yaml"]
  volumeMounts:
  - name: config
    mountPath: /etc/otelcol
```

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
        - 'attributes["url.path"] == "/health"'
        - 'attributes["url.path"] == "/metrics"'

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
- **Connectors Documentation**: https://opentelemetry.io/docs/collector/configuration/#connectors
- **Component Reference**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver
- **Processor Documentation**: https://opentelemetry.io/docs/collector/transforming-telemetry/
- **OTTL Language**: https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/pkg/ottl/README.md
- **Kafka Receiver**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/kafkareceiver
- **Kafka Exporter**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/kafkaexporter

---

## Summary

✅ Always use `memory_limiter` as the **first processor**
✅ Always use `batch` processor near the **end** of the chain
✅ Enable `file_storage` for production to prevent data loss
✅ Use **Kafka** (Tier 3) for cross-AZ/cross-region durability at scale
✅ Use **Connectors** for span-to-metrics and cross-pipeline routing (see [connectors.md](connectors.md))
✅ Use **multi-file config merging** to separate base config from environment overrides
✅ Use `${env:VAR:-default}` syntax for environment variable defaults
✅ Run `otelcol validate` in CI before deploying configuration changes
✅ Check component **stability levels** before production use
✅ Use **OCB** to build custom, lean collector binaries
✅ Monitor `otelcol_exporter_send_failed_spans` for data loss
✅ Never expose `pprof` or `zpages` on `0.0.0.0`

**The collector is not just a forwarder—it's a high-performance data processing pipeline that requires careful configuration for production resilience.**
