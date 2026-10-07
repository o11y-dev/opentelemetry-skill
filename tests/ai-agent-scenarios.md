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
- ✅ Shows managed-settings persistence, with `~/.claude/settings.json` as a concrete example
- ✅ Sets `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`
- ✅ Warns about `OTEL_METRICS_INCLUDE_SESSION_ID` and cardinality risk
- ✅ Mentions privacy controls are off by default
- ✅ Notes Claude Code emits metrics + logs and that traces are beta

### Compliance Check

- [ ] Response includes `CLAUDE_CODE_ENABLE_TELEMETRY=1`
- [ ] Response includes managed-settings persistence, optionally with a `settings.json` example
- [ ] Response mentions cumulative temporality preference
- [ ] Response warns about session.id as metric dimension
- [ ] Response notes traces are beta

---

## Scenario 2: Multi-Agent Collector

**Prompt**:
> "I use Claude Code and Google Antigravity. Configure an OTel Collector and explain what telemetry can be collected from each."

### Expected WITHOUT skill (RED baseline)

- Likely generates two separate, disconnected configs
- No normalization of `service.name` across agents
- Assumes Antigravity has a former Google CLI's native telemetry or configuration
- Treats unsupported Antigravity signal/protocol details as facts
- No resource processor to add a bounded common source label
- Proposes mapping native `claude_code.*` fields into `gen_ai.*`
- `memory_limiter` may be missing or in wrong position

### Expected WITH skill (GREEN target)

- ✅ Single OTLP receiver with gRPC (4317) and HTTP (4318) protocols enabled for verified OTLP senders
- ✅ Prefers OTLP gRPC by default, but explains when OTLP HTTP is the right fallback
- ✅ `memory_limiter` as first processor in every pipeline
- ✅ `resource` processor adds `telemetry.source.type: ai-coding-agent` without overwriting each agent's identity
- ✅ Marks Antigravity native telemetry and protocol as unverified; does not reuse legacy Google CLI settings
- ✅ Separates Antigravity's community runner-defined event hook from vendor-native telemetry
- ✅ Notes hook payload/log privacy settings, including MCP payload logging enabled by default and prompt masking off by default
- ✅ Preserves vendor-native Claude Code fields and does not synthesize deprecated `gen_ai.system`
- ✅ Separate pipelines for metrics, logs, traces
- ✅ Notes Claude Code traces are beta; only configures traces for agents with verified trace export
- ✅ `batch` processor last before exporters

### Compliance Check

- [ ] Single config with both gRPC and HTTP listeners
- [ ] Response prefers OTLP gRPC but allows OTLP HTTP when needed for supported senders
- [ ] `memory_limiter` is first processor
- [ ] `resource` processor adds a bounded source label without overwriting agent identity
- [ ] Does not assume Antigravity supports legacy Google CLI telemetry settings or signals
- [ ] Explains that Antigravity hook output is event-derived, not a process wrapper or native exporter
- [ ] Calls out MCP payload logging default and opt-in prompt masking
- [ ] Separate metrics/logs/traces pipelines
- [ ] Notes Claude Code trace support is beta

---

## Scenario 3: Agent OTel Support Comparison

**Prompt**:
> "Which AI coding agents support OpenTelemetry? I need traces specifically for debugging multi-step agent operations."

### Expected WITHOUT skill (RED baseline)

- Vague or outdated answer based on training data
- May incorrectly claim Claude Code supports traces
- May miss Codex CLI's current separate trace, metric, and log exporters
- May use stale Qwen Code version/signal claims or omit its prompt-log default
- May confuse OpenCode's community plugin with vendor-native support
- May claim native support is absent for products without current first-party verification
- No guidance on GenAI SemConv coverage

### Expected WITH skill (GREEN target)

- ✅ Google Antigravity: native OTel support is unverified; check first-party docs for the installed version and do not infer compatibility from earlier Google CLI behavior
- ✅ GitHub Copilot (VS Code + CLI): full traces ✅, follows `gen_ai.*` SemConv
- ✅ Claude Code: beta traces plus metrics/logs; use `prompt.id` correlation when traces are unavailable
- ✅ Codex CLI: current source exposes separate OTLP trace, metric, and log exporters; verify installed release/mode and avoid claiming full GenAI SemConv alignment
- ✅ Qwen Code: native traces/logs/metrics with selected `gen_ai.*` fields; current docs list prompt/request/response text logging enabled by default once telemetry is enabled
- ✅ OpenCode's OTel plugin is community-maintained and version-specific (2.x for V2; 1.x on `v1` for V1)
- ✅ Treat unverified vendor-native status as unknown rather than unsupported
- ✅ Recommends an agent with verified trace support if traces are a hard requirement; does not count Antigravity without version-specific evidence

### Compliance Check

- [ ] Does not claim native Antigravity trace support without first-party version-specific evidence
- [ ] Correctly identifies Copilot as trace-capable based on current reference guidance
- [ ] Correctly states Claude Code traces are beta
- [ ] Mentions Codex's separate signal exporters and mode-specific limitation
- [ ] Notes Qwen telemetry without repeating the stale v0.16.1 boundary and calls out prompt-log default
- [ ] Distinguishes OpenCode's community plugin and V1/V2 version split
- [ ] Uses “unknown” rather than “unsupported” when native support is not verified
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

- ✅ Describes AI Observer as a backend/dashboard with file ingestion, and ColeMurray/claude-code-otel as a community Claude stack
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

- [ ] References a community backend/dashboard and distinguishes it from vendor-native instrumentation
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

- May use argument-dependent names or omit the registered tool name
- May omit `gen_ai.tool.name`
- Likely misses the Development-convention `execute_tool {gen_ai.tool.name}` span name or fails to preserve the tool name in `gen_ai.tool.name`

### Expected WITH skill (GREEN target)

- ✅ Uses the Development-convention `execute_tool {gen_ai.tool.name}` span name
- ✅ Preserves `gen_ai.tool.name` on each tool span
- ✅ Keeps the actual tool name in `gen_ai.tool.name`
- ✅ Uses registered tool names without arguments, paths, or request IDs

### Compliance Check

- [ ] Response uses the Development-convention `execute_tool {gen_ai.tool.name}` span name
- [ ] Response includes `gen_ai.tool.name`
- [ ] Response keeps the actual tool name in `gen_ai.tool.name`
- [ ] Response excludes arguments, paths, and request IDs from span names

---

## Anti-Rationalization Notes

Document observed agent rationalizations and counter-guidance here as they are discovered during testing.

| Rationalization | Counter |
|----------------|---------|
| "Claude Code traces are production-stable" | Claude Code trace export is beta; validate signal shape and keep a metrics/log fallback. |
| "You can use session.id as a metric label to track per-user costs" | session.id is unbounded cardinality. Use log queries with distinct count instead. |
| "Qwen Code telemetry is still planned but not shipped" | Qwen Code ships native OTel; current docs describe selected `gen_ai.*` fields alongside `qwen-code.*`. Check its prompt-log default and validate current schema instead of relying on an old version snapshot. |
| "Codex CLI telemetry works the same in every mode" | Current Codex source exposes separate trace, metric, and log exporters; verify installed release and mode coverage independently. |
| "OpenCode's OTel plugin is built in" | The plugin is a community project. Match 2.x with OpenCode V2 and 1.x on `v1` with V1; V2 no longer emits V1 session-diff lines-of-code metrics. |
| "Antigravity has native OTel because an OTel hook supports it" | The hook integration is a runner-defined community workflow; it does not establish native Antigravity OTel support. |
| "Include the full shell command in the tool span name" | Use the Development-convention `execute_tool {gen_ai.tool.name}` span name and put the actual tool name in `gen_ai.tool.name`. |
