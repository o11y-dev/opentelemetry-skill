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
- Service A uses `http.method`, Service B uses `http_verb`, Service C uses `request.method`
- Queries become impossible: `WHERE http.method = 'POST' OR http_verb = 'POST' OR request.method = 'POST'`

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

### Database Semantic Conventions

```python
span.set_attribute(SpanAttributes.DB_SYSTEM, "postgresql")
span.set_attribute(SpanAttributes.DB_NAME, "orders")
span.set_attribute(SpanAttributes.DB_STATEMENT, "SELECT * FROM orders WHERE user_id = $1")
span.set_attribute(SpanAttributes.DB_OPERATION, "SELECT")
span.set_attribute(SpanAttributes.SERVER_ADDRESS, "db.example.com")
span.set_attribute(SpanAttributes.SERVER_PORT, 5432)
```

### Common Mistakes

❌ `span.set_attribute("db.type", "postgres")` → ✅ `db.system = "postgresql"`
❌ `span.set_attribute("http.url", "https://api.example.com/users/123?token=secret")` → ✅ Use `http.route` without PII
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
| `http.method` | ~10 (GET, POST, PUT...) | ✅ Yes | N/A |
| `http.status_code` | ~60 (200, 404, 500...) | ✅ Yes | N/A |
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
counter.add(1, {"http.target": "/users/123/orders/456"})  # Infinite cardinality
```

### Low-Cardinality Alternatives (GOOD)

✅ **Use http.route instead of http.target**:
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
5. **Record Exceptions**: Use `span.record_exception(e)` for error tracking
6. **Set Status**: Use `span.set_status(StatusCode.ERROR)` on failures
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

## Reference Links

- **Instrumentation Documentation**: https://opentelemetry.io/docs/instrumentation/
- **Semantic Conventions**: https://opentelemetry.io/docs/specs/semconv/
- **Language SDKs**: https://opentelemetry.io/docs/languages/
- **Auto-Instrumentation**: https://opentelemetry.io/docs/zero-code/
- **Registry (Instrumentation Libraries)**: https://opentelemetry.io/ecosystem/registry/

---

## Summary

✅ Start with **auto-instrumentation**, then add **manual instrumentation** for business logic
✅ Always use **Semantic Conventions** for attribute names
✅ Apply the **Rule of 100**: No high-cardinality attributes in metrics
✅ Use **SDK Views** to drop high-cardinality attributes before export
✅ **Propagate context** using W3C Trace Context headers
✅ **Record exceptions** and set span status on errors
✅ **Redact PII** at the instrumentation layer (SDK Views, span processors)

**Instrumentation is not just about adding code—it's about adding the right data in the right format with the right cardinality.**
