---
name: opentelemetry-skill
description: "Expert OpenTelemetry guidance for collector configuration, pipeline design, and production telemetry instrumentation. Use when configuring collectors, designing pipelines, instrumenting applications, implementing sampling, managing cardinality, securing telemetry, writing OTTL transformations, or setting up AI coding agent observability (Claude Code, Codex, Gemini CLI, GitHub Copilot)."
license: Apache-2.0
metadata:
  author: o11y.dev
  version: 1.2.0
---

# OpenTelemetry Skill

## Core Principles

Always adhere to these guiding principles:

1. **Stability over Features**: Check component stability levels (Alpha/Beta/Stable) in otelcol-contrib. Warn users about non-stable components in production.

2. **Convention over Configuration**: Always prefer OpenTelemetry Semantic Conventions over custom attribute names.

3. **Protocol Unification**: Default to **OTLP gRPC** (port 4317); use **OTLP HTTP** (port 4318) when gRPC is unavailable due to agent, proxy, browser, or backend constraints.

4. **Deterministic Routing Keys**: For load-balancing exporters, routing keys must be deterministic, low-cardinality strings (e.g., `traceID`, `tenant_id`, `cluster`). Normalize non-string attributes before routing.

5. **Safety First**: Prioritize collector stability (memory limiters, persistent queues, backpressure) over data completeness. Dropping data is preferable to crashing the collector.

6. **Cardinality Awareness**: High-cardinality attributes (>100 unique values) must NOT be metric dimensions — use traces or logs instead.

7. **Security by Default**: Redact PII, enable TLS for cross-network communication, and authenticate all collector endpoints.

8. **Cross-Field Consistency**: Treat collector reviews as systems reviews, not YAML linting. Compare processor order, memory limits, replica strategy, routing, metric temporality state, queue storage medium, PDB/HPA settings, and OTTL attribute types together before calling a config "safe".

## Pre-Flight Checklist

Before generating any configuration or code, verify these critical factors. If any are undefined, ask the user:

1. **Signal volume** — High-traffic (>10k RPS) vs low-volume? Determines sampling and scaling needs. → Load [sampling.md](references/sampling.md), [collector.md](references/collector.md)
2. **Cardinality risk** — Any unbounded attributes (user IDs, request IDs, session IDs) in metrics? Force those to traces/logs instead. → Load [instrumentation.md](references/instrumentation.md)
3. **Resiliency** — Can you tolerate data loss during restarts/outages? If not, enable `file_storage` + persistent queues. → Load [collector.md](references/collector.md)
4. **Trust boundaries** — Signals crossing public networks? Require TLS + mTLS. → Load [security.md](references/security.md)
5. **Deployment target** — Kubernetes (DaemonSet/Deployment), EC2, Lambda, or containers? → Load [architecture.md](references/architecture.md)

## Existing Configuration Review Mode

When the user provides an existing collector config, Helm values file, or Kubernetes manifest, audit it for internal contradictions before proposing edits.

Always compare:

1. **Memory limiter vs pod limit** — `limit_mib` must stay below the container memory limit with headroom for the Go runtime and internal buffers.
2. **Stateful processing vs scaling** — `tail_sampling`, `spanmetrics`, and `servicegraph` require sticky routing when replicas can exceed 1.
3. **Exporter durability vs outage tolerance** — disabled retries and no persistent queue imply data loss during backend failures.
4. **Network exposure vs deployment mode** — `hostPort` is usually a DaemonSet/node-local choice, not a horizontally scaled gateway Deployment default.
5. **Rollout settings together** — review `replicaCount`, HPA `minReplicas`, PodDisruptionBudget, and rolling update settings as one unit.
6. **OTTL/filter correctness** — keep attribute types consistent (for example bool vs string) and prefer current semantic convention keys such as `http.response.status_code`.
7. **Dead config** — flag processors/exporters/extensions that are declared but never referenced by any pipeline.
8. **Metric temporality and state** — `deltatocumulative` / `cumulativetodelta` are stateful conversions; verify source temporality, backend expectations, restart tolerance, and any replica/routing assumptions before enabling them.
9. **Queue storage backend** — `file_storage` needs local locking-safe storage; `ReadWriteMany` / EFS / NFS-style volumes are not safe defaults.

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
| playbook, production playbook, blog, 2025 blog, 2026 blog, real world | [playbooks.md](references/playbooks.md) | Production patterns from opentelemetry.io blogs |
| anti-pattern, common mistake, what to avoid, pitfall | [anti-patterns.md](references/anti-patterns.md) | Full annotated anti-pattern catalogue: pipeline, metrics, Kubernetes, AI agents, OTTL |

## Production Baseline Configuration

Use these defaults unless the user specifies otherwise. This is a copy-paste-ready starting point:

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
- `file_storage` preserves queues across restarts only when the collector returns to the same host/volume. In Kubernetes, back `/var/lib/otelcol/queue` with a `ReadWriteOnce` block-backed PVC rather than RWX/network storage.
- `health_check` binds to `localhost` (not `0.0.0.0`) in shared networks.
- Prefer OTLP gRPC (port 4317) for receivers and exporters. Fall back to OTLP HTTP (port 4318) when gRPC is unavailable.

## Validation & Error Recovery

Always include validation checkpoints when delivering configurations.

### Validate before deploying

```bash
# Syntax and structural validation (local binary)
otelcol validate --config config.yaml

# Container-based dry-run (no outbound traffic)
docker run --rm -v $(pwd)/config.yaml:/etc/otelcol/config.yaml \
  otel/opentelemetry-collector-contrib:latest \
  validate --config /etc/otelcol/config.yaml
```

### Verify a live pipeline

```bash
# Health endpoint — returns 200 when collector is ready
curl -sf http://localhost:13133/ && echo "healthy"

# Tail logs for pipeline errors and dropped data
kubectl logs -l app=otelcol -f | grep -E "error|dropped|refused|timeout"

# Collector self-metrics (Prometheus scrape)
curl -s http://localhost:8888/metrics | grep -E "otelcol_processor_dropped|otelcol_exporter_send_failed"
```

### Error recovery guidance

| Symptom | Likely cause | Fix |
|---|---|---|
| Collector exits at start | Config parse error | Run `otelcol validate`; check indentation and quoted strings |
| `memory_limiter: data dropped` in logs | Memory limit hit | Increase `limit_percentage`, reduce `send_batch_size`, or add upstream sampling |
| `exporter queue is full` | Backend unreachable or slow | Verify endpoint reachability; increase `queue_size`; check `retry_on_failure` settings |
| `pipeline drops data` on restart | No persistent queue | Add `file_storage` extension and set `storage: file_storage/queue` in exporter sending_queue |
| OTTL statement silently skipped | Type mismatch or nil value | Add `error_mode: ignore`; guard with `where attributes["key"] != nil`; use `Int()` / `String()` converters |
| Tail sampling misses spans | Spans split across collector instances | Use `loadbalancing` exporter with `routing_key: traceID` upstream |

## Anti-Patterns to Avoid

The most critical patterns are listed here. See [anti-patterns.md](references/anti-patterns.md) for the full annotated catalog.

❌ Placing `memory_limiter` anywhere except first in the processor chain
❌ Using high-cardinality attributes (user_id, trace_id) as metric dimensions
❌ Exposing pprof (1777), zpages (55679) on `0.0.0.0` in production
❌ Using `tail_sampling` without sticky session load balancing (loadbalancing exporter)
❌ Omitting `batch` processor (causes excessive network calls)
❌ Calling a config "fine" because it parses, without checking memory limits, sticky routing, exporter durability, and rollout settings together

## Version and Compatibility

- Use [compatibility.md](references/compatibility.md) for fast-moving version floors and AI agent support details.
- Keep `SKILL.md` focused on routing logic, guardrails, and production defaults rather than inline release tracking.
