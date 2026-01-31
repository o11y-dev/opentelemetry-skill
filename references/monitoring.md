# OpenTelemetry Collector Meta-Monitoring

## Overview

"Who watches the watchers?" Meta-monitoring is the practice of observing the observability pipeline itself. A failing collector can silently drop data, creating blind spots in production systems. This reference provides comprehensive guidance on collector self-monitoring, health checks, and alerting patterns.

## Table of Contents

1. [Why Meta-Monitoring?](#why-meta-monitoring)
2. [Collector Telemetry](#collector-telemetry)
3. [Critical Metrics](#critical-metrics)
4. [Health Checks](#health-checks)
5. [Dashboards](#dashboards)
6. [Alert Rules](#alert-rules)

---

## Why Meta-Monitoring?

### The Silent Failure Problem

**Scenario**: Your collector is silently dropping 50% of traces due to memory pressure.

**Impact**:
- ❌ Missing spans in distributed traces
- ❌ Incorrect latency percentiles (p95, p99)
- ❌ Undetected errors
- ❌ False confidence in system health

**Solution**: Monitor the collector's internal metrics to detect issues **before** data loss becomes critical.

### What to Monitor

| Category | Metrics | Purpose |
|----------|---------|---------|
| **Throughput** | Accepted vs sent spans/metrics/logs | Data flow verification |
| **Data Loss** | Refused, dropped, failed exports | Detect backpressure and failures |
| **Resources** | CPU, memory, disk usage | Prevent OOM kills |
| **Queue Health** | Queue size vs capacity | Predict saturation |
| **Export Performance** | Export latency, retry count | Backend health |

---

## Collector Telemetry

The collector exposes internal metrics on port **8888** (default).

### Enabling Telemetry

```yaml
service:
  telemetry:
    logs:
      level: info  # Options: debug, info, warn, error
    
    metrics:
      level: detailed  # Options: none, basic, normal, detailed
      address: "0.0.0.0:8888"  # Prometheus scrape endpoint
```

### Scraping Collector Metrics

**Prometheus scrape config**:

```yaml
scrape_configs:
  - job_name: 'otel-collector'
    static_configs:
      - targets: ['otel-collector:8888']
    
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
```

**Kubernetes ServiceMonitor (with Prometheus Operator)**:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: otel-collector
  namespace: observability
spec:
  selector:
    matchLabels:
      app: otel-collector
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

---

## Critical Metrics

### Metric Naming Convention

All collector metrics follow the pattern:
```
otelcol_{component}_{signal}_{metric}
```

**Examples**:
- `otelcol_receiver_accepted_spans`
- `otelcol_processor_dropped_metric_points`
- `otelcol_exporter_send_failed_log_records`

### Golden Signals for Collectors

#### 1. Throughput (Data Flow)

**Metrics**:
```promql
# Traces
otelcol_receiver_accepted_spans
otelcol_exporter_sent_spans

# Metrics
otelcol_receiver_accepted_metric_points
otelcol_exporter_sent_metric_points

# Logs
otelcol_receiver_accepted_log_records
otelcol_exporter_sent_log_records
```

**Query** (spans/second):
```promql
rate(otelcol_receiver_accepted_spans[1m])
rate(otelcol_exporter_sent_spans[1m])
```

**What to look for**:
- ✅ Accepted ≈ Sent → Healthy pipeline
- ⚠️ Accepted > Sent → Backpressure, queue filling
- ❌ Accepted >> Sent → Data loss

#### 2. Data Loss (Errors)

**Metrics**:
```promql
# Refused by receiver (backpressure)
otelcol_receiver_refused_spans

# Dropped by processor (filter/sampling)
otelcol_processor_dropped_spans

# Failed exports
otelcol_exporter_send_failed_spans
```

**Query** (dropped percentage):
```promql
100 * (
  rate(otelcol_processor_dropped_spans[1m]) +
  rate(otelcol_exporter_send_failed_spans[1m])
) / rate(otelcol_receiver_accepted_spans[1m])
```

**Alert threshold**: > 1% data loss

#### 3. Resource Usage

**Metrics**:
```promql
# Memory
otelcol_process_memory_rss  # Resident Set Size (actual RAM usage)

# CPU
rate(otelcol_process_cpu_seconds_total[1m])

# Goroutines (Go runtime)
otelcol_process_runtime_total_alloc_bytes
```

**Query** (memory usage percentage):
```promql
100 * otelcol_process_memory_rss / node_memory_MemTotal_bytes
```

**Alert threshold**: > 80% of container limit

#### 4. Queue Health

**Metrics**:
```promql
# Current queue size
otelcol_exporter_queue_size

# Max queue capacity
otelcol_exporter_queue_capacity
```

**Query** (queue saturation percentage):
```promql
100 * otelcol_exporter_queue_size / otelcol_exporter_queue_capacity
```

**Alert threshold**: > 80% full

#### 5. Export Performance

**Metrics**:
```promql
# Export latency
otelcol_exporter_send_failed_metric_points

# Retry count
otelcol_exporter_enqueue_failed_spans
```

**Query** (export failure rate):
```promql
rate(otelcol_exporter_send_failed_spans[1m])
```

**Alert threshold**: > 0 (any failures)

---

## Health Checks

### Health Check Extension

The `health_check` extension provides HTTP endpoints for Kubernetes probes.

**Configuration**:

```yaml
extensions:
  health_check:
    endpoint: "0.0.0.0:13133"
    tls:
      ca_file: ""
      cert_file: ""
      key_file: ""
    path: "/"
    check_collector_pipeline:
      enabled: true
      interval: "5m"
      exporter_failure_threshold: 5

service:
  extensions: [health_check]
```

### Kubernetes Probes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-collector
spec:
  template:
    spec:
      containers:
      - name: otel-collector
        ports:
        - containerPort: 13133
          name: health
        
        livenessProbe:
          httpGet:
            path: /
            port: 13133
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /
            port: 13133
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
```

### Health Check Responses

**Healthy**:
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "Server available",
  "uptime": "3h45m12s",
  "uptime_ns": 13512000000000
}
```

**Unhealthy** (exporter failing):
```
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "status": "Server unavailable",
  "error": "exporters: otlp: failed to send data: connection refused"
}
```

---

## Dashboards

### monitoringartist Dashboards

The community-standard dashboards for OpenTelemetry Collector monitoring:

**Repository**: [monitoringartist/opentelemetry-collector-monitoring](https://github.com/monitoringartist/opentelemetry-collector-monitoring)

**Grafana Dashboard ID**: 15983

**Import**:
```bash
# Via Grafana UI
Dashboard → Import → ID: 15983

# Via ConfigMap
kubectl create configmap otel-collector-dashboard \
  --from-file=dashboard.json \
  -n observability
```

### Key Dashboard Panels

#### 1. Throughput Panel

**Query**:
```promql
sum(rate(otelcol_receiver_accepted_spans[1m])) by (receiver)
sum(rate(otelcol_exporter_sent_spans[1m])) by (exporter)
```

**Visualization**: Line graph
**Purpose**: Verify data is flowing through the pipeline

#### 2. Data Loss Panel

**Query**:
```promql
sum(rate(otelcol_processor_dropped_spans[1m])) by (processor)
sum(rate(otelcol_exporter_send_failed_spans[1m])) by (exporter)
```

**Visualization**: Stacked area chart
**Purpose**: Identify sources of data loss

#### 3. Memory Usage Panel

**Query**:
```promql
otelcol_process_memory_rss / 1024 / 1024  # Convert to MB
```

**Visualization**: Gauge + Line graph
**Purpose**: Detect memory leaks or approaching OOM

#### 4. Queue Saturation Panel

**Query**:
```promql
100 * otelcol_exporter_queue_size / otelcol_exporter_queue_capacity
```

**Visualization**: Gauge (thresholds: 50% yellow, 80% red)
**Purpose**: Predict queue overflow

#### 5. Export Latency Panel

**Query**:
```promql
histogram_quantile(0.99, rate(otelcol_exporter_send_latency_bucket[1m]))
```

**Visualization**: Heatmap
**Purpose**: Detect backend slowness

---

## Alert Rules

### Prometheus Alerting Rules

```yaml
groups:
  - name: otel-collector
    interval: 30s
    rules:
      # Data loss alert
      - alert: OTelCollectorDataLoss
        expr: |
          rate(otelcol_exporter_send_failed_spans[1m]) > 0
        for: 5m
        labels:
          severity: critical
          component: otel-collector
        annotations:
          summary: "OpenTelemetry Collector is dropping data"
          description: "Collector {{ $labels.instance }} has failed to export {{ $value }} spans/second for 5 minutes."
      
      # High memory usage
      - alert: OTelCollectorHighMemory
        expr: |
          100 * otelcol_process_memory_rss / 
          (container_spec_memory_limit_bytes{pod=~"otel-collector.*"} > 0) > 80
        for: 10m
        labels:
          severity: warning
          component: otel-collector
        annotations:
          summary: "OpenTelemetry Collector memory usage high"
          description: "Collector {{ $labels.instance }} is using {{ $value }}% of its memory limit."
      
      # Queue saturation
      - alert: OTelCollectorQueueFull
        expr: |
          100 * otelcol_exporter_queue_size / otelcol_exporter_queue_capacity > 80
        for: 5m
        labels:
          severity: warning
          component: otel-collector
        annotations:
          summary: "OpenTelemetry Collector queue is filling up"
          description: "Collector {{ $labels.instance }} queue is {{ $value }}% full. Risk of data loss."
      
      # Collector down
      - alert: OTelCollectorDown
        expr: |
          up{job="otel-collector"} == 0
        for: 2m
        labels:
          severity: critical
          component: otel-collector
        annotations:
          summary: "OpenTelemetry Collector is down"
          description: "Collector {{ $labels.instance }} has been down for 2 minutes."
      
      # Receiver backpressure
      - alert: OTelCollectorBackpressure
        expr: |
          rate(otelcol_receiver_refused_spans[1m]) > 0
        for: 5m
        labels:
          severity: warning
          component: otel-collector
        annotations:
          summary: "OpenTelemetry Collector is applying backpressure"
          description: "Collector {{ $labels.instance }} is refusing {{ $value }} spans/second due to memory limits."
      
      # Export latency
      - alert: OTelCollectorHighExportLatency
        expr: |
          histogram_quantile(0.99, 
            rate(otelcol_exporter_send_latency_bucket[1m])
          ) > 5
        for: 10m
        labels:
          severity: warning
          component: otel-collector
        annotations:
          summary: "OpenTelemetry Collector export latency high"
          description: "Collector {{ $labels.instance }} p99 export latency is {{ $value }}s. Backend may be slow."
```

### Alert Routing (Alertmanager)

```yaml
route:
  receiver: default
  group_by: ['alertname', 'component']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  
  routes:
    - match:
        component: otel-collector
        severity: critical
      receiver: pagerduty
      continue: true
    
    - match:
        component: otel-collector
        severity: warning
      receiver: slack

receivers:
  - name: pagerduty
    pagerduty_configs:
      - service_key: '<pagerduty_key>'
  
  - name: slack
    slack_configs:
      - api_url: '<slack_webhook>'
        channel: '#observability-alerts'
```

---

## Advanced Patterns

### Self-Observability Pipeline

Configure the collector to send its own telemetry to a backend:

```yaml
exporters:
  otlp/self:
    endpoint: backend.example.com:4317
    tls:
      insecure: false

service:
  telemetry:
    metrics:
      level: detailed
      address: "0.0.0.0:8888"
      
      # Export collector metrics via OTLP
      readers:
        - periodic:
            interval: 30s
            exporter:
              otlp:
                protocol: grpc
                endpoint: backend.example.com:4317
```

### Distributed Tracing of the Collector

Enable tracing for the collector itself:

```yaml
service:
  telemetry:
    traces:
      processors:
        - batch:
            timeout: 10s
      exporters:
        - otlp:
            endpoint: backend.example.com:4317
```

**Use case**: Debug collector performance issues by tracing its internal operations.

---

## Troubleshooting Checklist

### Collector Not Accepting Data

**Symptoms**: Upstream services fail to send data, HTTP 503 errors

**Check**:
```promql
rate(otelcol_receiver_refused_spans[1m])
```

**Causes**:
- Memory limiter triggered (check `otelcol_process_memory_rss`)
- Receiver port not exposed (check Kubernetes Service)
- Network policy blocking traffic

### Data Not Reaching Backend

**Symptoms**: Collector accepts data, but backend shows no traces

**Check**:
```promql
rate(otelcol_exporter_sent_spans[1m])
rate(otelcol_exporter_send_failed_spans[1m])
```

**Causes**:
- Exporter misconfigured (wrong endpoint, no TLS)
- Backend down (check export failures)
- Queue full (check `otelcol_exporter_queue_size`)

### High Memory Usage

**Symptoms**: Collector OOMKilled, restarts frequently

**Check**:
```promql
otelcol_process_memory_rss
otelcol_exporter_queue_size
```

**Causes**:
- No memory_limiter processor
- Queue too large (`queue_size` > memory allows)
- High throughput without batching

### Incomplete Traces (Tail Sampling)

**Symptoms**: Traces missing spans, incorrect sampling decisions

**Check**:
- Verify loadbalancing exporter is using `routing_key: traceID`
- Check Headless Service is returning pod IPs, not VIP
- Verify `decision_wait` is long enough for trace completion

---

## Reference Links

- **Collector Metrics**: https://opentelemetry.io/docs/collector/internal-telemetry/
- **Monitoring Guide**: https://github.com/open-telemetry/opentelemetry-collector/blob/main/docs/monitoring.md
- **Health Check Extension**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/extension/healthcheckextension
- **Prometheus Receiver**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/prometheusreceiver
- **MonitoringArtist Dashboards**: https://github.com/monitoringartist/grafana-dashboards

---

## Summary

✅ **Expose metrics** on port 8888 for Prometheus scraping
✅ **Monitor throughput**: Accepted vs sent spans/metrics/logs
✅ **Alert on data loss**: `otelcol_exporter_send_failed_spans > 0`
✅ **Track memory usage**: Set alerts at 80% of limit
✅ **Watch queue saturation**: Alert when > 80% full
✅ **Use health checks**: Configure Kubernetes liveness/readiness probes
✅ **Deploy dashboards**: Use monitoringartist/opentelemetry-collector-monitoring
✅ **Self-observe**: Send collector metrics to the same backend

**Meta-monitoring is not optional—it's the safety net that prevents silent data loss in production observability systems.**
