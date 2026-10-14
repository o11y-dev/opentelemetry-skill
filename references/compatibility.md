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
- **Collector 0.160 examples**: selective Prometheus `resource_constant_labels` requires v0.160.0; custom builds require Go 1.26. The general canonical-ID floor remains v0.153.0. See the [0.162 upgrade checks](collector.md#collector-0162-upgrade-checks) when crossing that release.
- **Python GenAI packages**: migrated to `open-telemetry/opentelemetry-python-genai`; released beta versions and supported libraries are listed in [the Python reference](python-instrumentation.md#python-ai-instrumentation-packages). Do not substitute unreleased skeletons.

## AI agent telemetry compatibility

Use the [agent compatibility matrix](ai-agents.md#1-overview--compatibility-matrix) for supported signals, protocols, and product boundaries, and the [per-agent configurations](ai-agents.md#2-per-agent-quick-start-configs) for version-specific settings and migration notes.

Validate the installed product, version, and execution mode. Native export, community hooks/plugins, and file ingestion have different coverage; “unknown” means unverified, not unsupported. See [known gaps and workarounds](ai-agents.md#7-known-gaps--workarounds) before relying on cross-agent schema or backend compatibility.

## Maintenance guidance

- Treat these version floors as fast-moving compatibility notes rather than hard-coded architectural rules.
- Pin GenAI dashboards and transforms to the fields actually emitted by the agent/instrumentation version; do not infer current GenAI behavior from the core Semantic Conventions version alone.
- Pin collector components to released versions and verify stability levels before using non-stable features in production.
- Re-check upstream release notes whenever updating examples that depend on AI agent telemetry support or evolving semantic conventions.
