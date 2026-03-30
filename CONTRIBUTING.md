# Contributing to opentelemetry-skill

## What this project is

This is an AI skill, not traditional software. `SKILL.md` is a cognitive router that teaches LLMs how to reason about OpenTelemetry before generating code. The `references/` directory contains deep-dive documents loaded on demand via progressive disclosure triggers.

```
SKILL.md (cognitive router, ~compact)
    |
    |-- trigger: "Kubernetes" --> references/architecture.md
    |-- trigger: "collector"  --> references/collector.md
    |-- trigger: "sampling"   --> references/sampling.md
    |-- trigger: "OTTL"       --> references/ottl.md
    |-- ... (12 triggers total)
    |
references/ (loaded only when triggered)
tests/ (TDD validation scenarios)
```

## How to contribute

### Adding or updating a reference document

Reference documents live in `references/`. Each one covers a specific domain of OpenTelemetry.

1. Use production-first language: MUST, NEVER, ALWAYS where safety matters
2. Include anti-patterns with explicit "why this breaks" explanations
3. Include version-specific notes (e.g., "requires Collector v0.147.0+")
4. Keep configuration examples complete and runnable
5. Reference upstream docs with links

### Adding a new progressive disclosure trigger

Triggers are defined in `SKILL.md` and map keywords to reference files.

1. Identify a gap: what question does the AI answer poorly without this trigger?
2. Add the trigger keyword pattern to `SKILL.md`
3. Create or update the corresponding reference document
4. Add test scenarios in `tests/` that validate the trigger fires correctly
5. Update `README.md` if the trigger covers a new domain

### Adding test scenarios

Tests live in `tests/` and follow the RED-GREEN-REFACTOR pattern:

1. `tests/rationalization-table.md` tracks discovered AI "excuses" (shortcuts the AI takes)
2. `tests/compliance-verification.md` validates that anti-rationalizations work
3. `tests/ai-agent-scenarios.md` covers AI agent observability scenarios

To add a test:
1. Identify a rationalization (a shortcut or wrong answer the AI gives)
2. Add it to the rationalization table with the counter-instruction
3. Embed the counter directly into `SKILL.md` where the rationalization occurs
4. Add a scenario that would trigger the rationalization and verify it's blocked

### Updating playbooks

`references/playbooks.md` routes upstream OpenTelemetry blog posts by technical problem.

1. Find a new blog post on [opentelemetry.io/blog](https://opentelemetry.io/blog)
2. Identify which technical problem it addresses
3. Add it to the routing table with: title, URL, technical intent, and related triggers
4. The weekly upstream maintenance workflow (`otel-upstream-maintenance.yml`) will flag new posts automatically

## CI validation

`.github/workflows/validate.yml` checks on every push and PR:

- `SKILL.md` has required frontmatter (`name`, `description`)
- `marketplace.json` structure is valid
- No broken internal links between `SKILL.md` and `references/`
- Markdown linting passes

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - new reference, trigger, or capability
- `fix:` - correction to existing content
- `docs:` - documentation improvements
- `test:` - new or updated test scenarios
- `ci:` - workflow changes

## PR expectations

- One logical change per PR
- CI validation passes
- If adding a reference: include at least one test scenario
- If updating `SKILL.md` triggers: explain what question this improves
- Open an issue first for structural changes (new trigger categories, testing framework changes)
