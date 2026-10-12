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

- **Evidence baseline**: reviewed 2026-10-12; source and release snapshots are recorded in the [digest audit](../docs/upstream-review-2026-10-12.md). “Unknown” means not verified in current first-party sources, not “unsupported.” Keep vendor-native OTel separate from community hooks, plugins, file importers, and backends.
- **Claude Code**: current release emits metrics plus logs/events and beta traces with selected GenAI attributes (for example `gen_ai.tool.call.id`), not full schema alignment; `OTEL_METRICS_INCLUDE_ENTRYPOINT=true` adds optional bounded `app.entrypoint`
- **Google agents**: Gemini CLI retains documented native OTel for supported enterprise/API-key deployments. Antigravity CLI/IDE/2.0 has documented lifecycle hooks, but user-configurable OTLP export is unverified here; Python SDK v0.1.5 separately documents native tracing. Use the [Google product guidance and first-party sources](ai-agents.md#22-google-agents-gemini-cli-and-antigravity), not interchangeable settings or a community workflow as proof of native export.
- **GitHub Copilot**: distinguish VS Code Chat from CLI. VS Code supports native traces, metrics, and logs; CLI documents traces and metrics. Endpoint names, protocol defaults, and managed-setting precedence differ. See the [agent guide](ai-agents.md#23-github-copilot-vs-code).
- **Codex CLI**: current source exposes separate OTLP exporters for traces, metrics, and logs. Configure each signal explicitly; the current config resolver defaults the metrics exporter to Statsig, so do not assume an unset metrics exporter disables export. Verify installed-release and mode coverage. Its product-specific `codex.*` events are not full GenAI semantic-convention alignment.
- **Qwen Code**: current upstream docs describe native traces, metrics, and logs with selected `gen_ai.*` fields alongside `qwen-code.*`. Telemetry is disabled by default; `logPrompts` is documented as enabled by default once telemetry is enabled, so set it false when prompt/request/response content must not be logged. Session IDs are excluded from metric datapoints by default. Migration note: `tool_output_truncated` was renamed to `qwen-code.tool_output_truncated`; revalidate dashboards/filters and use emitted fields rather than older docs.
- **opentelemetry-hooks**: community event-hook integration emits event-derived spans/logs, not generic wrapped-process metrics. Antigravity requires a verified mapping from Google's callback payloads; a workflow command does not establish adapter compatibility or native CLI/IDE export.
- **OpenCode native**: `experimental.openTelemetry` enables AI SDK instrumentation; this is not evidence of a complete configurable native OTLP exporter. Keep it separate from community plugin support.
- **Cursor Enterprise**: server-side OTLP/HTTP protobuf logs and delta-sum metrics, no native traces; validate overlapping windows and use log event IDs for deduplication.
- **Pi, Windsurf, and Aider**: extension/hook/analytics surfaces are not native customer-configurable OTLP evidence; native export remains unverified in this review.
- **OpenCode plugin**: `@devtheops/opencode-plugin-otel` is community-maintained; `2.x` targets OpenCode V2 and `1.x` on branch `v1` targets V1. The V2 event API no longer exposes `session.diff`, so V1 lines-of-code metrics are not emitted by V2.
- **AI Observer**: local OTLP-compatible backend/dashboard with selected file import/watch modes; ingestion is not agent instrumentation, and file import is not equivalent to live telemetry.
- **Amazon Q Developer CLI**: upstream repository says maintenance is limited to critical security fixes; do not imply active integration support or infer its OTel signal status from this notice.

## October release checks

See [release-specific upgrade checks](upstream-upgrades.md) for Collector 0.162,
Operator 0.160, Python 1.45/0.66b0, and the other SDK releases in the open digests.
These targets do not raise every existing example's minimum version.

## Maintenance guidance

- Treat these version floors as fast-moving compatibility notes rather than hard-coded architectural rules.
- Pin GenAI dashboards and transforms to the fields actually emitted by the agent/instrumentation version; do not infer current GenAI behavior from the core Semantic Conventions version alone.
- Pin collector components to released versions and verify stability levels before using non-stable features in production.
- Re-check upstream release notes whenever updating examples that depend on AI agent telemetry support or evolving semantic conventions.
