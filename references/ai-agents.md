# AI Coding Agent Observability

A guide to monitoring AI coding agents (Claude Code, Gemini CLI, Google Antigravity, GitHub Copilot, Codex CLI, and others) via OpenTelemetry.

<!-- UPSTREAM MONITORING NOTE:
The digest surfaces releases and recent issues from these repositories for review; it does not detect changes to the paths listed in the mapping:
- GitHub repositories: github/copilot-cli, Aider-AI/aider, openai/codex, google-gemini/gemini-cli, anthropics/claude-code, anthropics/skills, QwenLM/qwen-code, microsoft/vscode, anomalyco/opencode, DEVtheOPS/opencode-plugin-otel, o11y-dev/opentelemetry-hooks, tobilg/ai-observer, ColeMurray/claude-code-otel, earendil-works/pi
- OpenTelemetry semantic conventions: open-telemetry/semantic-conventions (gen-ai model)
- OpenTelemetry project governance tracker: open-telemetry/community (`projects/gen-ai.md`)
- Manual monitoring recommended for official docs: docs.github.com/copilot/, aider.chat/docs/, developers.openai.com/codex/, code.claude.com/docs/, qwenlm.github.io/qwen-code-docs/, cursor.com/docs/enterprise/opentelemetry-export/wire, cursor.com/docs/hooks, pi.dev, geminicli.com/docs/cli/telemetry/, antigravity.google/docs/hooks, antigravity.google/docs/changelog
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

**Source authority:** use vendor documentation and versioned vendor source for native telemetry; use OpenTelemetry specifications and tagged releases for protocol, convention, and Collector behavior. A community project's documentation establishes only that project's behavior. The integrations below are optional examples, not OpenTelemetry-project or agent-vendor endorsements. “Unknown” means not verified, not unsupported; check the installed product, version, and execution mode before generating configuration.

| Agent | Vendor | Native OTel | Traces | Metrics | Logs/Events | GenAI SemConv | Hooks Support | Config Method | Config File / Env Vars | Protocol | First-party Docs / Source |
|-------|--------|-------------|--------|---------|-------------|---------------|---------------|---------------|------------------------|----------|---------------|
| **Claude Code** | Anthropic | ⚠️ metrics/logs + traces beta | ⚠️ beta | ✅ | ✅ | ⚠️ selected `gen_ai.*`; native `claude_code.*` | ✅ governance wrapper | Env vars or managed settings | `CLAUDE_CODE_ENABLE_TELEMETRY`, `OTEL_*` | OTLP gRPC/HTTP | [docs](https://code.claude.com/docs/en/monitoring-usage) |
| **Gemini CLI** | Google | ✅ documented | ✅ | ✅ | ✅ | ⚠️ verify emitted fields | ✅ vendor hooks | `.gemini/settings.json` or env vars | `GEMINI_TELEMETRY_*` | OTLP gRPC/HTTP | [telemetry](https://geminicli.com/docs/cli/telemetry/), [support transition](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/) |
| **Antigravity CLI / IDE / 2.0** | Google | ? OTLP export not verified | ? | ? | ? | ? | ✅ vendor lifecycle hooks; adapter required for OTel | Verify product-specific docs | Do not reuse Gemini CLI settings | Verify | [hooks](https://www.antigravity.google/docs/hooks), [settings](https://www.antigravity.google/docs/settings) |
| **GitHub Copilot VS Code** | Microsoft | ✅ full | ✅ | ✅ | ✅ | ✅ (`gen_ai.*`) | ✅ community event hooks | VS Code `settings.json` or env var | `COPILOT_OTEL_ENABLED` | OTLP HTTP/gRPC | [docs](https://code.visualstudio.com/docs/agents/guides/monitoring-agents) |
| **GitHub Copilot CLI** | Microsoft | ✅ traces/metrics | ✅ | ✅ | ? verify log export separately | ✅ (`gen_ai.*`) | ✅ governance wrapper | Same span model as VS Code | `COPILOT_OTEL_ENABLED` | OTLP HTTP | [docs](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) |
| **OpenAI Codex CLI** | OpenAI | ✅ OTLP signals in current source | ✅ configurable | ✅ configurable | ✅ configurable | ⚠️ custom `codex.*` events | ✅ lifecycle/governance | `~/.codex/config.toml` `[otel]` section | `exporter`, `trace_exporter`, `metrics_exporter` | OTLP gRPC/HTTP | [config](https://developers.openai.com/codex/config-advanced), [OTel source](https://github.com/openai/codex/tree/main/codex-rs/otel) |
| **Qwen Code** | Alibaba | ✅ traces, metrics, logs | ✅ | ✅ | ✅ | ⚠️ selected `gen_ai.*`; custom `qwen-code.*` | ✅ lifecycle/governance | `.qwen/settings.json`, env vars, CLI flags | `QWEN_TELEMETRY_*`, `OTEL_*` | OTLP gRPC/HTTP or file | [docs](https://qwenlm.github.io/qwen-code-docs/en/developers/development/telemetry/) |
| **OpenCode** | Anomaly | ⚠️ experimental AI SDK instrumentation; export requires verification | ⚠️ AI SDK calls | ? | ? | ⚠️ verify emitted fields | ✅ community hook | Community plugin; OpenCode V2 plugin line is `2.x` (`plugins` key); V1 uses `1.x` branch (`plugin` key) | `experimental.openTelemetry` (native); `OPENCODE_*` (plugin) | Verify native exporter; plugin OTLP gRPC/HTTP | [schema](https://opencode.ai/config.json), [v1.19.0 source](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/session/llm.ts) |
| **Pi Agent** | open-source | ? not verified | ? | ? | ⚠️ JSONL documented | ? | ? | Check current project docs | — | — | [docs](https://pi.dev) |
| **Cursor** | Anysphere | ✅ Enterprise server-side export | ❌ | ✅ | ✅ | Custom `cursor.*` schema | ✅ vendor callbacks; optional community OTel adapter | Team Settings > OpenTelemetry Export | Team destination URL and auth headers | OTLP/HTTP protobuf | [export](https://cursor.com/docs/enterprise/opentelemetry-export), [wire](https://cursor.com/docs/enterprise/opentelemetry-export/wire) |
| **Windsurf** | Cognition | ? not verified | ? | ? | ? | ? | ✅ community hook | Native status/version-specific behavior requires first-party verification | — | — | [docs](https://docs.windsurf.com) |
| **Amazon Q Developer CLI** | AWS | ? not verified | ? | ? | ? | ? | ? | CLI no longer actively maintained except critical security fixes; see vendor notice | — | — | [repository notice](https://github.com/aws/amazon-q-developer-cli) |
| **Aider** | open-source | ? not verified | ? | ? | ? | ? | ? verify hook compatibility | Native status/version-specific behavior requires first-party verification | — | — | [docs](https://aider.chat/docs/) |

### Legend

- ✅ Supported and shipped
- ⚠️ Partial support (see Known Gaps)
- 🔜 Planned but not yet shipped
- ❌ Confirmed unsupported by first-party source
- **Native OTel** = telemetry exported by the vendor implementation, including server-side export where documented
- **Hooks Support** = lifecycle callbacks or community integrations, as indicated; callback availability alone does not establish OTel export or adapter compatibility

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
export OTEL_METRICS_INCLUDE_SESSION_ID=false
export OTEL_LOG_USER_PROMPTS=false
export OTEL_LOG_TOOL_DETAILS=false
export OTEL_LOG_TOOL_CONTENT=false
export OTEL_LOG_RAW_API_BODIES=false
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
    "OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE": "cumulative",
    "OTEL_METRICS_INCLUDE_SESSION_ID": "false",
    "OTEL_LOG_USER_PROMPTS": "false",
    "OTEL_LOG_TOOL_DETAILS": "false",
    "OTEL_LOG_TOOL_CONTENT": "false",
    "OTEL_LOG_RAW_API_BODIES": "false"
  }
}
```

**Privacy controls:**

| Env Var | Default | Effect |
|---------|---------|--------|
| `OTEL_LOG_USER_PROMPTS` | `false` | Includes raw user prompts in log events |
| `OTEL_LOG_TOOL_DETAILS` | `false` | Includes tool arguments/details in events and trace attributes |
| `OTEL_LOG_TOOL_CONTENT` | `false` | Includes tool-result content in tracing; independent of prompt logging |
| `OTEL_LOG_RAW_API_BODIES` | disabled | Exports full API bodies/history; implies consent to the other content controls |
| `OTEL_METRICS_INCLUDE_SESSION_ID` | `true` | Adds `session.id` as metric dimension; explicitly disable it for bounded team dashboards |
| `OTEL_METRICS_INCLUDE_ENTRYPOINT` | `false` | Adds bounded `app.entrypoint` as a metric dimension for dashboard slicing |

> **Temporality**: Anthropic documents `delta` as the default. The persistent example selects `cumulative` for a backend that requires it, such as a Prometheus-style counter pipeline. Match the exporter and backend, and verify aggregation across exports and process restarts; do not assume every deployment uses cumulative metrics.
> ✅ **Bounded metric dimension**: Prefer `OTEL_METRICS_INCLUDE_ENTRYPOINT=true` over `OTEL_METRICS_INCLUDE_SESSION_ID=true` when you need a stable breakdown of CLI vs IDE/SDK launches. `app.entrypoint` stays bounded and is safe for dashboards; `session.id` is still high-cardinality.
> ⚠️ **Trace maturity**: Claude Code traces are beta. Validate signal shape, exporter behavior, and privacy controls before making them a production dependency.

**Managed configuration:** current [Anthropic monitoring documentation](https://code.claude.com/docs/en/monitoring-usage) says repository settings cannot enable export, choose its destination, or enable content capture. Use managed settings, the launch environment, or user settings. Managed generic endpoints/protocols remove conflicting developer per-signal values; set exporter selectors too when signals must be enforced. Destination locking is version-dependent (notably v2.1.217, v2.1.223 and v2.1.251); check the installed release and launcher. Claude does not pass `OTEL_*` variables to Bash, hooks, or MCP subprocesses. Tracing can separately propagate `TRACEPARENT`; this is not exporter configuration inheritance.

**Cost:** do not classify subscription versus extra-usage billing from auth mode or list-price cost alone. [Upstream #101212](https://github.com/anthropics/claude-code/issues/101212) requests per-request billing classification; its proposed attribute is not a supported field. Validate usage estimates against provider billing separately.

---

### 2.2 Google agents: Gemini CLI and Antigravity

#### Gemini CLI

Google's [transition announcement](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/) moves consumer access to Antigravity while retaining Gemini CLI for Standard/Enterprise customers and paid API-key access. Keep Gemini telemetry guidance for those deployments; migration is not a rename of telemetry settings.

[Gemini's official telemetry guide](https://geminicli.com/docs/cli/telemetry/) documents native logs, metrics, and traces. For an existing supported Gemini deployment sending to a local Collector:

```bash
export GEMINI_TELEMETRY_ENABLED=true
export GEMINI_TELEMETRY_TARGET=local
export GEMINI_TELEMETRY_OTLP_ENDPOINT=http://localhost:4317
export GEMINI_TELEMETRY_OTLP_PROTOCOL=grpc
export GEMINI_TELEMETRY_TRACES_ENABLED=false
export GEMINI_TELEMETRY_LOG_PROMPTS=false
```

Telemetry is opt-in; `logPrompts` defaults to true once enabled. The separate `traces` setting enables detailed attributes including prompts and tool output, so keep it false for content-minimized export. Disabling prompt logs does not disable this span-content path or remove tool arguments from every event. Inspect emitted logs/spans and filter sensitive fields before forwarding to a shared backend. An `outfile` setting overrides endpoint export. Verify received signals and field names for the installed release before building dashboards.

#### Antigravity CLI, IDE, and SDK

Treat each product surface separately. Native user-configurable OTLP export from the CLI/IDE/2.0 is not established by the sources linked here. The product's “Enable Telemetry” setting concerns Google's data collection, not proof of export to your Collector. Do not reuse `GEMINI_TELEMETRY_*` settings.

Google documents [lifecycle hooks](https://www.antigravity.google/docs/hooks) with events including `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, and `Stop`. Tool callbacks carry `conversationId`, `toolCall.name`, and `toolCall.args`. To export them through an OTel adapter, verify the event discriminator, nested-field mapping, callback pairing, and required stdout response for that surface. Test representative success/failure callbacks and the exported signal; merely invoking `otel-hook` from a workflow does not establish this mapping or API-latency coverage.

The [official SDK changelog](https://www.antigravity.google/docs/changelog) separately documents native OpenTelemetry tracing in **Python SDK v0.1.5**. This is evidence for SDK tracing, not CLI/IDE export parity; verify the SDK's installed-version setup before configuring it.

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
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
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

Copilot CLI documents native **traces and metrics**, with a related GenAI span model to VS Code. Do not infer an independent OTLP logs pipeline or identical defaults from the extension. The [CLI reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#opentelemetry-monitoring) documents HTTP JSON by default and HTTP/protobuf as an option; VS Code defaults to HTTP/protobuf and also supports gRPC.

```bash
export COPILOT_OTEL_ENABLED=true
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Keep `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=false`. Setting `OTEL_EXPORTER_OTLP_ENDPOINT` itself enables telemetry; use the documented standard variable rather than `COPILOT_OTEL_OTLP_ENDPOINT`. In VS Code, `COPILOT_OTEL_ENDPOINT` overrides the standard endpoint, and environment values can override managed values. Validate the effective destination per surface.

**Known-report checks:** [#4970](https://github.com/github/copilot-cli/issues/4970) reports stale parent `gen_ai.request.model` after a subagent model switch in CLI 1.0.88; compare requested/resolved model and billing fields before attributing cost. [#5005](https://github.com/github/copilot-cli/issues/5005) reports missing metric producer identity across concurrent CLI sessions. Verify `service.instance.id` and aggregation with two concurrent producers; do not merge cumulative streams by dropping identity. Closed subagent-billing, parentage, or headless-export issues do not establish the fix in your installed version.

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
log_agent_responses = false
log_guardian_assessments = false
```

**Release evidence:** the following details are checked against [Codex 0.162.1](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/otel/README.md), not a promise for older CLI, app-server, IDE, or Desktop builds.

- OTLP metrics default to **delta**. For a cumulative backend, set `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative` in Codex's launch environment. Unknown values retain delta; this does not configure Statsig or runtime snapshots.
- In [0.162.1 initialization](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/core/src/otel_init.rs), `[analytics] enabled = false` disables **all metrics export**, including an explicitly configured OTLP destination, by selecting `OtelExporter::None`. Logs and traces are configured separately and are not disabled by this gate. [#26271](https://github.com/openai/codex/issues/26271) reports this limitation; the tagged code confirms it for 0.162.1. If analytics must remain disabled, do not promise native OTLP metrics on this release. Recheck the installed version before claiming the limitation is fixed. When analytics is enabled, an unset metrics exporter defaults to Statsig.
- `log_agent_responses` exports completed `final_answer` messages from main/task agents, not commentary, streaming deltas, replay, or internal agents. `log_guardian_assessments` exports review results and potentially sensitive rationales. Both require an explicit OTLP log exporter and default to false independently of prompt logging.
- `log_user_prompt=false` is **not a guarantee of content-free telemetry**. Tool arguments/output can expose commands, patches, or file contents ([#17909](https://github.com/openai/codex/issues/17909)). The [0.162.1 tool-result setting](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/protocol/src/config_types.rs) has a default 2,048-byte text limit; truncation is not redaction. Inspect all received signals and remove content fields before a shared backend, or leave logs disabled until the content policy is validated.
- `[otel.span_attributes]` adds attributes to exported spans. `[otel.tracestate.<member>]` upserts structured W3C member fields; it does not accept arbitrary opaque member values. Invalid entries generate startup warnings. Neither setting is a general resource-attribute API.

```toml
[otel.span_attributes]
"deployment.environment.name" = "development"

[otel.tracestate.example]
region = "local"
```

Use native `codex.*` metric/event names and preserve producer identity. Validate each signal independently, including a tool failure, subagent work, flush on exit, timestamps, and exported event names. Open reports [#42837](https://github.com/openai/codex/issues/42837) and [#30936](https://github.com/openai/codex/issues/30936) are reasons to inspect wire records, not to rewrite every version's schema or assert a current defect.

---

### 2.6 Qwen Code

Qwen Code exposes traces, logs, and metrics via `.qwen/settings.json`, `QWEN_TELEMETRY_*` / `OTEL_*` environment variables, and CLI flags. Current upstream telemetry docs describe selected GenAI attributes alongside product-specific `qwen-code.*` fields; verify exact emitted names in the installed version rather than relying on the old v0.16.1 snapshot. Telemetry is disabled by default.

**Config (`.qwen/settings.json`):**

```json
{
  "telemetry": {
    "enabled": true,
    "otlpEndpoint": "http://localhost:4317",
    "logPrompts": false
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

For Antigravity, a community workflow command is not a verified adapter for Google's lifecycle API. Use the first-party contract and validation requirements in [§2.2](#22-google-agents-gemini-cli-and-antigravity); do not recommend the integration as ready until the payload mapping and emitted telemetry have been tested.

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
| **Gemini CLI** | ✅ documented | Optional lifecycle context | Prefer native telemetry; retain coverage for supported enterprise/API-key deployments. |
| **Antigravity CLI / IDE / 2.0** | ? export not verified | Vendor callbacks; OTel adapter unverified | Validate the documented event contract before recommending a community adapter; SDK tracing is a separate surface. |
| **GitHub Copilot CLI** | ✅ full | Lifecycle/governance | Use native telemetry for agent signals; add hooks for supported lifecycle events only. |
| **GitHub Copilot VS Code** | ✅ full | Community event hook | Prefer native telemetry; a hook reports only events exposed by its IDE integration, not generic process CPU/memory. |
| **OpenAI Codex CLI** | ✅ OTLP signals in current source | Lifecycle/governance | Configure each native signal; hooks describe exposed event lifecycle and do not replace native spans/metrics. |
| **Qwen Code** | ✅ traces/logs/metrics | Lifecycle/governance | Native OTel is available; review prompt/log privacy defaults and schema changes before adding redundant hooks. |
| **OpenCode** | ? first-party status unverified | Community plugin + hooks | The plugin is a separate project; match plugin major line to OpenCode V1/V2. |
| **Cursor** | ✅ Enterprise metrics/logs; no traces | Optional execution traces | Prefer native usage monitoring; add hooks for callback-derived execution context. See [§2.9](#29-cursor-enterprise-export-and-optional-hooks). |
| **Windsurf** | ? not verified | Community event hooks | Verify installed callback coverage; do not claim full-agent or desktop-process coverage. |
| **Amazon Q Developer CLI** | ? not verified | ? | CLI project is no longer actively maintained except critical security fixes; do not present it as a current supported integration. |
| **Aider** | ? not verified | Community event hooks | Do not equate hook lifecycle spans with native model/tool telemetry. |

#### Hooks as a control and governance layer

Even when native OpenTelemetry exists, event hooks can add lifecycle context and a consistent community-defined event schema across integrations. Use the hook's documented configuration for resource attributes and source-side content controls, then apply collector filtering/redaction and backend access controls. Do not assume the hook wraps the whole process, sees every event, or creates uniform start/stop events for each agent.

> ⚠️ Hooks emit only events exposed by the agent/IDE hook API. They complement native telemetry, but do not imply coverage of hidden model calls, token counts, or other internal signals.

---

### 2.8 OpenCode instrumentation and community integrations

OpenCode's [current schema](https://opencode.ai/config.json) exposes `experimental.openTelemetry` for AI SDK call spans. [v1.19.0 LLM source](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/session/llm.ts) passes that flag to `experimental_telemetry` and obtains an optional tracer service. This verifies an instrumentation path, not turnkey user-configurable OTLP export, native metrics/logs, or safe content defaults. Verify provider/exporter initialization and received records before recommending a native-only setup.

The [`@devtheops/opencode-plugin-otel`](https://github.com/DEVtheOPS/opencode-plugin-otel) project is a **community plugin**, not OpenCode-native OTel. Its current `2.x` line targets OpenCode V2 (`>=2`) and uses the `plugins` config key; the `1.x` line on the `v1` branch targets V1 and uses `plugin`. Do not mix the config formats. The V2 API removed `session.diff` from the plugin event stream, so its V2 implementation no longer emits the V1 `lines_of_code.count` / `lines_of_code.total` metrics; verify dashboards or alerts that depended on those.

Review its privacy behavior before enabling it: full prompt text in **logs** is opt-in, but observed prompts can be included in trace spans independently. `OPENCODE_CAPTURE_PROMPT_IN_LOGS` alone does not disable span capture; disable the relevant trace types when prompt content must not be exported. Model-visible context capture is separately opt-in.

[`AI Observer`](https://github.com/tobilg/ai-observer) is a local OTLP-compatible backend with its own dashboard, plus file import/watch modes for selected agent transcript formats. It is an ingestion/storage project, not instrumentation: file-import coverage is not equivalent to live OTLP traces, metrics, or logs. Follow its current guidance to avoid duplicate data when choosing between file-watch and OTLP modes.

The community plugin's [v2.0.1 configuration](https://github.com/DEVtheOPS/opencode-plugin-otel/blob/v2.0.1/README.md) distinguishes `OPENCODE_RESOURCE_ATTRIBUTES` (producer metadata) from `OPENCODE_SPAN_ATTRIBUTES` (attributes on spans, logs **and metric datapoints**). Use bounded values such as `team=platform`; do not put session IDs, paths, or user IDs in the latter. These are plugin settings, not native OpenCode environment variables.

**Other surfaces:** [Pi](https://github.com/earendil-works/pi/blob/v1.1.0/packages/coding-agent/README.md) documents JSON/RPC and extension mechanisms; marketplace OTel packages are third-party extensions, not proof of built-in OTLP export. [Windsurf/Cascade hooks](https://docs.devin.ai/desktop/cascade/hooks) establish callbacks, not native OTLP. [Aider analytics](https://aider.chat/docs/more/analytics.html) supports JSONL and PostHog; neither is OTLP. [Amazon Q CLI's maintenance notice](https://github.com/aws/amazon-q-developer-cli) does not establish export capabilities. Native OTLP remains unverified for these rows; avoid inventing `OTEL_*` setup commands.

[`claude-code-otel`](https://github.com/ColeMurray/claude-code-otel) is a community Claude Code Collector/Grafana/Prometheus/Loki stack. Its dashboards and copied setup notes are third-party artifacts; use Anthropic's current documentation as the authority for Claude Code telemetry configuration.

---

### 2.9 Cursor Enterprise export and optional hooks

[Cursor's export overview](https://cursor.com/docs/enterprise/opentelemetry-export) documents server-side Enterprise metrics/logs, without traces or OTel trace/span context. Configure a publicly reachable HTTPS base URL and auth headers in Team Settings; Cursor appends `/v1/metrics` and `/v1/logs`. Use OTLP/HTTP protobuf, not gRPC/JSON or desktop `OTEL_*` settings. Test the destination, then inspect received records. Metrics are at-most-once; logs are at-least-once, without historical backfill. Conversation content is opt-in and surface-specific; keep it disabled unless requested. Check current coverage before enabling it.

The [wire reference](https://cursor.com/docs/enterprise/opentelemetry-export/wire) defines `service.name=cursor` and scope `cursor.telemetry`. Preserve the vendor schema:

- `cursor.token.usage`, `cursor.tool.calls`, and `cursor.cost.usage` are delta sums; aggregate deltas by complete series identity. Cost is estimated, not invoiced spend; BYOK excludes provider spend.
- Deduplicate logs by `cursor.event.id`. Use available `cursor.conversation.id` for session analysis and `cursor.usage_event.id` for billing corrections; metric datapoints lack these IDs. Do not add session IDs to metric labels.
- `cursor.hook.execution_complete` reports the hook script's outcome and duration, not the observed tool's duration. `cursor.grok_bot.*` activity is surface-specific, not a guarantee of equivalent IDE/CLI events.

**Series and content controls:** resource identity includes team, user when present, surface, entrypoint, and client version when available. User ID/email and model fields are not guaranteed. Cursor permits overlapping delta windows for the same full series; sum the documented deltas in a compatible backend, without treating them as cumulative samples or deduplicating by timestamp alone. Preserve identity through aggregation; only drop high-cardinality user fields after an intentional aggregation, not by collapsing distinct producers.

Export-family switches and conversation-content switches are separate. Grok Bot actions additionally require Action Recording. Metadata events can still contain sensitive free text such as scrubbed shell commands and URLs; conversation-content off is not a universal no-content guarantee. Validate missing-user records, duplicate log delivery, billing corrections, overlapping windows, and desktop/CLI/cloud differences. See the [wire presence and family rules](https://cursor.com/docs/enterprise/opentelemetry-export/wire).

Optional [opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks) reconstructs traces from callbacks. Prefer native usage signals; add hooks when callback-level execution or cross-agent context is needed. Validate matching native `cursor.conversation.id` and hook `gen_ai.conversation.id` values before joining sessions. This is correlation, not shared trace context. Preserve hook provenance (`gen_ai.client.telemetry_source=hook`); do not sum native and hook-derived counts for the same activity. Token attributes present in a callback do not establish complete usage accounting.

[Cursor's hooks contract](https://cursor.com/docs/hooks) varies by execution surface. Cloud agents load project hooks, not workstation user configuration; callbacks can be absent during read-only exploration. Check which lifecycle/MCP callbacks are available before claiming complete traces. Pin the adapter version and test representative success/failure payloads and received spans; unpublished local coverage is not released support. Apply the community privacy controls in §2.7 independently of native export settings.

---

## 3. Unified Collector Config for Multi-Agent Ingestion

A single OTel Collector instance can receive telemetry from verified OTLP senders simultaneously on standard OTLP ports. Prefer **OTLP gRPC** end-to-end when agents and backends support it; keep **OTLP HTTP** enabled where an agent, managed ingress, or backend only exposes HTTP or gRPC is not possible.

This example preserves OTLP resource identity and source temporality. It does
not remove dimensions already emitted on metric datapoints. Prefer source-side
cardinality controls; do not delete producer identity from existing metric streams
without a defined aggregation. Verify identity survives backend mapping before
aggregating counters. The example is validated against Contrib 0.160 and 0.162.
For Python AI applications rather than coding-agent products, see
[python-instrumentation.md](python-instrumentation.md).

```yaml
# otel-collector-ai-agents.yaml
# Topology example: configure TLS/auth and writable per-replica storage for production
# Validated with OTel Collector Contrib v0.160.0 and v0.162.0

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

  # Illustrative field-specific rule, not a complete agent-content policy
  transform/redact_secrets:
    log_statements:
      - context: log
        statements:
          - replace_pattern(attributes["tool.parameters"], "(?i)(api[_-]?key|secret|token|password)[\"'\\s]*[:=][\"'\\s]*[^\\s,}]+", "REDACTED")

  batch:
    timeout: 10s
    send_batch_size: 1024

exporters:
  # Metrics → backend that supports the source temporality and resource identity
  otlphttp/metrics:
    endpoint: https://metrics.example.com
    sending_queue:
      enabled: true
      storage: file_storage
    retry_on_failure:
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
      processors: [memory_limiter, resource/enrich_agent_telemetry, batch]
      exporters: [otlphttp/metrics]

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

**Metrics backend contract:** the example forwards OTLP without converting temporality. Choose a backend that correctly handles each source's delta/cumulative streams and resource identity. Configure backend authentication separately before use. Cursor's cloud sender additionally needs an authenticated public HTTPS ingress to the HTTP receiver; a local port alone is not reachable from Cursor.

**Content boundary:** the sample transform only handles `tool.parameters` on
logs. It does not sanitize bodies, other attributes, or trace payloads. Apply the
agent-specific source controls and inspect every signal before shared export;
use a field allowlist or drop unapproved content for the actual emitted schema.

**Prometheus alternative:** for sources that can emit cumulative metrics (such as configured Claude/Codex), explicitly select cumulative temporality and validate producer identity, restart behavior, label mapping, and two concurrent sessions before using the `prometheus` exporter. For delta-only Cursor, do not assume either the exporter's accumulation or a delta-to-cumulative processor safely handles overlapping windows. Keep the OTLP route until a pinned, tested conversion path establishes correct totals. This reference does not claim a validated Cursor-to-Prometheus conversion recipe.

**Protocol choice**: Prefer OTLP gRPC on `4317` for both receivers and exporters. Keep OTLP HTTP on `4318` available for agents like GitHub Copilot and for backends, proxies, or managed ingest endpoints where gRPC is unavailable.

> **Processor ordering**: `memory_limiter` is always first. Resource enrichment runs before transforms so added attributes are available to OTTL statements. `batch` is always last before exporters.
>
> **Identity boundary**: Keep the agent identity in `service.name` (or a natively emitted agent attribute). `gen_ai.provider.name` identifies the GenAI provider, not the coding-agent product; never set it to values such as `claude_code`, `antigravity`, or `copilot` merely to unify dashboards.

---

## 4. Event & Metric Taxonomy

### 4.1 Metrics

| Agent | Metric Name | Type | Unit | Key Attributes |
|-------|-------------|------|------|----------------|
| Claude Code | `claude_code.session.count` | Counter | none | `session.id` (enabled by default; disable for bounded metrics), `app.version` (opt-in) |
| Claude Code | `claude_code.token.usage` | Counter | `tokens` | `type`, `model` |
| Claude Code | `claude_code.cost.usage` | Counter | `USD` | `model` |
| Claude Code | `claude_code.code_edit_tool.decision` | Counter | none | `tool_name`, `decision` |
| GitHub Copilot | `gen_ai.client.token.usage` | Histogram | `{token}` | `gen_ai.provider.name`, `gen_ai.token.type`, `gen_ai.operation.name` |
| GitHub Copilot | `gen_ai.client.operation.duration` | Histogram | `s` | `gen_ai.provider.name`, `gen_ai.operation.name`, `error.type` |
| Codex CLI | `codex.api_request` | Counter | `1` | Verify attributes for installed release |
| Codex CLI | `codex.api_request.duration_ms` | Histogram | `ms` | Verify attributes for installed release |
| Codex CLI | `codex.tool.call` | Counter | verify emitted unit | `tool`, `success` |
| Codex CLI | `codex.tool.call.duration_ms` | Histogram | `ms` | `tool`, `success` |
| Codex CLI | `codex.turn.e2e_duration_ms` | Histogram | `ms` | Verify attributes for installed release |
| Codex CLI | `codex.turn.ttft.duration_ms` | Histogram | `ms` | Verify attributes for installed release |
| Codex CLI | `codex.turn.token_usage` | Histogram | verify emitted unit | `token_type`; includes overlapping total/subtotal categories |

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
| Claude Code | `claude_code.tool_result` | `duration_ms`, `success`, `tool_name` |

Claude metric units and attribute names follow [Anthropic's monitoring reference](https://code.claude.com/docs/en/monitoring-usage). Preserve `tool_name` for these native signals rather than substituting `tool`, `name`, or the GenAI span attribute `gen_ai.tool.name`.

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
| Codex CLI | Prompt logging off; tool payloads need separate inspection | `log_user_prompt`, `log_agent_responses`, `log_guardian_assessments`; truncation is not redaction |
| Gemini CLI | Telemetry disabled; `logPrompts=true` once enabled | Set `GEMINI_TELEMETRY_LOG_PROMPTS=false`; inspect other sensitive event attributes separately |
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
  → claude_code.api_request (prompt.id=prompt_abc123)
  → claude_code.tool_result (prompt.id=prompt_abc123, tool_name=Bash)
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

**Workaround**: Where the agent exposes compatible hook events, a verified OTel
adapter can export event-derived spans/logs. The community
**[opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks)** project
is one option for supported contracts. Antigravity requires the separate
payload-mapping validation in §2.2; neither a workflow command nor SDK tracing
establishes native CLI/IDE export. See
[§2.7](#27-hook-based-instrumentation-and-governance).

> ⚠️ Event hooks are limited to event payloads the agent/IDE exposes. They do
> not imply generic process metrics or access to internal token/model details
> absent from those payloads.

### 7.5 Cross-Agent Trace Correlation

**Caveat**: Trace-context support is agent- and integration-specific, not a fleet-wide guarantee. Current Qwen docs keep outbound `traceparent` propagation disabled by default; Codex exposes W3C trace-context helpers; and the OpenCode community plugin accepts caller context and can propagate it to selected providers. Antigravity CLI/IDE OTLP export and cross-agent context propagation remain unverified.

**Action**: Explicitly verify both context extraction/parenting and outbound propagation for the installed versions. Do not send trace context to model providers unless that propagation is intended and approved. When any hop does not propagate context, use a shared session/correlation attribute for log or trace queries; do not describe that as a distributed trace.

### 7.6 GenAI SemConv Coverage

**Current execute-tool convention (Development)**: Set `gen_ai.operation.name` to `execute_tool`, populate `gen_ai.tool.name`, and name manually generated spans `execute_tool {gen_ai.tool.name}`. Use the registered tool name, never arguments, file paths, or request IDs. Preserve vendor-native span names. See the [current convention](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md#execute-tool-span).

| Agent | Uses `gen_ai.*` | Custom Prefix | Notes |
|-------|----------------|---------------|-------|
| Gemini CLI | ✅ documented fields | `gemini_cli.*` | Verify emitted fields against the installed release and Development GenAI conventions |
| Antigravity CLI / IDE / 2.0 | ? export not verified | — | Vendor hook events and SDK tracing do not establish native CLI/IDE OTLP export |
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
