# OpenTelemetry Skill Evaluations

This directory contains evaluation scenarios for the OpenTelemetry skill, designed to validate that the skill actually improves AI agent responses to OpenTelemetry configuration and observability questions.

## Eval Categories

- **`core-scenarios.md`**: Basic safety and architecture patterns
- **`ai-agent-scenarios.md`**: AI coding agent observability
- **`production-scenarios.md`**: Production deployment and security

## Maintenance scenarios

- `python-instrumentation/`: SDK 1.44 events, declarative initialization, and framework ownership.
- `python-genai-streaming/`: async parentage, complete stream lifetimes, privacy, and unknown usage.
- `collector-0160-upgrade/`: removed settings, selective labels, and release-specific validation.

These task/criteria pairs assess generated answers. They are separate from the
executable Python and Collector checks run by CI; passing those checks does not
establish an agent evaluation score.

## Running Evals

From the repository root:

```bash
# Run all task/criteria scenarios with the local skill and a baseline
tessl eval run evals --context . --wait

# Run one scenario
tessl eval run evals/python-genai-streaming --context . --wait

# Discover supported agents and models
tessl eval run --list-agents
```

Authenticate with `tessl login` and link the repository with `tessl project link
--workspace o11y-dev` first. The Markdown category files are planning references;
the executable scenarios are the subdirectories containing `task.md` and
`criteria.json`.

The `Tessl Behavioral Evaluations` workflow runs committed scenarios using the
Tessl CLI on same-repository pull requests. It evaluates the checked-out skill
against a baseline and waits for completion, retaining JSON output as an artifact.
A successful job means execution completed; inspect scores separately. The
project is created once outside CI and its generated `tessl.json` is committed.
The official `skill-eval` action currently skips committed scenarios on PR events
and requests a comment trigger, so this workflow explicitly invokes the CLI.
The separate `Tessl Skill Report` reviews skill quality.

## Expected Behavior

Each scenario tests whether the skill causes the AI to:
1. Include critical safety patterns (memory_limiter, cardinality guards)
2. Follow production best practices (TLS, persistent queues)
3. Apply OpenTelemetry-specific knowledge (processor ordering, stability levels)
4. Provide AI agent-specific guidance (telemetry enablement, privacy controls)

## Success Metrics

- **Without skill**: Generic configurations, missing safety patterns
- **With skill**: Production-ready configs with proper safeguards and OTel expertise
