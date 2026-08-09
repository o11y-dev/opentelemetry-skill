# Compatibility Reference

Use this document for version-sensitive guidance that changes more frequently than the core routing logic in `SKILL.md`.

## Baseline version floors

- **OpenTelemetry Collector**: v0.153.0+ (the first release that supports every canonical component ID used by this skill, including `load_balancing`)
- **Core Semantic Conventions**: v1.40.0+
- **GenAI Semantic Conventions**: follow the separate `open-telemetry/semantic-conventions-genai` repository; the signal definitions are Development and do not currently have a stable release floor
- **Kubernetes**: v1.24+ for native sidecar support
- **Go SDK**: v1.24.0+
- **Python SDK**: v1.41.0+

## AI agent telemetry compatibility

- **Claude Code**: current release emits metrics plus logs/events and beta traces; `OTEL_METRICS_INCLUDE_ENTRYPOINT=true` adds optional bounded `app.entrypoint`
- **Gemini CLI**: v0.34.0+ emits traces, metrics, and logs with GenAI semantic conventions
- **GitHub Copilot**: latest stable / Insiders builds expose traces, metrics, and events with GenAI semantic conventions
- **Codex CLI**: current documentation describes structured log events and metrics for API requests, tool calls, and sessions; verify trace support and mode-specific behavior in the installed release
- **Qwen Code**: v0.16.1+ emits traces, metrics, and logs with partial `gen_ai.*` dual-emit layered on top of authoritative `qwen-code.*` fields

## Maintenance guidance

- Treat these version floors as fast-moving compatibility notes rather than hard-coded architectural rules.
- Pin GenAI dashboards and transforms to the fields actually emitted by the agent/instrumentation version; do not infer current GenAI behavior from the core Semantic Conventions version alone.
- Pin collector components to released versions and verify stability levels before using non-stable features in production.
- Re-check upstream release notes whenever updating examples that depend on AI agent telemetry support or evolving semantic conventions.
