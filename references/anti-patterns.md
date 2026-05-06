# OpenTelemetry Anti-Patterns

This reference catalogs known anti-patterns across collector configuration, metrics design, Kubernetes deployments, and AI agent instrumentation. The top 6 most critical patterns are also kept inline in `SKILL.md`; all patterns are listed here with explanations and mitigations.

---

## Collector Pipeline Anti-Patterns

### `memory_limiter` not first in the processor chain

Placing any other processor before `memory_limiter` allows unchecked memory growth during bursts or back-pressure events, which can silently corrupt in-flight data before the limiter can shed load.

**Fix:** `memory_limiter` must always be the first processor in every pipeline.

---

### Omitting the `batch` processor

Without batching, each span/metric/log is exported individually, producing thousands of small network calls per second and dramatically reducing throughput.

**Fix:** Add `batch` immediately after `memory_limiter` in every pipeline.

---

### Exposing pprof / zpages on `0.0.0.0` in production

`pprof` (port 1777) and `zpages` (port 55679) expose internal profiling and pipeline state. Binding them to all interfaces in a shared network allows any workload to extract sensitive runtime data or profile the collector under load.

**Fix:** Bind debug extensions to `localhost` only, or omit them entirely in production.

---

### Using `tail_sampling` without sticky session load balancing

`tail_sampling` keeps per-trace state in memory. When multiple collector replicas compete for the same traffic without a `loadbalancing` exporter routing upstream, spans from the same trace are split across instances and sampling decisions diverge.

**Fix:** Place a `loadbalancing` exporter (with `routing_key: traceID`) upstream of all `tail_sampling` replicas.

---

### Using high-cardinality attributes as metric dimensions

Attributes such as `user_id`, `trace_id`, `request_id`, and `session_id` are unbounded and will cause metric cardinality explosions, OOM kills in the collector, and cost blowups in the backend.

**Fix:** Use traces or structured logs for high-cardinality data; keep metric dimensions below 100 unique values per attribute (Rule of 100).

---

### Calling a config "fine" because it parses

A config that passes `otelcol validate` can still be operationally broken: memory limits may exceed pod limits, stateful processors may run without sticky routing, queues may be backed by unsafe filesystems, and rollout settings may be mutually contradictory.

**Fix:** Treat every collector review as a systems review, not a YAML lint. Compare memory limits, replica strategy, routing, metric temporality state, queue storage medium, and PDB/HPA settings together.

---

## Kubernetes Deployment Anti-Patterns

### `hostPort` on a horizontally scaled gateway Deployment

`hostPort` reserves a port on every node the pod lands on. This is appropriate for DaemonSets where exactly one pod runs per node, but counter-productive and fragile on a Deployment that can schedule multiple replicas anywhere.

**Fix:** Use a `ClusterIP` or `LoadBalancer` Service instead. Reserve `hostPort` for DaemonSet node-agent patterns with an explicit justification.

---

### `memory_limiter.limit_mib` exceeding the pod/container memory limit

When the collector's `limit_mib` is higher than the container's `resources.limits.memory`, the Go runtime can allocate beyond the cgroup limit before the limiter fires, causing the container to be OOM-killed with no graceful shedding.

**Fix:** Set `limit_mib` to roughly 80% of the container memory limit to leave headroom for the Go runtime and internal buffers.

---

### Backing `file_storage` queues with RWX/network filesystems

`file_storage` uses bbolt, which requires byte-level file locking via `flock(2)`. EFS, NFS, and CephFS (in network modes) do not provide reliable POSIX locks, leading to database corruption on multi-writer or failover scenarios.

**Fix:** Back `file_storage` with a `ReadWriteOnce` block-backed PVC (for example, `gp3` on EKS). Never use `ReadWriteMany` or NFS-class storage.

---

## Metrics Anti-Patterns

### `deltatocumulative` / `cumulativetodelta` without checking source temporality and backend expectations

These processors are stateful: they accumulate or differentiate metric state in memory. Restarting the collector resets that state, producing a discontinuous series. Running multiple replicas without sticky routing splits the state across instances.

**Fix:** Confirm source SDK temporality, the backend's expected temporality, restart tolerance, and replica routing before enabling temporality conversion processors. Add justification comments in the config.

---

### Using delta temporality with backends that expect cumulative

Some backends (VictoriaMetrics, OpenTSDB) silently drop delta-temporality metrics or misinterpret them as cumulative. The error is silent and data appears to disappear.

**Fix:** Check the backend's temporality contract. Use `deltatocumulative` in the collector if the SDK emits delta and the backend expects cumulative — but see the stateful conversion warning above.

---

## AI Agent Instrumentation Anti-Patterns

### Including `prompt.id` or `session.id` as metric dimensions

These identifiers are unbounded (a new value per agent invocation). Using them as metric label values creates cardinality explosions that degrade the metrics backend and increase cost without insight.

**Fix:** Use `prompt.id` and `session.id` as span/log attributes only, never as metric dimensions.

---

### Enabling `captureContent` / `OTEL_LOG_USER_PROMPTS` without PII controls

These settings log raw prompt and completion text. In shared or production environments this can expose user PII, secrets embedded in prompts, and proprietary code to the telemetry backend.

**Fix:** Keep content capture disabled by default. If required for debugging, enable only in isolated dev/staging environments with appropriate data governance controls.

---

### Assuming all AI coding agents emit traces

Claude Code and Codex-exec do not emit traces — they emit metrics and logs/events only. Configuring a traces pipeline as the sole signal path will silently discard all their telemetry.

**Fix:** Check the AI agent support matrix in [compatibility.md](compatibility.md) before designing the collector pipeline. Always include a metrics and logs pipeline alongside any traces pipeline.

---

### Hard-coding `gen_ai.token.type` handling to only `input`/`output` values

The GenAI semantic conventions include additional token type values (for example `cache_read`, `cache_creation`). Hard-coding only `input`/`output` silently drops cost attribution for cached tokens.

**Fix:** Use a default/catch-all branch for unknown `gen_ai.token.type` values rather than strict equality checks.

---

### Treating open-spec proposals as stable APIs before they ship in SDKs or collector releases

GenAI and AI agent SemConv proposals move quickly. Implementing attributes from draft proposals means breaking changes when the spec stabilizes.

**Fix:** Check the stability status in [compatibility.md](compatibility.md) before using new attributes in production instrumentation.

---

## OTTL / Transform Anti-Patterns

### Mixing OTTL attribute types or using legacy semantic convention keys

OTTL is strictly typed. Setting an attribute to a boolean and then matching it with `IsMatch(..., "true")` will silently fail. Using deprecated keys like `http.status_code` instead of `http.response.status_code` produces gaps when backends apply semantic convention normalization.

**Fix:** Use `Int()`, `String()`, `Bool()` converters explicitly in OTTL statements. Use current SemConv keys and validate with `otelcol validate`.
