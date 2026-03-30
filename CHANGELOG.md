# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
- Clarify hook support and governance in AI agent observability reference

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
- Connectors reference (`references/connectors.md`): spanmetrics, servicegraph, routing, failover with stickiness requirements
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
- 12 progressive disclosure triggers mapping to reference documents
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
