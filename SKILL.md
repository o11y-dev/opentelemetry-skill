---
name: opentelemetry-skill
description: "Build OpenTelemetry collector configs, instrument services, transform telemetry with OTTL, and debug missing traces, metrics, or logs. Use for OTel/otelcol collector config, OTLP export, SDK instrumentation, sampling, cardinality, TLS/PII controls, Kubernetes/Helm values.yaml deployments, collector health and alerts, and AI coding-agent telemetry (Claude Code, Codex, Antigravity, GitHub Copilot)."
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
3. **Choose the work mode.** For existing configuration, apply the review checks below before editing. For a new Collector pipeline, load [production-baseline.md](references/production-baseline.md) and the platform setup guide; adapt their examples to the user's environment. For instrumentation, load the matching SDK/agent reference. For missing or dropped telemetry, follow [validation.md](references/validation.md) from source through Collector to backend.
4. **Validate and correct.** For Collector changes, run `otelcol validate --config <path>` with the target distribution/version; render Helm values before validating the resulting config. For SDK changes, exercise a representative request and inspect emitted telemetry. Fix reported failures and repeat the affected check; if blocked, report the exact failure and remaining verification.
5. **Deliver the result.** Include the findings or changed config/code, reasons for consequential choices, and checks performed with their results. Separate configuration validity from observed end-to-end delivery; do not claim live recovery from parsing or a health endpoint alone.

## Design Guardrails

- **Collector memory:** put `memory_limiter` first in every pipeline to prevent OOM crashes; size it below the container/host limit with runtime and buffer headroom. Prefer backpressure or controlled drops over crashing the Collector.
- **Metric cardinality:** reject unbounded `user_id`, `request_id`, `session.id`, or `trace_id` dimensions and explain time-series growth. Suggest privacy-safe traces/logs plus bounded metric labels; use the Rule of 100 in [instrumentation.md](references/instrumentation.md) as the review heuristic.
- **Transport:** default to OTLP gRPC (4317); use OTLP HTTP (4318) when the client, proxy, browser, or backend requires it.
- **Security:** redact PII; use TLS and authentication across trust boundaries, with mTLS where mutual peer identity is required. Keep health/debug endpoints private; never expose pprof or zpages publicly.
- **Conventions and stability:** prefer OpenTelemetry Semantic Conventions; verify component stability for the selected release and warn about non-stable production dependencies.
- **Routing:** use stable keys (`traceID` for tail sampling, `tenant_id` or `cluster` for tenant/shard routing); normalize non-string attributes first.
- **Kubernetes tail sampling:** use a Gateway Deployment behind `load_balancing` with `routing_key: traceID` and a Headless Service (`clusterIP: None`). For keep-errors-plus-10%, include error and probabilistic policies. Explicitly warn that `tail_sampling` is Beta in Collector 0.160; recheck stability for other releases.

## AI Agent Instrumentation

For coding-agent requests, load [ai-agents.md](references/ai-agents.md) and apply these signal-specific constraints:

- **Claude Code telemetry**: include `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`, and managed-settings persistence; traces are beta, while metrics and logs/events remain the broadly documented signals. Keep prompt/tool-content capture disabled unless PII controls are explicit, and avoid `session.id` as a metric dimension.
- **AI agent tool-call tracing**: for agents using current `gen_ai.*` conventions, set `gen_ai.operation.name: execute_tool`, preserve `gen_ai.tool.name`, and use `execute_tool {gen_ai.tool.name}` for manually generated tool spans; keep the registered tool name in the attribute as well. These GenAI conventions are Development; preserve vendor-native spans.
- **GenAI provider vs agent identity**: preserve `gen_ai.provider.name` for the model/provider (for example, `openai` or `gcp.gen_ai`); use `service.name` or a natively emitted agent attribute for the coding-agent identity rather than writing the agent name into the provider field.

## Existing Configuration Review Mode

Check these interactions, beyond configuration syntax:

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

Load only the references matching the request:

| Trigger keywords | Load | Key topics |
|---|---|---|
| New Collector pipeline, baseline config | [production-baseline.md](references/production-baseline.md) | Complete OTLP config, required substitutions, storage and listener setup |
| Choose deployment platform | [setup-index.md](references/setup-index.md) | Platform decision matrix |
| Deploy to Kubernetes, Helm values.yaml | [setup-kubernetes.md](references/setup-kubernetes.md) | DaemonSet, Gateway and sidecar manifests |
| Deploy to ECS, Fargate | [setup-ecs.md](references/setup-ecs.md) | Task definitions, IAM and secrets |
| Deploy to Docker, Compose | [setup-docker.md](references/setup-docker.md) | Container networking, resources and volumes |
| Deploy to VM, EC2, systemd, Windows service | [setup-vm.md](references/setup-vm.md) | Service lifecycle and host setup |
| Kubernetes, Helm, values.yaml, audit, review, DaemonSet, Sidecar, Gateway, Scaling, Load Balancing | [architecture.md](references/architecture.md) | DaemonSet vs Gateway vs Sidecar, Target Allocator, HPA, rollout consistency |
| Pipeline, Receiver, Processor, Exporter, Queue, Batch, Memory, Extensions, existing config | [collector.md](references/collector.md) | Processor ordering, memory_limiter, file_storage, config audit heuristics, temporality/state audits, stability levels |
| Python, FastAPI, Starlette, asyncio, Python GenAI, Python SDK events | [python-instrumentation.md](references/python-instrumentation.md) | Initialization ownership, duplicate instrumentation, SDK 1.44 migration, streaming, GenAI packages |
| JavaScript, Node.js, OTel JS 3.0, tracing SDK migration | [javascript-otel3-readiness.md](references/javascript-otel3-readiness.md) | Runtime floor, removed packages, tracing SDK imports, custom instrumentation review |
| SDK, Instrumentation, Spans, Attributes, Semantic Conventions, Cardinality | [instrumentation.md](references/instrumentation.md) | Auto vs manual, SemConv, cardinality Rule of 100 |
| Sampling, Cost, Volume, Head Sampling, Tail Sampling, Probabilistic | [sampling.md](references/sampling.md) | Head/tail sampling, sticky sessions, sampling math |
| Security, PII, GDPR, Redaction, TLS, Authentication, Credentials | [security.md](references/security.md) | PII redaction, mTLS, RBAC, extension exposure risks |
| Monitor the collector, Health, Alerts, Self-monitoring, Collector metrics | [monitoring.md](references/monitoring.md) | otelcol_* metrics, dashboards, alert rules |
| Lambda, Azure Functions, GCP Functions, Serverless, FaaS, Mobile, Browser | [platforms.md](references/platforms.md) | FaaS patterns, Lambda extension layer, client-side apps |
| OTTL, Transform, Transformation, Modify, Filter attributes, Parse, Extract | [ottl.md](references/ottl.md) | OTTL syntax, context types, built-in functions, error handling |
| Connector, span_metrics, service_graph, signal_to_metrics, log-to-metric, span-to-metric, routing connector, failover connector | [connectors.md](references/connectors.md) | R.E.D. metrics, service graph, routing, failover, stickiness, generated-metric producer identity |
| Claude Code, Codex, Antigravity, Copilot, AI agent, coding agent, MCP | [ai-agents.md](references/ai-agents.md) | Agent OTel support matrix, unified collector config, GenAI SemConv |
| validate, dry-run, startup error, pipeline error, dropped data, queue full, recovery | [validation.md](references/validation.md) | Config validation commands, live checks, symptom→cause→fix recovery guidance |
| playbook, production playbook, blog, developer observability, local OTel viewer, real world | [playbooks.md](references/playbooks.md) | Production and developer patterns from OpenTelemetry and CNCF blogs |
| anti-pattern, common mistake, what to avoid, pitfall | [anti-patterns.md](references/anti-patterns.md) | Full annotated anti-pattern catalogue: pipeline, metrics, Kubernetes, AI agents, OTTL |
