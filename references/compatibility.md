# Compatibility Reference

Use this document for version-sensitive guidance that changes more frequently than the core routing logic in `SKILL.md`.

## Baseline version floors

- **OpenTelemetry Collector**: v0.153.0+ (the first release that supports every canonical component ID used by this skill, including `load_balancing`)
- **Core Semantic Conventions**: v1.40.0+
- **GenAI Semantic Conventions**: follow the separate `open-telemetry/semantic-conventions-genai` repository; the signal definitions are Development and do not currently have a stable release floor
- **Kubernetes**: native restartable sidecars are enabled by default from v1.29; ordinary multi-container Pods are a separate pattern
- **OpenTelemetry JS 3.0**: see the [readiness checklist](javascript-otel3-readiness.md); verify stable release status and the final migration guide before upgrading
- **Go SDK**: v1.24.0+
- **Python SDK**: v1.41.0+ for unchanged examples; the new event/GenAI examples target v1.44.0 (instrumentation release train 0.65b0). See [Python guidance](python-instrumentation.md).
- **Collector 0.160 examples**: selective Prometheus `resource_constant_labels` requires v0.160.0; custom builds require Go 1.26. The general canonical-ID floor remains v0.153.0.
- **Python GenAI packages**: migrated to `open-telemetry/opentelemetry-python-genai`; released beta versions and supported libraries are listed in [the Python reference](python-instrumentation.md#python-ai-instrumentation-packages). Do not substitute unreleased skeletons.

## AI agent telemetry compatibility

- **Evidence baseline**: Reviewed 2026-10-07. “Unknown” means not verified in current first-party sources, not “unsupported.” Keep vendor-native OTel separate from community hooks, plugins, file importers, and backends.
- **Claude Code**: current release emits metrics plus logs/events and beta traces with selected GenAI attributes (for example `gen_ai.tool.call.id`), not full schema alignment; `OTEL_METRICS_INCLUDE_ENTRYPOINT=true` adds optional bounded `app.entrypoint`
- **Google Antigravity**: verify native OTel signals and configuration against first-party documentation for the installed product version. Do not reuse legacy Google CLI settings or claim signal support without verification.
- **GitHub Copilot**: latest stable / Insiders builds expose traces, metrics, and events with GenAI semantic conventions
- **Codex CLI**: current source exposes separate OTLP exporters for traces, metrics, and logs. Configure each signal explicitly; the current config resolver defaults the metrics exporter to Statsig, so do not assume an unset metrics exporter disables export. Verify installed-release and mode coverage. Its product-specific `codex.*` events are not full GenAI semantic-convention alignment.
- **Qwen Code**: current upstream docs describe native traces, metrics, and logs with selected `gen_ai.*` fields alongside `qwen-code.*`. Telemetry is disabled by default; `logPrompts` is documented as enabled by default once telemetry is enabled, so set it false when prompt/request/response content must not be logged. Session IDs are excluded from metric datapoints by default. Migration note: `tool_output_truncated` was renamed to `qwen-code.tool_output_truncated`; revalidate dashboards/filters and use emitted fields rather than older docs.
- **opentelemetry-hooks**: community event-hook integration emits event-derived spans/logs, not generic wrapped-process metrics. Antigravity uses a runner-defined manual workflow; this does not establish native Antigravity OTel.
- **OpenCode plugin**: `@devtheops/opencode-plugin-otel` is community-maintained; `2.x` targets OpenCode V2 and `1.x` on branch `v1` targets V1. The V2 event API no longer exposes `session.diff`, so V1 lines-of-code metrics are not emitted by V2.
- **AI Observer**: local OTLP-compatible backend/dashboard with selected file import/watch modes; ingestion is not agent instrumentation, and file import is not equivalent to live telemetry.
- **Amazon Q Developer CLI**: upstream repository says maintenance is limited to critical security fixes; do not imply active integration support or infer its OTel signal status from this notice.

## Maintenance guidance

- Treat these version floors as fast-moving compatibility notes rather than hard-coded architectural rules.
- Pin GenAI dashboards and transforms to the fields actually emitted by the agent/instrumentation version; do not infer current GenAI behavior from the core Semantic Conventions version alone.
- Pin collector components to released versions and verify stability levels before using non-stable features in production.
- Re-check upstream release notes whenever updating examples that depend on AI agent telemetry support or evolving semantic conventions.
