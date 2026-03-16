# OpenTelemetry Production Playbooks

## Overview

This reference turns real-world OpenTelemetry blog posts and deployment interviews into **playbooks**: reusable production patterns that can be applied beyond a single company story. Each playbook captures the deployment shape, the operational trade-offs, the failure modes, and the platform decisions that proved useful in production.

Use this document when a user asks for:

- a **real-world deployment pattern**
- a **production rollout model** for a platform team
- a **blog-derived example** instead of a purely theoretical recommendation
- a **repeatable playbook** that can scale across many future upstream stories

## Table of Contents

1. [How to Use This Reference](#how-to-use-this-reference)
2. [Playbook Format](#playbook-format)
3. [Playbook: Adobe - Simplicity at Scale](#playbook-adobe---simplicity-at-scale)
4. [Reusable Production Patterns](#reusable-production-patterns)
5. [Common Failure Modes](#common-failure-modes)

---

## How to Use This Reference

These playbooks are not meant to be copied verbatim. They should be used to answer questions like:

- "What does a real platform-team rollout look like?"
- "How do large organizations keep OTel simple for application teams?"
- "What architecture patterns keep one backend problem from taking out the whole pipeline?"
- "What operational pitfalls show up only after chaining collectors in production?"

For each playbook, extract the reusable decisions and then load deeper reference material as needed:

- [architecture.md](architecture.md) for deployment models and scaling
- [connectors.md](connectors.md) for routing and cross-pipeline patterns
- [instrumentation.md](instrumentation.md) for auto-instrumentation trade-offs
- [monitoring.md](monitoring.md) for collector health and failure visibility

---

## Playbook Format

As more OpenTelemetry.io blog posts are integrated, keep each playbook in this shape:

1. **Source & Context**: where the playbook came from and what problem space it addresses
2. **Deployment Model**: the actual collector/application topology used in production
3. **Operational Goal**: what the design optimized for (simplicity, isolation, cost, control)
4. **Reusable Patterns**: decisions other teams can copy safely
5. **Failure Modes & Caveats**: what broke or required special handling
6. **Deep-Dive Links**: which other references to load for implementation detail

This structure scales better than a flat list of case studies because future blog posts can be added as discrete operational playbooks.

---

## Playbook: Adobe - Simplicity at Scale

> **Source**: [Inside Adobe's OpenTelemetry pipeline: simplicity at scale](https://opentelemetry.io/blog/2026/adobe-otel-pipeline/) — Developer Experience SIG interview with Bogdan Stancu, Senior Software Engineer at Adobe

### Source & Context

Adobe's central observability team supports a large internal platform with thousands of collectors running per signal type. Their OpenTelemetry rollout was offered as a supported path for new services rather than a forced migration for every existing workload.

### Operational Goal

Optimize for **self-service observability with strong platform defaults**:

- application teams should get observability with minimal configuration
- observability changes should not restart application pods unnecessarily
- backend-specific issues should be isolated by signal type
- the platform team should retain control of the shared infrastructure layer

### Deployment Model

Adobe's production topology follows a three-tier collector model:

```text
Tier 1: application namespace
  - sidecar collector (immutable)
  - deployment collector (team-configurable)

Tier 2: managed observability namespace
  - metrics collector deployment
  - logs collector deployment
  - traces collector deployment

Tier 3: observability backends
  - backend A
  - backend B
  - additional managed destinations
```

#### Tier 1: Immutable sidecar + configurable deployment collector

The application-facing Helm chart creates two collectors:

- **Sidecar collector** inside the application pod
  - configuration is locked down by the platform team
  - collects all signals regardless of downstream destination
  - avoids application restarts caused by observability config edits
- **Deployment collector** in the same namespace
  - receives OTLP from the sidecar
  - exposes limited configuration through Helm values
  - restarts independently from the application pod when routing/export config changes

**Why this playbook works**:

- the collector nearest the app is stable and predictable
- service teams still get a supported customization point
- telemetry collection stays decoupled from backend-specific routing changes

**See also**: [architecture.md](architecture.md)

#### Tier 2: Signal-level isolation in the managed namespace

Adobe runs separate centralized collector deployments for **metrics**, **logs**, and **traces** instead of a single monolithic pipeline tier.

```yaml
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
          # Trace pipeline only
```

Repeat the same pattern for logs and metrics as separate deployments.

**Why this playbook works**:

- a metrics backend outage does not interrupt log or trace delivery
- traces can scale independently from metrics/logs
- troubleshooting is simpler because each deployment has a narrower responsibility

#### Backend selection: normalize transport metadata into routing attributes

Adobe's blog describes the backend choice being carried between collector tiers via OTLP HTTP metadata/header values selected from Helm values. A reusable collector playbook is to **normalize that choice into a routing attribute before using the routing connector** so the routing rule is explicit inside the config.

One practical pattern is to have the namespace-local deployment collector stamp a resource attribute that represents the selected backend profile before forwarding upstream:

```yaml
processors:
  resource/backend_destination:
    attributes:
      - key: tenant.backend.destination
        value: backend-a
        action: upsert
```

That makes `tenant.backend.destination` part of the telemetry contract rather than leaving the decision hidden in transport-only metadata.

```yaml
connectors:
  routing:
    default_pipelines: [traces/backend-default]
    error_mode: ignore
    table:
      - statement: route() where resource.attributes["tenant.backend.destination"] == "backend-a"
        pipelines: [traces/backend-a]
      - statement: route() where resource.attributes["tenant.backend.destination"] == "backend-b"
        pipelines: [traces/backend-b]

service:
  pipelines:
    traces/in:
      receivers: [otlp]
      exporters: [routing]

    traces/backend-default:
      receivers: [routing]
      processors: [memory_limiter, batch]
      exporters: [otlp/default]

    traces/backend-a:
      receivers: [routing]
      processors: [memory_limiter, batch]
      exporters: [otlp/backend-a]

    traces/backend-b:
      receivers: [routing]
      processors: [memory_limiter, batch]
      exporters: [otlp/backend-b]
```

**Playbook guidance**:

- transport headers/metadata are not the same as telemetry attributes
- if a routing decision originates in transport metadata, document where it becomes a resource attribute
- use a default pipeline for traffic where the routing attribute is missing, malformed, or mapped to an unsupported backend profile
- keep the routing contract low-cardinality and stable across tiers

**See also**: [connectors.md](connectors.md) and [ottl.md](ottl.md)

### Auto-Instrumentation Rollout Pattern

Adobe uses the OpenTelemetry Operator so teams can enable observability with two annotations:

```yaml
metadata:
  annotations:
    instrumentation.opentelemetry.io/inject-java: 'true'
    sidecar.opentelemetry.io/inject: 'true'
```

This is a strong **platform playbook**:

- make the default path easy
- keep the supported path narrow
- allow manual instrumentation for advanced use cases without making it the primary onboarding story

**See also**: [instrumentation.md](instrumentation.md) and [platforms.md](platforms.md)

### Custom Distribution Playbook

Adobe builds a custom collector distribution with [ocb](https://github.com/open-telemetry/opentelemetry-collector/tree/main/cmd/builder) so the default binary includes only the components the platform actually supports.

```yaml
dist:
  name: adobe-otelcol
  description: Adobe custom OTel Collector distribution
  output_path: ./adobe-otelcol

connectors:
  - gomod: github.com/open-telemetry/opentelemetry-collector-contrib/connector/routingconnector v0.147.0
```

**Why this playbook works**:

- reduces dependency sprawl
- narrows the supported component surface area
- gives the platform team a curated default while still allowing exceptions when needed

### Failure Modes & Caveats

#### ⚠️ Chained collectors hide downstream export failures

A `200 OK` from the next-hop collector only confirms that collector accepted the OTLP request. It does **not** guarantee the final backend accepted the data.

```text
deployment collector -> 200 OK from managed collector -> backend rejects export
```

Adobe addressed this with a custom extension that proactively checks backend authentication and returns an upstream failure before the OTLP exchange completes.

**Playbook guidance**:

- never treat next-hop success as end-to-end delivery
- monitor exporter failure metrics at every tier
- design explicit error visibility for chained collector architectures

**See also**: [monitoring.md](monitoring.md)

#### ⚠️ Operator/collector version drift breaks older custom resources

Adobe also encountered compatibility issues when the OpenTelemetry Operator advanced its expectations for `OpenTelemetryCollector` custom resources while some teams still ran much older collector versions.

**Playbook guidance**:

- enforce a supported version window
- avoid letting service teams fall multiple release trains behind the platform default
- document upgrade cadence so failures are not perceived as random breakage

#### ⚠️ Deprecations are part of the operating model

Adobe migrated from the deprecated `routing` processor to the `routing` connector.

**Playbook guidance**:

- design for component churn in rapidly evolving parts of the OTel ecosystem
- review stability and deprecation notices during each upgrade cycle
- treat migration work as routine platform maintenance, not as a one-off surprise

---

## Reusable Production Patterns

These are the reusable patterns that emerged both from the Adobe playbook and from scanning other production-focused OpenTelemetry material:

### Platform abstraction layer

Provide an opinionated Helm chart or operator-driven onboarding path so application teams interact with a supported platform interface rather than raw collector complexity.

### Signal-level isolation

Use separate centralized collector deployments per signal type when backend risk, scaling profile, or troubleshooting complexity differs across traces, metrics, and logs.

### Stable edge, configurable middle tier

Keep the collector closest to the application locked down. Put customization in a separate deployment layer that can restart independently.

### Normalize routing intent early

If routing starts from Helm values, ingress metadata, or tenant context, normalize it into a stable routing attribute before cross-pipeline routing decisions are made.

### Bounded upgrade lag

Run upgrades on a predictable cadence and keep a maximum supported lag between operator, collector, and platform defaults.

---

## Common Failure Modes

### ❌ Assuming OTLP `200` means end-to-end delivery

A successful upstream OTLP exchange does not prove the downstream exporter succeeded.

### ❌ Letting operator and collector versions drift indefinitely

Version skew is manageable only when the platform sets an explicit support boundary.

### ❌ Routing on undocumented transport-only state

If a routing rule depends on metadata that never becomes a documented routing attribute, the config becomes difficult to reason about and harder to port.

### ❌ Treating deprecations as exceptional events

With OpenTelemetry, component migrations are normal platform work. Budget for them.

### ❌ One centralized pipeline for every signal and every backend problem

Monolithic gateway tiers make it easier for one backend issue to cascade into unrelated signals.

---

## Reference Links

- **OTel blog**: https://opentelemetry.io/blog/
- **Adobe playbook source**: https://opentelemetry.io/blog/2026/adobe-otel-pipeline/
- **OpenTelemetry Operator**: https://opentelemetry.io/docs/platforms/kubernetes/operator/
- **routingconnector**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/routingconnector
- **OpenTelemetry Collector Builder (ocb)**: https://github.com/open-telemetry/opentelemetry-collector/tree/main/cmd/builder
- **Collector stability levels**: https://opentelemetry.io/docs/collector/configuration/#stability-levels

---

## Summary

✅ Treat upstream production stories as **playbooks**, not just case studies
✅ Prefer a **platform abstraction layer** for service-team onboarding
✅ Use **signal-level isolation** so one backend problem does not cascade across all telemetry
✅ Use an **immutable sidecar + configurable middle tier** to protect application availability
✅ Normalize routing intent into **documented routing attributes** before using the routing connector
⚠️ Never assume **OTLP `200 OK` = end-to-end delivery** in chained collectors
⚠️ Keep **operator and collector versions** within a bounded support window
⚠️ Expect **deprecations and migrations** as part of regular OpenTelemetry platform maintenance

**Production playbooks make the skill more scalable: each new upstream blog can become another reusable operational pattern set instead of a one-off narrative.**
