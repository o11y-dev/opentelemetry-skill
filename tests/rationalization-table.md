# Rationalization Table

> **Purpose:** Document agent rationalizations that bypass best practices, and their counters
>
> **Philosophy:** Agents will find creative excuses to skip complexity. Document these rationalizations and add explicit counters to SKILL.md.

This table tracks agent "excuses" discovered during RED/GREEN testing phases and maps them to countermeasures added to the skill.

---

## Discovered Rationalizations

### Testing Phase: Initial RED (Pre-OTTL Support)

| Scenario | Rationalization | Counter Added to SKILL.md | Status |
|----------|-----------------|---------------------------|--------|
| Collector Config | "Here's a basic configuration" | Core Principle #4: Safety First - memory_limiter mandatory | ✅ Added |
| Cardinality | "This gives you detailed metrics" | Core Principle #5: Cardinality Awareness - Rule of 100 | ✅ Added |
| Tail Sampling | "Here's the tail sampling config" | Sampling trigger: sticky sessions required | ✅ Added |
| TLS Config | "Set up the endpoint connection" | Core Principle #6: Security by Default | ✅ Added |
| PII Handling | "Here's the standard pipeline" | Security trigger: PII redaction mandatory | ✅ Added |
| Sampling Strategy | "Use tail sampling for best results" | System 2 Thinking: Signal Volume & Throughput | ✅ Added |
| Deployment Pattern | "DaemonSet is the standard pattern" | Progressive Disclosure: Architecture trigger | ✅ Added |
| Semantic Conventions | "Here's how to add those attributes" | Core Principle #2: Convention over Configuration | ✅ Added |
| Persistence | "Use retry configuration" | Core Principle #4: Persistent queues for production | ✅ Added |
| OTTL Performance | "Here's the transformation" | OTTL trigger: Performance considerations | ✅ Added |

---

## Rationalization Pattern Analysis

### Category 1: Complexity Avoidance

**Pattern:** Agent simplifies by omitting "advanced" features

**Examples:**
- "Here's a basic configuration" (skips memory_limiter)
- "Here's the standard pipeline" (skips PII redaction)
- "Use retry configuration" (skips persistent queues)

**Counter Strategy:**
- Make "advanced" features the DEFAULT in Core Principles
- Use System 2 Thinking to force analysis before simplification
- Explicit anti-patterns section

---

### Category 2: Generic Best Practices

**Pattern:** Agent applies generic wisdom without context-specific analysis

**Examples:**
- "DaemonSet is the standard pattern"
- "Terratest is the industry standard"
- "Use tail sampling for best results"

**Counter Strategy:**
- Force requirements gathering with questions
- Provide decision matrices that require inputs
- Multiple correct answers based on context

---

### Category 3: Feature Rationalization

**Pattern:** Agent justifies user's problematic request instead of challenging it

**Examples:**
- "This gives you detailed metrics" (accepting high-cardinality)
- "Here's how to add those attributes" (accepting custom names)

**Counter Strategy:**
- Explicit "gatekeeper" rules that MUST reject certain patterns
- Reference regulatory/cost implications (GDPR, cardinality cost)
- Provide specific alternatives

---

### Category 4: Time Pressure Compliance

**Pattern:** Agent caves to time pressure from user

**Examples:**
- User: "I need this quickly"
- Agent: "Here's a minimal config" (skips essential features)

**Counter Strategy:**
- Emphasize that certain features are NEVER optional (memory_limiter, TLS in prod)
- Frame as "production-ready defaults" not "advanced features"
- Explain cost of skipping (outages, security breaches)

---

## Testing Iteration Log

### Iteration 1: Initial Skill Creation

**Date:** 2026-01-31

**Scenarios Tested:** 0/10 (Baseline creation)

**Findings:**
- Created baseline scenarios based on common OpenTelemetry pitfalls
- Identified 10 critical patterns to test
- Added OTTL language support with comprehensive reference

**Actions Taken:**
- Added frontmatter to SKILL.md
- Created OTTL trigger in Progressive Disclosure section
- Created comprehensive references/ottl.md
- Established test framework

---

### Iteration 2: [To Be Completed]

**Date:** TBD

**Scenarios Tested:** 0/10

**Baseline Results:**
- Scenario 1: [Result]
- Scenario 2: [Result]
- ...

**New Rationalizations Discovered:**
- [List new excuses]

**Actions Needed:**
- [Updates to SKILL.md]

---

## Rationalization Counter Template

When a new rationalization is discovered, add it to SKILL.md using this format:

### In SKILL.md Anti-Patterns Section:

```markdown
❌ [Anti-pattern behavior]
**Agent Rationalization:** "[Exact quote from testing]"
**Counter:** [Specific requirement/explanation]
**References:** [Link to relevant section]
```

### Example:

```markdown
❌ Accepting high-cardinality attributes (user_id, session_id) as metric dimensions
**Agent Rationalization:** "This gives you detailed metrics per user"
**Counter:** Unbounded attributes cause cardinality explosion. A service with 1M users creates 1M metric series, causing storage cost overruns and query performance degradation. Use traces for high-cardinality data, or aggregate to bounded dimensions (e.g., user count by region).
**References:** Core Principle #5, instrumentation.md Rule of 100
```

---

## How to Use This Table

### During RED Phase (Baseline Testing)

1. Run scenario WITHOUT skill
2. Document agent response verbatim
3. Identify specific rationalizations used
4. Add to table with "Discovered" status
5. Note which scenario triggered it

### During REFACTOR Phase

1. For each rationalization:
   - Write explicit counter in SKILL.md
   - Choose placement: Core Principles, Anti-Patterns, or trigger section
   - Add reference in relevant section
2. Update table with:
   - Counter location in SKILL.md
   - Status: "Added"
3. Re-run scenario to verify counter works

### During Subsequent Iterations

1. Look for NEW rationalizations (agents are creative!)
2. Document even if similar to existing ones
3. Strengthen counters if old rationalizations resurface
4. Track iteration-over-iteration improvement

---

## Success Metrics

### Target: Zero Rationalizations

**Goal:** After multiple iterations, agent should:
- Never use documented rationalizations
- Proactively apply best practices
- Reference skill content unprompted

**Measurement:**
- Count rationalizations per scenario
- Track reduction over iterations
- Target: 0 rationalizations in 10/10 scenarios

### Iteration Tracking

| Iteration | Scenarios Passed | Avg Rationalizations per Scenario | New Rationalizations Found |
|-----------|------------------|-----------------------------------|----------------------------|
| 1 (Baseline) | 0/10 | N/A | 10 (initial set) |
| 2 | TBD | TBD | TBD |
| 3 | TBD | TBD | TBD |
| ... | ... | ... | ... |

---

## RED-GREEN-REFACTOR Cycle

### RED Phase
- Run WITHOUT skill
- Document failures and rationalizations
- Capture verbatim responses

### GREEN Phase
- Run WITH skill
- Document improvements
- Identify remaining gaps

### REFACTOR Phase
- Add counters to SKILL.md
- Strengthen weak sections
- Re-test until 100% pass rate

**Iterate until all scenarios pass consistently.**

---

## Contributing New Scenarios

If you discover new failure modes:

1. Add scenario to `baseline-scenarios.md`
2. Run RED-GREEN cycle
3. Document rationalization here
4. Add counter to SKILL.md
5. Submit PR with all updates

**Make the skill bulletproof through continuous testing.**

---

## Notes for Skill Authors

### Common Mistake: Vague Counters

❌ **Bad Counter:**
```
"Consider using memory_limiter"
```

✅ **Good Counter:**
```
"memory_limiter MUST be the first processor in the chain to prevent out-of-memory crashes. Configuration defaults: limit_percentage: 80, spike_limit_percentage: 20"
```

### Make It Impossible to Rationalize

**Strong counters:**
- Use MUST, NEVER, ALWAYS
- Explain consequences (cost, security, outages)
- Provide specific configuration defaults
- Reference regulatory requirements when applicable

**Weak counters:**
- "Consider..."
- "It's recommended..."
- "You might want to..."

---

**This table is living documentation. Update it after every testing iteration.**
