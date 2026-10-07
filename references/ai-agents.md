# AI Coding Agent Observability

A comprehensive guide to monitoring AI coding agents (Claude Code, Google Antigravity, GitHub Copilot, Codex CLI, and others) via OpenTelemetry.

<!-- UPSTREAM MONITORING NOTE:
This file is automatically flagged for review when changes occur in:
- GitHub repositories: github/copilot-cli, Aider-AI/aider, openai/codex, anthropics/claude-code, anthropics/skills, QwenLM/qwen-code, microsoft/vscode-copilot-chat, anysphere/cursor-wiki, anomalyco/opencode, DEVtheOPS/opencode-plugin-otel, o11y-dev/opentelemetry-hooks, tobilg/ai-observer, ColeMurray/claude-code-otel, badlogic/pi-mono
- OpenTelemetry semantic conventions: open-telemetry/semantic-conventions (gen-ai model)
- OpenTelemetry project governance tracker: open-telemetry/community (`projects/gen-ai.md`)
- Manual monitoring recommended for official docs: docs.github.com/copilot/, aider.chat/docs/, developers.openai.com/codex/, code.claude.com/docs/, qwenlm.github.io/qwen-code-docs/, cursor.com, pi.dev; verify Antigravity documentation for the installed version
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

**Evidence rule (reviewed 2026-10-07):** a vendor-native feature is marked supported only when current first-party documentation or source establishes it. “Unknown” means not verified, not unsupported. Community hooks, plugins, importers, and backends are listed separately; their signals must not be attributed to the agent vendor.

| Agent | Vendor | Native OTel | Traces | Metrics | Logs/Events | GenAI SemConv | Hooks Support | Config Method | Config File / Env Vars | Protocol | First-party Docs / Source |
|-------|--------|-------------|--------|---------|-------------|---------------|---------------|---------------|------------------------|----------|---------------|
| **Claude Code** | Anthropic | ⚠️ metrics/logs + traces beta | ⚠️ beta | ✅ | ✅ | ⚠️ selected `gen_ai.*`; native `claude_code.*` | ✅ governance wrapper | Env vars or managed settings | `CLAUDE_CODE_ENABLE_TELEMETRY`, `OTEL_*` | OTLP gRPC/HTTP | [docs](https://code.claude.com/docs/en/monitoring-usage) |
| **Google Antigravity** | Google | ? not verified | ? | ? | ? | ? | ⚠️ manual workflow hook | Verify version-specific docs | Do not reuse legacy CLI settings | Verify | — |
| **GitHub Copilot VS Code** | Microsoft | ✅ full | ✅ | ✅ | ✅ | ✅ (`gen_ai.*`) | ✅ community event hooks | VS Code `settings.json` or env var | `COPILOT_OTEL_ENABLED` | OTLP HTTP | [docs](https://code.visualstudio.com/docs/copilot/guides/monitoring-agents) |
| **GitHub Copilot CLI** | Microsoft | ✅ full | ✅ | ✅ | ✅ | ✅ (`gen_ai.*`) | ✅ governance wrapper | Same span model as VS Code | `COPILOT_OTEL_ENABLED` | OTLP HTTP | [docs](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) |
| **OpenAI Codex CLI** | OpenAI | ✅ OTLP signals in current source | ✅ configurable | ✅ configurable | ✅ configurable | ⚠️ custom `codex.*` events | ✅ lifecycle/governance | `~/.codex/config.toml` `[otel]` section | `exporter`, `trace_exporter`, `metrics_exporter` | OTLP gRPC/HTTP | [config](https://developers.openai.com/codex/config-advanced), [OTel source](https://github.com/openai/codex/tree/main/codex-rs/otel) |
| **Qwen Code** | Alibaba | ✅ traces, metrics, logs | ✅ | ✅ | ✅ | ⚠️ selected `gen_ai.*`; custom `qwen-code.*` | ✅ lifecycle/governance | `.qwen/settings.json`, env vars, CLI flags | `QWEN_TELEMETRY_*`, `OTEL_*` | OTLP gRPC/HTTP or file | [docs](https://qwenlm.github.io/qwen-code-docs/en/developers/development/telemetry/) |
| **OpenCode** | Anomaly | ? verify first-party | ? | ? | ? | ? | ✅ community hook | Community plugin; OpenCode V2 plugin line is `2.x` (`plugins` key); V1 uses `1.x` branch (`plugin` key) | `OPENCODE_*` (plugin) | OTLP gRPC/HTTP | — |
| **Pi Agent** | open-source | ? not verified | ? | ? | ⚠️ JSONL documented | ? | ? | Check current project docs | — | — | [docs](https://pi.dev) |
| **Cursor** | Anysphere | ? not verified | ? | ? | ? | ? | ✅ community hook | Native status/version-specific behavior requires first-party verification | — | — | [docs](https://cursor.com) |
| **Windsurf** | Cognition | ? not verified | ? | ? | ? | ? | ✅ community hook | Native status/version-specific behavior requires first-party verification | — | — | [docs](https://docs.windsurf.com) |
| **Amazon Q Developer CLI** | AWS | ? not verified | ? | ? | ? | ? | ? | CLI no longer actively maintained except critical security fixes; see vendor notice | — | — | [repository notice](https://github.com/aws/amazon-q-developer-cli) |
| **Aider** | open-source | ? not verified | ? | ? | ? | ? | ? verify hook compatibility | Native status/version-specific behavior requires first-party verification | — | — | [docs](https://aider.chat/docs/) |

### Legend

- ✅ Supported and shipped
- ⚠️ Partial support (see Known Gaps)
- 🔜 Planned but not yet shipped
- ❌ Confirmed unsupported by first-party source
- **Native OTel** = telemetry emitted by the agent itself
- **Hooks Support** = community IDE/agent-event hook integration; this is not vendor-native OTel or a generic process wrapper

---

## 2. Per-Agent Quick-Start Configs

### 2.1 Claude Code

Claude Code emits **metrics** and **logs/events**, with **traces available as a beta feature**. Telemetry is opt-in. Native beta tool spans include selected GenAI fields such as
`gen_ai.tool.call.id` alongside `tool_use_id`; this is partial alignment, not full
schema compliance. Keep `OTEL_LOG_TOOL_DETAILS` and `OTEL_LOG_TOOL_CONTENT` disabled
unless content collection is explicitly intended.
See [official monitoring documentation](https://code.claude.com/docs/en/monitoring-usage).

**Minimum config (env vars):**

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_TRACES_EXPORTER=otlp # beta
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
    "OTEL_TRACES_EXPORTER": "otlp",
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
> ⚠️ **Trace maturity**: Claude Code traces are beta. Validate signal shape, exporter behavior, and privacy controls before making them a production dependency.

---

### 2.2 Google Antigravity

Do not treat historical Google CLI telemetry settings or support claims as Antigravity documentation. Verify native OTel signals, configuration, protocol, privacy defaults, and semantic-convention coverage against first-party documentation for the installed Antigravity version. Until verified, mark native support as unknown rather than assuming former environment variables or configuration files work.

Antigravity has a community [runner-defined event-hook example](https://github.com/o11y-dev/opentelemetry-hooks/blob/main/examples/antigravity-workflow.example.md). Use it only when the installed runner supports the workflow/hook contract; it emits event-derived telemetry, not process duration/exit status or Antigravity-native signals. Verify the payloads and apply the privacy guidance in [§2.7](#27-hook-based-instrumentation-and-governance).

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

Copilot now emits three attribute namespaces: `gen_ai.*` for standard fields,
`github.copilot.*` as the preferred Copilot-specific namespace, and legacy
`copilot_chat.*` fields for compatibility. New dashboards and transforms should
prefer `github.copilot.*` while retaining legacy aliases when existing
consumers depend on them. Current Development GenAI tool spans use `execute_tool {gen_ai.tool.name}`;
the actual tool name belongs in `gen_ai.tool.name`.

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

Current Codex source includes independent OTLP exporters for logs, traces, and metrics. Configure each signal explicitly: setting the log `exporter` does not implicitly enable `trace_exporter`; HTTP endpoints are signal-specific. Verify the installed release and mode before assuming parity between interactive, `exec`, and `mcp-server`.

**Config file (`~/.codex/config.toml`):**

```toml
[otel]
exporter = { otlp-http = { endpoint = "http://localhost:4318/v1/logs", protocol = "json" } }
trace_exporter = { otlp-http = { endpoint = "http://localhost:4318/v1/traces", protocol = "json" } }
metrics_exporter = { otlp-http = { endpoint = "http://localhost:4318/v1/metrics", protocol = "json" } }
log_user_prompt = false
```

`log_user_prompt` defaults to `false`; agent-response and Guardian-assessment log events are separately opt-in and may contain sensitive text. The current Codex config source defaults `metrics_exporter` to Statsig, while trace/log exporters default to none; explicitly configure the metrics destination or set it to `none` rather than assuming an unset exporter disables metrics. Codex's event names and attributes are product-specific (`codex.*`), not a claim of full GenAI semantic-convention alignment. The current integration is in the [Codex OTel crate](https://github.com/openai/codex/tree/main/codex-rs/otel).

---

### 2.6 Qwen Code

Qwen Code exposes traces, logs, and metrics via `.qwen/settings.json`, `QWEN_TELEMETRY_*` / `OTEL_*` environment variables, and CLI flags. Current upstream telemetry docs describe selected GenAI attributes alongside product-specific `qwen-code.*` fields; verify exact emitted names in the installed version rather than relying on the old v0.16.1 snapshot. Telemetry is disabled by default.

**Config (`.qwen/settings.json`):**

```json
{
  "telemetry": {
    "enabled": true,
    "otlpEndpoint": "http://localhost:4317"
  }
}
```

> **Privacy:** current upstream docs list `logPrompts` as `true` by default; this includes prompts and API request/response text in telemetry logs. Set `QWEN_TELEMETRY_LOG_PROMPTS=false` (or the corresponding setting) unless that content is intentionally approved for the destination. `includeSensitiveSpanAttributes` defaults to `false`, but that does **not** suppress sensitive text in logs or other telemetry sinks. Metric `session.id` is excluded by default to limit cardinality.

**Schema/migration watch:** current upstream migration notes rename `tool_output_truncated` to `qwen-code.tool_output_truncated`. Recheck dashboards and filters that use the old name. The same notes clarify that some previously documented `tool.call.latency` and file-operation attributes were never emitted; validate actual telemetry instead of relying on older attribute tables.

---

### 2.7 Hook-Based Instrumentation and Governance

**[opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks)** is a community agent/IDE-event integration, not a process wrapper. The runner passes a JSON event payload to `otel-hook`; the hook emits spans and logs for lifecycle events such as prompts, tool calls, shell/MCP activity, file edits, and subagents. This can complement native telemetry or provide event-level coverage where vendor-native signals are unverified. It does not produce CPU/memory metrics or automatically discover internal activity that the agent does not expose through hooks.

Install and configure supported integrations with the project CLI:

```bash
pipx install opentelemetry-hooks
otel-hook setup --agent copilot --no-global
```

Antigravity uses a **manual, runner-defined workflow/hook command**, not an established native OTel exporter or an automated setup command. Follow the current [Antigravity workflow example](https://github.com/o11y-dev/opentelemetry-hooks/blob/main/examples/antigravity-workflow.example.md) and verify which event payloads the installed runner supplies.

| Project setting | Current documented default | Operational guidance |
|---|---|---|
| Conversation text | Off | Keep opt-in unless approved; captured text can include prompts and responses. |
| Tool-input content | Off | Keep off unless needed and approved. |
| OTel Logs | On | Disable if logs are not needed. |
| MCP input/output payload logs | **On** | Set `IDE_OTEL_MCP_LOG_PAYLOAD=false` in shared/production deployments unless full payload logging is explicitly approved. |
| Prompt masking | Off | `IDE_OTEL_MASK_PROMPTS=true` is opt-in; masking is not a substitute for minimizing capture. |

> **Privacy warning:** Do not assume the package's defaults are uniformly private: MCP payload logs are enabled by default while prompt masking is disabled. Apply source-side minimization and collector/backend access controls; inspect the current project configuration reference before deployment.

| Agent | Native OTel | Hooks Role | Recommended Usage |
|-------|-------------|------------|-------------------|
| **Claude Code** | ⚠️ metrics/logs + traces beta | Lifecycle/governance | Prefer native signals; add hook lifecycle events only when useful and reconcile duplicate session/activity data. |
| **Google Antigravity** | ? not verified | Manual event hook | Verify first-party signals separately; the hook project documents a runner-defined manual workflow integration. |
| **GitHub Copilot CLI** | ✅ full | Lifecycle/governance | Use native telemetry for agent signals; add hooks for supported lifecycle events only. |
| **GitHub Copilot VS Code** | ✅ full | Community event hook | Prefer native telemetry; a hook reports only events exposed by its IDE integration, not generic process CPU/memory. |
| **OpenAI Codex CLI** | ✅ OTLP signals in current source | Lifecycle/governance | Configure each native signal; hooks describe exposed event lifecycle and do not replace native spans/metrics. |
| **Qwen Code** | ✅ traces/logs/metrics | Lifecycle/governance | Native OTel is available; review prompt/log privacy defaults and schema changes before adding redundant hooks. |
| **OpenCode** | ? first-party status unverified | Community plugin + hooks | The plugin is a separate project; match plugin major line to OpenCode V1/V2. |
| **Cursor / Windsurf** | ? not verified | Community event hooks | Do not claim desktop process or full-agent coverage; verify what event payloads the installed integration exposes. |
| **Amazon Q Developer CLI** | ? not verified | ? | CLI project is no longer actively maintained except critical security fixes; do not present it as a current supported integration. |
| **Aider** | ? not verified | Community event hooks | Do not equate hook lifecycle spans with native model/tool telemetry. |

#### Hooks as a control and governance layer

Even when native OpenTelemetry exists, event hooks can add lifecycle context and a consistent community-defined event schema across integrations. Use the hook's documented configuration for resource attributes and source-side content controls, then apply collector filtering/redaction and backend access controls. Do not assume the hook wraps the whole process, sees every event, or creates uniform start/stop events for each agent.

> ⚠️ Hooks emit only events exposed by the agent/IDE hook API. They complement native telemetry, but do not imply coverage of hidden model calls, token counts, or other internal signals.

---

### 2.8 Community integrations: OpenCode and local ingestion

The [`@devtheops/opencode-plugin-otel`](https://github.com/DEVtheOPS/opencode-plugin-otel) project is a **community plugin**, not OpenCode-native OTel. Its current `2.x` line targets OpenCode V2 (`>=2`) and uses the `plugins` config key; the `1.x` line on the `v1` branch targets V1 and uses `plugin`. Do not mix the config formats. The V2 API removed `session.diff` from the plugin event stream, so its V2 implementation no longer emits the V1 `lines_of_code.count` / `lines_of_code.total` metrics; verify dashboards or alerts that depended on those.

Review its privacy behavior before enabling it: full prompt text in **logs** is opt-in, but observed prompts can be included in trace spans independently. `OPENCODE_CAPTURE_PROMPT_IN_LOGS` alone does not disable span capture; disable the relevant trace types when prompt content must not be exported. Model-visible context capture is separately opt-in.

[`AI Observer`](https://github.com/tobilg/ai-observer) is a local OTLP-compatible backend with its own dashboard, plus file import/watch modes for selected agent transcript formats. It is an ingestion/storage project, not instrumentation: file-import coverage is not equivalent to live OTLP traces, metrics, or logs. Follow its current guidance to avoid duplicate data when choosing between file-watch and OTLP modes.

[`claude-code-otel`](https://github.com/ColeMurray/claude-code-otel) is a community Claude Code Collector/Grafana/Prometheus/Loki stack. Its dashboards and copied setup notes are third-party artifacts; use Anthropic's current documentation as the authority for Claude Code telemetry configuration.

---

## 3. Unified Collector Config for Multi-Agent Ingestion

A single OTel Collector instance can receive telemetry from all agents simultaneously on standard OTLP ports. Prefer **OTLP gRPC** end-to-end when agents and backends support it; keep **OTLP HTTP** enabled where an agent, managed ingress, or backend only exposes HTTP or gRPC is not possible.

This example uses an explicit resource-label allowlist, requiring Contrib 0.160+.
It does not remove dimensions already emitted on metric datapoints. Disable or
filter session/user IDs at the source or with a targeted metric transform, and
verify producer identity survives backend mapping before aggregating counters.
For Python AI applications rather than coding-agent products, see
[python-instrumentation.md](python-instrumentation.md).

```yaml
# otel-collector-ai-agents.yaml
# Topology example: configure TLS/auth and writable per-replica storage for production
# Requires OTel Collector Contrib v0.160.0+ for resource_constant_labels

extensions:
  health_check:
    endpoint: localhost:13133
  file_storage:
    directory: /var/lib/otelcol/filestore
    create_directory: true

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317   # Preferred OTLP receiver: Claude Code, Codex CLI, and verified gRPC clients
      http:
        endpoint: 0.0.0.0:4318   # HTTP fallback/interop: GitHub Copilot VS Code/CLI and HTTP-only clients

processors:
  # CRITICAL: memory_limiter MUST be first processor in every pipeline
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 20

  # Preserve each agent's service.name and add a common filter dimension
  resource/enrich_agent_telemetry:
    attributes:
      - key: telemetry.source.type
        value: ai-coding-agent
        action: insert

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
    resource_constant_labels:
      included: [service.name, service.namespace, deployment.environment.name, telemetry.source.type]

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
      processors: [memory_limiter, resource/enrich_agent_telemetry, batch]
      exporters: [prometheus]

    # Logs/Events pipeline — all agents
    logs:
      receivers: [otlp]
      processors: [memory_limiter, resource/enrich_agent_telemetry, transform/redact_secrets, batch]
      exporters: [otlphttp/loki]

    # Traces pipeline — agents with verified trace export, such as Copilot
    traces:
      receivers: [otlp]
      processors: [memory_limiter, resource/enrich_agent_telemetry, batch]
      exporters: [otlp/tempo]
```

**Protocol choice**: Prefer OTLP gRPC on `4317` for both receivers and exporters. Keep OTLP HTTP on `4318` available for agents like GitHub Copilot and for backends, proxies, or managed ingest endpoints where gRPC is unavailable.

> **Processor ordering**: `memory_limiter` is always first. Resource enrichment runs before transforms so added attributes are available to OTTL statements. `batch` is always last before exporters.
>
> **Identity boundary**: Keep the agent identity in `service.name` (or a natively emitted agent attribute). `gen_ai.provider.name` identifies the GenAI provider, not the coding-agent product; never set it to values such as `claude_code`, `antigravity`, or `copilot` merely to unify dashboards.

---

## 4. Event & Metric Taxonomy

### 4.1 Metrics

| Agent | Metric Name | Type | Unit | Key Attributes |
|-------|-------------|------|------|----------------|
| Claude Code | `claude_code.session.count` | Counter | `count` | `session.id` (if enabled), `app.version` |
| Claude Code | `claude_code.token.usage` | Counter | `tokens` | `type`, `model` |
| Claude Code | `claude_code.cost.usage` | Counter | `USD` | `model` |
| Claude Code | `claude_code.code_edit_tool.decision` | Counter | `count` | `tool`, `decision` |
| GitHub Copilot | `gen_ai.client.token.usage` | Histogram | `{token}` | `gen_ai.provider.name`, `gen_ai.token.type`, `gen_ai.operation.name` |
| GitHub Copilot | `gen_ai.client.operation.duration` | Histogram | `s` | `gen_ai.provider.name`, `gen_ai.operation.name`, `error.type` |
| Codex CLI | `codex.api_request` | Counter | `1` | Verify attributes for installed release |
| Codex CLI | `codex.api_request.duration_ms` | Histogram | `ms` | Verify attributes for installed release |

> ⚠️ **Dashboard for evolving `gen_ai.token.type` values.** Do not assume GenAI token metrics are permanently limited to `input` and `output`. Newer semantic-convention work is adding finer-grained categories such as cache and reasoning tokens. Build charts and cost rollups so unknown token types are grouped, not discarded.

Codex metric names above are from the current [Codex OTel source](https://github.com/openai/codex/blob/main/codex-rs/otel/src/metrics/names.rs); earlier names such as `codex.tokens.used` and `codex.request.latency` are not present in that source. Recheck names, types, and attributes against the installed version before building dashboards.

**Current convention review**: GenAI conventions are now maintained in the separate [`open-telemetry/semantic-conventions-genai`](https://github.com/open-telemetry/semantic-conventions-genai) repository and are still marked Development. Preserve `gen_ai.provider.name`, `gen_ai.agent.version`, `gen_ai.usage.cache_read.input_tokens`, and `gen_ai.usage.cache_creation.input_tokens` when emitted. `gen_ai.system` is deprecated; do not synthesize it in Collector transforms.

### 4.2 Events / Logs

Current GenAI conventions model captured content with opt-in structured attributes on spans or events rather than the deprecated per-message event names:

| Content | Current attribute | Notes |
|---------|-------------------|-------|
| System instructions | `gen_ai.system_instructions` | Opt-in; may contain secrets or PII |
| Input/chat history | `gen_ai.input.messages` | Opt-in; preserve message order and structured schema |
| Model output | `gen_ai.output.messages` | Opt-in; one message per output choice/candidate |

Vendor event examples (these are log events, not metric instruments):

| Agent | Event | Useful attributes |
|-------|-------|-------------------|
| Claude Code | `claude_code.api_request` | `duration_ms`, `input_tokens`, `output_tokens`, `model` |
| Claude Code | `claude_code.tool_result` | `duration_ms`, `success`, `name` |

Do not generate `gen_ai.user.message`, `gen_ai.assistant.message`, `gen_ai.tool.message`, or `gen_ai.choice`; those event names are deprecated. Preserve vendor-native event names from Claude Code and Codex instead of relabeling them as standard GenAI events. Correlate with the native `prompt.id` or `session.id`, and use `gen_ai.conversation.id` when a GenAI-compatible source emits it.

### 4.3 Traces (where supported)

| Agent | Span Name | Kind | Key Attributes | Child Spans |
|-------|-----------|------|----------------|-------------|
| GenAI inference | `{gen_ai.operation.name} {gen_ai.request.model}` | `CLIENT` (usually) | `gen_ai.provider.name`, `gen_ai.operation.name`, `gen_ai.request.model` | tool call spans |
| GenAI tool execution (Development) | `execute_tool {gen_ai.tool.name}` | `INTERNAL` | `gen_ai.operation.name=execute_tool`, `gen_ai.tool.name`, `gen_ai.tool.call.id` | none |

> **Note**: Claude Code traces are beta. If traces are disabled or unavailable, use native `prompt.id` correlation across log events as a fallback.

---

## 5. Dashboard Patterns

### 5.1 Community Dashboards and Backends

| Project | Role / coverage | Stack or mode | Link |
|-----------|-----------------|---------------|------|
| **AI Observer** | Self-hosted OTLP backend/dashboard; selected file import/watch sources | Single binary; OTLP HTTP/JSON or HTTP/Protobuf | [github.com/tobilg/ai-observer](https://github.com/tobilg/ai-observer) |
| **claude-code-otel** | Community Claude Code dashboards and Collector setup | Grafana + Prometheus + Loki | [github.com/ColeMurray/claude-code-otel](https://github.com/ColeMurray/claude-code-otel) |

These projects are not vendor-native instrumentation. Confirm supported input signals and versions in each project's current docs; no built-in Honeycomb Claude Code board template is asserted here.

### 5.2 Recommended Dashboard Panels

Build these panels for a team-facing AI agent observability dashboard:

1. **Token usage by agent/user/model over time**
   - Metric: `claude_code.token.usage` grouped by `type` (Claude Code); `gen_ai.client.token.usage` where the agent emits it
   - Dimensions: `service.name` (agent), `gen_ai.provider.name`, and model (NOT `session.id` — high cardinality)
   - Chart type: Stacked bar, 1h buckets

2. **Cost breakdown by agent and model**
   - Metric: `claude_code.cost.usage` (Claude Code); derived from token counts × model pricing for others
   - Dimensions: `service.name`, `gen_ai.provider.name`, and model
   - Chart type: Time series + running total stat panel

3. **API request latency (p50/p95/p99)**
   - Source: `claude_code.api_request` log event `duration_ms` (Claude Code); `gen_ai.client.operation.duration` where a GenAI SemConv agent emits it
   - Chart type: Heatmap or percentile time series

4. **Tool call success/failure rates**
   - Source: `claude_code.tool_result` log event with `success` and `duration_ms`; use a counter/histogram only if the producer actually exports one
   - Trace query: filter spans where `gen_ai.operation.name = "execute_tool"`, grouped by `gen_ai.tool.name` and status; use the source's native event when traces are unavailable
   - Chart type: Success rate gauge + error rate alert

5. **Active sessions / DAU/WAU/MAU**
   - Source: Log events with `session.id` (count distinct via log query, not metric dimension)
   - Chart type: Unique session count per day/week/month

6. **Cache hit ratio (Claude Code)**
   - Metric: `claude_code.token.usage` grouped by token `type`; calculate cache-read share only after verifying whether `input` includes cache-read tokens in the deployed version
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
| `gen_ai.provider.name` | Low (~10 values) | Safe provider dimension; do not use it for coding-agent identity |
| `service.name` | Low for a controlled agent fleet | Preferred coding-agent dimension; enforce a bounded allowlist |
| `tool.name` | Low–Medium | Acceptable as metric dimension if tools are bounded |

> **Rule of 100**: Any attribute with >100 unique values should NOT be a metric dimension. Use logs or traces instead.

### 6.2 Prompt Content Controls

| Agent | Default | Content control |
|-------|---------|-------------------|
| Claude Code | Prompts **redacted** | `OTEL_LOG_USER_PROMPTS=true` |
| Codex CLI | Prompts **redacted** | `log_user_prompt = true` in config.toml |
| Qwen Code | Telemetry disabled; current docs list `logPrompts=true` by default once enabled | Set `QWEN_TELEMETRY_LOG_PROMPTS=false`; verify other telemetry sinks separately |
| opentelemetry-hooks | Conversation capture off; MCP payload logs on by default | Set `IDE_OTEL_MCP_LOG_PAYLOAD=false`; prompt masking also requires explicit opt-in |
| OpenCode community plugin | Prompt logs off, but observed prompt may appear in trace spans | `OPENCODE_CAPTURE_PROMPT_IN_LOGS` controls logs only; disable trace capture separately |
| GitHub Copilot | Content **not captured** | `captureContent: true` in settings |

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

### 7.1 Claude Code: Beta Traces

**Gap**: Claude Code's trace export is beta and should not be treated as a stable cross-agent tracing contract. There may still be deployments where only metrics and logs/events are enabled.

**Workaround — Pseudo-trace via `prompt.id` correlation**:

```
prompt.id = "prompt_abc123"

Log events sharing this prompt.id form a "trace":
  → <native user-prompt event>   (prompt.id=prompt_abc123)
  → claude_code.api.request (prompt.id=prompt_abc123)
  → <native tool event>   (prompt.id=prompt_abc123, tool.name=bash)
  → <native response event> (prompt.id=prompt_abc123)
```

Query in Loki/OpenSearch: `{job="claude_code"} | json | prompt_id="prompt_abc123"` to reconstruct a session's event timeline.

### 7.2 Codex CLI: Signal Configuration and Mode Coverage

**Caveat**: Current Codex source exposes independently configured OTLP log,
trace, and metric exporters. This does not establish identical signal coverage
across interactive, `exec`, and `mcp-server` modes or all released versions.

**Action**: Verify the installed Codex release and mode independently. Set
`trace_exporter` as well as the log `exporter` when traces are required. Add
caller-level timing/exit-code instrumentation only when native coverage is
missing.

### 7.3 Qwen Code: Native Telemetry and Privacy Defaults

**Status**: Current upstream docs describe native traces, logs, and metrics,
`.qwen/settings.json`, `QWEN_TELEMETRY_*` / `OTEL_*`, and selected `gen_ai.*`
attributes alongside `qwen-code.*` fields. Do not carry forward the old v0.16.1
snapshot as a current version boundary.

**Privacy action**: Telemetry is disabled by default, but current docs list
`logPrompts=true` once enabled. Explicitly set it to `false` when prompt and API
request/response text should not go to telemetry logs. The sensitive-span
attribute opt-in does not control all other telemetry sinks. Session IDs are
excluded from metric datapoints by default; enabling them can cause cardinality
fan-out.

### 7.4 Agents With Unverified Native OTel — Community Hook Coverage

**Gap**: Native OTel status is not established for every agent in the matrix.
Lack of evidence in reviewed sources is not proof that signals are unsupported.

**Workaround**: Where the agent exposes compatible hook events, use
**[opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks)** to
export event-derived spans/logs. Antigravity's integration is runner-defined and
manual; it does not establish Antigravity-native OTel support. See
[§2.7](#27-hook-based-instrumentation-and-governance).

> ⚠️ Event hooks are limited to event payloads the agent/IDE exposes. They do
> not imply generic process metrics or access to internal token/model details
> absent from those payloads.

### 7.5 Cross-Agent Trace Correlation

**Caveat**: Trace-context support is agent- and integration-specific, not a fleet-wide guarantee. Current Qwen docs keep outbound `traceparent` propagation disabled by default; Codex exposes W3C trace-context helpers; and the OpenCode community plugin accepts caller context and can propagate it to selected providers. Antigravity's native support remains unverified.

**Action**: Explicitly verify both context extraction/parenting and outbound propagation for the installed versions. Do not send trace context to model providers unless that propagation is intended and approved. When any hop does not propagate context, use a shared session/correlation attribute for log or trace queries; do not describe that as a distributed trace.

### 7.6 GenAI SemConv Coverage

**Current execute-tool convention (Development)**: Set `gen_ai.operation.name` to `execute_tool`, populate `gen_ai.tool.name`, and name manually generated spans `execute_tool {gen_ai.tool.name}`. Use the registered tool name, never arguments, file paths, or request IDs. Preserve vendor-native span names. See the [current convention](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md#execute-tool-span).

| Agent | Uses `gen_ai.*` | Custom Prefix | Notes |
|-------|----------------|---------------|-------|
| Google Antigravity | ? not verified | — | Confirm emitted fields and signal support against first-party documentation for the installed version |
| GitHub Copilot | ✅ documented | — | Verify emitted fields against the agent version and Development GenAI conventions |
| Claude Code | ⚠️ selected fields | `claude_code.*` | Beta tool spans emit selected GenAI fields; preserve native names and identify the agent with `service.name` |
| Codex CLI | ⚠️ alignment not established | `codex.*` | Codex-specific OTLP traces/logs/metrics; do not describe native events as GenAI semantic conventions |
| Qwen Code | ⚠️ selected fields | `qwen-code.*` | Current upstream docs describe selected dual-emitted `gen_ai.*`; validate exact names against the installed release |

For unified dashboards, group coding agents by `service.name` and providers by `gen_ai.provider.name`. Do not translate an agent product name into `gen_ai.provider.name`, and do not recreate deprecated `gen_ai.system` attributes.

For dashboards and alerting, treat `gen_ai.token.type` as an **open set**. Keep normalizations additive (for example, mapping vendor-specific cache counters into a shared label) instead of rewriting unfamiliar values away.

### 7.7 Watchlist: Agent Identity and Sandbox SemConv Proposals

OpenTelemetry upstream is discussing new semantic conventions for **AI agent identity/trust** and **AI sandbox execution** ([semantic-conventions#3582](https://github.com/open-telemetry/semantic-conventions/issues/3582), [semantic-conventions#3583](https://github.com/open-telemetry/semantic-conventions/issues/3583)). These are proposals only; this skill should not present `agent.*` or `sandbox.*` as stable OpenTelemetry fields yet.

There is also an active proposal for a dedicated **skill span** concept ([semantic-conventions#3540](https://github.com/open-telemetry/semantic-conventions/issues/3540)). Do not assume `gen_ai.skill.*` naming is finalized; keep skill/tool execution modeling behind collector transforms or dashboard aliasing until conventions stabilize.

Track the OpenTelemetry Community GenAI project page ([community/projects/gen-ai.md](https://github.com/open-telemetry/community/blob/main/projects/gen-ai.md)) for governance updates, ownership changes, and handoffs that can affect where canonical guidance is published.

**Current guidance until conventions stabilize:**

- Keep using the source's existing `gen_ai.*` fields, stable core resource attributes, and vendor-specific fields; treat the GenAI fields as Development rather than promising a stable schema.
- If you must model agent identity, trust, or sandbox metadata today, place it under an **organization-controlled custom namespace** (for example, `company.agent.id`, `company.agent.trust_level`, `company.sandbox.runtime`) rather than betting on proposed upstream names.
- Treat sandbox telemetry as a **deployment/runtime concern** first: make graceful flush, short-lived process export, and network-isolated delivery work before standardizing attribute names.
- Do **not** use proposed agent or sandbox IDs as metric dimensions unless you have verified bounded cardinality; keep high-cardinality identifiers in traces/logs only.

When these proposals become an OTEP or merge into the semantic conventions repository, update collector transforms and dashboard examples deliberately rather than bulk-renaming attributes prematurely.
