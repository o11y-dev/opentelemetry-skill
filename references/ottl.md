# OTTL: OpenTelemetry Transformation Language

## Overview

OTTL (OpenTelemetry Transformation Language) is a domain-specific language designed for transforming telemetry data within the OpenTelemetry Collector. It provides a powerful, expressive syntax for modifying, filtering, and enriching traces, metrics, and logs in real-time as they flow through collector pipelines.

**Key Use Cases**:
- **PII Redaction**: Remove or mask sensitive data (emails, IPs, tokens)
- **Attribute Enrichment**: Add context from environment variables or metadata
- **Data Filtering**: Drop unwanted telemetry to reduce costs
- **Field Extraction**: Parse structured data from strings (JSON, logs)
- **Data Normalization**: Standardize attribute names and values
- **Cardinality Reduction**: Limit high-cardinality attributes

## OTTL Processors

OTTL is used in three main collector processors:

| Processor | Signals | Purpose |
|-----------|---------|---------|
| **transform** | Traces, Metrics, Logs | General-purpose transformations on any signal type |
| **filter** | Traces, Metrics, Logs | Drop telemetry based on conditions |
| **routing** | Traces, Metrics, Logs | Route telemetry to different exporters based on attributes |

## Context Types

OTTL operates on different **contexts** depending on the telemetry signal being transformed:

### Trace Contexts

| Context | Scope | Use When |
|---------|-------|----------|
| `resource` | Resource-level attributes (applies to all spans) | Modifying service name, deployment environment |
| `scope` | Instrumentation scope (library/tracer) | Filtering by instrumentation library |
| `span` | Individual span | Modifying span attributes, name, or status |
| `spanevent` | Span events (logs within spans) | Transforming event attributes |

### Metric Contexts

| Context | Scope | Use When |
|---------|-------|----------|
| `resource` | Resource-level attributes | Service metadata |
| `scope` | Instrumentation scope | Filtering by meter |
| `metric` | Metric-level (name, description) | Renaming metrics |
| `datapoint` | Individual data points | Modifying attribute values, filtering specific series |

### Log Contexts

| Context | Scope | Use When |
|---------|-------|----------|
| `resource` | Resource-level attributes | Service identification |
| `scope` | Instrumentation scope | Library filtering |
| `log` | Individual log record | Parsing body, extracting fields, redaction |

## OTTL Syntax

### Statement Structure

```yaml
statements:
  - context: <context_type>
    statements:
      - <OTTL expression>
      - <OTTL expression>
```

### Path Expressions

Access telemetry data using **paths**:

```
# Resource attributes
resource.attributes["service.name"]

# Span attributes
attributes["http.method"]

# Span properties
name
status.code

# Log body
body

# Metric name
metric.name
```

### Conditions (Boolean Expressions)

Use conditions with `where` clauses or in `set` statements:

```yaml
# Only process spans with status code ERROR
where: status.code == STATUS_CODE_ERROR

# Check if attribute exists
where: attributes["user.id"] != nil

# Complex conditions
where: attributes["http.status_code"] >= 500 and attributes["http.method"] == "POST"
```

### Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `==` | Equality | `attributes["env"] == "prod"` |
| `!=` | Inequality | `status.code != STATUS_CODE_OK` |
| `>`, `<`, `>=`, `<=` | Comparison | `attributes["http.status_code"] >= 400` |
| `and`, `or`, `not` | Logical | `attributes["a"] > 0 and attributes["b"] < 100` |
| `+`, `-`, `*`, `/` | Arithmetic | `attributes["duration"] * 1000` |

## Core Functions

### Attribute Manipulation

#### `set(target, value)`
Set an attribute or property to a value.

```yaml
# Set new attribute
- set(attributes["region"], "us-east-1")

# Rename attribute (copy then delete)
- set(attributes["http.status_code"], attributes["status"])
- delete_key(attributes, "status")

# Set from environment variable
- set(resource.attributes["k8s.cluster.name"], env("CLUSTER_NAME"))
```

#### `delete_key(target, key)`
Delete an attribute.

```yaml
# Remove PII
- delete_key(attributes, "user.email")
- delete_key(attributes, "user.ip")

# Remove multiple keys
- delete_matching_keys(attributes, "temp_.*")
```

#### `keep_keys(target, keys...)`
Keep only specified keys, delete all others.

```yaml
# Keep only essential attributes
- keep_keys(attributes, "service.name", "http.method", "http.status_code")
```

### String Functions

#### `truncate(target, length)`
Truncate a string to maximum length.

```yaml
# Limit trace ID display
- set(attributes["trace_id_short"], Truncate(trace_id.string, 8))

# Limit log messages
- truncate(body, 1024) where IsMatch(body, ".*")
```

#### `replace_pattern(target, regex, replacement)`
Replace strings matching a regex pattern.

```yaml
# Redact email addresses
- replace_pattern(attributes["message"], "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b", "[REDACTED_EMAIL]")

# Redact IP addresses
- replace_pattern(body, "\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b", "[REDACTED_IP]")

# Normalize HTTP methods to uppercase
- replace_pattern(attributes["http.method"], "^(.*)$", Concat([UpperCase("$1")]))
```

#### `replace_all_patterns(target, map)`
Replace multiple patterns at once (more efficient).

```yaml
- replace_all_patterns(attributes, {
    "password\\s*=\\s*[^&\\s]+": "password=[REDACTED]",
    "api[_-]?key\\s*=\\s*[^&\\s]+": "api_key=[REDACTED]"
  })
```

### Parsing Functions

#### `ParseJSON(target)`
Parse JSON string into structured data.

```yaml
# Extract structured fields from JSON body
- merge_maps(attributes, ParseJSON(body), "upsert") where IsMatch(body, "^\\{")

# Parse JSON in attribute
- set(attributes["parsed"], ParseJSON(attributes["json_payload"]))
```

#### `ExtractPatterns(target, pattern)`
Extract values using regex capture groups.

```yaml
# Extract HTTP status from log message
- set(attributes["http.status_code"], ExtractPatterns(body, "status=(\\d+)"))

# Parse structured log format
- merge_maps(attributes, ExtractPatterns(body, "level=(?P<level>\\w+).*msg=\"(?P<message>[^\"]+)\""))
```

### Conditional Functions

#### `if(condition, true_value, false_value)` (Coming in future versions)
For now, use separate statements with `where` clauses.

```yaml
# Set priority based on status code
- set(attributes["priority"], "high") where attributes["http.status_code"] >= 500
- set(attributes["priority"], "medium") where attributes["http.status_code"] >= 400 and attributes["http.status_code"] < 500
- set(attributes["priority"], "low") where attributes["http.status_code"] < 400
```

### Type Conversion

```yaml
# String to int
- set(attributes["status_int"], Int(attributes["status_string"]))

# Int to string
- set(attributes["port_string"], String(attributes["port"]))

# Boolean conversions
- set(attributes["is_error"], attributes["http.status_code"] >= 400)
```

### Utility Functions

#### `IsMatch(target, pattern)`
Check if string matches regex.

```yaml
# Only process logs matching pattern
where: IsMatch(body, "ERROR|FATAL")

# Skip health check requests
where: not IsMatch(attributes["http.target"], "/health")
```

#### `Concat(list)`
Concatenate strings.

```yaml
# Build composite attribute
- set(attributes["full_path"], Concat([attributes["http.scheme"], "://", attributes["http.host"], attributes["http.target"]]))
```

#### `Len(target)`
Get length of string or array.

```yaml
# Log if message is too long
- set(attributes["message_length"], Len(body))
```

## Common Patterns

### Pattern 1: PII Redaction

```yaml
processors:
  transform:
    error_mode: ignore
    trace_statements:
      - context: span
        statements:
          # Redact email addresses
          - replace_pattern(attributes["message"], "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b", "[REDACTED_EMAIL]")
          # Redact credit card numbers
          - replace_pattern(attributes["message"], "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b", "[REDACTED_CC]")
          # Remove PII attributes entirely
          - delete_key(attributes, "user.email")
          - delete_key(attributes, "user.ssn")
          - delete_key(attributes, "credit_card")
```

### Pattern 2: Attribute Enrichment

```yaml
processors:
  transform:
    trace_statements:
      - context: resource
        statements:
          # Add environment from environment variable
          - set(attributes["deployment.environment"], env("ENV"))
          # Add cluster name
          - set(attributes["k8s.cluster.name"], env("CLUSTER_NAME"))
          # Add region
          - set(attributes["cloud.region"], env("AWS_REGION"))
```

### Pattern 3: Filtering Noise

```yaml
processors:
  filter:
    error_mode: ignore
    traces:
      span:
        # Drop health check spans
        - IsMatch(attributes["http.target"], "^/(health|ready|live)$")
        # Drop successful OPTIONS requests
        - attributes["http.method"] == "OPTIONS" and status.code == STATUS_CODE_UNSET
        # Drop internal monitoring
        - attributes["service.name"] == "otel-collector"
```

### Pattern 4: Cardinality Reduction

```yaml
processors:
  transform:
    metric_statements:
      - context: datapoint
        statements:
          # Remove high-cardinality user IDs from metrics
          - delete_key(attributes, "user.id")
          - delete_key(attributes, "session.id")
          # Truncate URLs to remove query params
          - replace_pattern(attributes["http.url"], "\\?.*$", "")
          # Bucket HTTP status codes
          - set(attributes["http.status_class"], "2xx") where attributes["http.status_code"] >= 200 and attributes["http.status_code"] < 300
          - set(attributes["http.status_class"], "4xx") where attributes["http.status_code"] >= 400 and attributes["http.status_code"] < 500
          - set(attributes["http.status_class"], "5xx") where attributes["http.status_code"] >= 500
          - delete_key(attributes, "http.status_code")
```

### Pattern 5: Log Parsing

```yaml
processors:
  transform:
    log_statements:
      - context: log
        statements:
          # Parse JSON logs
          - merge_maps(attributes, ParseJSON(body), "upsert") where IsMatch(body, "^\\{")
          # Extract log level
          - set(severity_text, ExtractPatterns(body, "level=(?P<level>\\w+)")[0]) where IsMatch(body, "level=")
          # Extract timestamp
          - set(attributes["extracted_time"], ExtractPatterns(body, "time=\"([^\"]+)\"")[0])
```

### Pattern 6: Span Name Normalization

```yaml
processors:
  transform:
    trace_statements:
      - context: span
        statements:
          # Normalize HTTP span names to include method + route
          - set(name, Concat([attributes["http.method"], " ", attributes["http.route"]])) where attributes["http.route"] != nil
          # Remove query parameters from span names
          - replace_pattern(name, "\\?.*$", "")
```

## Best Practices

### 1. Error Handling

**Always set `error_mode`** to control behavior when transformations fail:

```yaml
processors:
  transform:
    error_mode: ignore  # Options: ignore, silent, propagate
```

- **`ignore`**: Log errors but continue processing (recommended for production)
- **`silent`**: Suppress errors completely
- **`propagate`**: Stop pipeline on errors (development only)

### 2. Performance Optimization

**Order matters**: Apply filters before expensive transformations.

```yaml
# ✅ GOOD: Filter first, then transform
processors:
  filter:
    traces:
      span:
        - IsMatch(attributes["http.target"], "/health")
  
  transform:
    trace_statements:
      - context: span
        statements:
          - replace_pattern(attributes["message"], "complex_regex", "replacement")

# ❌ BAD: Transform everything, then filter
processors:
  transform:
    trace_statements:
      - context: span
        statements:
          - replace_pattern(attributes["message"], "complex_regex", "replacement")
  
  filter:
    traces:
      span:
        - IsMatch(attributes["http.target"], "/health")
```

**Use `where` clauses** to avoid unnecessary processing:

```yaml
# ✅ GOOD: Conditional execution
- replace_pattern(body, "regex", "replacement") where IsMatch(body, "trigger_pattern")

# ❌ BAD: Always execute
- replace_pattern(body, "regex", "replacement")
```

### 3. Regex Efficiency

- Use **non-capturing groups** `(?:...)` when you don't need to extract values
- Anchor patterns with `^` and `$` when possible
- Test regex performance with realistic data volumes

```yaml
# ✅ GOOD: Anchored, non-capturing
- replace_pattern(attributes["status"], "^(?:success|ok|200)$", "OK")

# ❌ BAD: Unanchored, captures unnecessarily
- replace_pattern(attributes["status"], "(success|ok|200)", "OK")
```

### 4. Cardinality Awareness

**Never create unbounded attributes in metrics**:

```yaml
# ❌ BAD: Creates unbounded cardinality
metric_statements:
  - context: datapoint
    statements:
      - set(attributes["full_url"], attributes["http.url"])  # Includes query params

# ✅ GOOD: Bucket or remove high-cardinality data
metric_statements:
  - context: datapoint
    statements:
      - replace_pattern(attributes["http.url"], "\\?.*$", "")  # Remove query params
      - replace_pattern(attributes["http.url"], "/users/\\d+", "/users/{id}")  # Parameterize IDs
```

### 5. Security - PII Redaction

**Redact sensitive data as early as possible** in the pipeline:

```yaml
# Processors order in collector config
processors:
  # 1. FIRST: Memory limiter (always first)
  memory_limiter:
    limit_percentage: 80
  
  # 2. SECOND: PII redaction (before data leaves collector)
  transform/redact_pii:
    error_mode: ignore
    trace_statements:
      - context: span
        statements:
          - replace_pattern(attributes["http.url"], "apikey=([^&]+)", "apikey=[REDACTED]")
          - delete_key(attributes, "user.email")
    log_statements:
      - context: log
        statements:
          - replace_pattern(body, "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b", "[REDACTED]")
  
  # 3. Other processors...
  batch:
    timeout: 10s
```

### 6. Testing Transformations

**Test OTTL statements before production**:

1. Use `otelcol-contrib` validate command:
   ```bash
   otelcol-contrib validate --config config.yaml
   ```

2. Use small data volumes in test environment
3. Monitor processor metrics: `otelcol_processor_dropped_spans`, `otelcol_processor_refused_spans`

```yaml
# Add telemetry for debugging
service:
  telemetry:
    logs:
      level: debug  # Temporarily enable debug logging
    metrics:
      level: detailed
```

### 7. Debugging

**Enable detailed logging** to see transformation effects:

```yaml
exporters:
  debug:
    verbosity: detailed
    sampling_initial: 10
    sampling_thereafter: 100

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [transform]
      exporters: [debug, otlp]  # Add debug exporter
```

**Check for dropped data**:

```bash
# Query Prometheus metrics
otelcol_processor_dropped_spans{processor="transform"} > 0
```

## Common Pitfalls

### ❌ Anti-Pattern 1: Mutating Immutable Fields

```yaml
# ❌ WRONG: Cannot modify trace ID or span ID
- set(trace_id, "new-trace-id")  # ERROR!
```

### ❌ Anti-Pattern 2: Type Mismatches

```yaml
# ❌ WRONG: Setting string to int field
- set(attributes["http.status_code"], "200")  # Should be Int(200)

# ✅ CORRECT: Use proper type
- set(attributes["http.status_code"], 200)
```

### ❌ Anti-Pattern 3: Over-Processing

```yaml
# ❌ BAD: Transforming all telemetry
trace_statements:
  - context: span
    statements:
      - replace_pattern(attributes["message"], "expensive_regex", "replacement")

# ✅ GOOD: Only transform when needed
trace_statements:
  - context: span
    statements:
      - replace_pattern(attributes["message"], "expensive_regex", "replacement") where IsMatch(attributes["message"], "trigger")
```

### ❌ Anti-Pattern 4: Creating Cardinality Explosions

```yaml
# ❌ BAD: Adding unbounded user IDs to metrics
metric_statements:
  - context: datapoint
    statements:
      - set(attributes["user_id"], resource.attributes["user.id"])

# ✅ GOOD: Add user IDs only to traces
trace_statements:
  - context: span
    statements:
      - set(attributes["user_id"], resource.attributes["user.id"])
```

## Version Compatibility

- **OTTL Syntax**: Introduced in OpenTelemetry Collector v0.78.0+
- **Transform Processor**: Stable since v0.86.0
- **Filter Processor (OTTL)**: Stable since v0.88.0
- **Routing Processor (OTTL)**: Beta in v0.90.0+

Check processor documentation for latest function availability:
- [Transform Processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/transformprocessor)
- [Filter Processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/filterprocessor)
- [OTTL Functions](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/pkg/ottl/ottlfuncs)

## Complete Example: Production Collector Config

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  # Always first: Memory protection
  memory_limiter:
    limit_percentage: 80
    spike_limit_percentage: 20
  
  # Early filtering: Drop noise
  filter:
    error_mode: ignore
    traces:
      span:
        - IsMatch(attributes["http.target"], "^/(health|ready|metrics)$")
        - attributes["http.method"] == "OPTIONS" and status.code == STATUS_CODE_UNSET
  
  # Security: PII redaction
  transform/redact_pii:
    error_mode: ignore
    trace_statements:
      - context: span
        statements:
          # Redact sensitive data
          - replace_pattern(attributes["http.url"], "apikey=([^&]+)", "apikey=[REDACTED]")
          - replace_pattern(attributes["http.url"], "token=([^&]+)", "token=[REDACTED]")
          - delete_key(attributes, "user.email")
          - delete_key(attributes, "user.ssn")
    log_statements:
      - context: log
        statements:
          - replace_pattern(body, "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b", "[REDACTED]")
          - replace_pattern(body, "password[\"']?\\s*[:=]\\s*[\"']?([^\"'\\s,}]+)", "password=[REDACTED]")
  
  # Enrichment: Add environment context
  transform/enrich:
    error_mode: ignore
    trace_statements:
      - context: resource
        statements:
          - set(attributes["deployment.environment"], env("ENV"))
          - set(attributes["k8s.cluster.name"], env("CLUSTER_NAME"))
          - set(attributes["cloud.region"], env("AWS_REGION"))
  
  # Cardinality management: Metrics only
  transform/reduce_cardinality:
    error_mode: ignore
    metric_statements:
      - context: datapoint
        statements:
          # Remove high-cardinality attributes
          - delete_key(attributes, "user.id")
          - delete_key(attributes, "session.id")
          # Parameterize URLs
          - replace_pattern(attributes["http.url"], "/users/\\d+", "/users/{id}")
          - replace_pattern(attributes["http.url"], "/orders/[a-f0-9-]+", "/orders/{id}")
  
  # Batching: Always include
  batch:
    timeout: 10s
    send_batch_size: 1024

exporters:
  otlp:
    endpoint: backend:4317
    tls:
      insecure: false

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors:
        - memory_limiter
        - filter
        - transform/redact_pii
        - transform/enrich
        - batch
      exporters: [otlp]
    
    metrics:
      receivers: [otlp]
      processors:
        - memory_limiter
        - transform/reduce_cardinality
        - batch
      exporters: [otlp]
    
    logs:
      receivers: [otlp]
      processors:
        - memory_limiter
        - filter
        - transform/redact_pii
        - batch
      exporters: [otlp]
```

## Additional Resources

- [OTTL GitHub Documentation](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/pkg/ottl)
- [Transform Processor README](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/transformprocessor)
- [OTTL Function Reference](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/pkg/ottl/ottlfuncs/README.md)
- [Filter Processor README](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/filterprocessor)

---

**Remember**: OTTL is powerful but can impact performance. Always test transformations with realistic data volumes before deploying to production. Monitor processor metrics to ensure transformations aren't causing data loss or bottlenecks.
