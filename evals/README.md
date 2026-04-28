# OpenTelemetry Skill Evaluations

This directory contains evaluation scenarios for the OpenTelemetry skill, designed to validate that the skill actually improves AI agent responses to OpenTelemetry configuration and observability questions.

## Eval Categories

- **`core-scenarios.md`**: Basic safety and architecture patterns
- **`ai-agent-scenarios.md`**: AI coding agent observability
- **`production-scenarios.md`**: Production deployment and security

## Running Evals

From the repository root:

```bash
# Run all evals
tessl eval run .

# Run specific category
tessl eval run evals/core-scenarios.md

# Run with multiple agents
tessl eval run . --agent claude:sonnet --agent gpt:4o
```

## Expected Behavior

Each scenario tests whether the skill causes the AI to:
1. Include critical safety patterns (memory_limiter, cardinality guards)
2. Follow production best practices (TLS, persistent queues)
3. Apply OpenTelemetry-specific knowledge (processor ordering, stability levels)
4. Provide AI agent-specific guidance (telemetry enablement, privacy controls)

## Success Metrics

- **Without skill**: Generic configurations, missing safety patterns
- **With skill**: Production-ready configs with proper safeguards and OTel expertise