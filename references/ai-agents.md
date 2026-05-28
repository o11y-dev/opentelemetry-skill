# AI Coding Agent Observability

A comprehensive guide to monitoring AI coding agents (Claude Code, Gemini CLI, GitHub Copilot, Codex CLI, and others) via OpenTelemetry.

<!-- UPSTREAM MONITORING NOTE:
This file is automatically flagged for review when changes occur in:
- GitHub repositories: github/copilot-cli, Aider-AI/aider, openai/codex, google-gemini/gemini-cli, anthropics/claude-code, anthropics/skills, QwenLM/qwen-code, microsoft/vscode-copilot-chat, anysphere/cursor-wiki, anomalyco/opencode, DEVtheOPS/opencode-plugin-otel, badlogic/pi-mono
- OpenTelemetry semantic conventions: open-telemetry/semantic-conventions (gen-ai model)
- Manual monitoring recommended for official docs: docs.github.com/copilot/, aider.chat/docs/, developers.openai.com/codex/, google-gemini.github.io/gemini-cli/, claude.ai/code/, qwenlm.github.io/qwen-code-docs/, cursor.com, pi.dev
-->

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

| Agent | Vendor | Native OTel | Traces | Metrics | Logs/Events | GenAI SemConv | Hooks Support | Config Method | Config File / Env Vars | Protocol | Official Docs |
|-------|--------|-------------|--------|---------|-------------|---------------|---------------|---------------|------------------------|----------|---------------|
| **Claude Code** | Anthropic | ⚠️ metrics/logs only | ❌ | ✅ | ✅ | ❌ (custom `claude_code.*`) | ✅ governance wrapper | Env vars or `~/.claude/settings.json` | `CLAUDE_CODE_ENABLE_TELEMETRY`, `OTEL_*` | OTLP gRPC/HTTP | [docs](https://code.claude.com/docs/en/monitoring-usage) |
| **Gemini CLI** | Google | ✅ full | ✅ | ✅ | ✅ | ✅ (`gen_ai.*`) | ✅ governance wrapper | `.gemini/settings.json` or env vars | `GEMINI_TELEMETRY_*` | OTLP gRPC | [docs](https://geminicli.com/docs/cli/telemetry/) |
| **GitHub Copilot VS Code** | Microsoft | ✅ full | ✅ | ✅ | ✅ | ✅ (`gen_ai.*`) | ⚠️ launcher wrapper only | VS Code `settings.json` or env var | `COPILOT_OTEL_ENABLED` | OTLP HTTP | [docs](https://code.visualstudio.com/docs/copilot/guides/monitoring-agents) |
| **GitHub Copilot CLI** | Microsoft | ✅ full | ✅ | ✅ | ✅ | ✅ (`gen_ai.*`) | ✅ governance wrapper | Same span model as VS Code | `COPILOT_OTEL_ENABLED` | OTLP HTTP | [docs](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) |
| **OpenAI Codex CLI** | OpenAI | ⚠️ partial | ⚠️ interactive only | ⚠️ interactive only | ✅ | ❌ (custom event names) | ✅ gap-filler + governance | `~/.codex/config.toml` `[otel]` section | `~/.codex/config.toml` | OTLP gRPC | [docs](https://developers.openai.com/codex/config-advanced) |
| **Qwen Code** | Alibaba | ⚠️ partial | ⚠️ partial | ⚠️ partial | ⚠️ partial | ⚠️ partial | ✅ interim bridge | `.qwen/settings.json`, env vars, CLI flags | `.qwen/settings.json`, `QWEN_TELEMETRY_*`, `OTEL_*` | OTLP gRPC/HTTP | [docs](https://qwenlm.github.io/qwen-code-docs/en/developers/development/telemetry/) |
| **OpenCode** | Anomaly | ❌ none | ❌ | ❌ | ❌ | ❌ | ✅ primary | Community plugin only | n/a | n/a | [plugin](https://github.com/DEVtheOPS/opencode-plugin-otel) |
| **Pi Agent** | open-source | ❌ none | ❌ | ❌ | ⚠️ install telemetry only | ❌ | ✅ primary | `~/.pi/agent/settings.json` or `.pi/settings.json` | `PI_TELEMETRY`, `enableInstallTelemetry` | n/a | [docs](https://pi.dev) |
| **Cursor** | Anysphere | ❌ none | ❌ | ❌ | ❌ | ❌ | ⚠️ launcher wrapper only | Via MCP servers only | n/a | n/a | — |
| **Windsurf** | Cognition | ❌ none | ❌ | ❌ | ❌ | ❌ | ⚠️ launcher wrapper only | Agent skills for user code only | n/a | n/a | — |
| **Amazon Q Developer** | AWS | ❌ OTLP | ❌ | ❌ | ❌ | ❌ | ✅ primary | CloudWatch/CloudTrail only | n/a | n/a | — |
| **Aider** | open-source | ❌ none | ❌ | ❌ | ❌ | ❌ | ✅ primary | External wrapper only | n/a | n/a | — |

### Legend

- ✅ Supported and shipped
- ⚠️ Partial support (see Known Gaps)
- 🔜 Planned but not yet shipped
- ❌ Not supported
- **Native OTel** = telemetry emitted by the agent itself
- **Hooks Support** = hook-based instrumentation around the agent invocation at the process boundary

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
| `OTEL_METRICS_INCLUDE_ENTRYPOINT` | `false` | Adds bounded `app.entrypoint` as a metric dimension for dashboard slicing |

> ⚠️ **Temporality**: Claude Code emits cumulative metrics. Set `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative` to match. VictoriaMetrics and some Prometheus backends will silently drop delta-converted metrics from cumulative sources.

> ✅ **Bounded metric dimension**: Prefer `OTEL_METRICS_INCLUDE_ENTRYPOINT=true` over `OTEL_METRICS_INCLUDE_SESSION_ID=true` when you need a stable breakdown of CLI vs IDE/SDK launches. `app.entrypoint` stays bounded and is safe for dashboards; `session.id` is still high-cardinality.

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

> As of v1.0.44, `userPromptSubmitted` hooks can handle requests directly, bypassing the LLM and returning a response without a model call. This is useful for governance wrappers that enforce pre-flight checks before any model invocation.

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

> ⚠️ Codex v0.105.0+ is required. `codex exec` drops metrics entirely. `codex mcp-server` has zero OTel support. See [open issue #12913](https://github.com/openai/codex/issues/12913). As of rust-v0.130.0, Codex CLI added configurable OpenTelemetry trace metadata fields.

---

### 2.6 Qwen Code

Qwen Code exposes OpenTelemetry via `.qwen/settings.json`, `QWEN_TELEMETRY_*` / `OTEL_*` environment variables, and CLI flags. As of **v0.16.1**, the runtime emits native spans/logs/metrics with **partial GenAI semantic-convention dual-emit** (`gen_ai.request.model`, `gen_ai.usage.*`, `gen_ai.server.time_to_first_token`) on top of its private `qwen-code.*` fields. Treat the private names as authoritative and the `gen_ai.*` fields as a compatibility layer while the signal surface continues to stabilize.

**Config (`.qwen/settings.json`):**

```json
{
  "telemetry": {
    "enabled": true,
    "otlpEndpoint": "http://localhost:4317"
  }
}
```

---

### 2.7 Hook-Based Instrumentation and Governance

Use **[opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks)** as a hook-based instrumentation layer around an agent invocation (typically a CLI entrypoint). Hooks serve three practical roles: a **primary instrumentation path** for agents with no native OpenTelemetry, a **gap-filler** for agents with partial native coverage, and an **outer governance/control wrapper** for agents that already emit telemetry but still need standardized invocation-level controls. Because hooks sit outside the agent process, they can standardize process-level telemetry and enforcement across heterogeneous agents without modifying the agent binary.

> **Scope:** opentelemetry-hooks instruments the *wrapped process invocation*. For fully CLI-based agents (OpenCode, Aider, Amazon Q Developer CLI) this captures each agent run end-to-end. For GUI-first editors (Cursor, Windsurf) wrapping the launch command provides limited value because the main agent activity occurs inside the desktop process after startup; only the launch duration and exit code are reliably captured. Use the hooks approach for Cursor/Windsurf only if you have a headless/CLI agent invocation (for example `cursor --headless` or a Windsurf CLI subcommand).

**Quick start with opentelemetry-hooks:**

```bash
# Install
pip install opentelemetry-hooks

# Wrap CLI-based agents (full coverage)
otel-hooks --service-name aider  --otlp-endpoint http://localhost:4317 -- aider <args>
otel-hooks --service-name opencode --otlp-endpoint http://localhost:4317 -- opencode <args>

# Wrap GUI-based agents (launch/exit coverage only)
otel-hooks --service-name cursor --otlp-endpoint http://localhost:4317 -- cursor <args>
```

**What opentelemetry-hooks captures:**

| Signal | Details |
|--------|---------|
| Spans | Start/end per invocation, child spans for subprocesses |
| Metrics | Wall-clock duration, exit code, process CPU/memory |
| Logs | stdout/stderr lines as log records with `severity` |

> **Privacy warning:** Capturing stdout/stderr as logs can include prompts, source code, configuration, secrets (for example, API keys or tokens), and other sensitive data. Before enabling this, review your data-handling requirements and configure your OpenTelemetry pipeline or `opentelemetry-hooks` to disable or redact stdout/stderr capture where needed (for example, via log filtering/redaction or by turning off log export). See [§6. Privacy & Cardinality Considerations](#6-privacy--cardinality-considerations) for guidance.

| Agent | Native OTel | Hooks Role | Recommended Usage |
|-------|-------------|------------|-------------------|
| **Claude Code** | ⚠️ metrics/logs only | Governance wrapper | Keep native metrics/logs enabled; add hooks when you need standardized start/stop audit events, resource attributes, or launch-time controls across agents. |
| **Gemini CLI** | ✅ full | Governance wrapper | Prefer native telemetry for traces and GenAI semantics; add hooks only for organization-wide process-boundary controls or uniform invocation audit events. |
| **GitHub Copilot CLI** | ✅ full | Governance wrapper | Use native telemetry for primary observability; add hooks when you need consistent launch policies, ownership tags, or process-boundary audit signals across multiple CLI agents. |
| **GitHub Copilot VS Code** | ✅ full | Limited launcher wrapper | Prefer native telemetry. Hooks can wrap the editor launch, but they provide only outer-process coverage because most agent activity occurs inside the desktop process after startup. |
| **OpenAI Codex CLI** | ⚠️ partial | Gap-filler + governance | Use native OTel where available, especially interactive mode. Add hooks to cover outer invocation telemetry, standardize controls, and partially bridge `exec`/`mcp-server` gaps. |
| **Qwen Code** | ⚠️ partial | Gap-filler until native stabilizes | Native traces/logs/metrics are active, and v0.16.1 added partial `gen_ai.*` dual-emit. Keep hooks for process-level invocation coverage and for teams that want a stable outer wrapper while Qwen's native schema continues to evolve. |
| **OpenCode** | ❌ none | Primary | Use [opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks) as the primary instrumentation path; community plugin: [opencode-plugin-otel](https://github.com/DEVtheOPS/opencode-plugin-otel) is an additional fallback. Feature request: [#14697](https://github.com/anomalyco/opencode/issues/14697). |
| **Cursor** | ❌ none | Limited launcher wrapper | Wrap only when you have a headless/CLI invocation. For the desktop app, hooks provide launch/exit coverage only; MCP servers instrument user code, not Cursor itself. |
| **Windsurf** | ❌ none | Limited launcher wrapper | Wrap only CLI/headless entrypoints. For the desktop app, hooks provide launch/exit coverage only; Windsurf agent skills can instrument user code but not Windsurf itself. |
| **Amazon Q Developer** | ❌ no OTLP | Primary | Native signals are CloudWatch/CloudTrail-oriented rather than OTLP. For process-level OTLP spans, metrics, and logs from the Q Developer CLI process, wrap it with hooks. |
| **Aider** | ❌ none | Primary | Use [opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks) as the primary process-level instrumentation path instead of a custom shell-script wrapper. |

#### Hooks as a control and governance layer

Even when native OpenTelemetry exists, hooks are useful above the agent as a lightweight control layer. Use them to attach standard resource attributes across all agents, enforce required environment/config before invocation, emit uniform start/stop audit events, apply pre-export filtering or redaction to stdout/stderr-derived logs, and add consistent ownership, cost-center, or environment tags. This creates organization-wide boundaries and policies that are independent of any single vendor's telemetry maturity.

> ⚠️ Hooks provide **process-level instrumentation only**. They complement native telemetry, but they do **not** replace in-process agent signals such as token counts, model metadata, internal tool-call spans, or semantic-convention-rich events emitted by the agent itself.

---

## 3. Unified Collector Config for Multi-Agent Ingestion

A single OTel Collector instance can receive telemetry from all agents simultaneously on standard OTLP ports. Prefer **OTLP gRPC** end-to-end when agents and backends support it; keep **OTLP HTTP** enabled where an agent, managed ingress, or backend only exposes HTTP or gRPC is not possible.

```yaml
# otel-collector-ai-agents.yaml
# Production-ready config for multi-agent AI coding observability
# Tested with OTel Collector v0.151.0+

extensions:
  health_check:
    endpoint: localhost:13133
  file_storage:
    directory: /var/lib/otelcol/filestore

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317   # Preferred OTLP receiver: Claude Code, Gemini CLI, Codex CLI
      http:
        endpoint: 0.0.0.0:4318   # HTTP fallback/interop: GitHub Copilot VS Code/CLI and HTTP-only clients

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

  # OTLP HTTP exporter example — use when the backend or ingress only accepts OTLP HTTP
  otlphttp/loki:
    endpoint: http://loki:3100/otlp
    sending_queue:
      enabled: true
      storage: file_storage
    retry_on_failure:
      enabled: true

  # Preferred OTLP gRPC exporter example
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true
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

**Protocol choice**: Prefer OTLP gRPC on `4317` for both receivers and exporters. Keep OTLP HTTP on `4318` available for agents like GitHub Copilot and for backends, proxies, or managed ingest endpoints where gRPC is unavailable.

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

> ⚠️ **Dashboard for evolving `gen_ai.token.type` values.** Do not assume GenAI token metrics are permanently limited to `input` and `output`. Newer semantic-convention work is adding finer-grained categories such as cache and reasoning tokens. Build charts and cost rollups so unknown token types are grouped, not discarded.

**SemConv v1.40.0 review**: Preserve `gen_ai.agent.version`, `gen_ai.usage.cache_read.input_tokens`, and `gen_ai.usage.cache_creation.input_tokens` when agents emit them. These attributes help distinguish agent releases and cached-token behavior without collapsing everything back into a fixed `input`/`output` schema.

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
| Gemini CLI | tool name (for example `bash`) | `INTERNAL` | `gen_ai.tool.name`, `gen_ai.tool.call.id` | none |
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

### 7.3 Qwen Code: Runtime Active, Partial GenAI Dual-Emit

**Status**: As of **v0.16.1**, Qwen Code's OpenTelemetry runtime emits native traces, logs, and metrics, and its LLM spans partially dual-emit GenAI semantic conventions such as `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.cached_tokens`, and `gen_ai.server.time_to_first_token`. The official docs also expose `.qwen/settings.json`, `QWEN_TELEMETRY_*`, and CLI flags for telemetry control.

**Action**: Verify your build's exact signal shape before committing to production dashboards. Qwen still treats its private `qwen-code.*` attributes as authoritative, with `gen_ai.*` emitted as a compatibility layer. Use hooks for outer invocation coverage while the native telemetry schema continues to mature.

### 7.4 Agents With No Native OTel — Hook-Based Coverage and Control

**Gap**: These agents emit no OTLP data. Native instrumentation is absent and no roadmap items are public.

**Workaround**: Use **[opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks)** to wrap the agent process. This provides a practical primary instrumentation path for unsupported agents and the same outer governance/control wrapper recommended elsewhere in this guide. It emits process-level spans, metrics, and logs without requiring changes to the agent binary. See [§2.7](#27-hook-based-instrumentation-and-governance) for setup and usage guidance.

> ⚠️ opentelemetry-hooks captures process-level signals only (invocation duration, exit code, stdout/stderr). It complements native telemetry, but it cannot observe LLM token usage, model names, or tool calls made inside the agent. For full GenAI observability, advocate for native instrumentation via the agents' issue trackers.

### 7.5 Cross-Agent Trace Correlation

**Gap**: No W3C `traceparent` propagation exists between AI coding agents. If Claude Code calls a tool that triggers Gemini CLI (or vice versa via MCP), there is no automatic trace linkage.

**Workaround**: Use a shared `session.id` or custom correlation attribute passed as metadata to link events across agents in log queries. True distributed tracing across agents is not possible today.

### 7.6 GenAI SemConv Coverage

**⚠️ Breaking Change in Semantic Conventions v1.41.0**: The gen-ai conventions now require that tool call spans use the tool name for span naming. This affects agents using the `gen_ai.*` namespace for tool execution spans. Prefer span names like `bash`, `search_code`, or `read_file`, and still populate `gen_ai.tool.name`; do not emit a generic `execute_tool` span name.

| Agent | Uses `gen_ai.*` | Custom Prefix | Notes |
|-------|----------------|---------------|-------|
| Gemini CLI | ✅ Full | — | Follows `gen_ai.*` v1.40.0+ |
| GitHub Copilot | ✅ Full | — | Follows `gen_ai.*` v1.40.0+ |
| Claude Code | ❌ | `claude_code.*` | Uses OTTL `transform` to map (see §3) |
| Codex CLI | ❌ | `codex.*` | Custom event names, partial coverage |
| Qwen Code | ⚠️ partial | `qwen-code.*` | v0.16.1 dual-emits selected `gen_ai.*` attributes (`gen_ai.request.model`, `gen_ai.usage.*`, `gen_ai.server.time_to_first_token`); private names remain authoritative |

Use the `transform/normalize_agent_metrics` processor from [§3](#3-unified-collector-config-for-multi-agent-ingestion) to add `gen_ai.system` attributes to Claude Code and Codex telemetry for unified dashboard queries.

For dashboards and alerting, treat `gen_ai.token.type` as an **open set**. Keep normalizations additive (for example, mapping vendor-specific cache counters into a shared label) instead of rewriting unfamiliar values away.

### 7.7 Watchlist: Agent Identity and Sandbox SemConv Proposals

OpenTelemetry upstream is discussing new semantic conventions for **AI agent identity/trust** and **AI sandbox execution** ([semantic-conventions#3582](https://github.com/open-telemetry/semantic-conventions/issues/3582), [semantic-conventions#3583](https://github.com/open-telemetry/semantic-conventions/issues/3583)). These are proposals only; this skill should not present `agent.*` or `sandbox.*` as stable OpenTelemetry fields yet.

There is also an active proposal for a dedicated **skill span** concept ([semantic-conventions#3540](https://github.com/open-telemetry/semantic-conventions/issues/3540)). Do not assume `gen_ai.skill.*` naming is finalized; keep skill/tool execution modeling behind collector transforms or dashboard aliasing until conventions stabilize.

**Current guidance until conventions stabilize:**

- Keep using stable `gen_ai.*`, core resource attributes, and vendor-specific fields that already exist.
- If you must model agent identity, trust, or sandbox metadata today, place it under an **organization-controlled custom namespace** (for example, `company.agent.id`, `company.agent.trust_level`, `company.sandbox.runtime`) rather than betting on proposed upstream names.
- Treat sandbox telemetry as a **deployment/runtime concern** first: make graceful flush, short-lived process export, and network-isolated delivery work before standardizing attribute names.
- Do **not** use proposed agent or sandbox IDs as metric dimensions unless you have verified bounded cardinality; keep high-cardinality identifiers in traces/logs only.

When these proposals become an OTEP or merge into the semantic conventions repository, update collector transforms and dashboard examples deliberately rather than bulk-renaming attributes prematurely.
