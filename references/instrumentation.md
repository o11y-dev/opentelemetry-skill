# OpenTelemetry Instrumentation & Semantic Conventions

## Overview

Instrumentation is the process of adding observability to application code. This reference provides comprehensive guidance on auto vs manual instrumentation, semantic conventions enforcement, and the critical challenge of **cardinality management**—the #1 cost driver in observability systems.

## Table of Contents

1. [Instrumentation Strategies](#instrumentation-strategies)
2. [Semantic Conventions](#semantic-conventions)
3. [Cardinality Management](#cardinality-management)
4. [Language-Specific Patterns](#language-specific-patterns)
5. [Best Practices](#best-practices)

---

## Instrumentation Strategies

### Auto-Instrumentation vs Manual Instrumentation

| Aspect | Auto-Instrumentation | Manual Instrumentation |
|--------|----------------------|------------------------|
| **Speed to Value** | ⚡ Minutes | 🐢 Days/Weeks |
| **Code Changes** | Zero (agent-based) | Extensive (SDK integration) |
| **Coverage** | Frameworks only (HTTP, DB, gRPC) | Business logic + frameworks |
| **Control** | Limited (configuration-based) | Full (code-level) |
| **Cardinality Risk** | ⚠️ High (auto-captures everything) | ✅ Low (explicit control) |
| **Performance Overhead** | 2-10% (bytecode manipulation) | <1% (optimized spans) |
| **Best For** | Getting started, brownfield apps | Production systems, domain logic |

### The Hybrid Pattern (Recommended)

**Step 1: Auto-Instrument** to get immediate value:
- HTTP request/response traces
- Database query spans
- External API calls

**Step 2: Manually Instrument** business-critical flows:
- `process_payment` spans with transaction amounts
- `fraud_detection` spans with risk scores
- `inventory_check` spans with SKU and quantity

### Auto-Instrumentation Setup

#### Java (OpenTelemetry Java Agent)

```bash
# Download the agent
wget https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar

# Run with agent
java -javaagent:opentelemetry-javaagent.jar \
     -Dotel.service.name=myapp \
     -Dotel.exporter.otlp.endpoint=http://otel-collector:4317 \
     -jar myapp.jar
```

#### Python (opentelemetry-instrument)

```bash
pip install opentelemetry-distro opentelemetry-exporter-otlp

opentelemetry-bootstrap -a install

opentelemetry-instrument \
    --service_name myapp \
    --exporter_otlp_endpoint http://otel-collector:4317 \
    python app.py
```

#### Node.js (Auto-Instrumentation SDK)

```javascript
// tracing.js - Load BEFORE app code
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
  ],
});
```

```bash
node -r ./tracing.js app.js
```

### Manual Instrumentation

#### Creating Spans

**Python**:
```python
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

tracer = trace.get_tracer(__name__)

def process_payment(user_id, amount):
    with tracer.start_as_current_span("process_payment") as span:
        span.set_attribute("user.id", user_id)
        span.set_attribute("payment.amount", amount)
        span.set_attribute("payment.currency", "USD")
        
        try:
            result = charge_credit_card(amount)
            span.set_attribute("payment.status", "success")
            return result
        except Exception as e:
            span.set_status(Status(StatusCode.ERROR, str(e)))
            span.record_exception(e)
            raise
```

**Go**:
```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/codes"
)

func processPayment(ctx context.Context, userID string, amount float64) error {
    tracer := otel.Tracer("payment-service")
    ctx, span := tracer.Start(ctx, "process_payment")
    defer span.End()
    
    span.SetAttributes(
        attribute.String("user.id", userID),
        attribute.Float64("payment.amount", amount),
        attribute.String("payment.currency", "USD"),
    )
    
    if err := chargeCreditCard(ctx, amount); err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
        return err
    }
    
    span.SetAttributes(attribute.String("payment.status", "success"))
    return nil
}
```

**Java**:
```java
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;

public class PaymentService {
    private final Tracer tracer;
    
    public void processPayment(String userId, double amount) {
        Span span = tracer.spanBuilder("process_payment").startSpan();
        try (Scope scope = span.makeCurrent()) {
            span.setAttribute("user.id", userId);
            span.setAttribute("payment.amount", amount);
            span.setAttribute("payment.currency", "USD");
            
            chargeCreditCard(amount);
            span.setAttribute("payment.status", "success");
        } catch (Exception e) {
            span.recordException(e);
            span.setStatus(StatusCode.ERROR, e.getMessage());
            throw e;
        } finally {
            span.end();
        }
    }
}
```

---

## Semantic Conventions

**Semantic Conventions** are the OpenTelemetry "type system"—standardized attribute names that ensure data consistency across languages and vendors.

### Why They Matter

❌ **Without conventions**:
- Service A uses legacy `http.method`, Service B uses `http_verb`, Service C uses `request.method`
- Queries become impossible: `WHERE http.request.method = 'POST' OR http.method = 'POST' OR request.method = 'POST'`

✅ **With conventions**:
- All services use `http.request.method`
- Query: `WHERE http.request.method = 'POST'`

### Core Semantic Convention Categories

| Category | Attributes | Example |
|----------|-----------|---------|
| **HTTP** | `http.request.method`, `http.response.status_code`, `http.route` | `http.request.method = "POST"` |
| **Database** | `db.system`, `db.statement`, `db.name` | `db.system = "postgresql"` |
| **RPC/gRPC** | `rpc.system`, `rpc.service`, `rpc.method` | `rpc.method = "GetUser"` |
| **Messaging** | `messaging.system`, `messaging.destination`, `messaging.operation` | `messaging.system = "kafka"` |
| **Network** | `network.protocol.name`, `network.protocol.version` | `network.protocol.name = "http"` |
| **Cloud** | `cloud.provider`, `cloud.platform`, `cloud.region` | `cloud.provider = "aws"` |
| **GenAI** | `gen_ai.system`, `gen_ai.operation.name`, `gen_ai.request.model` | `gen_ai.system = "openai"` |
| **Events** | `event.name`, structured log body | `event.name = "user.login"` |

### HTTP Semantic Conventions

```python
from opentelemetry.semconv.trace import SpanAttributes

span.set_attribute(SpanAttributes.HTTP_REQUEST_METHOD, "POST")
span.set_attribute(SpanAttributes.HTTP_ROUTE, "/api/users/{id}")
span.set_attribute(SpanAttributes.HTTP_RESPONSE_STATUS_CODE, 200)
span.set_attribute(SpanAttributes.HTTP_REQUEST_BODY_SIZE, 1024)
span.set_attribute(SpanAttributes.SERVER_ADDRESS, "api.example.com")
span.set_attribute(SpanAttributes.SERVER_PORT, 443)
span.set_attribute(SpanAttributes.URL_SCHEME, "https")
span.set_attribute(SpanAttributes.URL_PATH, "/api/users/123")
```

#### Intentional Client Cancellations

If an HTTP client instrumentation can determine that a request was **intentionally canceled by the caller** (for example, a browser abort, a user navigation, or an application-level timeout that the caller explicitly triggered), keep the span status as **`UNSET`** rather than `ERROR`. Record the HTTP attributes that are still known (`http.request.method`, `server.address`, `url.path`, etc.), but only set `http.response.status_code` if a response was actually received.

This follows the current semantic convention clarification tracked in [semantic-conventions#3495](https://github.com/open-telemetry/semantic-conventions/issues/3495) and avoids polluting error-rate dashboards with user-driven aborts that did not represent backend failures.

### Database Semantic Conventions

```python
span.set_attribute(SpanAttributes.DB_SYSTEM, "postgresql")
span.set_attribute(SpanAttributes.DB_NAME, "orders")
span.set_attribute(SpanAttributes.DB_STATEMENT, "SELECT * FROM orders WHERE user_id = $1")
span.set_attribute(SpanAttributes.DB_OPERATION, "SELECT")
span.set_attribute(SpanAttributes.SERVER_ADDRESS, "db.example.com")
span.set_attribute(SpanAttributes.SERVER_PORT, 5432)
```

### GenAI Semantic Conventions (v1.27.0+)

The `gen_ai/` namespace covers Generative AI operations (LLM calls, embeddings, etc.):

```python
# Instrumenting an LLM API call (e.g., OpenAI Chat Completions)
with tracer.start_as_current_span("chat.completion") as span:
    span.set_attribute("gen_ai.system", "openai")           # ai system identifier
    span.set_attribute("gen_ai.operation.name", "chat")     # "chat", "text_completion", "embeddings"
    span.set_attribute("gen_ai.request.model", "gpt-4o")    # requested model
    span.set_attribute("gen_ai.request.max_tokens", 1024)
    span.set_attribute("gen_ai.request.temperature", 0.7)

    response = client.chat.completions.create(...)

    span.set_attribute("gen_ai.response.model", response.model)     # actual model used
    span.set_attribute("gen_ai.usage.input_tokens", response.usage.prompt_tokens)
    span.set_attribute("gen_ai.usage.output_tokens", response.usage.completion_tokens)
    span.set_attribute("gen_ai.response.finish_reasons", [response.choices[0].finish_reason])
```

**Key GenAI attributes**:

| Attribute | Type | Description |
|-----------|------|-------------|
| `gen_ai.system` | string | AI provider (`openai`, `anthropic`, `vertex_ai`, `aws_bedrock`) |
| `gen_ai.operation.name` | string | Operation type (`chat`, `text_completion`, `embeddings`) |
| `gen_ai.request.model` | string | Requested model name |
| `gen_ai.response.model` | string | Actual model used (may differ from request) |
| `gen_ai.usage.input_tokens` | int | Tokens consumed in the prompt |
| `gen_ai.usage.output_tokens` | int | Tokens generated in the response |
| `gen_ai.request.max_tokens` | int | Token limit for the response |
| `gen_ai.request.temperature` | double | Sampling temperature |
| `gen_ai.response.finish_reasons` | string[] | Reason generation stopped |

> ⚠️ **Stability note for skill orchestration spans**: the upstream proposal to
> add `gen_ai.skill` spans and `gen_ai.skill.*` attributes is still open in
> [semantic-conventions#3540](https://github.com/open-telemetry/semantic-conventions/issues/3540).
> Do **not** assume those names are stable yet. If you need to observe an
> internal skill lifecycle today, use an internal or experimental span name and
> your own span-attribute namespace so the data can be remapped later without
> breaking dashboards or stored queries.

⚠️ **Cardinality warning**: `gen_ai.request.model` has bounded cardinality (~10-50 models) and is safe as a metric dimension. Do NOT use `gen_ai.request.messages` or response content as metric dimensions.

**Token cost metrics**:
```python
# Use metrics to track token usage for cost attribution
token_counter = meter.create_counter(
    "gen_ai.client.token.usage",
    unit="{token}",
    description="Number of tokens used in GenAI operations",
)
token_counter.add(
    response.usage.total_tokens,
    {
        "gen_ai.system": "openai",
        "gen_ai.operation.name": "chat",
        "gen_ai.token.type": "total",  # Common values include total/input/output; cache/reasoning buckets may appear as semantic conventions evolve
    }
)
```

> ⚠️ **Do not hard-code GenAI metrics to only `input` / `output` token classes.** The GenAI semantic conventions are expanding to cover finer-grained token accounting (for example cache-hit and reasoning tokens). Preserve unknown `gen_ai.token.type` values in telemetry pipelines and handle grouping in dashboards or collector transforms instead of dropping new categories.

### Declarative Configuration: Verify the Effective Resource via Emitted Telemetry

When an SDK is initialized from **declarative configuration**, there is not yet a stable cross-language API to read back the final merged `Resource` after config files, environment variables, and resource detectors are applied.

**Practical guidance**:
- Keep critical resource attributes (`service.name`, `deployment.environment.name`, ownership tags) explicit in config instead of relying on implicit detector merge order.
- Verify the effective `Resource` through emitted telemetry, collector debug output, or integration tests — not by assuming the SDK exposes a post-merge resource object.
- If you need downstream routing or access control based on resource attributes, test the serialized OTLP output end to end before promoting a declarative config change.

### Events Semantic Conventions (v1.32.0+)

**Events** are a specialized log sub-type with a required `event.name` attribute, used for structured domain events (as distinct from free-text log messages).

```python
# Using the Python logging bridge (recommended pattern for events)
import logging
from opentelemetry.sdk.logs import LoggerProvider
from opentelemetry.sdk.logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter

# Configure logger provider
logger_provider = LoggerProvider()
logger_provider.add_log_record_processor(
    BatchLogRecordProcessor(OTLPLogExporter())
)

# Get an OTel-aware logger
otel_logger = logger_provider.get_logger("my-service", version="1.0.0")

# Emit a structured event: set event.name as a structured attribute
# The standard way to emit events varies by SDK version.
# Use the OTTL transform processor in the collector to normalize
# custom log records to events by adding event.name:
```

```yaml
# Collector: promote structured log records to events via transform
processors:
  transform:
    log_statements:
      - context: log
        statements:
          # Any log record with a "type" attribute becomes an event
          - set(attributes["event.name"], attributes["type"]) where attributes["type"] != nil
          - delete_key(attributes, "type") where attributes["event.name"] != nil
```

**Alternative: Java SDK Event API (SDK 1.40.0+)**

```java
// Java SDK has a first-class Events API via the event bridge
import io.opentelemetry.api.events.EventEmitter;
import io.opentelemetry.api.events.EventEmitterProvider;

EventEmitter emitter = EventEmitterProvider.noop()
    .eventEmitterBuilder("my-service")
    .setInstrumentationVersion("1.0.0")
    .build();

// Emit a structured event
emitter.emit("user.login",                // event.name
    Attributes.builder()
        .put("auth.method", "oauth2")
        .put("session.id", "sess-abc")
        .build()
);
```

**Key Event rules**:
- `event.name` is **required** and must be a low-cardinality, dot-separated namespace string (e.g., `user.login`, `order.placed`, `payment.failed`)
- Event names follow the `<domain>.<action>` pattern
- Events are **not** free-text log messages — use structured attributes for all data
- Events are correlated to traces via the active span context (trace_id, span_id)

⚠️ **Do NOT use `event.name` as a metric dimension** if it has more than ~100 unique values.

### ⚠️ Span Events API Deprecation: Migrate to Logs

OpenTelemetry announced the deprecation of the **Span Event API** in the
official March 17, 2026 blog post
[Deprecating Span Events API](https://opentelemetry.io/blog/2026/deprecating-span-events/).
The corresponding migration plan is captured in
[OTEP 4430](https://github.com/open-telemetry/opentelemetry-specification/blob/fd43145dde7e5192ebc59a20992d98a3e6af5553/oteps/4430-span-event-api-deprecation-plan.md).

Additional event-to-logs related proposals are under discussion (for example
`Span.SetErrorStatus`, `AlwaysStackTrace` / `NeverStackTrace`, and built-in
event-routing processors in the spec issue tracker). Treat these as
**non-stable design signals** until they are accepted in the specification and
implemented in your target SDK/collector version.

The important distinction is that OpenTelemetry is deprecating the **API used to
record new span events** — methods such as `Span.AddEvent` and
`Span.RecordException` — not the ability for backends to keep showing events in
trace-oriented views. New code should prefer **log-based events** correlated with
the active span context.

### What to Change

| Current pattern | Recommended direction |
|----------------|-----------------------|
| `span.add_event("user.login", attrs)` | Emit a log/event with `event.name="user.login"` while the span is current |
| `span.record_exception(err)` | Emit a structured exception log/event and still set span status for the operation outcome |
| New semantic convention examples based on span events | Define the event as a log record with `event.name` plus structured attributes |

### Migration Checklist

1. **Inventory existing usage** of `AddEvent`, `RecordException`, and any custom instrumentation that models domain events as span events.
2. **Do not force a flag day**: keep existing stable instrumentation behavior until your SDK, instrumentation library, and backend support log-based events cleanly.
3. **Write new events through the Logs API** (or a logging bridge) using `event.name` and structured attributes, while ensuring the active span context is present so `trace_id` and `span_id` are attached.
4. **Keep span status semantics separate** from event emission. Exceptions and failures still need proper span status (`ERROR` for real failures, `UNSET` for intentional cancellations); the event payload should move to logs.
5. **Verify the backend experience** after upgrades: confirm correlated log-based events still appear in the span timeline, exception view, or investigation workflow your teams rely on.
6. **Keep collector log pipelines ready**. If you previously treated traces as the only source of exception/event data, ensure logs are received, filtered, routed, and exported with the same retention and access controls.

### Practical Migration Pattern

Use this pattern when replacing new span events with log-based events:

```python
import logging
from opentelemetry import trace

tracer = trace.get_tracer(__name__)
logger = logging.getLogger("payment-events")

with tracer.start_as_current_span("process_payment") as span:
    try:
        charge_credit_card(amount)
    except Exception as exc:
        span.set_status(Status(StatusCode.ERROR, str(exc)))
        logger.exception(
            "payment.failed",
            extra={
                "event.name": "payment.failed",
                "payment.amount": amount,
                "error.type": type(exc).__name__,
            },
        )
        raise
```

This keeps the **operation state** on the span while moving the **event payload**
to logs. If your language SDK offers a compatibility bridge that projects
log-based events back into span views, prefer that over adding new span events.

### How to Monitor Future Deprecations

- **Official announcement stream**: watch the OpenTelemetry blog feed at `https://opentelemetry.io/blog/index.xml` for blog posts like the March 2026 deprecation announcement.
- **Specification change stream**: watch the `open-telemetry/opentelemetry-specification` repository for OTEPs, release notes, and deprecation PRs affecting tracing, logs, and semantic conventions.
- **Community migration feedback**: watch `open-telemetry/community` for follow-up discussions such as [community#3312](https://github.com/open-telemetry/community/issues/3312).
- **Repository automation**: this repository's weekly maintenance workflow (`.github/workflows/otel-upstream-maintenance.yml`) already fetches the OpenTelemetry blog RSS feed and upstream risk signals; use its digest issue as the first place to review deprecations that may require doc updates.

### Kubernetes Semantic Conventions (`release_candidate` in v1.30+)

The `k8s.*` attribute namespace has been promoted to **`release_candidate`** stability ([semantic-conventions#3380](https://github.com/open-telemetry/semantic-conventions/issues/3380)), meaning attribute names are stable and backend support is expected. This makes it safe to rely on these names in production instrumentation and collector enrichment (via `k8sattributes` processor).

**Cardinality guidance for k8s attributes as metric dimensions**:

| Attribute | Cardinality | Safe as metric dimension? |
|-----------|-------------|---------------------------|
| `k8s.namespace.name` | ~10–100 | ✅ Yes — bounded |
| `k8s.deployment.name` | ~10–500 | ✅ Yes — bounded |
| `k8s.daemonset.name` | ~10–100 | ✅ Yes — bounded |
| `k8s.statefulset.name` | ~10–100 | ✅ Yes — bounded |
| `k8s.node.name` | ~10–1000 | ⚠️ Use with caution — large clusters may exceed Rule of 100 |
| `k8s.pod.name` | Potentially thousands | ❌ **NO** — use in traces/logs only |
| `k8s.pod.uid` | Unbounded | ❌ **NO** — never use in metrics |
| `k8s.container.name` | ~5–20 per pod | ✅ Yes — bounded |

> ⚠️ **Node-level cardinality**: In clusters with >100 nodes, `k8s.node.name` exceeds the Rule of 100. Avoid using it as a metric dimension in large clusters; use it in traces/logs for per-node debugging instead.

**Recommended attributes for k8s-enriched metrics** (via `k8sattributes` processor):
```yaml
processors:
  k8sattributes:
    auth_type: "serviceAccount"
    extract:
      metadata:
        - k8s.namespace.name      # ✅ safe metric dimension
        - k8s.deployment.name     # ✅ safe metric dimension
        - k8s.node.name           # ⚠️ only for small clusters
        - k8s.pod.name            # ❌ traces/logs only
        - k8s.pod.uid             # ❌ never in metrics
        - k8s.container.name      # ✅ safe metric dimension
```

### Common Mistakes

❌ `span.set_attribute("db.type", "postgres")` → ✅ `db.system = "postgresql"`
❌ `span.set_attribute("url.full", "https://api.example.com/users/123?token=secret")` → ✅ Prefer `http.route` and `url.path` for server spans; only emit sanitized `url.full`
❌ `span.set_attribute("service", "frontend")` → ✅ Use Resource attribute `service.name`
❌ `span.set_attribute("http_method", "GET")` → ✅ `http.request.method = "GET"`

### Enforcement in Collector

Use the `transform` processor to enforce conventions:

```yaml
processors:
  transform:
    error_mode: ignore
    trace_statements:
      - context: span
        statements:
          # Rename non-standard attributes
          - set(attributes["http.request.method"], attributes["http_method"]) where attributes["http_method"] != nil
          - delete_key(attributes, "http_method") where attributes["http_method"] != nil
```

---

## Cardinality Management

**Cardinality** is the number of unique values an attribute can have. High cardinality in metrics is the #1 cause of cost overruns.

### The Problem

Metrics backends (Prometheus, Datadog, New Relic) store **one time series per unique combination of label values**.

**Example**:
```
http_requests_total{method="GET", status="200", user_id="user_1"} 1
http_requests_total{method="GET", status="200", user_id="user_2"} 1
...
http_requests_total{method="GET", status="200", user_id="user_1000000"} 1
```

**Result**: 1,000,000 time series for a single metric → Storage explosion

### The Rule of 100

**Rule**: If an attribute has **more than 100 unique values**, it should **NOT** be a metric dimension.

| Attribute | Cardinality | Metric? | Alternative |
|-----------|-------------|---------|-------------|
| `http.request.method` | ~10 (GET, POST, PUT...) | ✅ Yes | N/A |
| `http.response.status_code` | ~60 (200, 404, 500...) | ✅ Yes | N/A |
| `region` | ~30 (us-east-1, eu-west-1...) | ✅ Yes | N/A |
| `user_id` | 1,000,000+ | ❌ **NO** | Use in traces/logs |
| `trace_id` | Infinite | ❌ **NO** | Use in traces only |
| `request_id` | Infinite | ❌ **NO** | Use in traces/logs |
| `session_id` | 100,000+ | ❌ **NO** | Use in traces/logs |
| `customer_email` | 1,000,000+ | ❌ **NO** | Use in traces/logs (redacted) |

### High-Cardinality Examples (BAD)

❌ **Metric with user_id**:
```python
counter = meter.create_counter("api_requests")
counter.add(1, {"user_id": user_id})  # Creates 1M+ time series
```

❌ **Metric with URL path** (unbounded):
```python
counter.add(1, {"url.path": "/users/123/orders/456"})  # Infinite cardinality
```

### Low-Cardinality Alternatives (GOOD)

✅ **Use `http.route` instead of raw `url.path`**:
```python
counter.add(1, {"http.route": "/users/{id}/orders/{order_id}"})  # Bounded
```

✅ **Use traces for user_id**:
```python
# Metric (aggregated)
counter = meter.create_counter("api_requests")
counter.add(1, {"method": "GET", "status": "200"})

# Trace (detailed)
span.set_attribute("user.id", user_id)
```

### Detecting High Cardinality

**In Prometheus**:
```promql
# Count unique label values
count(count by (label_name) (metric_name))

# Example
count(count by (user_id) (http_requests_total))  # If >1000, it's high cardinality
```

**In Collector**:
Use the `filter` processor to drop high-cardinality attributes:

```yaml
processors:
  filter:
    metrics:
      datapoint:
        # Drop user_id from metrics
        - 'attributes["user_id"] != nil'
```

### SDK Views for Cardinality Control

**Python**:
```python
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.view import View

# Drop high-cardinality attributes
view = View(
    instrument_name="http.server.request.duration",
    attribute_keys=["http.request.method", "http.response.status_code", "http.route"]
    # user_id is NOT in the list → dropped
)

provider = MeterProvider(views=[view])
```

**Go**:
```go
import (
    "go.opentelemetry.io/otel/sdk/metric"
)

provider := metric.NewMeterProvider(
    metric.WithView(
        metric.NewView(
            metric.Instrument{Name: "http.server.request.duration"},
            metric.Stream{
                AttributeFilter: attribute.NewAllowKeysFilter(
                    "http.request.method",
                    "http.response.status_code",
                    "http.route",
                    // user_id is NOT in the list → dropped
                ),
            },
        ),
    ),
)
```

---

## Language-Specific Patterns

### Python: Context Propagation

```python
from opentelemetry import trace
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

# Extract context from incoming HTTP headers
propagator = TraceContextTextMapPropagator()
context = propagator.extract(carrier=request.headers)

# Start a span with the extracted context
with tracer.start_as_current_span("handle_request", context=context) as span:
    # Process request
    pass
```

### Go: Context Propagation

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/propagation"
)

// Extract context from HTTP headers
propagator := otel.GetTextMapPropagator()
ctx := propagator.Extract(r.Context(), propagation.HeaderCarrier(r.Header))

// Start a span with the extracted context
ctx, span := tracer.Start(ctx, "handle_request")
defer span.End()
```

### Java: Spring Boot Integration

```java
@Configuration
public class OpenTelemetryConfig {
    @Bean
    public OpenTelemetry openTelemetry() {
        return AutoConfiguredOpenTelemetrySdk.initialize()
            .getOpenTelemetrySdk();
    }
}

@RestController
public class UserController {
    @Autowired
    private Tracer tracer;
    
    @GetMapping("/users/{id}")
    public User getUser(@PathVariable String id) {
        Span span = tracer.spanBuilder("get_user")
            .setAttribute("user.id", id)
            .startSpan();
        try (Scope scope = span.makeCurrent()) {
            return userService.findById(id);
        } finally {
            span.end();
        }
    }
}
```

### Node.js: Express Middleware

```javascript
const { trace } = require('@opentelemetry/api');

app.use((req, res, next) => {
    const tracer = trace.getTracer('express-app');
    const span = tracer.startSpan('custom_middleware');
    
    span.setAttribute('http.route', req.route?.path || 'unknown');
    span.setAttribute('user.id', req.user?.id);
    
    res.on('finish', () => {
        span.setAttribute('http.response.status_code', res.statusCode);
        span.end();
    });
    
    next();
});
```

---

## Best Practices

### ✅ DO

1. **Use Semantic Conventions**: Always use standard attribute names
2. **Control Cardinality**: Never use unbounded attributes (user_id, trace_id) in metrics
3. **Enrich Business Context**: Add business-meaningful attributes (`order.value`, `fraud.score`)
4. **Propagate Context**: Use W3C Trace Context headers for distributed tracing
5. **Record Exceptions Carefully**: Prefer log-based exception events for new code, and use `span.record_exception(e)` only where your current SDK/instrumentation still relies on the legacy span event API
6. **Set Status Thoughtfully**: Use `span.set_status(StatusCode.ERROR)` for real failures, but leave spans `UNSET` for intentional client-side cancellations
7. **Use Views**: Filter high-cardinality attributes at the SDK level
8. **Use Baggage Intentionally**: Leverage baggage for low-cardinality cross-cutting attributes (e.g., tenant, release) and avoid storing PII or unbounded values
9. **Keep Instrumentation Vendor-Neutral**: Default to OTLP and semantic conventions; avoid backend-specific attributes unless gated
10. **Name Scopes Clearly**: Use unique `instrumentation_scope` names and versions (e.g., `my-company-http-client@1.2.0`) to trace signal provenance
11. **Separate Library vs App Packaging**:
    - **Library**: Depend only on the OpenTelemetry **API**, stay silent until the host app wires an SDK
    - **Application**: Bundle SDK + exporters/resources/samplers in a single “init” entry point (e.g., `MyCompanyOTel.Initialize()`)
12. **Expose a Single Setup Path**: Provide a thin initializer that configures propagators (TraceContext/Baggage), OTLP exporters, resource attributes, and sampling defaults
13. **Auto-Instrument Safely**: When wrapping frameworks, use monkey-patching/wrappers that start/stop spans and enrich with semantic attributes; guard against double-instrumentation
14. **Context Propagation Everywhere**: Ensure inbound/outbound HTTP/RPC handlers extract/inject context so traces stitch across services

### ❌ DON'T

1. **Don't Ignore Conventions**: Avoid custom attribute names (`my_method` instead of `http.request.method`)
2. **Don't Over-Instrument**: Avoid spans for trivial operations (<1ms)
3. **Don't Capture PII**: Redact sensitive data (`credit_card`, `ssn`, `password`)
4. **Don't Block Threads**: Ensure instrumentation is async and non-blocking
5. **Don't Create Unbounded Metrics**: No user_id, request_id, or trace_id in metric labels
6. **Don't Instrument Libraries**: Use auto-instrumentation for frameworks
7. **Don't Forget Sampling**: Always configure sampling in high-traffic systems

---

## Version-Specific Notes

### Go SDK 1.40.0+

⚠️ **Non-Backward-Compatible Change**: Go SDK version 1.40.0 includes breaking changes to sampling and propagation behavior. If upgrading from an earlier version:

- **Re-test instrumentation examples**: Verify that `ParentBased` and `TraceIDRatio` samplers work as expected in your environment
- **Verify custom propagators/samplers**: If you have custom implementations, test thoroughly on 1.40.x
- **Pin or upgrade together**: Avoid mixing SDK minor versions (e.g., 1.39.x and 1.40.x) in the same service graph to prevent inconsistent sampling/propagation behavior
- **Choose the OTLP protocol explicitly in Go unless you use `autoexport`**: In Go, this is generally determined by the exporter package you configure, not automatically by `OTEL_EXPORTER_OTLP_PROTOCOL` alone ([opentelemetry-go#8091](https://github.com/open-telemetry/opentelemetry-go/issues/8091)). Use the `*grpc` or `*http` exporter packages explicitly—for example, `otlptracegrpc` / `otlpmetricgrpc` for gRPC or `otlptracehttp` / `otlpmetrichttp` for HTTP—or adopt `go.opentelemetry.io/contrib/exporters/autoexport` if you need environment-driven protocol selection.

**Recommendation**: Pin dependencies to a specific minor version or upgrade all services together to 1.40.x+.

### Python SDK 1.40.0+

- **Logging bridge change**: `opentelemetry-sdk` now deprecates `LoggingHandler` in favor of `opentelemetry-instrumentation-logging`. Prefer the instrumentation package for stdlib logging bridge setups on new deployments.
- **Pin GenAI packages together**: `opentelemetry-instrumentation-langchain` and `opentelemetry-semantic-conventions-ai` must be tested and pinned together. [semantic-conventions#3520](https://github.com/open-telemetry/semantic-conventions/issues/3520) reports import errors for mismatched versions (`0.53.0` + `0.4.15`).
- **Semconv alignment**: Python SDK 1.40.0 bumps bundled semantic conventions to v1.40.0, so review any older examples that still reference legacy HTTP attribute names.

---

## Cumulative Metrics: StartTimeUnixNano Requirements

The OpenTelemetry specification ([#4184](https://github.com/open-telemetry/opentelemetry-specification/issues/4184)) clarifies that **cumulative data points must set `StartTimeUnixNano` to the start of the measurement period for each timeseries** — not zero, and not the current collection timestamp.

### Why It Matters

Backends use `StartTimeUnixNano` to:
- **Detect resets**: If the start time advances unexpectedly, the backend knows the counter was reset (e.g., process restart).
- **Calculate rates correctly**: Rate calculations over a window require knowing when the accumulation began.

### What to Check

| Signal Type | Temporality | `StartTimeUnixNano` Expected Value |
|------------|-------------|-------------------------------------|
| Counter (Sum) | Cumulative | Timestamp of first observation for this timeseries |
| Histogram | Cumulative | Timestamp of first observation for this timeseries |
| Gauge | N/A (stateless) | Typically 0 or omitted |

### SDK Behavior

Most SDKs (Java, Python, Go) set `StartTimeUnixNano` correctly for SDK-created instruments. However, custom metric producers (e.g., custom exporters, OTLP bridge from Prometheus) must explicitly set this field.

⚠️ **Common mistake**: Setting `StartTimeUnixNano = 0` or `StartTimeUnixNano = collection_time` on cumulative metrics causes backends to misidentify resets and produce incorrect rate graphs.

**If using Prometheus → OTLP bridge**: Ensure the Prometheus scraper preserves the `process_start_time_seconds` metric so the collector's [prometheusreceiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/prometheusreceiver) can map it to `StartTimeUnixNano` for cumulative counters. The fix tracking `StartTimeUnixNano` per-timeseries correctness in the Prometheus receiver is tracked in the spec under [#4184](https://github.com/open-telemetry/opentelemetry-specification/issues/4184); verify your collector version is v0.146.0+ and that `use_start_time_metric: true` is set in the `prometheusreceiver` config if scraping Prometheus exporters that emit `process_start_time_seconds`.

---

## Complex Attribute Types

OpenTelemetry is expanding support for complex attribute types — EMPTY, BYTES, SLICE, and MAP — tracked in the Go SDK under issues [#7932](https://github.com/open-telemetry/opentelemetry-go/issues/7932), [#7933](https://github.com/open-telemetry/opentelemetry-go/issues/7933), [#7934](https://github.com/open-telemetry/opentelemetry-go/issues/7934), and [#7935](https://github.com/open-telemetry/opentelemetry-go/issues/7935) (targeting Go SDK v1.42.0). This extends complex types — which were previously only available in logs — to **all signals (traces, metrics, logs)**.

See the [OTel blog post on complex attribute types](https://opentelemetry.io/blog/2025/complex-attribute-types/) for full context.

### New Attribute Types

| Type | Description |
|------|-------------|
| `EMPTY` | Explicitly null/absent attribute value |
| `BYTES` | Raw byte array (e.g., binary IDs, encoded payloads) |
| `SLICE` | Ordered list of attribute values |
| `MAP` | Key-value map of nested attribute values |

### Usage Guidance

⚠️ **Backend compatibility varies**: Not all backends and exporters handle complex attribute types equally. Some may flatten, silently drop, or fail to index nested `SLICE` and `MAP` data.

- **Prefer flat, primitive attributes for metric dimensions** (counters, histograms, gauges): metrics backends optimized for label cardinality often cannot efficiently store or query nested structures.
- **Use complex types (SLICE, MAP, BYTES) for traces and logs** where your backend explicitly supports structured attribute querying.
- **Test your export pipeline end-to-end** before relying on complex attribute types in production — check that the exporter serializes them and the backend indexes them as expected.

---

## Reference Links

- **Instrumentation Documentation**: https://opentelemetry.io/docs/instrumentation/
- **Semantic Conventions**: https://opentelemetry.io/docs/specs/semconv/
- **GenAI Semantic Conventions**: https://opentelemetry.io/docs/specs/semconv/gen-ai/
- **Events Semantic Conventions**: https://opentelemetry.io/docs/specs/semconv/general/events/
- **Deprecating Span Events API**: https://opentelemetry.io/blog/2026/deprecating-span-events/
- **OTEP 4430: Span Event API deprecation plan**: https://github.com/open-telemetry/opentelemetry-specification/blob/fd43145dde7e5192ebc59a20992d98a3e6af5553/oteps/4430-span-event-api-deprecation-plan.md
- **Language SDKs**: https://opentelemetry.io/docs/languages/
  - Python: https://opentelemetry.io/docs/languages/python/
  - Go: https://opentelemetry.io/docs/languages/go/
  - JavaScript: https://opentelemetry.io/docs/languages/js/
  - TypeScript: https://opentelemetry.io/docs/languages/js/
- **Auto-Instrumentation**: https://opentelemetry.io/docs/zero-code/
- **Registry (Instrumentation Libraries)**: https://opentelemetry.io/ecosystem/registry/

---

## Summary

✅ Start with **auto-instrumentation**, then add **manual instrumentation** for business logic
✅ Always use **Semantic Conventions** for attribute names (target v1.40.0+)
✅ Use **GenAI conventions** (`gen_ai.*`) for LLM/AI workloads — track token usage as metrics
✅ Use **Events** (`event.name`) for structured domain events in logs, and plan migrations away from new span-event API usage
✅ Apply the **Rule of 100**: No high-cardinality attributes in metrics
✅ Use **SDK Views** to drop high-cardinality attributes before export
✅ **Propagate context** using W3C Trace Context headers
✅ **Record exceptions** and set span status on errors
✅ **Redact PII** at the instrumentation layer (SDK Views, span processors)

**Instrumentation is not just about adding code—it's about adding the right data in the right format with the right cardinality.**
