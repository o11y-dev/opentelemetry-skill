---
name: opentelemetry-skill
description: "Configure, review, and troubleshoot OpenTelemetry (OTel) collectors and application instrumentation for tracing, metrics, and logs. Use for OTLP pipelines, Kubernetes/Helm or container deployments, SDK setup, sampling, metric cardinality, OTTL transforms, telemetry security, collector monitoring, and AI coding-agent observability (Claude Code, Codex, Gemini CLI, GitHub Copilot)."
metadata:
  author: o11y.dev
  version: 0.5.3
  tessl_version: 0.5.3
  license: Apache-2.0
  tags: "opentelemetry, otel, observability, telemetry, monitoring, tracing, metrics, logs, collector, otelcol, pipeline, instrumentation, kubernetes, ecs, docker, serverless, deployment, architecture, sampling, cardinality, security, ottl, transform, codex, ai-agent"
  signals: "traces, metrics, logs, profiles"
  deployments: "kubernetes, ecs, docker, vm, serverless, lambda, gcp-functions, azure-functions"
  deployment_patterns: "daemonset, sidecar, gateway, standalone, serverless"
  supported_platforms: "aws, gcp, azure, on-premises"
  vendor_agnostic: "true"
  triggers: >-
    file_patterns: **/collector*.yaml, **/otelcol*.yaml, **/values*.yaml,
    **/trace-config*.yaml, **/metric-config*.yaml, **/log-config*.yaml,
    **/helm*.yaml, **/docker-compose*.yaml, **/task-definition*.yaml,
    **/task-definition*.json; config_keys: receivers:, processors:, exporters:,
    service:, pipelines:, extensions:, connectors:; keywords: opentelemetry, otel,
    otelcol, collector, observability, traces, metrics, logs, pipeline, sampler,
    sampling, cardinality, instrumentation, kubernetes, helm, ecs, docker, compose,
    serverless, lambda, deployment, architecture, receiver, processor, exporter,
    connector, span_metrics, service_graph, signal_to_metrics, tail sampling,
    memory limiter, batch processor, ottl, transform, security, tls, pii, redaction,
    codex, ai-agent, genai
---

# OpenTelemetry Skill

## Workflow

1. **Scope the request.** Identify the signals, deployment target, Collector/SDK version, backend protocol, expected volume, outage tolerance, and trust boundaries from the supplied files or context. Ask only for missing details that change the design; state assumptions for a draft.
2. **Load relevant references.** Use the trigger table below. For version-sensitive settings, check [compatibility.md](references/compatibility.md) and the upstream documentation for the installed release.
3. **Choose the work mode.** For an existing configuration, apply the review checks below and report concrete contradictions before editing. For a new pipeline or instrumentation, adapt the relevant example to the user's environment. For missing or dropped telemetry, follow [validation.md](references/validation.md) from source through Collector to backend.
4. **Validate and correct.** For Collector changes, run `otelcol validate --config <path>` with the target distribution/version; render Helm values before validating the resulting config. For SDK changes, exercise a representative request and inspect emitted telemetry. Fix reported failures and repeat the affected check; if blocked, report the exact failure and remaining verification.
5. **Deliver the result.** Include the findings or changed config/code, reasons for consequential choices, and checks performed with their results. Separate configuration validity from observed end-to-end delivery; do not claim live recovery from parsing or a health endpoint alone.

## Design Guardrails

- **Collector memory:** put `memory_limiter` first in every pipeline to prevent OOM crashes; size it below the container/host limit with runtime and buffer headroom. Prefer backpressure or controlled drops over crashing the Collector.
- **Metric cardinality:** reject unbounded `user_id`, `request_id`, `session.id`, or `trace_id` dimensions and explain time-series growth. Suggest privacy-safe traces/logs plus bounded metric labels; use the Rule of 100 in [instrumentation.md](references/instrumentation.md) as the review heuristic.
- **Transport:** default to OTLP gRPC (4317); use OTLP HTTP (4318) when the client, proxy, browser, or backend requires it.
- **Security:** redact PII; use TLS and authentication across trust boundaries, with mTLS where mutual peer identity is required. Keep health/debug endpoints private; never expose pprof or zpages publicly.
- **Conventions and stability:** prefer OpenTelemetry Semantic Conventions; verify component stability for the selected release and warn about non-stable production dependencies.
- **Routing:** use stable keys (`traceID` for tail sampling, `tenant_id` or `cluster` for tenant/shard routing); normalize non-string attributes first. For Kubernetes tail sampling, use a Gateway Deployment tier behind `load_balancing` with `routing_key: traceID` and a Headless Service (`clusterIP: None`). For a keep-errors-plus-10% request, include error and probabilistic policies. Explicitly warn that `tail_sampling` is Beta in Collector 0.160; check the target release before claiming a different stability level.

## AI Agent Instrumentation

For coding-agent requests, load [ai-agents.md](references/ai-agents.md) and apply these signal-specific constraints:

- **Claude Code telemetry**: include `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`, and managed-settings persistence; traces are beta, while metrics and logs/events remain the broadly documented signals. Keep prompt/tool-content capture disabled unless PII controls are explicit, and avoid `session.id` as a metric dimension.
- **AI agent tool-call tracing**: for agents using current `gen_ai.*` conventions, set `gen_ai.operation.name: execute_tool`, preserve `gen_ai.tool.name`, and use `execute_tool {gen_ai.tool.name}` for manually generated tool spans; keep the registered tool name in the attribute as well. These GenAI conventions are Development; preserve vendor-native spans.
- **GenAI provider vs agent identity**: preserve `gen_ai.provider.name` for the model/provider (for example, `openai` or `gcp.gen_ai`); use `service.name` or a natively emitted agent attribute for the coding-agent identity rather than writing the agent name into the provider field.

## Existing Configuration Review Mode

Audit these interactions together; a configuration that parses can still lose or corrupt telemetry:

1. **Memory vs pod limit** — compare the limiter's actual ceiling with the pod limit, not just the configured percentage.
2. **Stateful processing vs scaling** — `tail_sampling`, `span_metrics`, and `service_graph` need sticky routing above one replica.
3. **Durability vs outage tolerance** — disabled retries and no persistent queue mean data loss on backend failure.
4. **Deployment mode vs exposure** — `hostPort` fits DaemonSet/node-local patterns, not scaled gateway Deployments.
5. **Rollout settings** — review `replicaCount`, HPA `minReplicas`, PodDisruptionBudget, and rolling updates together.
6. **OTTL/filter correctness** — keep attribute types consistent and prefer current semantic convention keys.
7. **Metric temporality and state** — `deltatocumulative` / `cumulativetodelta` need source/backend/restart checks.
8. **Queue storage backend** — `file_storage` needs local locking-safe storage; RWX, EFS, and NFS are unsafe defaults.
9. **Generated metric identity** — for log/span-to-metric connectors, verify replica count, export mode, actual temporality, whether the emitted producer identity survives backend mapping, and the aggregation query shape together.

## Progressive Disclosure: Context Triggers

Load detailed reference documentation only when the user's request matches a trigger. This keeps context lean.

| Trigger keywords | Load | Key topics |
|---|---|---|
| Kubernetes, Helm, values.yaml, audit, review, DaemonSet, Sidecar, Gateway, Scaling, Load Balancing | [architecture.md](references/architecture.md) | DaemonSet vs Gateway vs Sidecar, Target Allocator, HPA, rollout consistency |
| Pipeline, Receiver, Processor, Exporter, Queue, Batch, Memory, Extensions, existing config | [collector.md](references/collector.md) | Processor ordering, memory_limiter, file_storage, config audit heuristics, temporality/state audits, stability levels |
| Python, FastAPI, Starlette, asyncio, Python GenAI, Python SDK events | [python-instrumentation.md](references/python-instrumentation.md) | Initialization ownership, duplicate instrumentation, SDK 1.44 migration, streaming, GenAI packages |
| SDK, Instrumentation, Spans, Attributes, Semantic Conventions, Cardinality | [instrumentation.md](references/instrumentation.md) | Auto vs manual, SemConv, cardinality Rule of 100 |
| Sampling, Cost, Volume, Head Sampling, Tail Sampling, Probabilistic | [sampling.md](references/sampling.md) | Head/tail sampling, sticky sessions, sampling math |
| Security, PII, GDPR, Redaction, TLS, Authentication, Credentials | [security.md](references/security.md) | PII redaction, mTLS, RBAC, extension exposure risks |
| Monitor the collector, Health, Alerts, Self-monitoring, Collector metrics | [monitoring.md](references/monitoring.md) | otelcol_* metrics, dashboards, alert rules |
| Lambda, Azure Functions, GCP Functions, Serverless, FaaS, Mobile, Browser | [platforms.md](references/platforms.md) | FaaS patterns, Lambda extension layer, client-side apps |
| OTTL, Transform, Transformation, Modify, Filter attributes, Parse, Extract | [ottl.md](references/ottl.md) | OTTL syntax, context types, built-in functions, error handling |
| Connector, span_metrics, service_graph, signal_to_metrics, log-to-metric, span-to-metric, routing connector, failover connector | [connectors.md](references/connectors.md) | R.E.D. metrics, service graph, routing, failover, stickiness, generated-metric producer identity |
| Claude Code, Codex, Gemini CLI, Copilot, AI agent, coding agent, MCP | [ai-agents.md](references/ai-agents.md) | Agent OTel support matrix, unified collector config, GenAI SemConv |
| validate, dry-run, startup error, pipeline error, dropped data, queue full, recovery | [validation.md](references/validation.md) | Config validation commands, live checks, symptom→cause→fix recovery guidance |
| playbook, production playbook, blog, developer observability, local OTel viewer, real world | [playbooks.md](references/playbooks.md) | Production and developer patterns from OpenTelemetry and CNCF blogs |
| anti-pattern, common mistake, what to avoid, pitfall | [anti-patterns.md](references/anti-patterns.md) | Full annotated anti-pattern catalogue: pipeline, metrics, Kubernetes, AI agents, OTTL |

## Production Baseline Configuration

Start from this local receiver baseline, then adapt it to the confirmed deployment. Before use, replace `your-backend:4317` with a TLS-enabled backend, supply its authentication as required, and mount a writable persistent queue directory. Network-facing receivers need explicit bind addresses, TLS/authentication, and network access controls from [security.md](references/security.md).

```yaml
extensions:
  health_check:
    endpoint: "127.0.0.1:13133"
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
        endpoint: "127.0.0.1:4317"
      http:
        endpoint: "127.0.0.1:4318"

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

Deployment notes:

- `batch` reduces exporter network calls.
- `file_storage` preserves queues across restarts only on the same host/volume. In Kubernetes, back `/var/lib/otelcol/queue` with a `ReadWriteOnce` block-backed PVC, not RWX/network storage.
- Loopback listeners are reachable only within the same network namespace. For Kubernetes HTTP probes or remote clients, bind the required endpoint to the pod interface and restrict access; otherwise the probe/client cannot connect.
