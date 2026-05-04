# Baseline Scenarios (RED Phase)

> **Purpose:** Test skill effectiveness by comparing agent behavior WITHOUT vs WITH skill loaded
>
> **Iron Law:** Per writing-skills standards, NO SKILL WITHOUT A FAILING TEST FIRST

This document defines test scenarios to validate that opentelemetry-skill actually changes Claude's behavior. Each scenario must be run WITHOUT the skill first (baseline), then WITH the skill (compliance verification).

## Testing Methodology

### RED Phase (This Document)
1. Run each scenario WITHOUT opentelemetry-skill loaded
2. Document verbatim agent responses
3. Identify specific rationalizations and missed opportunities
4. Note which pressures trigger violations

### GREEN Phase (compliance-verification.md)
1. Run same scenarios WITH opentelemetry-skill loaded
2. Document behavior changes
3. Verify agents now comply with patterns

### REFACTOR Phase (rationalization-table.md)
1. Identify new rationalizations from testing
2. Add explicit counters to SKILL.md
3. Re-test until bulletproof

---

## Scenario 1: Collector Configuration Without Memory Protection

**Objective:** Verify agent proactively includes memory_limiter as first processor

### Test Prompt
```
Configure an OpenTelemetry Collector to receive OTLP traces and export them to Jaeger.
```

### Expected Baseline Behavior (WITHOUT skill)
- Agent creates receiver and exporter configuration
- May include batch processor
- **Likely SKIPS:** memory_limiter entirely or places it incorrectly
- **Rationalization:** "Here's a basic configuration"

### Target Behavior (WITH skill)
- Agent includes memory_limiter as FIRST processor
- Explains why it must be first (prevent OOM)
- Includes batch processor after memory_limiter
- Warns about stability levels if using unstable components

### Pressure Variations
- **Time pressure:** "I need this quickly, just the basics"
- **Authority pressure:** "I know collectors, just show me the config"

### Success Criteria
- [ ] Agent includes memory_limiter processor
- [ ] memory_limiter is explicitly placed FIRST in processor chain
- [ ] Agent explains the importance of processor ordering
- [ ] Agent doesn't rationalize skipping memory protection

---

## Scenario 2: High-Cardinality Metric Dimensions

**Objective:** Verify agent blocks unbounded attributes in metrics

### Test Prompt
```
I want to track request latency as a metric. Add dimensions for:
- User ID
- Request ID
- HTTP method
- HTTP status code
```

### Expected Baseline Behavior (WITHOUT skill)
- Creates metric with all requested dimensions
- **Likely MISSES:** Cardinality implications of user_id and request_id
- **Rationalization:** "This gives you detailed metrics"

### Target Behavior (WITH skill)
- **Blocks** user_id and request_id as metric dimensions
- Explains Rule of 100 and cardinality explosion risk
- Recommends:
  - Use traces for user_id and request_id
  - Keep only `http.request.method` and `http.response.status_code` in metrics
  - Or suggest aggregated user count metric
- References instrumentation.md cardinality section

### Success Criteria
- [ ] Agent identifies user_id and request_id as unbounded
- [ ] Agent explicitly rejects high-cardinality metric dimensions
- [ ] Agent provides alternative approaches (traces, aggregation)
- [ ] Agent explains cost implications

---

## Scenario 3: Tail Sampling Without Load Balancing

**Objective:** Verify agent requires sticky sessions for tail sampling

### Test Prompt
```
I need to implement tail sampling in my OpenTelemetry Collector gateway to reduce trace volume by 90% but keep all error traces.
```

### Expected Baseline Behavior (WITHOUT skill)
- Configures tail_sampling processor
- **Likely SKIPS:** loadbalancing exporter with traceID routing
- **Likely MISSES:** Warning that tail sampling requires all spans of a trace on same collector
- **Rationalization:** "Here's the tail sampling config"

### Target Behavior (WITH skill)
- Asks about deployment architecture (how many collector instances)
- Explains requirement for sticky sessions (traceID routing)
- Provides loadbalancing exporter configuration with `routing_key: traceID`
- Includes Headless Service YAML for Kubernetes
- Warns about tail_sampling stability level (Beta)
- References sampling.md and architecture.md

### Success Criteria
- [ ] Agent mentions load balancing requirement
- [ ] Agent provides loadbalancing exporter config
- [ ] Agent explains why traceID routing is mandatory
- [ ] Agent warns about stability level
- [ ] Agent doesn't provide tail sampling without addressing load balancing

---

## Scenario 4: Missing TLS Configuration

**Objective:** Verify agent recommends TLS for cross-network communication

### Test Prompt
```
Configure a collector to send telemetry from my Kubernetes cluster to a SaaS observability backend.
```

### Expected Baseline Behavior (WITHOUT skill)
- Configures OTLP exporter with endpoint
- **Likely SKIPS:** TLS configuration
- **Likely USES:** `insecure: true` or doesn't mention security
- **Rationalization:** "Set up the endpoint connection"

### Target Behavior (WITH skill)
- Includes TLS configuration by default
- Sets `insecure: false` explicitly
- May mention mutual TLS for enhanced security
- References security.md for TLS patterns
- Asks about authentication requirements (API keys, tokens)

### Success Criteria
- [ ] Agent includes TLS configuration
- [ ] Agent does not use `insecure: true` for production
- [ ] Agent mentions authentication/authorization
- [ ] Agent references security best practices

---

## Scenario 5: PII in Telemetry

**Objective:** Verify agent proactively addresses PII redaction

### Test Prompt
```
I'm collecting traces from my web application that handles user data. Configure the collector to process these traces.
```

### Expected Baseline Behavior (WITHOUT skill)
- Creates basic receiver/processor/exporter pipeline
- **Likely SKIPS:** PII redaction entirely
- **Likely MISSES:** Asking about sensitive data in requests
- **Rationalization:** "Here's the standard pipeline"

### Target Behavior (WITH skill)
- Asks what user data is being collected
- Proactively suggests PII redaction
- Provides transform processor with OTTL examples for:
  - Email address redaction
  - URL parameter sanitization
  - Header filtering
- References security.md PII redaction section
- Recommends redaction early in pipeline (before data leaves collector)

### Success Criteria
- [ ] Agent asks about sensitive data / PII
- [ ] Agent recommends PII redaction processor
- [ ] Agent provides specific OTTL redaction patterns
- [ ] Agent explains placement in processor chain
- [ ] Agent references compliance requirements (GDPR, CCPA)

---

## Scenario 6: Sampling Strategy Without Cost Analysis

**Objective:** Verify agent considers cost and throughput when recommending sampling

### Test Prompt
```
My application generates 100,000 traces per second. How should I handle this volume?
```

### Expected Baseline Behavior (WITHOUT skill)
- Recommends head sampling or tail sampling
- **Likely SKIPS:** Cost implications, statistical accuracy
- **Likely MISSES:** Alternative approaches (traffic-based sampling, parent-based)
- **Rationalization:** "Use tail sampling for best results"

### Target Behavior (WITH skill)
- Performs System 2 analysis on throughput (>10k RPS = high volume)
- Asks about:
  - Budget constraints
  - Critical user flows to preserve
  - Error rate expectations
- Explains trade-offs between head and tail sampling
- Provides statistical impact analysis (e.g., 10% sampling = 10x data loss for rare events)
- May recommend progressive sampling strategy
- References sampling.md

### Success Criteria
- [ ] Agent identifies volume as high-traffic scenario
- [ ] Agent asks about budget and requirements
- [ ] Agent explains sampling trade-offs (cost vs. completeness)
- [ ] Agent provides statistical analysis
- [ ] Agent considers multiple sampling strategies

---

## Scenario 7: Collector Deployment Pattern Selection

**Objective:** Verify agent uses decision matrix for deployment architecture

### Test Prompt
```
I need to deploy OpenTelemetry collectors in my Kubernetes cluster. What's the best approach?
```

### Expected Baseline Behavior (WITHOUT skill)
- Recommends DaemonSet (most common answer)
- **Likely SKIPS:** Requirements gathering (what signals, what processing)
- **Likely MISSES:** Gateway pattern for centralized processing
- **Rationalization:** "DaemonSet is the standard pattern"

### Target Behavior (WITH skill)
- Asks clarifying questions:
  - What signals? (Traces, metrics, logs)
  - What processing? (Sampling, aggregation, filtering)
  - Scale requirements?
- Uses decision matrix from architecture.md:
  - DaemonSet for node-level metrics and logs
  - Gateway for centralized processing (tail sampling, aggregation)
  - Sidecar for application-specific processing
- Provides deployment YAML for recommended pattern
- Explains trade-offs

### Success Criteria
- [ ] Agent asks about signals and processing requirements
- [ ] Agent uses deployment decision matrix
- [ ] Agent explains rationale for recommendation
- [ ] Agent doesn't default to DaemonSet without context
- [ ] Agent mentions when to use Gateway vs DaemonSet

---

## Scenario 8: Instrumentation Without Semantic Conventions

**Objective:** Verify agent enforces semantic conventions

### Test Prompt
```
Show me how to add custom attributes to my spans:
- "request_method" for the HTTP method
- "status" for the response code
- "endpoint_url" for the request URL
```

### Expected Baseline Behavior (WITHOUT skill)
- Provides code to add custom attributes with given names
- **Likely SKIPS:** Semantic conventions entirely
- **Likely MISSES:** Standardized attribute names
- **Rationalization:** "Here's how to add those attributes"

### Target Behavior (WITH skill)
- **Corrects** attribute names to semantic conventions:
  - `http.request.method` (not request_method)
  - `http.response.status_code` (not status)
  - `http.route` for server-side route templates, or sanitized `url.full`/`url.path` instead of a custom `endpoint_url`
- Explains importance of semantic conventions (cross-tool compatibility)
- References latest semantic conventions version (1.40.0+)
- Loads instrumentation.md
- May provide link to semantic conventions documentation

### Success Criteria
- [ ] Agent uses semantic convention attribute names
- [ ] Agent explains why custom names are problematic
- [ ] Agent references semantic conventions specification
- [ ] Agent doesn't blindly implement custom attribute names

---

## Scenario 9: Missing Persistent Queues

**Objective:** Verify agent recommends persistent queues for production

### Test Prompt
```
I need to ensure I don't lose telemetry data if my backend goes down temporarily. How should I configure my collector?
```

### Expected Baseline Behavior (WITHOUT skill)
- May mention retry settings on exporter
- **Likely SKIPS:** file_storage extension and persistent queues
- **Likely MISSES:** Disk space requirements, PersistentVolume setup
- **Rationalization:** "Use retry configuration"

### Target Behavior (WITH skill)
- Recommends file_storage extension
- Configures persistent queues on exporters
- Explains disk space requirements
- For Kubernetes: provides PersistentVolumeClaim YAML
- Mentions trade-off: persistence vs. performance
- References collector.md persistence section

### Success Criteria
- [ ] Agent recommends file_storage extension
- [ ] Agent shows how to attach persistent queues to exporters
- [ ] Agent mentions disk space considerations
- [ ] Agent provides Kubernetes volume configuration if applicable
- [ ] Agent explains durability guarantees

---

## Scenario 10: OTTL Transformation Without Performance Consideration

**Objective:** Verify agent considers performance when using OTTL

### Test Prompt
```
I need to redact all email addresses from span attributes using OTTL.
```

### Expected Baseline Behavior (WITHOUT skill)
- Provides OTTL regex transformation
- **Likely SKIPS:** Performance optimization (where clauses, filter ordering)
- **Likely MISSES:** Error handling, regex efficiency
- **Rationalization:** "Here's the transformation"

### Target Behavior (WITH skill)
- Provides OTTL transformation with:
  - `error_mode: ignore` for resilience
  - `where` clause to avoid unnecessary processing
  - Efficient regex pattern
- Explains processor ordering (filter before transform if possible)
- Mentions testing with realistic data volumes
- References ottl.md best practices

### Success Criteria
- [ ] Agent includes error_mode configuration
- [ ] Agent uses where clauses for conditional execution
- [ ] Agent mentions performance implications
- [ ] Agent recommends testing before production
- [ ] Agent provides efficient regex patterns

---

## Scenario 11: Existing Helm Values Audit

**Objective:** Verify agent audits an existing collector values file for cross-field contradictions instead of only fixing syntax.

### Test Prompt
```yaml
Review this OpenTelemetry Collector Helm values snippet and tell me what's risky or inconsistent:

mode: deployment
replicaCount: 1
autoscaling:
  enabled: true
  minReplicas: 4
processors:
  tail_sampling:
    decision_wait: 5s
    num_traces: 1000
  memory_limiter:
    limit_mib: 1500
resources:
  limits:
    memory: 666Mi
ports:
  otlp:
    hostPort: 4317
podDisruptionBudget:
  enabled: true
  minAvailable: 2
exporters:
  otlp:
    retry_on_failure:
      enabled: false
processors_extra:
  transform/flag:
    trace_statements:
      - context: span
        statements:
          - set(attributes["2metric"], true) where attributes["http.status_code"] != "200"
  filter/lambda:
    traces:
      span:
        - name == "Lambda.Invoke" and not IsMatch(attributes["2metric"], "true")
```

### Expected Baseline Behavior (WITHOUT skill)
- May point out one or two obvious issues
- **Likely SKIPS:** cross-field review of memory sizing, sticky routing, `hostPort`, rollout consistency, and OTTL type mismatches
- **Likely RATIONALIZES:** "The YAML looks mostly fine; just tune some values"

### Target Behavior (WITH skill)
- Flags that `memory_limiter.limit_mib` exceeds pod memory limit and should leave runtime headroom
- Flags `tail_sampling` on a Deployment that can scale above one replica without sticky routing/loadbalancing exporter
- Flags `hostPort` as suspicious for a scaled gateway Deployment
- Flags `retry_on_failure: false` with no durable queue as an explicit data-loss trade-off
- Flags rollout inconsistency across `replicaCount`, HPA, and PodDisruptionBudget
- Flags OTTL/filter mismatch: boolean attribute checked via string regex and stale `http.status_code` usage
- References collector.md and architecture.md audit guidance

### Success Criteria
- [ ] Agent compares memory limiter settings to pod memory limits
- [ ] Agent identifies sticky-routing requirement for tail sampling
- [ ] Agent questions or rejects `hostPort` on this gateway deployment
- [ ] Agent identifies durability risk from disabled retry / missing queue
- [ ] Agent identifies OTTL type or semantic-convention mismatch
- [ ] Agent reviews rollout settings as a combined system, not independent fields

---

## Scenario 12: Existing Metrics Helm Values Audit

**Objective:** Verify agent audits metrics-specific state, storage, and processor-ordering risks in an existing collector values file.

### Test Prompt
```yaml
Review this OpenTelemetry Collector metrics Helm values snippet and tell me what's risky or inconsistent:

mode: statefulset
autoscaling:
  enabled: true
  minReplicas: 1
  maxReplicas: 6
processors:
  groupbyattrs/keep_stable_labels:
    keys: [cloud.region, faas.name, k8s.deployment.name]
  deltatocumulative:
    max_stale: 1m
  filter/drop_http:
    error_mode: ignore
    metrics:
      datapoint:
        - 'attributes["http.route"] == ""'
  memory_limiter:
    limit_mib: 1500
resources:
  limits:
    memory: 666Mi
service:
  pipelines:
    metrics:
      processors: [deltatocumulative, filter/drop_http, memory_limiter, batch]
extensions:
  file_storage/queue:
    directory: /var/lib/storage/queue/coralogix
exporters:
  otlp:
    sending_queue:
      enabled: true
      storage: file_storage/queue
statefulset:
  volumeClaimTemplates:
    - metadata:
        name: queue
      spec:
        storageClassName: efs
        accessModes: [ReadWriteMany]
ports:
  otlp:
    hostPort: 4317
podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

### Expected Baseline Behavior (WITHOUT skill)
- May praise the presence of a persistent queue
- **Likely SKIPS:** that `deltatocumulative` is stateful, that EFS/RWX is unsafe for `file_storage`, that `memory_limiter` is not first, and that `groupbyattrs` is declared but unused
- **Likely RATIONALIZES:** "It already has a queue, so it's mostly production-ready"

### Target Behavior (WITH skill)
- Flags that `memory_limiter.limit_mib` exceeds the pod memory limit and is placed too late in the metrics processor chain
- Flags `deltatocumulative` as a stateful temporality conversion that needs source/backend justification and careful restart/scale assumptions
- Flags `file_storage` on `efs` + `ReadWriteMany` as unsafe for bbolt-backed persistent queues
- Flags `groupbyattrs/keep_stable_labels` as dead config because it is declared but unused
- Questions `hostPort` on a horizontally scalable metrics gateway
- Notes that `podDisruptionBudget.minAvailable: 1` with a single guaranteed replica prevents voluntary eviction unless that trade-off is intentional
- References collector.md audit guidance and persistent-queue filesystem guidance

### Success Criteria
- [ ] Agent compares memory limiter settings to pod memory limits
- [ ] Agent flags `memory_limiter` ordering in the metrics pipeline
- [ ] Agent identifies temporality conversion as stateful and questions whether it is needed
- [ ] Agent identifies EFS/RWX as unsafe for `file_storage`
- [ ] Agent flags declared-but-unused `groupbyattrs`
- [ ] Agent questions `hostPort` or PDB settings in the scaled/single-replica design

---

## Running These Tests

### Step 1: Prepare Test Environment

**Option A: Separate Claude Session**
- Open Claude in a browser (without skill access)
- Or use different CLI profile without opentelemetry-skill

**Option B: Temporarily Disable Skill**
```bash
mv ~/.claude/skills/opentelemetry-skill ~/.claude/skills/opentelemetry-skill.disabled
```

### Step 2: Run Baseline (WITHOUT Skill)

For each scenario:
1. Copy test prompt exactly
2. Run in Claude WITHOUT skill loaded
3. Document agent response verbatim in `baseline-results/scenario-N.md`
4. Note specific rationalizations used
5. Identify what was missed vs target behavior

### Step 3: Enable Skill

```bash
mv ~/.claude/skills/opentelemetry-skill.disabled ~/.claude/skills/opentelemetry-skill
# Or reload skill in environment
```

### Step 4: Run Compliance Tests (WITH Skill)

See `compliance-verification.md` for detailed methodology.

### Step 5: Document Rationalizations

Capture all excuses/rationalizations in `rationalization-table.md`:
- "Here's a basic configuration"
- "This gives you detailed metrics"
- "Use tail sampling for best results"
- "DaemonSet is the standard pattern"

Each rationalization gets an explicit counter added to SKILL.md.

---

## Expected Outcomes

### Success Metrics

For skill to be considered "passing TDD":
- [ ] **12/12 scenarios** show clear behavior change WITH skill vs baseline
- [ ] Agent uses skill content (decision matrices, patterns, checklists)
- [ ] Agent doesn't rationalize skipping best practices
- [ ] Rationalizations documented and countered in skill

### Common Baseline Failures to Document

1. **Missing memory_limiter** (Scenario 1)
2. **Accepting high-cardinality metric dimensions** (Scenario 2)
3. **Tail sampling without load balancing** (Scenario 3)
4. **Missing TLS configuration** (Scenario 4)
5. **No PII redaction** (Scenario 5)
6. **No cost analysis for sampling** (Scenario 6)
7. **Generic deployment recommendation** (Scenario 7)
8. **Custom attribute names instead of semantic conventions** (Scenario 8)
9. **Missing persistent queues** (Scenario 9)
10. **Inefficient OTTL transformations** (Scenario 10)
11. **No audit of cross-field config contradictions** (Scenario 11)
12. **No audit of metrics temporality/storage contradictions** (Scenario 12)

### RED Phase Complete When:

- [ ] All 12 scenarios run WITHOUT skill
- [ ] Results documented in `baseline-results/` directory
- [ ] Rationalizations captured verbatim
- [ ] Comparison criteria defined for GREEN phase

---

## Next Steps

After completing RED phase:
1. → `compliance-verification.md` - Run WITH skill, compare results
2. → `rationalization-table.md` - Document excuses, add counters to SKILL.md
3. → Iterate: Find new loopholes, plug them, re-test

**Remember:** This is TDD for documentation. Same rigor as code testing.
