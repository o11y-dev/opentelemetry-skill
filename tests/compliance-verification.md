# Compliance Verification (GREEN Phase)

> **Purpose:** Verify that opentelemetry-skill changes agent behavior per TDD methodology
>
> **Prerequisite:** baseline-scenarios.md must be completed first (RED phase)

This document defines the GREEN phase of TDD testing: running the same scenarios WITH the skill loaded and verifying behavior changes.

---

## Testing Workflow

### Prerequisites

1. ✅ RED phase complete (`baseline-scenarios.md` scenarios run WITHOUT skill)
2. ✅ Baseline results documented in `baseline-results/` directory
3. ✅ Skill loaded in Claude environment

### GREEN Phase Process

For each scenario from `baseline-scenarios.md`:

1. **Load opentelemetry-skill** in Claude environment
2. **Run exact same prompt** as baseline
3. **Document agent response** in `compliance-results/scenario-N.md`
4. **Compare to baseline** - what changed?
5. **Verify success criteria** from baseline scenario

---

## Comparison Template

For each scenario, document:

### Scenario N: [Name]

**Baseline Behavior (WITHOUT skill):**
- [What agent did/said]
- [What was missed]
- [Rationalizations used]

**Compliance Behavior (WITH skill):**
- [What agent did/said]
- [What improved]
- [Skill content referenced]

**Behavior Change:**
- ✅ **Improved:** [Specific improvements]
- ⚠️ **Partial:** [Partially addressed]
- ❌ **Unchanged:** [Still missing]

**Success Criteria Status:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] etc.

**Evidence of Skill Usage:**
- [ ] Agent referenced decision matrix
- [ ] Agent quoted/paraphrased skill content
- [ ] Agent followed patterns from skill
- [ ] Agent used skill-specific terminology

**New Rationalizations Discovered:**
- [Any new excuses/workarounds to add to rationalization table]

---

## Scenario 1: Collector Configuration Without Memory Protection

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW includes memory_limiter as first processor
- Agent explains why processor ordering matters
- Agent provides production-ready defaults (80% limit, 20% spike)

### Success Criteria Verification

- [ ] Agent includes memory_limiter processor
- [ ] memory_limiter is explicitly placed FIRST
- [ ] Agent explains processor ordering importance
- [ ] Agent doesn't skip memory protection

### Evidence Checklist

Look for agent:
- Mentioning "memory_limiter must be first"
- Providing default configuration (limit_percentage: 80)
- Explaining OOM prevention
- Referencing Core Principles from SKILL.md

---

## Scenario 2: High-Cardinality Metric Dimensions

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW blocks user_id and request_id in metrics
- Agent explains Rule of 100 and cardinality explosion
- Agent suggests alternative approaches (traces, aggregation)

### Success Criteria Verification

- [ ] Agent identifies unbounded attributes
- [ ] Agent rejects high-cardinality dimensions
- [ ] Agent provides alternatives
- [ ] Agent explains cost implications

### Evidence Checklist

Look for agent:
- Mentioning "Rule of 100"
- Explaining cardinality explosion risk
- Referencing instrumentation.md
- Suggesting traces for high-cardinality data

---

## Scenario 3: Tail Sampling Without Load Balancing

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW requires loadbalancing exporter for tail sampling
- Agent explains sticky session requirement
- Agent provides traceID routing configuration

### Success Criteria Verification

- [ ] Agent mentions load balancing requirement
- [ ] Agent provides loadbalancing exporter config
- [ ] Agent explains traceID routing requirement
- [ ] Agent warns about stability level

### Evidence Checklist

Look for agent:
- Mentioning "loadbalancing exporter"
- Explaining "routing_key: traceID"
- Warning "all spans of a trace must reach same collector"
- Referencing sampling.md and architecture.md

---

## Scenario 4: Missing TLS Configuration

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW includes TLS by default
- Agent sets insecure: false
- Agent mentions authentication requirements

### Success Criteria Verification

- [ ] Agent includes TLS configuration
- [ ] Agent avoids insecure: true
- [ ] Agent mentions authentication
- [ ] Agent references security best practices

---

## Scenario 5: PII in Telemetry

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW proactively asks about sensitive data
- Agent recommends PII redaction with OTTL
- Agent provides specific redaction patterns
- Agent explains processor placement

### Success Criteria Verification

- [ ] Agent asks about PII/sensitive data
- [ ] Agent recommends redaction processor
- [ ] Agent provides OTTL patterns
- [ ] Agent explains pipeline placement
- [ ] Agent references compliance

---

## Scenario 6: Sampling Strategy Without Cost Analysis

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW performs System 2 analysis on throughput
- Agent asks about budget and requirements
- Agent explains sampling trade-offs
- Agent provides statistical analysis

### Success Criteria Verification

- [ ] Agent identifies high-traffic scenario
- [ ] Agent asks about budget
- [ ] Agent explains trade-offs
- [ ] Agent provides statistical analysis
- [ ] Agent considers multiple strategies

---

## Scenario 7: Collector Deployment Pattern Selection

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW asks about signals and processing needs
- Agent uses deployment decision matrix
- Agent explains rationale for recommendation

### Success Criteria Verification

- [ ] Agent asks requirements questions
- [ ] Agent uses decision matrix
- [ ] Agent explains rationale
- [ ] Agent doesn't default to DaemonSet
- [ ] Agent mentions Gateway vs DaemonSet

---

## Scenario 8: Instrumentation Without Semantic Conventions

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW corrects to semantic conventions
- Agent explains importance of standards
- Agent references specification

### Success Criteria Verification

- [ ] Agent uses semantic convention names
- [ ] Agent explains why custom names problematic
- [ ] Agent references specification
- [ ] Agent doesn't implement custom names

---

## Scenario 9: Missing Persistent Queues

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW recommends file_storage extension
- Agent configures persistent queues
- Agent explains disk requirements
- Agent provides Kubernetes volume config

### Success Criteria Verification

- [ ] Agent recommends file_storage
- [ ] Agent shows persistent queue attachment
- [ ] Agent mentions disk space
- [ ] Agent provides K8s config
- [ ] Agent explains durability guarantees

---

## Scenario 10: OTTL Transformation Without Performance Consideration

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW includes error_mode
- Agent uses where clauses
- Agent mentions performance implications
- Agent recommends testing

### Success Criteria Verification

- [ ] Agent includes error_mode
- [ ] Agent uses where clauses
- [ ] Agent mentions performance
- [ ] Agent recommends testing
- [ ] Agent provides efficient patterns

---

## Scenario 11: Collector Security Hardening

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW enforces TLS 1.3/mTLS and refuses `insecure_skip_verify: true`.
- Agent requires authentication on receivers and pulls secrets from env/secret managers (not inline YAML).
- Agent binds debug endpoints to localhost and recommends NetworkPolicy restrictions.
- Agent pins collector images (no `:latest`) and runs as non-root/read-only root filesystem.

### Success Criteria Verification

- [ ] Agent includes TLS 1.3/mTLS guidance and blocks insecure skip verify
- [ ] Agent specifies receiver authentication with externalized secrets
- [ ] Agent binds debug endpoints to localhost and mentions NetworkPolicy
- [ ] Agent pins images and enforces non-root + read-only root filesystem

---

## Overall Compliance Assessment

### Passing Criteria

Skill is considered "passing GREEN phase" when:

**Quantitative:**
- [ ] 10/10 scenarios show measurable behavior improvement
- [ ] 80%+ of success criteria met across all scenarios
- [ ] Agent references skill content in 9/10+ scenarios

**Qualitative:**
- [ ] Agent proactively applies patterns (not reactive)
- [ ] Agent uses decision frameworks unprompted
- [ ] Agent cites specific sections/examples from skill
- [ ] Responses align with skill philosophy

### Failure Modes

If scenarios fail (no behavior change):

**Diagnosis:**
1. Check skill description - does it match trigger conditions?
2. Check "When to Use" section - clear enough?
3. Check content organization - is pattern findable?
4. Check keyword coverage - would search find it?

**Remediation:**
1. Enhance frontmatter description and keywords
2. Reorganize content for scannability
3. Add explicit counter-rationalizations
4. Re-test in REFACTOR phase

---

## Documentation Requirements

### For Each Scenario

Create file: `compliance-results/scenario-N-[name].md`

**Required sections:**
1. Full agent response (verbatim or screenshot)
2. Comparison to baseline (what changed)
3. Success criteria checklist
4. Evidence of skill usage
5. New rationalizations discovered
6. PASS/PARTIAL/FAIL verdict

### Summary Report

Create file: `compliance-results/SUMMARY.md`

**Include:**
- Overview: N/10 scenarios passed
- Success criteria: N% met overall
- Key improvements observed
- Remaining gaps
- Rationalizations to address in REFACTOR phase

---

## GREEN Phase Complete When:

- [ ] All 10 scenarios run WITH skill loaded
- [ ] Results documented in `compliance-results/` directory
- [ ] Comparison to baseline complete for all scenarios
- [ ] Success criteria evaluated
- [ ] Summary report written
- [ ] New rationalizations captured for REFACTOR phase

---

## Next Steps

After GREEN phase:
1. → `rationalization-table.md` - Update with findings
2. → REFACTOR phase - Add counters to SKILL.md for new rationalizations
3. → Re-test scenarios that failed or partially passed
4. → Iterate until 10/10 scenarios pass

**This is iterative:** First pass may only get 7/10 scenarios passing. That's expected. The goal is continuous improvement through the RED-GREEN-REFACTOR cycle.
