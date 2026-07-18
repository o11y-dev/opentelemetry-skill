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
- Agent NOW requires load_balancing exporter for tail sampling
- Agent explains sticky session requirement
- Agent provides traceID routing configuration

### Success Criteria Verification

- [ ] Agent mentions load balancing requirement
- [ ] Agent provides load_balancing exporter config
- [ ] Agent explains traceID routing requirement
- [ ] Agent warns about stability level

### Evidence Checklist

Look for agent:
- Mentioning "load_balancing exporter"
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

## Scenario 11: Existing Helm Values Audit

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW audits the snippet as a whole system instead of line-by-line
- Agent compares `memory_limiter` to container limits
- Agent requires sticky routing for scaled tail sampling
- Agent questions `hostPort` on a gateway Deployment
- Agent identifies retry/queue durability gaps
- Agent catches the bool-vs-string OTTL/filter mismatch and stale semantic convention key

### Success Criteria Verification

- [ ] Agent compares memory limiter settings to pod memory limits
- [ ] Agent calls out sticky-routing requirement for `tail_sampling`
- [ ] Agent flags `hostPort` as suspicious or inappropriate here
- [ ] Agent identifies disabled retry / missing queue as data-loss risk
- [ ] Agent catches OTTL type mismatch or stale `http.status_code`
- [ ] Agent evaluates HPA/PDB/replica settings together

### Evidence Checklist

Look for agent:
- Mentioning that `limit_mib: 1500` conflicts with `memory: 666Mi`
- Explaining that scaling `tail_sampling` behind a normal Service breaks correctness
- Saying `hostPort` is usually for node-local / DaemonSet patterns, not gateway Deployments
- Recommending `sending_queue` + `file_storage` when data loss is not acceptable
- Correcting `http.status_code` to `http.response.status_code` and/or bool-vs-string comparison

---

## Scenario 12: Existing Metrics Helm Values Audit

### Expected Improvements

**Baseline → Compliance Changes:**
- Agent NOW audits the metrics snippet as a stateful system, not just a queue-enabled config
- Agent flags `memory_limiter` size and ordering problems
- Agent questions whether `deltatocumulative` is required and explains its restart/scale trade-offs
- Agent rejects `file_storage` on `efs` + `ReadWriteMany`
- Agent catches dead config (`groupbyattrs`) and rollout/eviction concerns

### Success Criteria Verification

- [ ] Agent compares memory limiter settings to pod memory limits
- [ ] Agent flags `memory_limiter` ordering in the metrics pipeline
- [ ] Agent identifies temporality conversion as stateful and questions whether it is needed
- [ ] Agent identifies EFS/RWX as unsafe for `file_storage`
- [ ] Agent flags declared-but-unused `groupbyattrs`
- [ ] Agent questions `hostPort` or PDB settings in the scaled/single-replica design

### Evidence Checklist

Look for agent:
- Mentioning that `limit_mib: 1500` conflicts with `memory: 666Mi`
- Calling out that `memory_limiter` should be first, not after other metric processors
- Explaining that `deltatocumulative` keeps per-timeseries state and can reset on restart/scale events
- Saying `ReadWriteMany` + `efs` is unsafe for bbolt-backed `file_storage`
- Identifying `groupbyattrs/keep_stable_labels` as unused

---

## Focused Regression Check: Scaled `signal_to_metrics` Histogram Direct Export

### Test Prompt

```text
Review this design for metric correctness. A logs collector runs with three replicas. Each replica uses the current signal_to_metrics connector to generate a log.processing.duration histogram with an outcome attribute and exports it directly over OTLP to a backend. In the backend, the stored histogram is cumulative and has the same metric/outcome label set from every replica; inspection shows that signal_to_metrics.service.instance.id is not retained as series identity. The destination metrics pipeline also carries application metrics. The dashboard needs latency and event rate. Is this safe, and what should change?
```

### Expected Improvements

- Agent explains that current `signal_to_metrics` emits delta histograms and automatically adds `signal_to_metrics.service.instance.id`.
- Agent identifies the backend's loss of that resource identity, followed by a cumulative representation, as creating competing metric streams with the same stored label set.
- Agent first recommends preserving or mapping the built-in producer identity. For an older/custom path that emits no identity, it recommends `service.instance.id` only when the metric resource represents the Collector, or a scoped `collector_instance` fallback otherwise.
- Agent scopes the identity to a dedicated connector-generated metrics pipeline rather than adding pod labels to all metrics.
- Agent requires dashboards to aggregate the producer identity away with `sum by (...)`, retaining histogram bucket dimensions where applicable.
- Agent contrasts direct export with Prometheus scraping, where the scrape path usually adds an `instance` identity.
- Agent uses the histogram `_count` for event rate instead of recommending a duplicate counter.

### Success Criteria Verification

- [ ] Agent checks replica count, direct export mode, connector delta temporality, backend cumulative conversion, producer identity, and query aggregation together.
- [ ] Agent flags the dropped per-replica identity before approving the design.
- [ ] Agent recognizes the current connector's built-in `signal_to_metrics.service.instance.id` instead of blindly adding a duplicate identity.
- [ ] Agent limits producer enrichment to the generated metric stream.
- [ ] Agent recommends aggregation across producers in dashboards and alerts.
- [ ] Agent does not recommend adding pod labels to all application metrics.
- [ ] Agent does not recommend a separate event counter when the histogram `_count` is sufficient.

---

## Overall Compliance Assessment

### Passing Criteria

Skill is considered "passing GREEN phase" when:

**Quantitative:**
- [ ] 12/12 scenarios show measurable behavior improvement
- [ ] 80%+ of success criteria met across all scenarios
- [ ] Agent references skill content in 11/12+ scenarios

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
- Overview: N/12 scenarios passed
- Success criteria: N% met overall
- Key improvements observed
- Remaining gaps
- Rationalizations to address in REFACTOR phase

---

## GREEN Phase Complete When:

- [ ] All 12 scenarios run WITH skill loaded
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
4. → Iterate until 12/12 scenarios pass

**This is iterative:** First pass may only get 9/12 scenarios passing. That's expected. The goal is continuous improvement through the RED-GREEN-REFACTOR cycle.
