# OpenTelemetry Sampling Strategies

## Overview

Sampling is the practice of selectively collecting traces to reduce volume and cost while maintaining observability. This reference provides deep technical guidance on head sampling, tail sampling, and the critical architectural requirements for production systems.

## Table of Contents

1. [Why Sampling?](#why-sampling)
2. [Head Sampling](#head-sampling)
3. [Tail Sampling](#tail-sampling)
4. [Sampling Math](#sampling-math)
5. [Architecture Requirements](#architecture-requirements)
6. [Configuration Examples](#configuration-examples)

---

## Why Sampling?

### The Cost Problem

**Production trace volume** at scale:
- 10,000 requests/second × 10 spans/request = 100,000 spans/second
- 100,000 spans/second × 60 seconds × 60 minutes × 24 hours = **8.64 billion spans/day**
- At $0.10 per million spans: **$864/day = $26,000/month**

**With 1% sampling**:
- 86.4 million spans/day
- $8.64/day = **$260/month** (99% cost reduction)

### The Trade-off

Sampling reduces cost but introduces **incomplete visibility**:
- ✅ Errors and slow requests: Keep 100%
- ✅ Rare endpoints: Keep 100%
- ⚠️ Normal requests: Keep 1-10%

**Goal**: Sample intelligently to minimize cost while maximizing signal.

---

## Head Sampling

**Head sampling** makes the sampling decision **at the start of the trace** (at the root span creation).

### How It Works

```
Request arrives → SDK generates trace_id → Hash(trace_id) % 100 < sampling_rate?
├─ YES → Trace is sampled (all spans are recorded)
└─ NO  → Trace is NOT sampled (no spans are recorded)
```

**Key Point**: The decision is made **before** any spans are created. If a trace is not sampled, **no spans are sent**.

### Advantages

✅ **Simple**: Easy to configure
✅ **Efficient**: No processing overhead (spans are never created)
✅ **Deterministic**: Same trace_id always produces the same decision
✅ **Distributed**: Works across microservices (via context propagation)

### Disadvantages

❌ **Blind to content**: Cannot sample based on span attributes (error status, latency)
❌ **Statistical**: May miss important traces (e.g., a rare error in an unsampled trace)

### Configuration: ParentBasedTraceIdRatio

**Always use `ParentBased`** to ensure downstream services respect upstream sampling decisions.

#### Python

```python
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.sampling import ParentBasedTraceIdRatio

# Sample 10% of traces
sampler = ParentBasedTraceIdRatio(0.1)

provider = TracerProvider(sampler=sampler)
```

#### Go

```go
import (
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

sampler := sdktrace.ParentBased(sdktrace.TraceIDRatioBased(0.1))

provider := sdktrace.NewTracerProvider(
    sdktrace.WithSampler(sampler),
)
```

#### Java

```java
import io.opentelemetry.sdk.trace.samplers.Sampler;

Sampler sampler = Sampler.parentBasedBuilder(Sampler.traceIdRatioBased(0.1)).build();

SdkTracerProvider provider = SdkTracerProvider.builder()
    .setSampler(sampler)
    .build();
```

#### Environment Variable

```bash
export OTEL_TRACES_SAMPLER=parentbased_traceidratio
export OTEL_TRACES_SAMPLER_ARG=0.1  # 10%
```

### Why ParentBased?

**Without ParentBased**:
```
Service A (sampled)   → Span A recorded ✅
Service B (not sampled) → Span B NOT recorded ❌
```
**Result**: Incomplete trace (broken trace graph)

**With ParentBased**:
```
Service A (sampled)   → Span A recorded ✅
Service B (inherits sampling decision) → Span B recorded ✅
```
**Result**: Complete trace

### When to Use Head Sampling

✅ **Low-traffic systems** (<1,000 RPS): Simple and effective
✅ **Cost-constrained environments**: Immediate volume reduction at SDK
✅ **Distributed systems**: ParentBased ensures trace completeness across services

---

## Tail Sampling

**Tail sampling** makes the sampling decision **after** all spans in a trace are collected, allowing intelligent decisions based on span content.

### How It Works

```
All spans collected → Assemble complete trace → Apply policies → Keep or Drop?
├─ ERROR status? → Keep 100%
├─ Latency > 500ms? → Keep 100%
├─ Rare endpoint? → Keep 100%
└─ Normal request → Keep 1%
```

**Key Point**: The collector **buffers all spans** for a trace, waits for the trace to complete, then decides.

### Advantages

✅ **Intelligent**: Keeps all errors, slow requests, and rare endpoints
✅ **Cost-optimized**: Drops boring traffic while retaining signals
✅ **Flexible**: Policy-based (error, latency, rate limiting)

### Disadvantages

❌ **Complex**: Requires stateful collector (sticky sessions)
❌ **Resource-intensive**: Must buffer spans in memory (high memory usage)
❌ **Latency**: Adds buffering delay (configurable, typically 10-30 seconds)

### Policies

The `tail_sampling` processor supports multiple policies:

| Policy | Description | Use Case |
|--------|-------------|----------|
| `always_sample` | Keep 100% | Debug mode |
| `status_code` | Keep if span status = ERROR | Error tracking |
| `latency` | Keep if duration > threshold | SLO monitoring |
| `rate_limiting` | Keep N spans/second | Traffic limiting |
| `string_attribute` | Keep if attribute matches regex | Feature flags, A/B tests |
| `probabilistic` | Keep X% | Cost reduction for normal traffic |
| `composite` | Combine multiple policies (OR logic) | Production systems |

### Configuration

```yaml
processors:
  tail_sampling:
    # Wait time before making decision
    decision_wait: 10s
    
    # Max spans in memory
    num_traces: 50000
    
    # Expected new traces per second
    expected_new_traces_per_sec: 1000
    
    policies:
      # Policy 1: Keep all errors
      - name: errors
        type: status_code
        status_code:
          status_codes: [ERROR]
      
      # Policy 2: Keep slow requests (>500ms)
      - name: slow_requests
        type: latency
        latency:
          threshold_ms: 500
      
      # Policy 3: Keep specific endpoints
      - name: checkout_endpoint
        type: string_attribute
        string_attribute:
          key: http.route
          values: ["/checkout", "/payment"]
          enabled_regex_matching: false
      
      # Policy 4: Sample 1% of normal traffic
      - name: probabilistic
        type: probabilistic
        probabilistic:
          sampling_percentage: 1

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, tail_sampling, batch]
      exporters: [otlp]
```

### Memory Sizing

**Formula**:
```
Memory (GB) = (num_traces × avg_spans_per_trace × avg_span_size) / 1,000,000,000
```

**Example**:
- `num_traces`: 50,000
- `avg_spans_per_trace`: 10
- `avg_span_size`: 1 KB

```
Memory = (50,000 × 10 × 1,000) / 1,000,000,000 = 0.5 GB
```

**Best Practice**: Set `num_traces` to handle `decision_wait` seconds of traffic:
```
num_traces = requests_per_second × decision_wait × spans_per_request
```

Example: 1,000 RPS × 10s × 10 spans = 100,000 traces

---

## Sampling Math

### Sampling Rate Calculation

**Goal**: Reduce to N spans/day

**Formula**:
```
sampling_rate = target_spans_per_day / current_spans_per_day
```

**Example**:
- Current: 8.64 billion spans/day
- Target: 86.4 million spans/day (1% of current)

```
sampling_rate = 86.4M / 8.64B = 0.01 = 1%
```

### Estimating Sampled Volume

**Formula**:
```
sampled_spans = total_spans × sampling_rate
```

**Example**:
- Total: 100,000 spans/second
- Sampling rate: 5%

```
sampled_spans = 100,000 × 0.05 = 5,000 spans/second
```

### Trace Completeness Probability

With **head sampling**, the probability that a multi-service trace is complete:

**Formula**:
```
P(complete) = sampling_rate ^ num_services
```

**Example** (3 microservices, 10% sampling):
```
P(complete) = 0.1^3 = 0.001 = 0.1%
```

**Conclusion**: Only 0.1% of traces will have all 3 services' spans.

**Solution**: Use `ParentBased` sampling to ensure 100% completion:
```
P(complete) = sampling_rate^1 = 0.1 = 10%
```

Now 10% of traces are sampled, and **all sampled traces are complete**.

---

## Architecture Requirements

### The Stickiness Requirement

**Critical**: Tail sampling requires **all spans of a trace to arrive at the same collector instance**.

#### Without Stickiness (BROKEN)

```
Span A (trace_id: 123) → Collector Pod 1 (buffers Span A, waits for Span B)
Span B (trace_id: 123) → Collector Pod 2 (buffers Span B, waits for Span A)

Decision Time:
- Pod 1: Incomplete trace (missing Span B) → Drops or makes wrong decision
- Pod 2: Incomplete trace (missing Span A) → Drops or makes wrong decision
```

**Result**: Data loss or incorrect sampling

#### With Stickiness (CORRECT)

```
Span A (trace_id: 123) → Collector Pod 1
Span B (trace_id: 123) → Collector Pod 1

Decision Time:
- Pod 1: Complete trace (has Span A + Span B) → Correct decision
```

### Solution: Load Balancing Exporter

Use a **two-tier architecture**:

```
Agent (with loadbalancing exporter) → Gateway (with tail_sampling processor)
```

**Agent Configuration**:

```yaml
exporters:
  loadbalancing:
    protocol:
      otlp:
        endpoint: placeholder
        tls:
          insecure: true
    routing_key: "traceID"  # Critical: ensures stickiness
    resolver:
      k8s:
        service: otel-gateway-headless
        ports:
          - 4317

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [loadbalancing]
```

**Gateway Configuration**:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  memory_limiter:
    limit_percentage: 80
    spike_limit_percentage: 20
  
  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
    expected_new_traces_per_sec: 1000
    policies:
      - name: errors
        type: status_code
        status_code: {status_codes: [ERROR]}
      - name: slow
        type: latency
        latency: {threshold_ms: 500}
      - name: default
        type: probabilistic
        probabilistic: {sampling_percentage: 1}
  
  batch:
    timeout: 10s
    send_batch_size: 1024

exporters:
  otlp:
    endpoint: backend.example.com:4317

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, tail_sampling, batch]
      exporters: [otlp]
```

**Headless Service**:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: otel-gateway-headless
spec:
  clusterIP: None  # Headless: returns pod IPs
  selector:
    app: otel-gateway
  ports:
  - name: otlp-grpc
    port: 4317
```

### Verification

Test stickiness with trace correlation:

```bash
# Generate traces with same trace_id from different agents
# All spans should end up on the same gateway pod

kubectl logs -l app=otel-gateway | grep "trace_id: 123abc"
```

All logs for `trace_id: 123abc` should come from the **same pod**.

---

## Configuration Examples

### Hybrid: Head + Tail Sampling

Combine both for optimal cost/signal:

1. **Head sampling at SDK**: Sample 10% at the application
2. **Tail sampling at gateway**: Keep 100% of errors/slow, 1% of normal

**Net effect**:
- Errors/slow: 10% sampled (SDK) × 100% kept (gateway) = **10% retained**
- Normal traffic: 10% sampled (SDK) × 1% kept (gateway) = **0.1% retained**

**Configuration**:

**SDK** (environment variables):
```bash
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
```

**Gateway**:
```yaml
processors:
  tail_sampling:
    policies:
      - name: errors
        type: status_code
        status_code: {status_codes: [ERROR]}
      - name: slow
        type: latency
        latency: {threshold_ms: 500}
      - name: default
        type: probabilistic
        probabilistic: {sampling_percentage: 1}
```

### Rate-Limited Sampling

Limit to N spans/second per service:

```yaml
processors:
  tail_sampling:
    policies:
      - name: rate_limit
        type: rate_limiting
        rate_limiting:
          spans_per_second: 100
```

### Custom Attribute Sampling

Keep traces with specific feature flags:

```yaml
processors:
  tail_sampling:
    policies:
      - name: beta_features
        type: string_attribute
        string_attribute:
          key: feature.flag
          values: ["beta_checkout", "new_ui"]
          enabled_regex_matching: false
```

---

## Reference Links

- **Sampling Documentation**: https://opentelemetry.io/docs/concepts/sampling/
- **Tail Sampling Processor**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor
- **Probabilistic Sampler**: https://opentelemetry.io/docs/specs/otel/trace/sdk/#parentbased
- **Load Balancing Exporter**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/loadbalancingexporter

---

## Summary

✅ Use **head sampling** (ParentBasedTraceIdRatio) for simple, distributed sampling
✅ Use **tail sampling** for intelligent, policy-based sampling (errors, latency)
✅ Always use **ParentBased** to ensure trace completeness across services
✅ Use **loadbalancing exporter with routing_key: traceID** for tail sampling stickiness
✅ Deploy **two-tier architecture** (Agent with loadbalancing → Gateway with tail_sampling)
✅ Size tail_sampling memory: `num_traces = RPS × decision_wait × spans_per_trace`
✅ Monitor `otelcol_processor_tail_sampling_policy_decision` metrics

**Sampling is not about throwing away data—it's about keeping the right data at the right cost.**
