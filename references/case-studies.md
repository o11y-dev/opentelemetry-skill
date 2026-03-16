# OpenTelemetry Production Case Studies

## Overview

This reference documents real-world OpenTelemetry deployments from the [OpenTelemetry Developer Experience SIG interview series](https://opentelemetry.io/blog/) and community contributions. Each case study distills practical lessons, architectural patterns, and hard-won production insights that complement the technical references in this skill. Use these patterns as validated blueprints—not theoretical guidelines.

## Table of Contents

1. [How to Use This Reference](#how-to-use-this-reference)
2. [Adobe: Simplicity at Scale](#adobe-simplicity-at-scale)
3. [Cross-Cutting Production Patterns](#cross-cutting-production-patterns)
4. [Anti-Patterns Observed in Production](#anti-patterns-observed-in-production)
5. [Reference Links](#reference-links)

---

## How to Use This Reference

Case studies are structured to highlight:

- **Architecture decisions** and the reasoning behind them
- **Scaling challenges** and how they were solved
- **Operational lessons** discovered through production experience
- **Configuration patterns** validated at scale

Each case study maps to existing technical references so you can load deeper context when needed.

---

## Adobe: Simplicity at Scale

> **Source**: [Inside Adobe's OpenTelemetry pipeline: simplicity at scale](https://opentelemetry.io/blog/2026/adobe-otel-pipeline/) — Developer Experience SIG interview with Bogdan Stancu, Senior Software Engineer at Adobe

### Context

Adobe's central observability team provides observability infrastructure across a global software company with thousands of collectors running per signal type. The pipeline was introduced voluntarily alongside existing monitoring solutions—adoption was not mandated, and existing applications with established monitoring were left in place.

### Architecture: Three-Tier Collector Pipeline

Adobe's deployment follows a three-tier design that cleanly separates concerns between application teams, the observability platform, and backend infrastructure.

```
Tier 1: User Helm Chart (per-namespace)
  ├── Sidecar Collector (in application pod, immutable config)
  └── Deployment Collector (configurable via Helm values)
        │
        │ OTLP over HTTP
        ▼
Tier 2: Managed Namespace (per-signal isolation)
  ├── Metrics Collector Deployment
  ├── Logs Collector Deployment
  └── Traces Collector Deployment
        │
        │ Signal-specific exporters
        ▼
Tier 3: Observability Backends
  ├── Backend A (selected via HTTP header routing)
  └── Backend B
```

**See also**: [architecture.md](architecture.md) for DaemonSet/Gateway/Sidecar patterns.

#### Tier 1: The User Helm Chart

The observability team provides a Helm chart that service teams deploy into their own namespaces. The chart creates two collectors:

**Sidecar Collector (immutable)**

```yaml
# Conceptual: sidecar runs inside the application pod
# Configuration is locked — service teams cannot modify it
# Collects all signals: metrics, logs, traces regardless of downstream destination
# Immutable config prevents application restarts on observability changes
```

Key properties:
- Runs inside the application pod, not as a DaemonSet
- Configuration is **immutable**—service teams cannot change it
- Collects all signals (metrics, logs, traces) unconditionally
- Sends everything downstream over OTLP

**Deployment Collector (configurable)**

```yaml
# Conceptual: standalone deployment in the same namespace
# Receives from sidecar, routes to managed namespace
# Service teams configure exporters and destinations via Helm values
# When config changes, only this collector restarts — app pod untouched
```

Key properties:
- Separate Kubernetes Deployment (not a sidecar)
- Receives from the sidecar over OTLP
- Handles routing and export configuration
- Configurable by service teams via Helm values
- When configuration changes, only this collector restarts—the application pod and its sidecar are unaffected

#### Tier 2: Managed Namespace with Signal-Level Isolation

A critical architectural decision: the managed namespace runs a **separate collector deployment for each signal type**.

```yaml
# Tier 2: per-signal deployments
# Each handles one signal type from all upstream deployment collectors

# Metrics collector
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-managed-metrics
  namespace: observability-managed
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: otel-collector
        # Receives only metrics, exports only to metrics backends

# Logs collector
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-managed-logs
  namespace: observability-managed
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: otel-collector
        # Receives only logs, exports only to log backends

# Traces collector
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-managed-traces
  namespace: observability-managed
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: otel-collector
        # Receives only traces, exports only to trace backends
```

**Why signal-level isolation matters**: If a backend becomes rate-limited or starts rejecting data for one signal type, the other signals continue flowing uninterrupted. A metrics backend outage does not affect log or trace delivery.

#### Backend Routing via HTTP Header and Routing Connector

Service teams select their desired backend through Helm values, which sets an HTTP header on OTLP exports. The managed namespace collectors use the [routing connector](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/routingconnector) to direct telemetry to the correct exporter.

```yaml
# Managed namespace collector: routing by HTTP header
connectors:
  routing:
    default_pipelines: [traces/default]
    error_mode: ignore
    table:
      - statement: attributes["x-backend-destination"] == "backend-a"
        pipelines: [traces/backend-a]
      - statement: attributes["x-backend-destination"] == "backend-b"
        pipelines: [traces/backend-b]

service:
  pipelines:
    traces/in:
      receivers: [otlp]
      exporters: [routing]

    traces/backend-a:
      receivers: [routing]
      processors: [memory_limiter, batch]
      exporters: [otlp/backend-a]

    traces/backend-b:
      receivers: [routing]
      processors: [memory_limiter, batch]
      exporters: [otlp/backend-b]
```

**See also**: [connectors.md](connectors.md) for routing connector patterns.

### Auto-Instrumentation: Two Lines and It Works

Adobe leverages the [OpenTelemetry Operator](https://opentelemetry.io/docs/platforms/kubernetes/operator/) for auto-instrumentation. Service teams enable instrumentation by adding two annotations to their Kubernetes deployment manifests:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-java-service
spec:
  template:
    metadata:
      annotations:
        instrumentation.opentelemetry.io/inject-java: 'true'
        sidecar.opentelemetry.io/inject: 'true'
```

The design philosophy: **make the default path require as little effort as possible, while leaving the door open for advanced use cases.** Teams can add manual SDK instrumentation—the sidecar accepts all OTLP data—but the supported path focuses on auto-instrumentation.

**See also**: [instrumentation.md](instrumentation.md) for auto-instrumentation patterns.

### Custom Collector Distribution

Adobe builds its own OpenTelemetry Collector distribution using [ocb (OpenTelemetry Collector Builder)](https://github.com/open-telemetry/opentelemetry-collector/tree/main/cmd/builder) to include only the components they use, avoiding unnecessary dependencies from the Contrib distribution.

```yaml
# builder-config.yaml (conceptual)
dist:
  name: adobe-otelcol
  description: Adobe custom OTel Collector distribution
  output_path: ./adobe-otelcol

receivers:
  - gomod: go.opentelemetry.io/collector/receiver/otlpreceiver v0.147.0

processors:
  - gomod: go.opentelemetry.io/collector/processor/memorylimiterprocessor v0.147.0
  - gomod: go.opentelemetry.io/collector/processor/batchprocessor v0.147.0

exporters:
  - gomod: go.opentelemetry.io/collector/exporter/otlpexporter v0.147.0
  - gomod: go.opentelemetry.io/collector/exporter/otlphttpexporter v0.147.0

connectors:
  - gomod: github.com/open-telemetry/opentelemetry-collector-contrib/connector/routingconnector v0.147.0

extensions:
  - gomod: go.opentelemetry.io/collector/extension/healthcheckextension v0.147.0
```

Teams can manually switch to the full Contrib distribution if they need components not included in the custom build.

### ⚠️ The Chained Collector Error Visibility Problem

When collectors are chained, error visibility becomes a critical problem.

**The problem**: The OTLP transaction between the user's deployment collector and the managed namespace collector completes with a `200 OK` response *before* the managed namespace collector attempts to export to the backend. If the backend rejects the data, the error is only visible in the managed namespace collector's logs. **The upstream (user's) collector sees only success.**

```
User Deployment Collector → [OTLP 200 OK] → Managed Namespace Collector → [Backend rejects data]
                                                                                    ↑
                                               Error visible here only, user sees 200s
```

**Adobe's solution**: A custom extension acting as a circuit breaker for backend authentication. The extension runs in the managed namespace collector's receiver, proactively sending mock authentication requests to the backend and caching results. If authentication fails, it returns a `401` to the upstream collector *before* the OTLP transaction completes, propagating the error back to where users can see it.

**Upstream opportunity**: A more general back-pressure mechanism where exporter failures propagate upstream through chained collectors remains an open need in the OpenTelemetry Collector project.

### Lifecycle Management

Adobe upgrades their collector distribution and OTel Operator on a **quarterly cadence**. Key operational notes:

- Upgrade issues have been rare overall
- When the Helm chart is updated, service teams pick up the new collector version on their next deployment
- ⚠️ **Operator/Collector version compatibility**: When the Operator is upgraded, it can modify the `OpenTelemetryCollector` custom resource to align with new configuration expectations. If a service team runs a significantly older collector version, these changes can be incompatible, preventing collectors from starting. The resolution is upgrading the collector, but it can cause confusion for teams whose collectors break without any changes on their end.

### Component Deprecation: Routing Processor → Routing Connector

Adobe originally used the `routing` processor to direct telemetry to different backends based on HTTP headers. When the processor was deprecated in favor of the routing connector, they migrated.

> "This is a risk we knew about, the whole OpenTelemetry landscape is changing constantly and the benefits outweigh the 'issues' if you can call fast development an issue." — Bogdan Stancu, Adobe

**Lesson**: Plan for component lifecycle changes when building long-lived observability platforms. Use the [stability levels](https://opentelemetry.io/docs/collector/configuration/#stability-levels) documentation to anticipate future deprecations.

### Adobe's Advice for Others

Based on Adobe's experience building a platform-level observability pipeline:

1. **Treat OpenTelemetry as a platform to build on**: Don't expect it to solve all your problems out of the box. It's designed to be extended and customized for your specific needs.
2. **Don't be afraid to build custom components**: The Collector's architecture makes it straightforward to build extensions tailored to your needs.
3. **Design for user simplicity**: Make the default path require minimal effort. The teams consuming your platform are not observability experts.
4. **Plan for error visibility in chained collectors**: OTLP transaction success does not guarantee end-to-end delivery. Consider how errors will surface to users.

---

## Cross-Cutting Production Patterns

These patterns appear consistently across production deployments and are validated at scale.

### Pattern: Platform Team Abstraction Layer

**What**: A central observability team provides opinionated, pre-configured Helm charts or operator-based abstractions that service teams consume without needing deep OTel knowledge.

**Why it works**:
- Service teams go from zero to full observability with minimal configuration
- Platform team retains control over centralized infrastructure
- Sensible defaults prevent anti-patterns before they reach production
- Advanced customization remains possible for teams that need it

**Implementation approach**:
1. Provide a Helm chart or Operator `Instrumentation` CR that encapsulates best practices
2. Expose only the configuration knobs service teams actually need (destination, language)
3. Lock down the sidecar/agent configuration to prevent accidental breakage
4. Document escape hatches for advanced use cases

### Pattern: Signal-Level Pipeline Isolation

**What**: Run separate collector deployments for metrics, logs, and traces in centralized tiers.

**Why it works**:
- Backend outages for one signal type don't cascade to others
- Independent scaling per signal type (traces often need more resources than metrics)
- Simpler debugging—each pipeline has a clear, single responsibility
- Enables per-signal rate limiting and backpressure independently

**Trade-off**: Higher Kubernetes resource footprint (more deployments, services, and HPA rules).

### Pattern: Immutable Sidecar + Configurable Gateway

**What**: The sidecar (closest to the application) has an immutable configuration. A separate gateway/deployment collector is configurable.

**Why it works**:
- Application pods never restart due to observability configuration changes
- The sidecar always collects everything—routing decisions happen downstream
- Service teams customize destinations without affecting application availability

**See also**: [architecture.md](architecture.md) for the Sidecar pattern.

### Pattern: Header-Based Multi-Backend Routing

**What**: Use HTTP headers set by upstream collectors (or Helm values) to route telemetry to different backends in a centralized collector using the routing connector.

**Why it works**:
- Service teams select their backend through simple Helm values
- No per-tenant configuration changes required in the centralized collector
- Routing logic is expressed declaratively in OTTL

**Key risk**: HTTP headers become part of your routing contract. Document them explicitly and consider them a versioned API.

**See also**: [connectors.md](connectors.md) and [ottl.md](ottl.md).

### Pattern: Quarterly Upgrade Cadence

**What**: Upgrade the collector distribution and OTel Operator on a defined, regular cadence (quarterly is common) rather than continuously.

**Why it works**:
- Reduces operational burden of continuous upgrades
- Gives upstream changes time to stabilize
- Provides a predictable maintenance window for service teams

**Risk to manage**: Large version gaps between the Operator and service-team collectors can cause compatibility issues. Enforce a maximum version lag policy (e.g., no more than two quarterly releases behind).

---

## Anti-Patterns Observed in Production

These are failure modes encountered in real production deployments.

### ❌ Assuming OTLP 200 Means End-to-End Delivery

**Problem**: In a chained collector pipeline, a `200 OK` from the next-hop collector only confirms receipt by that collector—not delivery to the final backend.

**Solution**: Implement circuit breakers or health-check extensions that propagate backend health upstream. Monitor `otelcol_exporter_send_failed_*` metrics at every tier.

**See also**: [monitoring.md](monitoring.md).

### ❌ Operator/Collector Version Drift

**Problem**: Upgrading the OTel Operator without upgrading service-team collectors can cause the Operator to modify `OpenTelemetryCollector` CRDs in ways incompatible with older collector versions, silently breaking collectors.

**Solution**: Enforce a minimum supported collector version. Alert when collector versions fall more than one minor release behind the Operator version.

### ❌ Using the Routing Processor (Deprecated)

**Problem**: The `routing` processor is deprecated in favor of the `routing` connector. Using deprecated components creates technical debt and will require migration.

**Solution**: Use the `routingconnector` for all new deployments. Migrate existing `routing` processor configurations as part of regular upgrade cycles.

**See also**: [connectors.md](connectors.md).

### ❌ One Monolithic Collector Pipeline for All Signals

**Problem**: A single collector pipeline for all signals means a backend issue for one signal type affects all signals. Memory pressure from high-volume traces can starve metrics and logs processing.

**Solution**: Isolate pipelines by signal type, especially in centralized gateway tiers.

---

## Reference Links

- **OTel Developer Experience SIG Blog Series**: https://opentelemetry.io/blog/
- **Adobe Case Study**: https://opentelemetry.io/blog/2026/adobe-otel-pipeline/
- **OpenTelemetry Operator**: https://opentelemetry.io/docs/platforms/kubernetes/operator/
- **Routing Connector**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/routingconnector
- **OTel Collector Builder (ocb)**: https://github.com/open-telemetry/opentelemetry-collector/tree/main/cmd/builder
- **Component Stability Levels**: https://opentelemetry.io/docs/collector/configuration/#stability-levels
- **OpenTelemetry Instrumentation Annotation Reference**: https://opentelemetry.io/docs/platforms/kubernetes/operator/automatic/

---

## Summary

✅ Use a **platform abstraction layer** (Helm chart, Operator CR) so service teams get observability with two annotations and zero OTel expertise required
✅ Use **signal-level pipeline isolation** in centralized tiers—a metrics backend outage must not affect trace or log delivery
✅ Use an **immutable sidecar + configurable gateway** pattern to prevent application restarts from observability configuration changes
✅ Use the **routing connector** (not the deprecated routing processor) for header-based multi-backend routing
✅ Build a **custom collector distribution** with only the components you need—reduces binary size, attack surface, and dependency conflicts
⚠️ Never assume **OTLP 200 OK = end-to-end delivery** in chained pipelines—monitor `otelcol_exporter_send_failed_*` metrics at every tier
⚠️ Enforce a **maximum version lag** between the OTel Operator and service-team collectors to prevent compatibility breakage on Operator upgrades
⚠️ Plan for **component deprecations** as a normal part of the OTel lifecycle—treat the routing processor → connector migration as the template for future transitions

**Real-world OpenTelemetry deployments succeed by treating OTel as a platform to build on, not a plug-and-play solution. Design for simplicity at the service-team boundary, and reserve complexity for the centralized infrastructure layer.**
