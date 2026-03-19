# AI Coding Agent Observability

A comprehensive guide to monitoring AI coding agents (Claude Code, Gemini CLI, GitHub Copilot, Codex CLI, and others) via OpenTelemetry.

---

## Table of Contents

1. [Overview & Compatibility Matrix](#1-overview--compatibility-matrix)
2. [Per-Agent Quick-Start Configs](#2-per-agent-quick-start-configs)
3. [Unified Collector Config for Multi-Agent Ingestion](#3-unified-collector-config-for-multi-agent-ingestion)
4. [Event & Metric Taxonomy](#4-event--metric-taxonomy)
5. [Dashboard Patterns](#5-dashboard-patterns)
6. [Privacy & Cardinality Considerations](#6-privacy--cardinality-considerations)
7. [Known Gaps & Workarounds](#7-known-gaps--workarounds)

---

## 1. Overview & Compatibility Matrix

| Agent | Vendor | Traces | Metrics | Logs/Events | GenAI SemConv | Config Method | Config File / Env Vars | Protocol | Official Docs |
|-------|--------|--------|---------|-------------|---------------|---------------|------------------------|----------|---------------|
| **Claude Code** | Anthropic | ❌ | ✅ | ✅ | ❌ (custom `claude_code.*`) | Env vars or `~/.claude/settings.json` | `CLAUDE_CODE_ENABLE_TELEMETRY`, `OTEL_*` | OTLP gRPC/HTTP | [docs](https://code.claude.com/docs/en/monitoring-usage) |
| **Gemini CLI** | Google | ✅ | ✅ | ✅ | ✅ (`gen_ai.*`) | `.gemini/settings.json` or env vars | `GEMINI_TELEMETRY_*` | OTLP gRPC | [docs](https://geminicli.com/docs/cli/telemetry/) |
| **GitHub Copilot VS Code** | Microsoft | ✅ | ✅ | ✅ | ✅ (`gen_ai.*`) | VS Code `settings.json` or env var | `COPILOT_OTEL_ENABLED` | OTLP HTTP | [docs](https://code.visualstudio.com/docs/copilot/guides/monitoring-agents) |
| **GitHub Copilot CLI** | Microsoft | ✅ | ✅ | ✅ | ✅ (`gen_ai.*`) | Same span model as VS Code | `COPILOT_OTEL_ENABLED` | OTLP HTTP | [docs](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) |
| **OpenAI Codex CLI** | OpenAI | ⚠️ interactive only | ⚠️ interactive only | ✅ | ❌ (custom event names) | `~/.codex/config.toml` `[otel]` section | `~/.codex/config.toml` | OTLP gRPC | [docs](https://developers.openai.com/codex/config-advanced) |
| **Qwen Code** | Alibaba | 🔜 planned | 🔜 planned | 🔜 planned | 🔜 planned | `.qwen/settings.json` | `.qwen/settings.json` | OTLP | [docs](https://qwenlm.github.io/qwen-code-docs/en/developers/development/telemetry/) |
| **OpenCode** | Anomaly | ❌ | ❌ | ❌ | ❌ | Community plugin only | n/a | n/a | [plugin](https://github.com/DEVtheOPS/opencode-plugin-otel) |
| **Cursor** | Anysphere | ❌ | ❌ | ❌ | ❌ | Via MCP servers only | n/a | n/a | — |
| **Windsurf** | Cognition | ❌ | ❌ | ❌ | ❌ | Agent skills for user code only | n/a | n/a | — |
| **Amazon Q Developer** | AWS | ❌ | ❌ | ❌ | ❌ | CloudWatch/CloudTrail only | n/a | n/a | — |
| **Aider** | open-source | ❌ | ❌ | ❌ | ❌ | External wrapper only | n/a | n/a | — |

### Legend

- ✅ Supported and shipped
- ⚠️ Partial support (see Known Gaps)
- 🔜 Planned but not yet shipped
- ❌ Not supported

---

## 2. Per-Agent Quick-Start Configs

### 2.1 Claude Code

Claude Code emits **metrics** and **logs/events** only — no traces. Telemetry is opt-in.

**Minimum config (env vars):**

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

**Persistent config (`~/.claude/settings.json`):**

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4317",
    "OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE": "cumulative"
  }
}
```

**Privacy controls:**

| Env Var | Default | Effect |
|---------|---------|--------|
| `OTEL_LOG_USER_PROMPTS` | `false` | Includes raw user prompts in log events |
| `OTEL_LOG_TOOL_DETAILS` | `false` | Includes tool call parameters in logs |
| `OTEL_METRICS_INCLUDE_SESSION_ID` | `false` | Adds `session.id` as metric dimension (⚠️ high cardinality) |

> ⚠️ **Temporality**: Claude Code emits cumulative metrics. Set `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative` to match. VictoriaMetrics and some Prometheus backends will silently drop delta-converted metrics from cumulative sources.

---

### 2.2 Gemini CLI

Gemini CLI emits full **traces + metrics + logs** using GenAI semantic conventions (`gen_ai.*`).

**Config file (`.gemini/settings.json`):**

```json
{
  "telemetry": {
    "enabled": true,
    "otlpEndpoint": "http://localhost:4317",
    "otlpProtocol": "grpc",
    "logPrompts": false
  }
}
```

**Env var override:**

```bash
export GEMINI_TELEMETRY_ENABLED=true
export GEMINI_TELEMETRY_OTLP_ENDPOINT=http://localhost:4317
```

> ✅ Gemini CLI v0.34.0+ follows `gen_ai.*` GenAI semantic conventions. Traces include full span hierarchy for multi-step agent operations.

---

### 2.3 GitHub Copilot (VS Code)

**VS Code `settings.json`:**

```json
{
  "github.copilot.chat.otel.enabled": true,
  "github.copilot.chat.otel.otlpEndpoint": "http://localhost:4318",
  "github.copilot.chat.otel.exporterType": "otlp-http",
  "github.copilot.chat.otel.captureContent": false
}
```

**Env var alternative:**

```bash
export COPILOT_OTEL_ENABLED=true
export COPILOT_OTEL_OTLP_ENDPOINT=http://localhost:4318
```

> ⚠️ `captureContent: true` captures **full prompts and responses**. Keep this `false` in shared or production environments. See [Privacy section](#6-privacy--cardinality-considerations).

---

### 2.4 GitHub Copilot CLI

Copilot CLI shares the same span model as the VS Code extension. Uses OTLP HTTP by default.

```bash
export COPILOT_OTEL_ENABLED=true
export COPILOT_OTEL_OTLP_ENDPOINT=http://localhost:4318
```

---

### 2.5 OpenAI Codex CLI

Codex CLI supports telemetry in **interactive mode only**. `codex exec` and `codex mcp-server` have known gaps (see [Known Gaps](#7-known-gaps--workarounds)).

**Config file (`~/.codex/config.toml`):**

```toml
[otel]
exporter = { otlp-grpc = { endpoint = "http://localhost:4317" } }
log_user_prompt = false
```

**Minimum config only:**

```toml
[otel]
exporter = { otlp-grpc = { endpoint = "http://localhost:4317" } }
```

> ⚠️ Codex v0.105.0+ is required. `codex exec` drops metrics entirely. `codex mcp-server` has zero OTel support. See [open issue #12913](https://github.com/openai/codex/issues/12913).

---

### 2.6 Qwen Code (Watch — Not Yet Shipped)

Docs describe a telemetry system with `.qwen/settings.json`, but the corresponding code has not shipped as of 2026-03. Monitor the [Qwen Code telemetry docs](https://qwenlm.github.io/qwen-code-docs/en/developers/development/telemetry/) for updates.

**Planned config (`.qwen/settings.json`):**

```json
{
  "telemetry": {
    "enabled": true,
    "otlpEndpoint": "http://localhost:4317"
  }
}
```

---

### 2.7 Agents Without Native OTel

For agents that emit no OpenTelemetry data, use **[opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks)** — a hook-based instrumentation layer that wraps any CLI tool and emits OTLP spans, metrics, and logs without modifying the agent itself.

**Quick start with opentelemetry-hooks:**

```bash
# Install
pip install opentelemetry-hooks

# Wrap any unsupported agent
otel-hooks --service-name cursor --otlp-endpoint http://localhost:4317 -- cursor <args>
otel-hooks --service-name aider  --otlp-endpoint http://localhost:4317 -- aider <args>
```

**What opentelemetry-hooks captures:**

| Signal | Details |
|--------|---------|
| Spans | Start/end per invocation, child spans for subprocesses |
| Metrics | Wall-clock duration, exit code, process CPU/memory |
| Logs | stdout/stderr lines as log records with `severity` |

| Agent | Recommended Approach |
|-------|---------------------|
| **OpenCode** | [opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks) (primary); community plugin: [opencode-plugin-otel](https://github.com/DEVtheOPS/opencode-plugin-otel) as fallback. Feature request: [#14697](https://github.com/anomalyco/opencode/issues/14697) |
| **Cursor** | [opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks); MCP servers (Traceloop, Observe) instrument only user code, not Cursor itself |
| **Windsurf** | [opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks); Windsurf agent skills can add OTel to user code but Windsurf itself emits nothing |
| **Amazon Q Developer** | [opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks); CloudWatch/CloudTrail for activity logging but no OTLP export |
| **Aider** | [opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks); replaces the manual shell-script wrapper approach |

---

## 3. Unified Collector Config for Multi-Agent Ingestion

A single OTel Collector instance can receive telemetry from all agents simultaneously on standard OTLP ports.

```yaml
# otel-collector-ai-agents.yaml
# Production-ready config for multi-agent AI coding observability
# Tested with OTel Collector v0.147.0+

extensions:
  health_check:
    endpoint: localhost:13133
  file_storage:
    directory: /var/lib/otelcol/filestore

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317   # Claude Code, Gemini CLI, Codex CLI (grpc)
      http:
        endpoint: 0.0.0.0:4318   # GitHub Copilot VS Code/CLI (http)

processors:
  # CRITICAL: memory_limiter MUST be first processor in every pipeline
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 20

  # Normalize service.name across all agents
  resource:
    attributes:
      - key: service.name
        action: upsert
        from_attribute: service.name
      # Tag all AI agent telemetry for easy filtering
      - key: telemetry.source.type
        value: ai-coding-agent
        action: insert

  # Map custom claude_code.* prefixes to gen_ai.* where semantically equivalent
  transform/normalize_agent_metrics:
    metric_statements:
      - context: datapoint
        statements:
          # Claude Code uses claude_code.* prefix — surface agent name for dashboards
          - set(attributes["gen_ai.system"], "claude_code") where resource.attributes["service.name"] == "claude_code"
          - set(attributes["gen_ai.system"], "gemini_cli") where resource.attributes["service.name"] == "gemini_cli"
    log_statements:
      - context: log
        statements:
          # Normalize agent identifier in log body for cross-agent queries
          - set(attributes["gen_ai.system"], "claude_code") where resource.attributes["service.name"] == "claude_code"

  # Redact secrets from tool_parameters (reuse security.md pattern)
  transform/redact_secrets:
    log_statements:
      - context: log
        statements:
          - replace_pattern(attributes["tool.parameters"], "(?i)(api[_-]?key|secret|token|password)[\"'\\s]*[:=][\"'\\s]*[^\\s,}]+", "REDACTED")

  batch:
    timeout: 10s
    send_batch_size: 1024

exporters:
  # Metrics → Prometheus (scraped by Grafana)
  prometheus:
    endpoint: 0.0.0.0:8889
    namespace: ai_agent
    resource_to_telemetry_conversion:
      enabled: true

  # Logs → Loki
  otlphttp/loki:
    endpoint: http://loki:3100/otlp
    sending_queue:
      enabled: true
      storage: file_storage
    retry_on_failure:
      enabled: true

  # Traces → Tempo (for agents that emit traces: Gemini CLI, Copilot)
  otlp/tempo:
    endpoint: http://tempo:4317
    sending_queue:
      enabled: true
      storage: file_storage
    retry_on_failure:
      enabled: true

service:
  extensions: [health_check, file_storage]
  pipelines:
    # Metrics pipeline — all agents
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, resource, transform/normalize_agent_metrics, batch]
      exporters: [prometheus]

    # Logs/Events pipeline — all agents
    logs:
      receivers: [otlp]
      processors: [memory_limiter, resource, transform/normalize_agent_metrics, transform/redact_secrets, batch]
      exporters: [otlphttp/loki]

    # Traces pipeline — Gemini CLI, Copilot only (others emit nothing here)
    traces:
      receivers: [otlp]
      processors: [memory_limiter, resource, batch]
      exporters: [otlp/tempo]
```

> **Processor ordering**: `memory_limiter` is always first. The `resource` processor runs before `transform` so enriched attributes are available for OTTL statements. `batch` is always last before exporters.

---

## 4. Event & Metric Taxonomy

### 4.1 Metrics

| Agent | Metric Name | Type | Unit | Key Attributes |
|-------|-------------|------|------|----------------|
| Claude Code | `claude_code.tokens.input` | Counter | `{token}` | `model`, `session.id` |
| Claude Code | `claude_code.tokens.output` | Counter | `{token}` | `model`, `session.id` |
| Claude Code | `claude_code.cost.usd` | Counter | `USD` | `model` |
| Claude Code | `claude_code.api.request.duration` | Histogram | `ms` | `model`, `status` |
| Claude Code | `claude_code.tool.call.count` | Counter | `{call}` | `tool.name`, `status` |
| Claude Code | `claude_code.cache.read.tokens` | Counter | `{token}` | `model` |
| Gemini CLI | `gen_ai.client.token.usage` | Counter | `{token}` | `gen_ai.system`, `gen_ai.token.type`, `gen_ai.operation.name` |
| Gemini CLI | `gen_ai.client.operation.duration` | Histogram | `s` | `gen_ai.system`, `gen_ai.operation.name`, `gen_ai.response.finish_reason` |
| GitHub Copilot | `gen_ai.client.token.usage` | Counter | `{token}` | `gen_ai.system`, `gen_ai.token.type` |
| GitHub Copilot | `gen_ai.client.operation.duration` | Histogram | `s` | `gen_ai.system`, `gen_ai.operation.name` |
| Codex CLI | `codex.tokens.used` | Counter | `{token}` | `model`, `direction` |
| Codex CLI | `codex.request.latency` | Histogram | `ms` | `model`, `status` |

### 4.2 Events / Logs

| Agent | Event Name | Key Attributes | Correlation ID Field |
|-------|------------|----------------|---------------------|
| Claude Code | `gen_ai.user.message` | `gen_ai.system`, `session.id`, `prompt.id` | `prompt.id` |
| Claude Code | `gen_ai.assistant.message` | `gen_ai.system`, `session.id`, `prompt.id`, `model` | `prompt.id` |
| Claude Code | `gen_ai.tool.message` | `tool.name`, `session.id`, `prompt.id` | `prompt.id` |
| Claude Code | `claude_code.api.request` | `model`, `prompt.id`, `input_tokens`, `output_tokens`, `cost_usd` | `prompt.id` |
| Gemini CLI | `gen_ai.user.message` | `gen_ai.system`, `gen_ai.conversation.id` | `gen_ai.conversation.id` |
| Gemini CLI | `gen_ai.assistant.message` | `gen_ai.system`, `gen_ai.conversation.id`, `gen_ai.response.model` | `gen_ai.conversation.id` |
| GitHub Copilot | `gen_ai.user.message` | `gen_ai.system`, `gen_ai.thread.id` | `gen_ai.thread.id` |
| GitHub Copilot | `gen_ai.choice` | `gen_ai.system`, `gen_ai.response.finish_reason` | `gen_ai.thread.id` |
| Codex CLI | `codex.session.start` | `session.id`, `model`, `working_dir` | `session.id` |
| Codex CLI | `codex.session.end` | `session.id`, `total_tokens`, `total_cost_usd` | `session.id` |

### 4.3 Traces (where supported)

| Agent | Span Name | Kind | Key Attributes | Child Spans |
|-------|-----------|------|----------------|-------------|
| Gemini CLI | `gen_ai.chat` | `CLIENT` | `gen_ai.system`, `gen_ai.operation.name`, `gen_ai.request.model` | tool call spans |
| Gemini CLI | `execute_tool` | `INTERNAL` | `gen_ai.tool.name`, `gen_ai.tool.call.id` | none |
| GitHub Copilot | `gen_ai.chat` | `CLIENT` | `gen_ai.system`, `gen_ai.operation.name` | completion spans |
| GitHub Copilot | `gen_ai.completion` | `INTERNAL` | `gen_ai.response.finish_reason`, `gen_ai.usage.input_tokens` | none |

> **Note**: Claude Code emits **no traces**. Use `prompt.id` correlation across log events as a pseudo-trace (see [Known Gaps](#7-known-gaps--workarounds)).

---

## 5. Dashboard Patterns

### 5.1 Community Dashboards

| Dashboard | Agents Covered | Stack | Link |
|-----------|---------------|-------|------|
| **ai-observer** | Claude Code + Gemini CLI + Codex CLI | Any OTLP backend | [github.com/tobilg/ai-observer](https://github.com/tobilg/ai-observer) |
| **claude-code-otel** | Claude Code | Grafana + Prometheus | [github.com/ColeMurray/claude-code-otel](https://github.com/ColeMurray/claude-code-otel) |
| **Honeycomb Claude Code template** | Claude Code | Honeycomb | Built-in board template (search "Claude Code" in Honeycomb) |
| **Gemini CLI GCP Monitoring** | Gemini CLI | GCP Monitoring | Pre-configured template in GCP Console |

### 5.2 Recommended Dashboard Panels

Build these panels for a team-facing AI agent observability dashboard:

1. **Token usage by agent/user/model over time**
   - Metric: `claude_code.tokens.input` + `claude_code.tokens.output` (Claude Code); `gen_ai.client.token.usage` (Gemini, Copilot)
   - Dimensions: `model`, `gen_ai.system` (NOT `session.id` — high cardinality)
   - Chart type: Stacked bar, 1h buckets

2. **Cost breakdown by agent and model**
   - Metric: `claude_code.cost.usd` (Claude Code); derived from token counts × model pricing for others
   - Dimensions: `gen_ai.system`, `model`
   - Chart type: Time series + running total stat panel

3. **API request latency (p50/p95/p99)**
   - Metric: `claude_code.api.request.duration` (Claude Code); `gen_ai.client.operation.duration` (GenAI SemConv agents)
   - Chart type: Heatmap or percentile time series

4. **Tool call success/failure rates**
   - Metric: `claude_code.tool.call.count` with `status` dimension
   - Log query: filter `gen_ai.tool.message` events by `status`
   - Chart type: Success rate gauge + error rate alert

5. **Active sessions / DAU/WAU/MAU**
   - Source: Log events with `session.id` (count distinct via log query, not metric dimension)
   - Chart type: Unique session count per day/week/month

6. **Cache hit ratio (Claude Code)**
   - Metric: `claude_code.cache.read.tokens` / (`claude_code.tokens.input` + `claude_code.cache.read.tokens`)
   - Chart type: Single stat percentage gauge

---

## 6. Privacy & Cardinality Considerations

### 6.1 High-Cardinality Fields

| Field | Cardinality | Recommendation |
|-------|------------|----------------|
| `prompt.id` | Unbounded | Use in **logs/events only**, never as metric dimension |
| `session.id` | Unbounded | Use in **logs/events only**; keep `OTEL_METRICS_INCLUDE_SESSION_ID=false` |
| `user.id` | Bounded by team size | Acceptable as metric dimension for small teams (<1000 users); use logs for larger orgs |
| `model` | Low (~5–20 values) | Safe as metric dimension |
| `gen_ai.system` | Low (~10 values) | Safe as metric dimension |
| `tool.name` | Low–Medium | Acceptable as metric dimension if tools are bounded |

> **Rule of 100**: Any attribute with >100 unique values should NOT be a metric dimension. Use logs or traces instead.

### 6.2 Prompt Content Controls

| Agent | Default | Opt-in for Content |
|-------|---------|-------------------|
| Claude Code | Prompts **redacted** | `OTEL_LOG_USER_PROMPTS=true` |
| Codex CLI | Prompts **redacted** | `log_user_prompt = true` in config.toml |
| GitHub Copilot | Content **not captured** | `captureContent: true` in settings |
| Gemini CLI | Prompts **not logged** | `logPrompts: true` in settings.json |

> ⚠️ **Production Warning**: Never enable prompt capture in shared or production environments without explicit PII controls. User prompts frequently contain secrets, credentials, and personal data.

### 6.3 OTTL Redaction Patterns

Add to your collector config to redact secrets from tool parameters before they reach backends:

```yaml
transform/redact_agent_secrets:
  log_statements:
    - context: log
      statements:
        # Redact API keys and tokens from tool parameters
        - replace_pattern(attributes["tool.parameters"], "(?i)(api[_-]?key|secret|token|password|bearer)[\"'\\s]*[:=][\"'\\s]*[^\\s,}\"']+", "${1}=REDACTED")
        # Redact AWS credentials
        - replace_pattern(attributes["tool.parameters"], "AKIA[0-9A-Z]{16}", "REDACTED_AWS_KEY")
        # Redact connection strings
        - replace_pattern(attributes["tool.parameters"], "(postgresql|mysql|mongodb)://[^@]+@", "${1}://REDACTED@")
```

See `references/security.md` for comprehensive OTTL redaction patterns.

---

## 7. Known Gaps & Workarounds

### 7.1 Claude Code: No Traces

**Gap**: Claude Code emits metrics and logs/events, but **no distributed traces**. There is no W3C `traceparent` propagation.

**Workaround — Pseudo-trace via `prompt.id` correlation**:

```
prompt.id = "prompt_abc123"

Log events sharing this prompt.id form a "trace":
  → gen_ai.user.message   (prompt.id=prompt_abc123)
  → claude_code.api.request (prompt.id=prompt_abc123)
  → gen_ai.tool.message   (prompt.id=prompt_abc123, tool.name=bash)
  → gen_ai.assistant.message (prompt.id=prompt_abc123)
```

Query in Loki/OpenSearch: `{job="claude_code"} | json | prompt_id="prompt_abc123"` to reconstruct a session's event timeline.

### 7.2 Codex CLI: Exec and MCP-Server Gaps

**Gap**: `codex exec` (non-interactive batch mode) drops **all metrics**. `codex mcp-server` has **zero OTel instrumentation**.

**Status**: Open issue — [github.com/openai/codex/issues/12913](https://github.com/openai/codex/issues/12913)

**Workaround**: Use interactive `codex` mode for telemetry. For `codex exec` pipelines, instrument the calling shell script with timing/exit code metrics via a Prometheus Pushgateway or write structured JSON logs that a filelog receiver can ingest.

### 7.3 Qwen Code: Docs Without Code

**Gap**: Alibaba has published telemetry documentation but the implementation code has not shipped as of 2026-03.

**Action**: Watch the [Qwen Code changelog](https://qwenlm.github.io/qwen-code-docs/en/developers/development/telemetry/) and the repo for the enabling commit. Do not build infrastructure dependencies on Qwen Code telemetry until code ships.

### 7.4 Agents With No OTel Support (OpenCode, Cursor, Windsurf, Amazon Q, Aider)

**Gap**: These agents emit no OTLP data. Native instrumentation is absent and no roadmap items are public.

**Workaround**: Use **[opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks)** to wrap the agent process. This emits process-level spans and metrics without requiring changes to the agent binary. See [§2.7](#27-agents-without-native-otel) for setup.

> ⚠️ opentelemetry-hooks captures process-level signals only (invocation duration, exit code, stdout/stderr). It cannot observe LLM token usage, model names, or tool calls made inside the agent. For full GenAI observability, advocate for native instrumentation via the agents' issue trackers.

### 7.5 Cross-Agent Trace Correlation

**Gap**: No W3C `traceparent` propagation exists between AI coding agents. If Claude Code calls a tool that triggers Gemini CLI (or vice versa via MCP), there is no automatic trace linkage.

**Workaround**: Use a shared `session.id` or custom correlation attribute passed as metadata to link events across agents in log queries. True distributed tracing across agents is not possible today.

### 7.6 GenAI SemConv Coverage

| Agent | Uses `gen_ai.*` | Custom Prefix | Notes |
|-------|----------------|---------------|-------|
| Gemini CLI | ✅ Full | — | Follows `gen_ai.*` v1.40.0+ |
| GitHub Copilot | ✅ Full | — | Follows `gen_ai.*` v1.40.0+ |
| Claude Code | ❌ | `claude_code.*` | Uses OTTL `transform` to map (see §3) |
| Codex CLI | ❌ | `codex.*` | Custom event names, partial coverage |
| Qwen Code | 🔜 planned | `.qwen.*` | Not yet verifiable |

Use the `transform/normalize_agent_metrics` processor from [§3](#3-unified-collector-config-for-multi-agent-ingestion) to add `gen_ai.system` attributes to Claude Code and Codex telemetry for unified dashboard queries.
