# OpenTelemetry Collector: Connectors

## Overview

**Connectors** are a first-class OpenTelemetry Collector component type that act as **both an exporter and a receiver**. A connector bridges two pipelines: it receives data as an exporter on one pipeline and emits data as a receiver on another. This enables cross-pipeline signal routing, aggregation, and transformation patterns that are impossible with standard pipeline stages.

## Table of Contents

1. [What Are Connectors?](#what-are-connectors)
2. [Production-Relevant Connectors](#production-relevant-connectors)
3. [spanmetricsconnector: R.E.D. Metrics from Traces](#spanmetricsconnector-red-metrics-from-traces)
4. [servicegraphconnector: Dependency Graphs](#servicegraphconnector-dependency-graphs)
5. [routingconnector: Attribute-Based Pipeline Routing](#routingconnector-attribute-based-pipeline-routing)
6. [failoverconnector: Automatic Pipeline Failover](#failoverconnector-automatic-pipeline-failover)
7. [countconnector: Signal Counting](#countconnector-signal-counting)
8. [signaltometricsconnector: Any Signal to Metrics](#signaltometricsconnector-any-signal-to-metrics)
9. [Connector Pipeline Patterns](#connector-pipeline-patterns)
10. [Stability Levels](#stability-levels)
11. [Reference Links](#reference-links)

---

## What Are Connectors?

A connector simultaneously acts as:

- **Exporter** (consuming data from a source pipeline)
- **Receiver** (emitting data into a destination pipeline)

```
Pipeline A (Traces) → [connector as exporter] → [connector as receiver] → Pipeline B (Metrics)
```

### Why Connectors?

Without connectors, generating metrics from traces requires external tools (e.g., span-to-metrics exporters, separate agents). Connectors enable this natively inside the collector, reducing latency, operational complexity, and cost.

### Service Pipeline Definition

Connectors are declared in the `service.pipelines` section by listing the same connector as both an exporter in the source pipeline and a receiver in the destination pipeline:

```yaml
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [spanmetrics]          # connector as exporter

    metrics:
      receivers: [spanmetrics]          # same connector as receiver
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

---

## Production-Relevant Connectors

| Connector | Purpose | Source Signal | Output Signal | Stability |
|-----------|---------|---------------|---------------|-----------|
| `spanmetricsconnector` | R.E.D. metrics from traces | Traces | Metrics | Beta |
| `servicegraphconnector` | Service dependency graph | Traces | Metrics | Beta |
| `routingconnector` | Attribute-based pipeline routing | Any | Same signal | Alpha |
| `failoverconnector` | Automatic pipeline failover | Any | Same signal | Alpha |
| `countconnector` | Count signals as metrics | Any | Metrics | Alpha |
| `signaltometricsconnector` | Convert any signal to metrics | Any | Metrics | Alpha |

---

## spanmetricsconnector: R.E.D. Metrics from Traces

Generates **R.E.D. metrics** (Rate, Errors, Duration) from trace spans without requiring a separate agent or post-processing step.

### Generated Metrics

- `traces.span.metrics.calls` (counter): Request rate and error rate
- `traces.span.metrics.duration` (histogram): Latency distribution

### Configuration

```yaml
connectors:
  spanmetrics:
    histogram:
      explicit:
        buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]  # milliseconds
    dimensions:
      - name: http.request.method
        default: GET
      - name: http.response.status_code
      - name: service.name
    exemplars:
      enabled: true              # Link metrics to traces via exemplars
    metrics_flush_interval: 60s  # How often to flush aggregated metrics

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp, spanmetrics]    # forward traces AND generate metrics

    metrics:
      receivers: [otlp, spanmetrics]    # receive both OTLP metrics and generated metrics
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

### ⚠️ Stickiness Requirement

`spanmetricsconnector` is **stateful** — it aggregates metrics in-memory across spans. In a multi-replica gateway deployment, all spans for the same service or trace must route to the **same collector instance**.

```yaml
# Agent-tier: use loadbalancing exporter to stick spans to a gateway replica
exporters:
  loadbalancing:
    routing_key: traceID              # deterministic routing to gateway
    protocol:
      otlp:
        tls:
          insecure: true
    resolver:
      k8s:
        service: otel-gateway-headless  # ⚠️ must be Headless Service
```

### Cardinality Warning

⚠️ **Avoid high-cardinality dimensions** in `spanmetricsconnector`. Adding `user.id`, `request.id`, or raw `url.path` as dimensions creates millions of time series. Apply the **Rule of 100**: only include dimensions with fewer than 100 unique values.

---

## servicegraphconnector: Dependency Graphs

Generates **service dependency graph metrics** showing request rates and error rates between pairs of services.

### Generated Metrics

- `traces.service.graph.request.total` (counter): Total calls between service pairs
- `traces.service.graph.request.failed.total` (counter): Failed calls between service pairs
- `traces.service.graph.request.duration` (histogram): Latency between service pairs
- `traces.service.graph.unpaired_spans_total` (counter): Spans without matching pairs (incomplete traces)

### Configuration

```yaml
connectors:
  servicegraph:
    latency_histogram_buckets: [1, 2, 6, 10, 100, 250]  # milliseconds
    dimensions:
      - http.request.method
    store:
      ttl: 2s          # Time to wait for matching spans
      max_items: 10000  # Max in-flight span pairs

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp, servicegraph]   # forward traces AND generate graph metrics

    metrics:
      receivers: [otlp, servicegraph]
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

### ⚠️ Stickiness Requirement

Like `spanmetricsconnector`, the `servicegraphconnector` is **stateful**. It must see both the client span and the server span for a given request to compute the edge. Use the `loadbalancing` exporter with `routing_key: traceID` to route all spans of a trace to the same gateway replica.

---

## routingconnector: Attribute-Based Pipeline Routing

Routes signals to different pipelines based on attribute values, enabling per-tenant or per-environment routing.

### Configuration

```yaml
connectors:
  routing:
    default_pipelines: [traces/default]   # fallback if no rule matches
    error_mode: ignore
    table:
      - statement: route() where attributes["tenant.id"] == "us-east"
        pipelines: [traces/us_east]
      - statement: route() where attributes["env"] == "prod"
        pipelines: [traces/prod]

service:
  pipelines:
    traces/in:
      receivers: [otlp]
      processors: [memory_limiter]
      exporters: [routing]              # connector as exporter

    traces/us_east:
      receivers: [routing]             # same connector as receiver
      processors: [batch]
      exporters: [otlp/us_east]

    traces/prod:
      receivers: [routing]
      processors: [batch]
      exporters: [otlp/prod]

    traces/default:
      receivers: [routing]
      processors: [batch]
      exporters: [otlp/default]
```

### Routing Key Best Practices

✅ Use low-cardinality, deterministic attributes (`tenant.id`, `env`, `cluster`)
❌ Do not route on high-cardinality attributes (`user.id`, `request.id`) — this creates excessive pipeline fan-out

---

## failoverconnector: Automatic Pipeline Failover

Provides automatic failover between pipelines based on health/error conditions. When the primary pipeline experiences errors, traffic shifts to the secondary pipeline.

### Configuration

```yaml
connectors:
  failover:
    priority_levels:
      - [traces/primary]    # try this pipeline first
      - [traces/secondary]  # fallback if primary fails
    retry_interval: 10m     # how long before retrying the primary
    retry_gap: 10s          # gap between individual retry attempts
    max_retries: 3          # attempts before moving to next priority level

service:
  pipelines:
    traces/in:
      receivers: [otlp]
      processors: [memory_limiter]
      exporters: [failover]           # connector as exporter

    traces/primary:
      receivers: [failover]           # connector as receiver
      processors: [batch]
      exporters: [otlp/primary]

    traces/secondary:
      receivers: [failover]
      processors: [batch]
      exporters: [otlp/secondary]     # backup backend (e.g., different region)
```

### Use Case: Cross-Region Failover

```
Primary pipeline → us-east-1 backend
              ↓ (on failure)
Secondary pipeline → eu-west-1 backup backend
```

---

## countconnector: Signal Counting

Counts telemetry signals (spans, metric data points, or log records) and emits the counts as metrics. Useful for SLI instrumentation and billing.

### Configuration

```yaml
connectors:
  count:
    spans:
      - name: trace.span.count
        description: Total spans processed
        conditions:
          - 'attributes["http.route"] != nil'  # only count HTTP spans
        attributes:
          - key: http.request.method
          - key: http.response.status_code
          - key: service.name
    logs:
      - name: log.record.count
        description: Total log records
        attributes:
          - key: severity_text

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp, count]              # connector as exporter

    metrics:
      receivers: [otlp, count]              # connector as receiver
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

---

## signaltometricsconnector: Any Signal to Metrics

Converts any signal type (traces, logs, or metrics) into metrics using OTTL expressions. More flexible than `spanmetricsconnector` for custom metric generation.

### Configuration

```yaml
connectors:
  signaltometrics:
    spans:
      - name: http.server.request.duration
        description: HTTP server request duration from spans
        unit: ms
        histogram:
          value: Milliseconds(end_time - start_time)
          bucket_boundaries: [0, 5, 10, 25, 50, 100, 250, 500, 1000]
          attributes:
            - key: http.request.method
            - key: http.route
            - key: http.response.status_code
    logs:
      - name: log.body.size
        description: Size of log body
        unit: By
        gauge:
          value: Int(Len(body))
          attributes:
            - key: severity_text

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp, signaltometrics]    # connector as exporter

    metrics:
      receivers: [otlp, signaltometrics]    # connector as receiver
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

---

## Connector Pipeline Patterns

### Pattern 1: Full Observability Stack (Traces + Metrics + Graphs)

```yaml
connectors:
  spanmetrics: {}
  servicegraph: {}

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, k8sattributes, batch]
      exporters: [otlp, spanmetrics, servicegraph]

    metrics:
      receivers: [otlp, spanmetrics, servicegraph]
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

### Pattern 2: Multi-Tenant Routing with Fallback

```yaml
connectors:
  routing:
    default_pipelines: [traces/default]
    table:
      - statement: route() where resource.attributes["tenant.id"] == "acme"
        pipelines: [traces/acme]

service:
  pipelines:
    traces/in:
      receivers: [otlp]
      processors: [memory_limiter]
      exporters: [routing]

    traces/acme:
      receivers: [routing]
      processors: [batch]
      exporters: [otlp/acme_backend]

    traces/default:
      receivers: [routing]
      processors: [batch]
      exporters: [otlp/shared_backend]
```

---

## Stability Levels

⚠️ **Check stability before production use**:

| Connector | Stability | Notes |
|-----------|-----------|-------|
| `spanmetricsconnector` | **Beta** | Feature-complete, minor breaking changes possible |
| `servicegraphconnector` | **Beta** | Feature-complete, minor breaking changes possible |
| `routingconnector` | **Alpha** | Experimental — test thoroughly before production |
| `failoverconnector` | **Alpha** | Experimental — test thoroughly before production |
| `countconnector` | **Alpha** | Experimental — test thoroughly before production |
| `signaltometricsconnector` | **Alpha** | Experimental — test thoroughly before production |

All connectors are in the [opentelemetry-collector-contrib](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector) repository.

---

## Reference Links

- **Connectors Documentation**: https://opentelemetry.io/docs/collector/configuration/#connectors
- **Connector Components (Contrib)**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector
- **spanmetricsconnector**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/spanmetricsconnector
- **servicegraphconnector**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/servicegraphconnector
- **routingconnector**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/routingconnector
- **failoverconnector**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/failoverconnector
- **countconnector**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/countconnector
- **signaltometricsconnector**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/signaltometricsconnector

---

## Summary

✅ Use **spanmetricsconnector** to generate R.E.D. metrics from traces without extra agents
✅ Use **servicegraphconnector** to build service dependency maps from trace data
✅ Use **routingconnector** for attribute-based multi-tenant or multi-environment pipeline routing
✅ Use **failoverconnector** for automatic cross-region or cross-backend failover
✅ Always pair **stateful connectors** (spanmetrics, servicegraph) with the `loadbalancing` exporter and `routing_key: traceID`
✅ Check **stability levels** — only `spanmetricsconnector` and `servicegraphconnector` are Beta; others are Alpha
⚠️ Avoid **high-cardinality dimensions** in spanmetrics/servicegraph to prevent time series explosion

**Connectors are the bridge between pipeline stages — use them to turn trace data into metrics and to route signals across pipelines without external tooling.**
