# AI Agent Observability Test Scenarios

**Phase**: RED → GREEN (TDD)
**Purpose**: Validate that the `references/ai-agents.md` reference causes the skill to materially improve responses to AI coding agent observability questions.

---

## How to Use These Scenarios

1. **RED phase**: Test WITHOUT loading `references/ai-agents.md`. Record baseline responses.
2. **GREEN phase**: Test WITH skill active (SKILL.md loaded + ai-agents.md trigger fires). Verify improvements.
3. **REFACTOR**: Document any agent rationalizations and add counter-guidance.

---

## Scenario 1: Claude Code Telemetry Setup

**Prompt**:
> "Set up OpenTelemetry monitoring for Claude Code to track token usage and costs"

### Expected WITHOUT skill (RED baseline)

- May not know `CLAUDE_CODE_ENABLE_TELEMETRY=1` is required (telemetry is opt-in)
- Likely suggests wrong or generic env var names
- Will not mention `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`
- No mention of `~/.claude/settings.json` for persistent config
- No privacy controls (`OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_TOOL_DETAILS`)
- No cardinality warning about `session.id` as metric dimension
- Generic collector YAML without Claude Code-specific considerations

### Expected WITH skill (GREEN target)

- ✅ Includes `CLAUDE_CODE_ENABLE_TELEMETRY=1` as prerequisite
- ✅ Provides exact env vars: `OTEL_METRICS_EXPORTER=otlp`, `OTEL_LOGS_EXPORTER=otlp`
- ✅ Shows `~/.claude/settings.json` persistent config format
- ✅ Sets `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`
- ✅ Warns about `OTEL_METRICS_INCLUDE_SESSION_ID` and cardinality risk
- ✅ Mentions privacy controls are off by default
- ✅ Notes Claude Code emits metrics + logs, NOT traces

### Compliance Check

- [ ] Response includes `CLAUDE_CODE_ENABLE_TELEMETRY=1`
- [ ] Response includes `settings.json` persistent config example
- [ ] Response mentions cumulative temporality preference
- [ ] Response warns about session.id as metric dimension
- [ ] Response notes no traces are emitted

---

## Scenario 2: Multi-Agent Collector

**Prompt**:
> "I use Claude Code and Gemini CLI. Configure a single OTel Collector to receive telemetry from both."

### Expected WITHOUT skill (RED baseline)

- Likely generates two separate, disconnected configs
- No normalization of `service.name` across agents
- May not know Claude Code uses gRPC (4317) while Copilot uses HTTP (4318)
- No resource processor to unify agent identifiers
- No OTTL transform to map `claude_code.*` to `gen_ai.*`
- `memory_limiter` may be missing or in wrong position

### Expected WITH skill (GREEN target)

- ✅ Single OTLP receiver with both gRPC (4317) and HTTP (4318) protocols enabled
- ✅ Prefers OTLP gRPC by default, but explains when OTLP HTTP is the right fallback
- ✅ `memory_limiter` as first processor in every pipeline
- ✅ `resource` processor to tag `telemetry.source.type: ai-coding-agent`
- ✅ `transform` processor adding `gen_ai.system` attribute to Claude Code data
- ✅ Separate pipelines for metrics, logs, traces
- ✅ Notes Claude Code emits no traces (traces pipeline still useful for Gemini CLI)
- ✅ `batch` processor last before exporters

### Compliance Check

- [ ] Single config with both gRPC and HTTP listeners
- [ ] Response prefers OTLP gRPC but allows OTLP HTTP when needed
- [ ] `memory_limiter` is first processor
- [ ] `resource` processor normalizes agent identity
- [ ] Separate metrics/logs/traces pipelines
- [ ] Notes Claude Code has no traces

---

## Scenario 3: Agent OTel Support Comparison

**Prompt**:
> "Which AI coding agents support OpenTelemetry? I need traces specifically for debugging multi-step agent operations."

### Expected WITHOUT skill (RED baseline)

- Vague or outdated answer based on training data
- May incorrectly claim Claude Code supports traces
- Likely misses Codex CLI partial support gaps
- No mention that Qwen Code now has partial native OTel support
- No mention of OpenCode/Cursor/Windsurf having no native OTel
- No guidance on GenAI SemConv coverage

### Expected WITH skill (GREEN target)

- ✅ Gemini CLI: full traces ✅, follows `gen_ai.*` SemConv, v0.34.0+
- ✅ GitHub Copilot (VS Code + CLI): full traces ✅, follows `gen_ai.*` SemConv
- ✅ Claude Code: NO traces ❌ — metrics + logs only; use `prompt.id` as pseudo-trace correlation
- ✅ Codex CLI: traces ⚠️ in interactive mode only; `codex exec` drops metrics
- ✅ Qwen Code: partial native OTel ⚠️ with partial `gen_ai.*` dual-emit as of v0.16.1
- ✅ OpenCode, Cursor, Windsurf, Aider: no native OTel ❌
- ✅ Recommends Gemini CLI or Copilot if traces are a hard requirement

### Compliance Check

- [ ] Correctly identifies Gemini CLI and Copilot as trace-capable
- [ ] Correctly states Claude Code has NO traces
- [ ] Mentions Codex CLI partial support limitation
- [ ] Notes Qwen Code has partial native OTel and partial `gen_ai.*` dual-emit in v0.16.1
- [ ] Suggests GenAI SemConv coverage as selection criterion

---

## Scenario 4: Privacy Controls for Claude Code

**Prompt**:
> "Enable Claude Code telemetry but make sure no user prompts are logged"

### Expected WITHOUT skill (RED baseline)

- May accidentally enable `OTEL_LOG_USER_PROMPTS=true` without warning
- Likely omits privacy env vars entirely
- No mention that prompts are redacted by default
- No warning about `OTEL_LOG_TOOL_DETAILS` leaking tool parameters
- No OTTL redaction recommendation for tool parameters that may contain secrets

### Expected WITH skill (GREEN target)

- ✅ States prompts are redacted by default — `OTEL_LOG_USER_PROMPTS` defaults to `false`
- ✅ Explicitly sets `OTEL_LOG_USER_PROMPTS=false` (or omits it, noting the safe default)
- ✅ Warns about `OTEL_LOG_TOOL_DETAILS` — tool parameters may contain secrets/paths
- ✅ Recommends OTTL redaction processor for tool_parameters as defense-in-depth
- ✅ Notes `captureContent` risk if user later adopts GitHub Copilot
- ✅ Warns about `OTEL_METRICS_INCLUDE_SESSION_ID=false` (cardinality, not PII, but related)

### Compliance Check

- [ ] States prompts are redacted by default in Claude Code
- [ ] Addresses `OTEL_LOG_USER_PROMPTS` explicitly
- [ ] Addresses `OTEL_LOG_TOOL_DETAILS` specifically
- [ ] Includes or recommends OTTL redaction for tool parameters
- [ ] Does NOT accidentally suggest enabling prompt logging

---

## Scenario 5: Dashboard Recommendations for Team AI Usage

**Prompt**:
> "What dashboards should I build for monitoring our team's AI coding agent usage?"

### Expected WITHOUT skill (RED baseline)

- Generic "build a dashboard" advice
- Vague panel suggestions without specific metric names
- No mention of community-built dashboards
- May suggest using `user.id` or `session.id` as metric dimensions (cardinality risk)
- No cost breakdown guidance
- No distinction between metrics-based and log-based panels

### Expected WITH skill (GREEN target)

- ✅ References community dashboards: ai-observer, ColeMurray/claude-code-otel, Honeycomb template
- ✅ Panel 1: Token usage by model/agent over time — NOT by session.id
- ✅ Panel 2: Cost breakdown by agent and model
- ✅ Panel 3: API latency percentiles (p50/p95/p99)
- ✅ Panel 4: Tool call success/failure rates
- ✅ Panel 5: Active sessions via log queries (not metric dimensions)
- ✅ Panel 6: Cache hit ratio for Claude Code
- ✅ Warns about session.id/prompt.id cardinality if put in metric dimensions
- ✅ Notes some agents (Claude Code) require log-based queries for session counts
- ✅ Notes GenAI token dashboards should tolerate additional token classes (for example cache/reasoning), not just `input`/`output`

### Compliance Check

- [ ] References at least one community dashboard (ai-observer or ColeMurray)
- [ ] Lists token usage, cost, and latency panels with specific metric names
- [ ] Warns about session.id as metric dimension
- [ ] Suggests log-based queries for session/user counts
- [ ] Mentions cache hit ratio for Claude Code
- [ ] Avoids assuming `gen_ai.token.type` is limited to only `input` / `output`

---

## Scenario 6: GenAI Tool-Call Span Naming

**Prompt**:
> "I'm instrumenting an AI coding agent that calls `bash` and `search_code`. Show me how the OpenTelemetry spans should be named."

### Expected WITHOUT skill (RED baseline)

- May use a generic `execute_tool` span name for every tool call
- May omit `gen_ai.tool.name`
- Likely misses the Semantic Conventions v1.41.0 span-naming requirement

### Expected WITH skill (GREEN target)

- ✅ Uses the actual tool name as the execute-tool span name (for example `bash`, `search_code`)
- ✅ Preserves `gen_ai.tool.name` on each tool span
- ✅ Mentions the v1.41.0 GenAI SemConv breaking change for tool-call span naming
- ✅ Avoids collapsing all tool calls into a generic `execute_tool` span name

### Compliance Check

- [ ] Response names execute-tool spans with the actual tool name
- [ ] Response includes `gen_ai.tool.name`
- [ ] Response mentions the v1.41.0 tool-call span-naming requirement
- [ ] Response avoids a generic `execute_tool` span name

---

## Anti-Rationalization Notes

Document observed agent rationalizations and counter-guidance here as they are discovered during testing.

| Rationalization | Counter |
|----------------|---------|
| "Claude Code supports traces via the OTEL_TRACES_EXPORTER env var" | Claude Code explicitly does NOT emit traces. `OTEL_TRACES_EXPORTER` is ignored. Only metrics and logs are emitted. |
| "You can use session.id as a metric label to track per-user costs" | session.id is unbounded cardinality. Use log queries with distinct count instead. |
| "Qwen Code telemetry is still planned but not shipped" | Qwen Code ships native OTel. As of v0.16.1 it also dual-emits selected `gen_ai.*` attributes, but the private `qwen-code.*` fields remain authoritative while the schema settles. |
| "Codex CLI telemetry works the same in exec mode" | `codex exec` drops ALL metrics. Interactive mode only for full telemetry. |
| "Use a generic `execute_tool` span name for all agent tool calls" | GenAI SemConv v1.41.0 requires execute-tool spans to use the actual tool name while still populating `gen_ai.tool.name`. |
