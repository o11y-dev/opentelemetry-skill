# OpenTelemetry Skill Tile Documentation

This document is the Tessl docs entrypoint for the tile. `SKILL.md` remains the cognitive router for agent behavior, while this index makes the bundled references, evaluation assets, and project guidance explicitly review-visible.

## Reference bundles

These are the deep-dive documents that the skill loads on demand:

- [AI agents](../references/ai-agents.md)
- [Anti-patterns](../references/anti-patterns.md)
- [Architecture](../references/architecture.md)
- [Collector](../references/collector.md)
- [Compatibility](../references/compatibility.md)
- [Connectors](../references/connectors.md)
- [Instrumentation](../references/instrumentation.md)
- [Monitoring](../references/monitoring.md)
- [OTTL](../references/ottl.md)
- [Platforms](../references/platforms.md)
- [Playbooks](../references/playbooks.md)
- [Sampling](../references/sampling.md)
- [Security](../references/security.md)
- [Validation](../references/validation.md)

## Evaluation surface

The authoritative Tessl-facing eval assets live in `evals/`. The `tests/` documents are supporting methodology notes for the RED/GREEN/REFACTOR workflow.

### Published eval assets

- [Evals overview](../evals/README.md)
- [Core scenarios](../evals/core-scenarios.md)
- [AI agent scenarios](../evals/ai-agent-scenarios.md)
- [Production scenarios](../evals/production-scenarios.md)
- [Collector memory limiter task](../evals/collector-memory-limiter/task.md)
- [Cardinality protection task](../evals/cardinality-protection/task.md)
- [Tail sampling setup task](../evals/tail-sampling-setup/task.md)
- [Claude Code telemetry task](../evals/claude-code-telemetry/task.md)

### Supporting test methodology

- [Baseline scenarios](../tests/baseline-scenarios.md)
- [AI agent test scenarios](../tests/ai-agent-scenarios.md)
- [Compliance verification](../tests/compliance-verification.md)
- [Rationalization table](../tests/rationalization-table.md)

## Project docs

- [README](../README.md)
- [Changelog](../CHANGELOG.md)
- [Contributing](../CONTRIBUTING.md)
