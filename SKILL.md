---
name: opentelemetry-skill
description: "Expert OpenTelemetry guidance for collector configuration, observability pipeline design, and production telemetry instrumentation. Use when working with OpenTelemetry - configuring collectors, designing pipelines, instrumenting applications, implementing sampling strategies, managing cardinality, securing telemetry data, troubleshooting observability issues, writing OTTL transformations, making production observability architecture decisions, or setting up observability for AI coding agents (Claude Code, Codex, Gemini CLI, GitHub Copilot, and others)"
license: Apache-2.0
metadata:
  author: o11y.dev
  version: 1.2.0
---

# OpenTelemetry Skill

## Core Principles

Always adhere to these guiding principles:

1. **Stability over Features**: Check component stability levels (Alpha/Beta/Stable) in otelcol-contrib. Warn users about non-stable components in production environments.

2. **Convention over Configuration**: Always prefer OpenTelemetry Semantic Conventions over custom attribute naming. Use standard attribute names from the semantic conventions specification.

3. **Protocol Unification**: Always prefer OTLP (gRPC/HTTP) over legacy protocols (Zipkin, Jaeger, Prometheus Remote Write) unless there are specific compatibility requirements.

4. **Deterministic Routing Keys**: For load-balancing exporters, routing keys must be deterministic, low-cardinality strings (e.g., `traceID`, `tenant_id`, `cluster`). Normalize/stringify non-string attributes before routing to prevent shard churn and ensure sticky sessions for stateful processors.

5. **Safety First**: Prioritize collector stability (memory limiters, persistent queues, backpressure) over data completeness. Dropping data is preferable to crashing the collector.

6. **Cardinality Awareness**: Always evaluate the cardinality implications of attributes. High-cardinality attributes (>100 unique values) should NOT be metric dimensions—use traces or logs instead.

7. **Security by Default**: Never expose sensitive data in telemetry. Always consider PII redaction, TLS encryption, and authentication.

## Pre-Flight Checklist

Before generating any configuration or code, verify these critical factors. If any are undefined, ask the user:

1. **Signal volume** — High-traffic (>10k RPS) vs low-volume? Determines sampling and scaling needs. → Load `references/sampling.md`, `references/collector.md`
2. **Cardinality risk** — Any unbounded attributes (user IDs, request IDs, session IDs) in metrics? Force those to traces/logs instead. → Load `references/instrumentation.md`
3. **Resiliency** — Can you tolerate data loss during restarts/outages? If not, enable `file_storage` + persistent queues. → Load `references/collector.md`
4. **Trust boundaries** — Signals crossing public networks? Require TLS + mTLS. → Load `references/security.md`
5. **Deployment target** — Kubernetes (DaemonSet/Deployment), EC2, Lambda, or containers? → Load `references/architecture.md`

## Progressive Disclosure: Context Triggers

Use these triggers to load detailed reference documentation only when needed. This optimizes context usage and prevents information overload.

### Trigger: Architecture & Deployment
**Keywords**: "Kubernetes", "Helm", "Deployment", "DaemonSet", "Sidecar", "Gateway", "Scaling", "Load Balancing", "Horizontal Scaling"

**Action**: Load `references/architecture.md`

**Contains**:
- DaemonSet vs Gateway vs Sidecar decision matrix
- Load balancing strategies for tail sampling (sticky sessions)
- Horizontal scaling patterns with Target Allocator
- Resource sizing and HPA configuration

### Trigger: Collector Configuration
**Keywords**: "Pipeline", "Receiver", "Processor", "Exporter", "Queue", "Batch", "Memory", "Components", "Extensions"

**Action**: Load `references/collector.md`

**Contains**:
- Pipeline anatomy and processor ordering rules
- memory_limiter configuration (critical for stability)
- Persistent queues with file_storage
- Core vs Contrib component stability levels
- Batch processor optimization
- **Tip**: For the `loadbalancing` exporter, the `routing_key` should be a stable, low-cardinality string (e.g., `traceID`, `tenant_id`, `cluster`). Normalize non-string attributes to strings before routing to avoid shard churn.

### Trigger: Instrumentation & SDKs
**Keywords**: "SDK", "Instrumentation", "Automatic", "Manual", "Spans", "Attributes", "Semantic Conventions", "Cardinality"

**Action**: Load `references/instrumentation.md`

**Contains**:
- Auto-instrumentation vs manual instrumentation trade-offs
- Semantic conventions enforcement
- Cardinality management and the "Rule of 100"
- Language-specific SDK patterns (Java, Python, Go, Node.js)

### Trigger: Sampling Strategies
**Keywords**: "Sampling", "Cost", "Volume", "Budget", "Head Sampling", "Tail Sampling", "Probabilistic", "Rate Limiting"

**Action**: Load `references/sampling.md`

**Contains**:
- Head sampling (ParentBasedTraceIdRatio) configuration
- Tail sampling policies (latency, error, probabilistic)
- Statistical implications and sampling math
- Architecture requirements for tail sampling (sticky sessions)

### Trigger: Security & Compliance
**Keywords**: "Security", "PII", "GDPR", "Redaction", "Masking", "TLS", "Authentication", "Credentials", "Sensitive Data"

**Action**: Load `references/security.md`

**Contains**:
- PII redaction patterns and regex configurations
- TLS mutual authentication (mTLS)
- Extension security (pprof, zpages exposure risks)
- Least privilege and RBAC configuration

### Trigger: Meta-Monitoring
**Keywords**: "Monitor the collector", "Health", "Metrics", "Dashboard", "Alerts", "Self-monitoring", "Collector metrics"

**Action**: Load `references/monitoring.md`

**Contains**:
- Critical collector metrics (otelcol_* metrics)
- monitoringartist dashboard patterns
- Alert rules for data loss and resource exhaustion
- Health check endpoints and readiness probes

### Trigger: Platforms & Serverless
**Keywords**: "Lambda", "AWS Lambda", "Azure Functions", "Google Cloud Functions", "GCP Functions", "Serverless", "FaaS", "Functions as a Service", "Mobile", "Browser", "Client-side", "iOS", "Android", "Cold start", "Timeout"

**Action**: Load `references/platforms.md`

**Contains**:
- FaaS deployment patterns (Lambda, Azure, GCP)
- Lambda best practices (non-blocking export, timeout handling)
- Collector Extension Layer configuration
- Lambda layers and environment variables
- Client-side app patterns (mobile, browser)
- Platform-specific semantic conventions

### Trigger: OTTL (OpenTelemetry Transformation Language)
**Keywords**: "OTTL", "Transform", "Transformation", "Modify", "Filter attributes", "Parse", "Extract fields", "Redact", "Rename", "Context", "Statement", "Function", "Converter"

**Action**: Load `references/ottl.md`

**Contains**:
- OTTL syntax and context types (resource, scope, span, spanEvent, metric, datapoint, log)
- Built-in functions (set, delete, truncate, limit, replace_pattern, parse_json, etc.)
- Transformation patterns and best practices
- Performance considerations and optimization
- Common use cases (PII redaction, attribute enrichment, filtering)
- Error handling and debugging transformations

### Trigger: Connectors
**Keywords**: "Connector", "span-to-metrics", "spanmetrics", "service graph", "servicegraph", "routing connector", "failover connector", "cross-pipeline", "R.E.D. metrics", "pipeline bridge", "signal to metrics"

**Action**: Load `references/connectors.md`

**Contains**:
- Connector concept: simultaneously an exporter on one pipeline and a receiver on another
- spanmetricsconnector: R.E.D. (Rate, Errors, Duration) metrics from traces
- servicegraphconnector: service dependency graph metrics
- routingconnector: attribute-based pipeline routing
- failoverconnector: automatic pipeline failover
- countconnector and signaltometricsconnector
- Stickiness requirements for stateful connectors (spanmetrics, servicegraph)
- Stability levels and cardinality warnings

### Trigger: AI Coding Agent Observability
**Keywords**: "Claude Code", "Codex", "Codex CLI", "Gemini CLI", "Copilot", "GitHub Copilot", "Qwen Code", "OpenCode", "Cursor", "Windsurf", "Aider", "AI agent", "coding agent", "vibe coding", "AI coding", "coding assistant", "AI IDE", "agent telemetry", "agent observability", "agent monitoring", "agent identity", "agent trust", "sandbox", "code interpreter", "MCP"

**Action**: Load `references/ai-agents.md`

**Contains**:
- AI coding agent OTel support matrix (traces, metrics, logs per agent)
- Per-agent quick-start configuration (env vars, settings files)
- Unified OTel Collector config for multi-agent ingestion
- Event/metric taxonomy and GenAI semantic convention mapping
- Dashboard patterns and community resources
- Privacy controls and cardinality management for agent telemetry

### Trigger: Playbooks & Production Patterns
**Keywords**: "playbook", "production playbook", "blog", "2025 blog", "2026 blog", "production deployment", "real world", "example deployment", "platform team", "Gateway API", "mTLS", "Lambda extension", "decouple processor", "receiver creator", "annotation-based discovery", "auto-instrumentation", "zero-code", "eBPF", "compile-time instrumentation", "span naming", "attribute naming", "metric naming", "complex attributes", "Logs API", "events", "sampling update", "TraceState", "declarative config", "health check exclusion", "OTTL", "transform processor", "RPC conventions", "unroll processor", "profiles", "profiling", "continuous profiling", "OTLP Profiles", "pprof receiver", "Mastodon", "one collector per namespace", "OpenTelemetry Operator", "Argo CD", "tail sampling"

**Action**: Load `references/playbooks.md`

**Contains**:
- Generic playbook routing format for turning upstream blog posts into reusable skill guidance
- Expanded scan of relevant 2025-2026 `opentelemetry.io` blogs for this skill
- Routing coverage for Kubernetes discovery, secure collector ingress, Lambda extension-layer collection, auto-instrumentation strategy, logging, naming, sampling, declarative configuration, OTTL transforms, Go zero-code instrumentation, RPC convention stability, and log unrolling
- Guidance to route by technical problem space instead of company-specific narratives
- Links to the local deep-dive references that should be loaded after a playbook match

## Production Baseline Configuration

Use these defaults unless the user specifies otherwise. This is a copy-paste-ready starting point:

```yaml
extensions:
  health_check:
    endpoint: "0.0.0.0:13133"
  file_storage/queue:
    directory: /var/lib/otelcol/queue

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
  otlphttp:
    endpoint: "https://your-backend:4318"
    sending_queue:
      storage: file_storage/queue

service:
  extensions: [health_check, file_storage/queue]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlphttp]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlphttp]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlphttp]
```

Key defaults: `memory_limiter` is always first in the processor chain, `batch` reduces network calls, `file_storage` persists queues across restarts, `health_check` binds to localhost (not 0.0.0.0) in shared networks. Always use the latest stable semantic conventions. Prefer OTLP gRPC (4317) over legacy protocols for new deployments.

## Anti-Patterns to Avoid

Actively prevent these common mistakes:

❌ Placing memory_limiter anywhere except first in the processor chain
❌ Using high-cardinality attributes (user_id, trace_id) as metric dimensions
❌ Exposing pprof (1777), zpages (55679) on 0.0.0.0 in production
❌ Using tail_sampling without sticky session load balancing (loadbalancing exporter)
❌ Omitting batch processor (causes excessive network calls)
❌ Using deprecated protocols (Zipkin, Jaeger) for new deployments
❌ Creating custom attribute names instead of using semantic conventions
❌ Ignoring component stability levels in production
❌ Including prompt.id or session.id as metric dimensions (unbounded cardinality)
❌ Enabling captureContent/OTEL_LOG_USER_PROMPTS in shared/production environments without PII controls
❌ Assuming all AI coding agents emit traces (Claude Code and Codex exec do not)
❌ Using delta temporality with backends that expect cumulative (e.g., VictoriaMetrics silently drops)
❌ Hard-coding `gen_ai.token.type` handling to only `input`/`output` values
❌ Treating open spec proposals (for example `Span.SetErrorStatus`, `AlwaysStackTrace`, built-in event-routing processors) as stable APIs before they ship in SDKs/collector releases

## Version and Compatibility

- **Target Version**: OpenTelemetry Collector v0.150.0+ (2026+)
- **Semantic Conventions**: v1.40.0+
- **Kubernetes**: v1.24+ (for native sidecar support)
- **Go SDK**: v1.24.0+
- **Python SDK**: v1.41.0+
- **Claude Code Telemetry**: Compatible with current release (metrics + logs/events)
- **Gemini CLI Telemetry**: v0.34.0+ (traces + metrics + logs, GenAI SemConv)
- **GitHub Copilot OTel**: VS Code Insiders / latest stable (traces + metrics + events, GenAI SemConv)
- **Codex CLI Telemetry**: v0.105.0+ (traces + logs in interactive mode; exec/mcp-server gaps)

