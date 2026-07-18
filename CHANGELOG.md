# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Add scaled `signal_to_metrics` correctness guidance and regression coverage for producer identity, backend resource mapping, temporality, and dashboard aggregation

### Changed
- Replace upstream digest issue updates to overwrite issue body snapshots (instead of appending) while preserving idempotent no-op reruns on exact body matches
- Update GenAI guidance for the separate conventions repository, provider-versus-agent identity, histogram token usage, current content attributes, and execute-tool span naming
- Migrate Collector examples and evaluations to canonical component IDs and raise the compatibility floor to v0.153.0
- Document sparse exporter-helper failure metrics and expand upstream watcher coverage for GenAI conventions and exporter helpers
- Bump aligned Tessl skill and tile metadata from `0.3.0` to `0.4.0`

## [1.3.0] - 2026-05-08

### Added
- `references/anti-patterns.md`: full annotated catalog of 17 anti-patterns organized by category (pipeline, Kubernetes, metrics, AI agents, OTTL)
- Progressive Disclosure trigger for `anti-patterns.md` in `SKILL.md`

### Changed
- Teach the skill to audit existing collector/Helm configs for cross-field contradictions such as memory limiter sizing, sticky routing for scaled tail sampling, hostPort misuse, durability gaps, rollout inconsistency, OTTL type drift, unsafe RWX/NFS-backed queues, and risky temporality conversions
- Trim `SKILL.md` inline anti-patterns from 17 to 6 most critical; remaining 11 moved to `references/anti-patterns.md`
- Clarify hook support and governance in AI agent observability reference
- Document limitations, roadmap, and contribution guidelines in README, CONTRIBUTING, and this changelog
- Make bundled references and evaluation docs review-visible via a Tessl docs entrypoint
- Move fast-changing compatibility details out of `SKILL.md` and into `references/compatibility.md`
- Add practical upstream watch guidance for bbolt security advisory tracking and event-to-logs proposal maturity

## [1.2.0] - 2026-03-20

### Added
- AI coding agent observability reference (`references/ai-agents.md`) with support matrix for Claude Code, Gemini CLI, GitHub Copilot, Codex CLI, and others
- Recommend opentelemetry-hooks for agents without native telemetry
- Production playbooks routing reference from OpenTelemetry.io blog series (`references/playbooks.md`)
- 5 new test scenarios for AI agent observability

### Fixed
- Homepage references and installation URLs

## [1.1.0] - 2026-03-11

### Added
- Connectors reference (`references/connectors.md`): `span_metrics`, `service_graph`, routing, and failover with stickiness requirements
- Kafka resiliency patterns, semconv v1.30+ guidance, config management, scaling guidance (Collector v0.147.0)
- Upstream maintenance digest workflow (weekly automated scan of OTel issues, releases, and blog posts)
- Cursor Marketplace plugin manifests
- Markdownlint configuration for documentation style
- Filesystem compatibility warnings for `file_storage` and bbolt
- Document semconv handling for intentional HTTP cancellations
- Load-balancing routing key requirements and Go SDK 1.40.0 breaking changes

### Changed
- README trimmed: removed Terraform comparison table, fixed installation URLs
- Applied upstream maintenance guidance from 2026-02-24 digest
- bbolt v1.4.3 on_rebound crash mitigation documented

## [1.0.0] - 2026-02-03

### Added
- Initial cognitive router (`SKILL.md`) with System 2 Thinking framework
- 11 progressive disclosure triggers mapping to reference documents
- Reference documents: architecture, collector, instrumentation, sampling, security, monitoring, OTTL, platforms
- Anti-pattern prevention with explicit language (MUST/NEVER/ALWAYS)
- TDD testing framework with rationalization table
- Claude marketplace plugin (`.claude-plugin/marketplace.json`)
- CI validation workflow (frontmatter, links, markdown linting)
- Auto-delete merged branches workflow
- Contrib component references and example configs
- Per-language SDK links and instrumentation packaging guidance

[Unreleased]: https://github.com/o11y-dev/opentelemetry-skill/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/o11y-dev/opentelemetry-skill/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/o11y-dev/opentelemetry-skill/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/o11y-dev/opentelemetry-skill/releases/tag/v1.0.0
