# Compatibility Reference

Use this document for version-sensitive guidance that changes more frequently than the core routing logic in `SKILL.md`.

## Baseline version floors

- **OpenTelemetry Collector**: v0.151.0+
- **Semantic Conventions**: v1.40.0+
- **Kubernetes**: v1.24+ for native sidecar support
- **Go SDK**: v1.24.0+
- **Python SDK**: v1.41.0+

## AI agent telemetry compatibility

- **Claude Code**: current release emits metrics plus logs/events, not traces; `OTEL_METRICS_INCLUDE_ENTRYPOINT=true` adds optional bounded `app.entrypoint`
- **Gemini CLI**: v0.34.0+ emits traces, metrics, and logs with GenAI semantic conventions
- **GitHub Copilot**: latest stable / Insiders builds expose traces, metrics, and events with GenAI semantic conventions
- **Codex CLI**: v0.105.0+ emits traces and logs in interactive mode, with gaps in `exec` / `mcp-server`
- **Qwen Code**: v0.16.1+ emits traces, metrics, and logs with partial `gen_ai.*` dual-emit layered on top of authoritative `qwen-code.*` fields

## Maintenance guidance

- Treat these version floors as fast-moving compatibility notes rather than hard-coded architectural rules.
- Pin collector components to released versions and verify stability levels before using non-stable features in production.
- Re-check upstream release notes whenever updating examples that depend on AI agent telemetry support or evolving semantic conventions.
