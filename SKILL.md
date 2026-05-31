---
name: opentelemetry-skill
description: "Expert OpenTelemetry guidance for collector configuration, pipeline design, and production telemetry instrumentation across Kubernetes, ECS, serverless, and standalone deployments. Use when configuring collectors, designing pipelines, instrumenting applications, implementing sampling, managing cardinality, securing telemetry, writing OTTL transformations, or setting up AI coding agent observability (Claude Code, Codex, Gemini CLI, GitHub Copilot)."
license: Apache-2.0
metadata:
  author: o11y.dev
  version: 1.5.0
  signals:
    - traces
    - metrics
    - logs
    - profiles
  deployments:
    - kubernetes
    - ecs
    - docker
    - vm
    - serverless
    - lambda
    - gcp-functions
    - azure-functions
  deployment_patterns:
    - daemonset
    - sidecar
    - gateway
    - standalone
  supported_platforms:
    - aws
    - gcp
    - azure
    - on-premises
  vendor_agnostic: true
  triggers:
    file_patterns:
      - "**/collector*.yaml"
      - "**/otelcol*.yaml"
      - "**/values*.yaml"
      - "**/trace-config*.yaml"
      - "**/metric-config*.yaml"
      - "**/log-config*.yaml"
      - "**/helm*.yaml"
      - "**/docker-compose*.yaml"
      - "**/task-definition*.yaml"
      - "**/task-definition*.json"
    config_keys:
      - "receivers:"
      - "processors:"
      - "exporters:"
      - "service:"
      - "pipelines:"
      - "extensions:"
      - "connectors:"
    keywords:
      - opentelemetry
      - otel
      - otelcol
      - collector
      - observability
      - traces
      - metrics
      - logs
      - pipeline
      - sampler
      - sampling
      - cardinality
      - instrumentation
      - kubernetes
      - helm
      - ecs
      - docker
      - compose
      - serverless
      - lambda
      - deployment
      - architecture
      - receiver
      - processor
      - exporter
      - connector
      - spanmetrics
      - tail sampling
      - memory limiter
      - batch processor
      - ottl
      - transform
      - security
      - tls
      - pii
      - redaction
      - codex
      - ai-agent
      - genai
---

# OpenTelemetry Skill

## Core Principles

Use these defaults:

1. **Stability over Features**: Check otelcol-contrib stability (Alpha/Beta/Stable) and warn on non-stable components in production.

2. **Convention over Configuration**: Prefer OpenTelemetry Semantic Conventions over custom attribute names.

3. **Protocol Unification**: Default to **OTLP gRPC** (4317); use **OTLP HTTP** (4318) when gRPC is blocked by the agent, proxy, browser, or backend.

4. **Deterministic Routing Keys**: Use stable routing keys for load-balancing exporters (`traceID` for tail sampling, `tenant_id` or `cluster` for tenant/shard routing). Normalize non-string attributes first.

5. **Safety First**: Prefer collector stability (memory limiters, persistent queues, backpressure) over completeness. Dropping data is better than crashing the collector.

6. **Cardinality Awareness**: High-cardinality attributes (>100 unique values) must not be metric dimensions; use traces or logs instead.

7. **Security by Default**: Redact PII, enable TLS for cross-network communication, and authenticate all collector endpoints.

8. **Cross-Field Consistency**: Treat collector reviews as systems reviews. Check processor order, memory limits, replica strategy, routing, metric temporality, queue storage, PDB/HPA settings, and OTTL types together before calling a config safe.

## Pre-Flight Checklist

Before generating config/code, confirm these. If unknown, ask first:

1. **Signal volume** — High traffic (>10k RPS) or low volume? Drives sampling/scaling. → [sampling.md](references/sampling.md), [collector.md](references/collector.md)
2. **Cardinality risk** — Any unbounded metric attributes (user/request/session IDs)? Move to traces/logs. → [instrumentation.md](references/instrumentation.md)
3. **Resiliency** — Is restart/outage data loss acceptable? If no, use `file_storage` + persistent queues. → [collector.md](references/collector.md)
4. **Trust boundaries** — Any public-network hops? Require TLS + mTLS. → [security.md](references/security.md)
5. **Deployment target** — Kubernetes, ECS, Lambda, VM, or other? → [architecture.md](references/architecture.md), [setup guides](#when-to-use-this-skill)

## When to Use This Skill

Use this table to navigate specific use cases to their reference docs:

| Your question | Key topics | Go to |
|---|---|---|
| **Deploy to Kubernetes** — EKS, GKE, AKS, OpenShift, Autopilot, Fargate | DaemonSet, Gateway, Sidecar, Helm, RBAC, persistent volumes | [setup-kubernetes.md](references/setup-kubernetes.md) |
| **Deploy to ECS** — EC2 or Fargate | CloudWatch Logs, Task definition, networking, service discovery | [setup-ecs.md](references/setup-ecs.md) |
| **Docker / Docker Compose** — Container or compose stack | Volume mounts, bridge/host networking, state persistence | [setup-docker.md](references/setup-docker.md) |
| **Standalone VM / EC2** — Linux, Windows, or macOS | Systemd service, binary install, config management | [setup-vm.md](references/setup-vm.md) |
| **Choose your deployment pattern** — Not sure which platform? | DaemonSet vs Gateway vs Sidecar, decision tree | [setup-index.md](references/setup-index.md) |
| **Collector basics** — Receivers, processors, exporters, pipelines | Config audit, processor ordering, memory limits, queues | [collector.md](references/collector.md) |
| **Architecture & scaling** — Replicas, affinity, load balancing, resilience | Target Allocator, HPA, PodDisruptionBudget, steady-state | [architecture.md](references/architecture.md) |
| **SDK instrumentation** — Auto-instrumentation vs manual, SemConv, cardinality | Language-specific setup, span attributes, best practices | [instrumentation.md](references/instrumentation.md) |
| **Sampling strategy** — Head sampling, tail sampling, probabilistic, cost optimization | Sampling rate math, trace propagation, sticky sessions | [sampling.md](references/sampling.md) |
| **Security & compliance** — PII redaction, TLS, mTLS, GDPR, secrets | Redaction processor, allow-lists, encryption, RBAC | [security.md](references/security.md) |
| **OTTL / Transformations** — Parse, extract, modify attributes, enrich spans | OTTL syntax, context types, error handling, examples | [ottl.md](references/ottl.md) |
| **Connectors** — spanmetrics, servicegraph, routing, failover | R.E.D. metrics, sticky routing, statefulness | [connectors.md](references/connectors.md) |
| **Serverless & FaaS** — Lambda, Google Cloud Functions, Azure Functions | Lambda Layer, memory constraints, cost, cold-start mitigation | [platforms.md](references/platforms.md) |
| **Monitoring the collector** — Health, alerts, self-monitoring, diagnostics | otelcol_* metrics, dashboards, pprof, health check | [monitoring.md](references/monitoring.md) |
| **Validation & troubleshooting** — "No data reaching backend", config errors, symptom→fix | Config validation, dry-run, live checks, recovery steps | [validation.md](references/validation.md) |
| **Production anti-patterns** — What NOT to do, common mistakes | Cardinality explosions, processor ordering, unsafe defaults | [anti-patterns.md](references/anti-patterns.md) |
| **Real-world playbooks** — Production patterns, best practices from blog | Multi-signal, multi-tenant, high-volume setups | [playbooks.md](references/playbooks.md) |
| **AI agent telemetry** — Claude Code, Codex, Gemini CLI, Copilot, MCP | Agent OTel support, unified config, GenAI SemConv | [ai-agents.md](references/ai-agents.md) |

## Eval-Critical Response Minimums

When user requests match these patterns, include these points explicitly:

- **Collector setup**: include `memory_limiter`; keep it first in each pipeline `processors` list; explain OOM-prevention rationale.
- **Metric dimension request for `user_id`, `request_id`, or other high-cardinality**: refuse; explain time-series explosion risk; suggest traces and bounded metric dimensions; reference Rule of 100.
- **Exporter resilience**: For production, enable `sending_queue` with `file_storage` backend and `retry_on_failure` with exponential backoff. Explain data preservation and backpressure benefits.
- **OTLP gRPC vs HTTP**: Default to gRPC (port 4317); switch to HTTP only if gRPC is blocked by network, proxy, or backend. Include rationale (binary efficiency, TLS-by-default, bidirectional).
- **Kubernetes tail sampling**: Gateway (Deployment) tier, `loadbalancing` exporter with `routing_key: traceID`, Headless Service (`clusterIP: None`), tail sampling policy with error+10% rules, Beta stability caution.
- **Multi-signal consistency**: When reviewing collector config, verify processor order consistency across traces/metrics/logs pipelines; ensure `memory_limiter` is first in all; check temporality and routing coherence.
- **DaemonSet vs Gateway vs Sidecar**: Clarify the pattern matching the user's deployment topology before prescribing a config (see [setup-index.md](references/setup-index.md)).
- **Cardinality guardrails**: `aggregation_cardinality_limit` is a guardrail, not a fix. Still recommend removing or normalizing high-cardinality labels in the pipeline.
- **Claude Code telemetry**: include `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`, `~/.claude/settings.json` persistence; `OTEL_LOG_USER_PROMPTS`/`OTEL_LOG_TOOL_DETAILS` default to `false` — warn against enabling in shared/production environments without PII controls; avoid `session.id` as a metric dimension.
- **AI agent tool-call tracing**: for agents using `gen_ai.*` traces, name execute-tool spans with the actual tool name (for example `bash` or `search_code`) and preserve `gen_ai.tool.name`; do not use a generic `execute_tool` span name.

## Common Workflows

### 1. Triage: "No data reaching the backend"

Follow these steps in order before touching any OTTL/transforms:

1. **Verify the collector is running and alive** (Kubernetes example):
   ```bash
   kubectl logs -n otel-system <collector-pod>
   # Look for "starting otelcontribcol" or config parse errors at startup
   ```

2. **Check if exporter is emitting** (any platform):
   ```bash
   # Enable debug logging in exporter config: debug_metrics: true
   # Then check: Are otelcol_exporter_sent_* metrics > 0 and climbing?
   # Or use health_check endpoint (default :13133)
   ```

3. **Verify receiver is receiving data**:
   - Do clients point to the correct receiver endpoint (default OTLP: 4317 gRPC, 4318 HTTP)?
   - Are they using the correct protocol (gRPC vs HTTP)?
   - Check receiver logs: `otelcol_receiver_accepted_*` metrics increasing?

4. **Check network connectivity**:
   ```bash
   # From collector → backend: DNS, TLS, routing, firewall, proxy?
   curl -v https://backend-endpoint:443
   # Or inside a container: nc -zv backend-endpoint 443
   ```

5. **Verify authentication**:
   - Are credentials (API key, TLS cert) correct and not expired?
   - Is the exporter passing auth headers correctly?

Reference: [validation.md](references/validation.md) for detailed commands per platform.

### 2. Diagnose: "Metric cardinality explosion" or "time-series overflow"

1. **Identify high-cardinality dimensions**:
   ```bash
   # If metrics are reaching backend, query your metrics store for series count by dimension
   # E.g., Prometheus: topk(10, count by (__name__, dimension_name) (...))
   ```

2. **Verify Rule of 100**:
   - Does any metric dimension have > 100 unique values? ❌ Move to span/log attributes or normalize.
   - Examples: `user_id`, `request_id`, `pod_name` (per pod × per host × ...) are all high-cardinality.

3. **Apply guardrails** (not a fix, a stopgap):
   ```yaml
   spanmetrics:
     aggregation_cardinality_limit: 1000  # overflow handling
   ```

4. **Normalize or drop** (permanent fix):
   - Use OTTL to extract low-cardinality parts (e.g., `http.route` instead of full URL).
   - Reference: [anti-patterns.md](references/anti-patterns.md) — "High-cardinality metric dimensions".

### 3. Fix: "Collector out of memory" or `memory_limiter` firing constantly

1. **Check if `memory_limiter` is first in processor chain**:
   - If not → move it to position 0 in `processors:` array. ❌ This is a critical anti-pattern.

2. **Adjust limits** (conservative defaults):
   ```yaml
   processors:
     memory_limiter:
       check_interval: 1s
       limit_percentage: 80        # 80% of pod memory limit
       spike_limit_percentage: 20  # allow 20% spike
   ```

3. **Check pod memory request/limit**:
   - `limit_mib` must leave headroom for Go runtime, OS buffers, and spike handling.
   - E.g., if pod limit is 1Gi, set `limit_percentage: 80` → ~800Mi for otelcol, ~200Mi for runtime.

4. **Enable disk-backed queues**:
   ```yaml
   exporters:
     otlp:
       sending_queue:
         enabled: true
         storage: file_storage/queue  # enables disk buffering
   ```

5. **Reduce receiver load** (if safe):
   - Enable sampling (head or tail) to reduce span/metric volume.
   - Reference: [sampling.md](references/sampling.md).

Reference: [collector.md](references/collector.md) — "Memory and Performance" section.



When the user provides an existing collector config, Helm values file, or Kubernetes manifest, audit it for internal contradictions before proposing edits.

Check these interactions together:

1. **Memory vs pod limit** — `limit_mib` must leave headroom for the Go runtime and buffers.
2. **Stateful processing vs scaling** — `tail_sampling`, `spanmetrics`, and `servicegraph` need sticky routing above one replica.
3. **Durability vs outage tolerance** — disabled retries and no persistent queue mean data loss on backend failure.
4. **Deployment mode vs exposure** — `hostPort` fits DaemonSet/node-local patterns, not scaled gateway Deployments.
5. **Rollout settings** — review `replicaCount`, HPA `minReplicas`, PodDisruptionBudget, and rolling updates together.
6. **OTTL/filter correctness** — keep attribute types consistent and prefer current semantic convention keys.
7. **Metric temporality and state** — `deltatocumulative` / `cumulativetodelta` need source/backend/restart checks.
8. **Queue storage backend** — `file_storage` needs local locking-safe storage; RWX, EFS, and NFS are unsafe defaults.

## Progressive Disclosure: Context Triggers

Load detailed reference documentation only when the user's request matches a trigger. This keeps context lean.

| Trigger keywords | Load | Key topics |
|---|---|---|
| Kubernetes, Helm, values.yaml, audit, review, DaemonSet, Sidecar, Gateway, Scaling, Load Balancing | [architecture.md](references/architecture.md) | DaemonSet vs Gateway vs Sidecar, Target Allocator, HPA, rollout consistency |
| Pipeline, Receiver, Processor, Exporter, Queue, Batch, Memory, Extensions, existing config | [collector.md](references/collector.md) | Processor ordering, memory_limiter, file_storage, config audit heuristics, temporality/state audits, stability levels |
| SDK, Instrumentation, Spans, Attributes, Semantic Conventions, Cardinality | [instrumentation.md](references/instrumentation.md) | Auto vs manual, SemConv, cardinality Rule of 100 |
| Sampling, Cost, Volume, Head Sampling, Tail Sampling, Probabilistic | [sampling.md](references/sampling.md) | Head/tail sampling, sticky sessions, sampling math |
| Security, PII, GDPR, Redaction, TLS, Authentication, Credentials | [security.md](references/security.md) | PII redaction, mTLS, RBAC, extension exposure risks |
| Monitor the collector, Health, Alerts, Self-monitoring, Collector metrics | [monitoring.md](references/monitoring.md) | otelcol_* metrics, dashboards, alert rules |
| Lambda, Azure Functions, GCP Functions, Serverless, FaaS, Mobile, Browser | [platforms.md](references/platforms.md) | FaaS patterns, Lambda extension layer, client-side apps |
| OTTL, Transform, Transformation, Modify, Filter attributes, Parse, Extract | [ottl.md](references/ottl.md) | OTTL syntax, context types, built-in functions, error handling |
| Connector, spanmetrics, servicegraph, routing connector, failover connector | [connectors.md](references/connectors.md) | R.E.D. metrics, service graph, routing, failover, stickiness |
| Claude Code, Codex, Gemini CLI, Copilot, AI agent, coding agent, MCP | [ai-agents.md](references/ai-agents.md) | Agent OTel support matrix, unified collector config, GenAI SemConv |
| validate, dry-run, startup error, pipeline error, dropped data, queue full, recovery | [validation.md](references/validation.md) | Config validation commands, live checks, symptom→cause→fix recovery guidance |
| playbook, production playbook, blog, 2025 blog, 2026 blog, real world | [playbooks.md](references/playbooks.md) | Production patterns from opentelemetry.io blogs |
| anti-pattern, common mistake, what to avoid, pitfall | [anti-patterns.md](references/anti-patterns.md) | Full annotated anti-pattern catalogue: pipeline, metrics, Kubernetes, AI agents, OTTL |

## Production Baseline Configuration

Use this copy-paste-ready baseline unless the user wants something different:

```yaml
extensions:
  health_check:
    endpoint: "0.0.0.0:13133"
  file_storage/queue:
    directory: /var/lib/otelcol/queue
    timeout: 10s
    compaction:
      on_start: true
      on_rebound: false

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: "0.0.0.0:4317"
      http:
        endpoint: "0.0.0.0:4318"

processors:
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 20
  batch:
    timeout: 10s
    send_batch_size: 1024

exporters:
  otlp:
    endpoint: "your-backend:4317"
    sending_queue:
      enabled: true
      storage: file_storage/queue
      num_consumers: 4
      queue_size: 1024
    retry_on_failure:
      enabled: true
      initial_interval: 1s
      max_interval: 30s
      max_elapsed_time: 300s
  # otlphttp:                        # HTTP exporter — use when backend requires HTTP
  #   endpoint: "https://your-backend:4318"
  #   sending_queue: { enabled: true, storage: file_storage/queue }

service:
  extensions: [health_check, file_storage/queue]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

Key defaults:

- `memory_limiter` must be first in every processor chain.
- `batch` reduces exporter network calls.
- `file_storage` preserves queues across restarts only on the same host/volume. In Kubernetes, back `/var/lib/otelcol/queue` with a `ReadWriteOnce` block-backed PVC, not RWX/network storage.
- `health_check` binds to `localhost` (not `0.0.0.0`) in shared networks.
- Prefer OTLP gRPC (port 4317) for receivers and exporters. Fall back to OTLP HTTP (port 4318) when gRPC is unavailable.

## Validation & Error Recovery

Always include at least one validation checkpoint: `otelcol validate --config <path>`.
For container dry-run commands, live pipeline checks, and symptom→cause→fix recovery, load [validation.md](references/validation.md).

## Anti-Patterns to Avoid

❌ Placing `memory_limiter` anywhere except first in the processor chain
❌ Using high-cardinality attributes (user_id, trace_id) as metric dimensions
❌ Exposing pprof (1777), zpages (55679) on `0.0.0.0` in production
❌ Using `tail_sampling` without sticky session load balancing (loadbalancing exporter)
❌ Omitting `batch` processor (causes excessive network calls)
❌ Calling a config "fine" because it parses, without checking memory limits, sticky routing, exporter durability, and rollout settings together

See [anti-patterns.md](references/anti-patterns.md) for the full annotated catalog.

## Version and Compatibility

- Use [compatibility.md](references/compatibility.md) for fast-moving version floors and AI agent support details.
- Keep `SKILL.md` focused on routing logic, guardrails, and production defaults rather than inline release tracking.
