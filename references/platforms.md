# OpenTelemetry Platforms & Serverless Best Practices

## Overview

OpenTelemetry is available for a variety of platforms and environments, ensuring seamless observability in hybrid systems. This reference provides comprehensive guidance on deploying OpenTelemetry in different platform environments, with detailed focus on serverless functions (AWS Lambda, Azure Functions, GCP Cloud Functions) and client-side applications.

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Functions as a Service (FaaS)](#functions-as-a-service-faas)
3. [AWS Lambda Best Practices](#aws-lambda-best-practices)
4. [Azure Functions](#azure-functions)
5. [Google Cloud Functions](#google-cloud-functions)
6. [Client-Side Applications](#client-side-applications)
7. [Best Practices Summary](#best-practices-summary)

---

## Platform Overview

OpenTelemetry supports the following major platform categories:

| Platform | Description | Key Considerations |
|----------|-------------|-------------------|
| **Functions as a Service (FaaS)** | AWS Lambda, Azure Functions, GCP Cloud Functions | Cold starts, execution timeouts, async export |
| **Client-Side Apps** | Mobile (iOS, Android), Browser (JavaScript), Desktop | Data volume control, PII handling, battery life |
| **Container Platforms** | Kubernetes, Docker, ECS/Fargate | See [architecture.md](architecture.md) for details |
| **Virtual Machines** | EC2, Azure VMs, GCE | Traditional collector deployments |

---

## Functions as a Service (FaaS)

Functions as a Service (FaaS) is an important serverless compute platform for cloud-native applications. However, platform quirks usually mean these applications have slightly different monitoring guidance and requirements than applications running on Kubernetes or Virtual Machines.

### The FaaS Challenge

Serverless functions have unique characteristics that affect observability:

| Challenge | Impact | OpenTelemetry Solution |
|-----------|--------|----------------------|
| **Short Execution Time** | Function may terminate before telemetry export completes | Use Collector Extension Layer (async export) |
| **Cold Starts** | Initialization overhead increases latency | Minimize instrumentation scope, use provisioned concurrency |
| **Limited Control** | Cannot run DaemonSet or Gateway collectors | Use Lambda Layers or Collector Extensions |
| **Timeouts** | Function must complete within time limit | Never block on telemetry export |
| **Cost Per Millisecond** | Every millisecond of execution is billed | Async export to avoid blocking handler |

### Deployment Patterns

**Pattern 1: Lambda Layer (Auto-Instrumentation)**
- Pre-built Lambda layers with auto-instrumentation
- Zero code changes required
- Managed by OpenTelemetry community

**Pattern 2: Collector Extension Layer**
- Collector runs as a Lambda extension (sidecar process)
- Decouples telemetry export from function execution
- **Non-blocking**: Export happens after handler returns
- **Recommended for production**

**Pattern 3: Manual SDK Integration**
- Full control over instrumentation
- Requires code changes
- Best combined with Collector Extension Layer

---

## AWS Lambda Best Practices

### Critical Rule: Never Block on Telemetry Export

**Problem**: Lambda may terminate the execution environment immediately after your handler returns, killing any in-flight telemetry exports.

**Solution**: Use the OpenTelemetry Collector Extension Layer to decouple export from execution.

### Architecture: Collector Extension Layer

```
┌─────────────────────────────────────┐
│        Lambda Execution             │
│                                     │
│  ┌──────────────┐  ┌─────────────┐ │
│  │   Handler    │  │  Collector  │ │
│  │   Function   │→ │  Extension  │ │
│  └──────────────┘  └─────────────┘ │
│         ↓                 ↓         │
│    Returns            Exports       │
│    Immediately        Async         │
└─────────────────────────────────────┘
```

**Benefits**:
✅ Handler returns immediately (no blocking on export)
✅ Telemetry exported asynchronously after handler completes
✅ Collector persists across invocations (reduces overhead)
✅ Data flushed during next invocation if Lambda freezes

### Setup: Using AWS OpenTelemetry Lambda Layer

#### Step 1: Add Lambda Layers

**For Node.js**:
```bash
# ARN format (region-specific)
arn:aws:lambda:<region>:901920570463:layer:aws-otel-nodejs-<arch>-ver-1-18-1:4

# Example: us-east-1, x86_64
arn:aws:lambda:us-east-1:901920570463:layer:aws-otel-nodejs-amd64-ver-1-18-1:4
```

**For Python**:
```bash
arn:aws:lambda:<region>:901920570463:layer:aws-otel-python-<arch>-ver-1-25-0:3
```

**For Java**:
```bash
arn:aws:lambda:<region>:901920570463:layer:aws-otel-java-wrapper-<arch>-ver-1-32-0:3
```

**Collector Extension Layer** (required for async export):
```bash
arn:aws:lambda:<region>:901920570463:layer:aws-otel-collector-<arch>-ver-0-102-1:1
```

#### Step 2: Configure Environment Variables

**Essential Variables**:

```bash
# Service identification
OTEL_SERVICE_NAME=my-lambda-function

# Export configuration (HTTP recommended for Lambda)
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-backend:4318

# Resource attributes
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.version=1.0.0

# Enable auto-instrumentation
AWS_LAMBDA_EXEC_WRAPPER=/opt/otel-handler  # For Node.js/Python
```

**Performance Optimization Variables**:

```bash
# Minimize cold start overhead - disable unnecessary instrumentations
OTEL_INSTRUMENTATION_COMMON_DEFAULT_ENABLED=false
OTEL_INSTRUMENTATION_AWS_SDK_ENABLED=true
OTEL_INSTRUMENTATION_HTTP_ENABLED=true

# Export only traces (disable metrics/logs if not needed)
OTEL_METRICS_EXPORTER=none
OTEL_LOGS_EXPORTER=none

# Disable batch processor timeout (use extension's batching)
OTEL_BSP_SCHEDULE_DELAY=0
OTEL_BSP_MAX_QUEUE_SIZE=2048
```

**Critical Attributes for Non-Blocking Behavior**:

```bash
# Force synchronous export to collector extension (not backend)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318  # Collector extension endpoint

# Collector extension handles async export to backend
# Set backend endpoint in collector extension config (see below)
```

#### Step 3: Configure Collector Extension (Optional)

Create `collector.yaml` in Lambda function package:

```yaml
# /opt/collector-config/config.yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: localhost:4318

processors:
  batch:
    timeout: 1s        # Short timeout for Lambda's lifecycle
    send_batch_size: 512
  memory_limiter:
    limit_mib: 50      # Conservative for Lambda extension
    spike_limit_mib: 10

exporters:
  otlp:
    endpoint: your-backend.example.com:4317
    tls:
      insecure: false
    timeout: 5s        # Must complete before Lambda freezes

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

**Set environment variable to use custom config**:
```bash
OPENTELEMETRY_COLLECTOR_CONFIG_FILE=/var/task/collector.yaml
```

### Handling Timeouts

#### Problem: Function Times Out Before Telemetry Export

**Symptom**: Traces are missing for slow or timed-out functions.

**Solution 1: Increase Function Timeout**
```yaml
# serverless.yml or SAM template
Timeout: 30  # Ensure sufficient time for export
```

**Solution 2: Configure Export Timeout**
```bash
# Reduce export timeout to avoid blocking
OTEL_EXPORTER_OTLP_TIMEOUT=1000  # 1 second max
```

**Solution 3: Use Collector Extension with Buffering**
- Extension persists across invocations
- Buffered data exported during next invocation if current one times out

### Lambda-Specific Semantic Conventions

Always include these resource attributes for Lambda functions:

```python
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource

# Automatic via environment
resource = Resource.create({
    "cloud.provider": "aws",
    "cloud.platform": "aws_lambda",
    "cloud.region": os.environ.get("AWS_REGION"),
    "faas.name": os.environ.get("AWS_LAMBDA_FUNCTION_NAME"),
    "faas.version": os.environ.get("AWS_LAMBDA_FUNCTION_VERSION"),
    "faas.instance": os.environ.get("AWS_LAMBDA_LOG_STREAM_NAME"),
})
```

**Span Attributes** (set in handler):

```python
import json
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def lambda_handler(event, context):
    with tracer.start_as_current_span("lambda_handler") as span:
        # FaaS semantic conventions
        span.set_attribute("faas.trigger", "http")  # or "pubsub", "timer", etc.
        span.set_attribute("faas.execution", context.aws_request_id)
        span.set_attribute("faas.invocation_id", context.request_id)
        
        # Add cold start indicator
        span.set_attribute("faas.coldstart", is_cold_start())
        
        # Business context
        span.set_attribute("user.id", event.get("userId"))
        
        # Process request
        result = process_request(event)
        
        # Set status
        span.set_attribute("faas.result", "success")
        return result
```

### Anti-Patterns to Avoid

❌ **Blocking on export in handler**:
```python
# DON'T DO THIS
def lambda_handler(event, context):
    span = tracer.start_span("handler")
    result = process(event)
    span.end()
    tracer.force_flush()  # ❌ Blocks until export completes!
    return result
```

✅ **Use collector extension (non-blocking)**:
```python
# DO THIS
def lambda_handler(event, context):
    with tracer.start_as_current_span("handler") as span:
        result = process(event)
    # Handler returns immediately
    # Collector extension exports async
    return result
```

❌ **Using gRPC protocol** (high cold start overhead):
```bash
OTEL_EXPORTER_OTLP_PROTOCOL=grpc  # ❌ Slow connection establishment
```

✅ **Use HTTP/protobuf**:
```bash
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf  # ✅ Faster, more reliable
```

❌ **Over-instrumenting** (increases cold start):
```bash
# All instrumentations enabled by default
# ❌ Instruments libraries you don't use
```

✅ **Selective instrumentation**:
```bash
OTEL_INSTRUMENTATION_COMMON_DEFAULT_ENABLED=false
OTEL_INSTRUMENTATION_AWS_SDK_ENABLED=true  # Only what you need
```

### Monitoring Lambda Performance

**Critical Metrics to Monitor**:

```promql
# Cold start rate
sum(rate(faas_coldstart_total{result="true"}[5m])) by (faas_name)

# Initialization overhead
histogram_quantile(0.95, 
  sum(rate(faas_init_duration_milliseconds_bucket[5m])) by (le, faas_name)
)

# Execution duration (include telemetry overhead)
histogram_quantile(0.95,
  sum(rate(faas_execution_duration_milliseconds_bucket[5m])) by (le, faas_name)
)

# Timeout rate
sum(rate(faas_timeout_total[5m])) by (faas_name)
```

### Example: Complete Node.js Lambda with OpenTelemetry

```javascript
// handler.js - No instrumentation code needed with auto-instrumentation layer
exports.handler = async (event, context) => {
    const { trace } = require('@opentelemetry/api');
    const span = trace.getActiveSpan();
    
    // Add custom attributes
    if (span) {
        span.setAttribute('faas.trigger', 'http');
        span.setAttribute('faas.coldstart', process.env._COLD_START === 'true');
        span.setAttribute('user.id', event.userId);
    }
    
    // Mark cold start
    if (!global._COLD_START) {
        global._COLD_START = true;
        process.env._COLD_START = 'true';
    } else {
        process.env._COLD_START = 'false';
    }
    
    // Business logic
    const result = await processRequest(event);
    
    // Handler returns immediately
    // Collector extension handles export async
    return {
        statusCode: 200,
        body: JSON.stringify(result)
    };
};
```

**Deployment Configuration** (serverless.yml):

```yaml
service: my-service

provider:
  name: aws
  runtime: nodejs18.x
  architecture: x86_64
  timeout: 30
  memorySize: 512
  environment:
    OTEL_SERVICE_NAME: ${self:service}-${self:provider.stage}
    OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
    OTEL_EXPORTER_OTLP_ENDPOINT: http://localhost:4318
    OTEL_RESOURCE_ATTRIBUTES: deployment.environment=${self:provider.stage}
    AWS_LAMBDA_EXEC_WRAPPER: /opt/otel-handler
    OTEL_INSTRUMENTATION_COMMON_DEFAULT_ENABLED: false
    OTEL_INSTRUMENTATION_AWS_SDK_ENABLED: true
    OTEL_INSTRUMENTATION_HTTP_ENABLED: true
    OTEL_METRICS_EXPORTER: none
    OTEL_LOGS_EXPORTER: none

functions:
  myFunction:
    handler: handler.handler
    layers:
      - arn:aws:lambda:us-east-1:901920570463:layer:aws-otel-nodejs-amd64-ver-1-18-1:4
      - arn:aws:lambda:us-east-1:901920570463:layer:aws-otel-collector-amd64-ver-0-102-1:1
```

---

## Azure Functions

### Architecture

Azure Functions supports OpenTelemetry through:
1. **Built-in integration** with Application Insights (supports OTLP)
2. **Manual SDK integration** for custom instrumentation
3. **Extension-based collection** (similar to Lambda)

### Configuration

**Using Application Insights with OTLP**:

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "maxTelemetryItemsPerSecond": 20
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

**Environment Variables**:

```bash
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...
OTEL_SERVICE_NAME=my-azure-function
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-backend:4318
```

### Best Practices

✅ Use Application Insights native integration for simplicity
✅ Configure sampling to control cost (default: 5 requests/second)
✅ Use Consumption Plan for variable workloads, Premium for consistent latency
✅ Set `FUNCTIONS_WORKER_RUNTIME` appropriately (node, python, dotnet, java)

---

## Google Cloud Functions

### Architecture

GCP Cloud Functions (2nd generation) runs on Cloud Run, supporting:
1. **Auto-instrumentation via buildpacks** (Node.js, Python, Java)
2. **OpenTelemetry SDK integration**
3. **Export to Cloud Trace** (native OTLP support)

### Configuration

**Automatic Instrumentation** (Node.js):

```yaml
# package.json
{
  "scripts": {
    "start": "functions-framework --target=myFunction"
  },
  "dependencies": {
    "@google-cloud/functions-framework": "^3.0.0",
    "@opentelemetry/api": "^1.4.0"
  }
}
```

**Environment Variables**:

```bash
OTEL_SERVICE_NAME=my-gcp-function
OTEL_TRACES_EXPORTER=google_cloud_trace
GOOGLE_CLOUD_PROJECT=my-project-id
```

**Export to Custom Backend**:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-backend:4317
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://your-backend:4317/v1/traces
```

### Best Practices

✅ Use 2nd generation Cloud Functions (runs on Cloud Run, better performance)
✅ Export to Cloud Trace for native GCP integration
✅ Configure minimum instances to avoid cold starts
✅ Use `--timeout=60s` and `--max-instances=100` flags appropriately

---

## Client-Side Applications

Client-side applications (mobile apps, web browsers, desktop apps) have unique constraints that require careful consideration when implementing OpenTelemetry. Unlike server-side applications, client-side apps run on user-controlled devices with limited resources, unreliable networks, and strict privacy requirements.

### The Client-Side Challenge

| Challenge | Impact | OpenTelemetry Solution |
|-----------|--------|----------------------|
| **Battery Drain** | Excessive telemetry collection drains device battery | Aggressive sampling (1-5%), batch exports (5-10s intervals) |
| **Data Usage** | Users on metered connections pay for telemetry data | Compress payloads, sample aggressively, avoid verbose attributes |
| **Bundle Size** | Large SDK increases app download size | Use tree-shaking, import only needed modules, consider vendor SDKs |
| **Privacy** | User data must be protected (GDPR, CCPA) | Never collect PII, mask sensitive DOM elements, use consent management |
| **Network Reliability** | Offline or flaky connections cause data loss | Buffer telemetry locally, retry with exponential backoff |
| **Performance** | Instrumentation must not impact UX | Async instrumentation, <1% CPU overhead, avoid blocking main thread |

### Mobile Apps (iOS, Android)

#### Critical Best Practices

**1. Aggressive Sampling (1-5%)**

Mobile apps generate high volumes of user interactions. Sampling is mandatory to control data volume and battery usage.

**iOS (Swift)**:

```swift
import OpenTelemetryApi
import OpenTelemetrySdk

// Configure with 1% sampling for production
let resource = Resource(attributes: [
    "service.name": "my-ios-app",
    "service.version": "1.2.3",
    "deployment.environment": "production",
    "device.model.name": UIDevice.current.model,
    "device.os.version": UIDevice.current.systemVersion
])

// ParentBased ensures trace continuity across services
let sampler = ParentBasedSampler(root: TraceIdRatioBasedSampler(ratio: 0.01))  // 1% sampling

let tracerProvider = TracerProviderBuilder()
    .with(resource: resource)
    .with(sampler: sampler)
    .build()

OpenTelemetry.registerTracerProvider(tracerProvider: tracerProvider)
```

**Android (Kotlin)**:

```kotlin
import io.opentelemetry.api.GlobalOpenTelemetry
import io.opentelemetry.sdk.OpenTelemetrySdk
import io.opentelemetry.sdk.resources.Resource
import io.opentelemetry.sdk.trace.SdkTracerProvider
import io.opentelemetry.sdk.trace.samplers.Sampler

val resource = Resource.create(
    Attributes.of(
        ResourceAttributes.SERVICE_NAME, "my-android-app",
        ResourceAttributes.SERVICE_VERSION, "1.2.3",
        ResourceAttributes.DEPLOYMENT_ENVIRONMENT, "production",
        ResourceAttributes.DEVICE_MODEL_NAME, Build.MODEL,
        ResourceAttributes.OS_VERSION, Build.VERSION.RELEASE
    )
)

// ParentBased sampler for trace continuity
val sampler = Sampler.parentBased(Sampler.traceIdRatioBased(0.01))  // 1% sampling

val tracerProvider = SdkTracerProvider.builder()
    .setResource(resource)
    .setSampler(sampler)
    .build()

val openTelemetry = OpenTelemetrySdk.builder()
    .setTracerProvider(tracerProvider)
    .build()

GlobalOpenTelemetry.set(openTelemetry)
```

**2. Battery-Aware Export Configuration**

Configure batch exports to minimize wake-ups and network calls:

**iOS**:
```swift
import OpenTelemetrySdk

let batchProcessor = BatchSpanProcessor(
    spanExporter: OtlpHttpTraceExporter(endpoint: exporterEndpoint),
    scheduleDelay: 10.0,      // Export every 10 seconds
    maxQueueSize: 512,         // Smaller queue for mobile
    maxExportBatchSize: 256    // Smaller batches
)

tracerProvider.addSpanProcessor(batchProcessor)
```

**Android**:
```kotlin
val batchProcessor = BatchSpanProcessor.builder(
    OtlpHttpSpanExporter.builder()
        .setEndpoint("https://your-backend.example.com/v1/traces")
        .build()
)
    .setScheduleDelay(10, TimeUnit.SECONDS)  // Export every 10 seconds
    .setMaxQueueSize(512)
    .setMaxExportBatchSize(256)
    .build()

tracerProvider.addSpanProcessor(batchProcessor)
```

**3. Network Reliability & Offline Support**

Handle offline scenarios gracefully by buffering telemetry:

**iOS** (using local storage):
```swift
import Foundation

// Pseudocode template - requires implementation for your specific needs
class OfflineStorage {
    static let queue = DispatchQueue(label: "telemetry.offline")
    static let maxStoredSpans = 1000
    
    static func saveSpan(_ span: ReadableSpan) {
        queue.async {
            // Example: Serialize span to JSON and save to UserDefaults
            // let data = try? JSONEncoder().encode(span)
            // UserDefaults.standard.set(data, forKey: "span_\(UUID().uuidString)")
            // Implement LRU eviction if count > maxStoredSpans
        }
    }
    
    static func flushOfflineSpans() {
        queue.async {
            // Example: Retrieve stored spans and export when online
            // let spans = retrieveStoredSpans()
            // exporter.export(spans) { result in ... }
            // Clear storage after successful export
        }
    }
}
```

**Android** (using Room database):
```kotlin
// Pseudocode template - requires Room database setup
@Dao
interface TelemetryDao {
    @Insert
    fun insertSpan(span: SpanEntity)
    
    @Query("SELECT * FROM spans LIMIT 100")
    fun getSpans(): List<SpanEntity>
    
    @Delete
    fun deleteSpans(spans: List<SpanEntity>)
}

// Export when network available
if (isNetworkAvailable()) {
    val spanEntities = database.telemetryDao().getSpans()
    // Convert SpanEntity to proper SDK format before export
    // val spans = spanEntities.map { it.toReadableSpan() }
    // exporter.export(spans)
    database.telemetryDao().deleteSpans(spanEntities)
}
```

**4. Privacy & PII Handling**

Never collect PII without explicit user consent:

**iOS**:
```swift
// ❌ DON'T: Collect PII
span.setAttribute("user.email", user.email)
span.setAttribute("user.phone", user.phone)

// ✅ DO: Use anonymous IDs
span.setAttribute("user.id", user.anonymousId)  // Hashed or UUID
span.setAttribute("user.segment", user.segment)  // "premium", "free"
```

**Android**:
```kotlin
// ❌ DON'T: Collect sensitive data
span.setAttribute("credit_card", cardNumber)

// ✅ DO: Use non-identifying attributes
span.setAttribute("payment.method", "credit_card")
span.setAttribute("payment.provider", "stripe")
```

**5. Monitor SDK Overhead**

Track OpenTelemetry's impact on app performance:

```swift
// iOS: Monitor CPU and memory usage
func reportMemoryUsage() -> UInt64 {
    var info = mach_task_basic_info()
    var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
    let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
            task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
        }
    }
    return kerr == KERN_SUCCESS ? info.resident_size : 0
}

let startCPU = ProcessInfo.processInfo.processorTime
let startMemory = reportMemoryUsage()

// Initialize OpenTelemetry
setupOpenTelemetry()

let cpuOverhead = ProcessInfo.processInfo.processorTime - startCPU
let memoryOverhead = reportMemoryUsage() - startMemory

// Should be <1% CPU, <5MB memory
```

### Browser (JavaScript)

#### Critical Best Practices

**1. Minimize Bundle Size**

Use tree-shaking and import only necessary modules:

```javascript
// ❌ DON'T: Import entire SDK
import * as opentelemetry from '@opentelemetry/api';

// ✅ DO: Import specific modules
import { trace } from '@opentelemetry/api';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
```

**2. CORS Configuration**

Backend must support CORS for browser-based OTLP export:

**Backend CORS Headers Required**:
```
Access-Control-Allow-Origin: https://your-app.com
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-API-Key
Access-Control-Max-Age: 86400
```

**Exporter Configuration**:
```javascript
const exporter = new OTLPTraceExporter({
  url: 'https://your-backend.example.com/v1/traces',
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json'
  },
  // HTTP not gRPC (browsers don't support gRPC-Web by default)
});
```

**3. User Privacy & DOM Masking**

Mask sensitive DOM elements to prevent PII leakage:

```javascript
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';

const userInteractionInstrumentation = new UserInteractionInstrumentation({
  // Don't capture text from password, credit card fields
  eventNames: ['click', 'submit'],
  shouldPreventSpanCreation: (eventType, element, span) => {
    // Skip instrumentation for sensitive forms
    if (element.type === 'password' || element.name === 'creditCard') {
      return true;
    }
    return false;
  }
});
```

**4. Complete Browser Setup**

```javascript
import { trace } from '@opentelemetry/api';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';

// Resource attributes for browser
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'my-web-app',
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'production'
});

// HTTP exporter (not gRPC)
const exporter = new OTLPTraceExporter({
  url: 'https://your-backend.example.com/v1/traces',
  headers: { 'X-API-Key': 'your-api-key' }
});

const provider = new WebTracerProvider({
  resource: resource,
  // 5% sampling for browser traffic
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(0.05)
  })
});

// Batch exports every 5 seconds
provider.addSpanProcessor(new BatchSpanProcessor(exporter, {
  maxQueueSize: 100,
  maxExportBatchSize: 50,
  scheduledDelayMillis: 5000  // 5 seconds
}));

// Zone context manager for async operations
provider.register({
  contextManager: new ZoneContextManager()
});
```

**5. Handle Offline Scenarios**

Buffer telemetry when offline using localStorage:

```javascript
// Note: This is a simplified example for illustration
// In production, use a SpanProcessor to buffer spans properly
const offlineStorage = {
  maxSpans: 500,
  
  saveSpanData(spanData) {
    const spans = JSON.parse(localStorage.getItem('otel_spans') || '[]');
    spans.push(spanData);
    
    // LRU eviction
    if (spans.length > this.maxSpans) {
      spans.shift();
    }
    
    localStorage.setItem('otel_spans', JSON.stringify(spans));
  },
  
  // This is pseudocode - actual implementation requires proper span reconstruction
  async flushOfflineSpans() {
    const spanData = JSON.parse(localStorage.getItem('otel_spans') || '[]');
    if (spanData.length > 0 && navigator.onLine) {
      // In practice, use a custom SpanProcessor to handle offline scenarios
      // The exporter expects proper ReadableSpan objects
      localStorage.removeItem('otel_spans');
    }
  }
};

// Flush when back online
window.addEventListener('online', () => {
  offlineStorage.flushOfflineSpans();
});
```

**6. Performance Monitoring**

Track SDK overhead to ensure <1% performance impact:

```javascript
const startTime = performance.now();
// Note: performance.memory is Chrome-specific and not available in Firefox/Safari
const startMemory = performance.memory?.usedJSHeapSize || 0;

// Initialize OpenTelemetry
initializeOpenTelemetry();

const initTime = performance.now() - startTime;
const memoryUsage = (performance.memory?.usedJSHeapSize || 0) - startMemory;

console.log(`OTel init time: ${initTime}ms`);
console.log(`OTel memory: ${memoryUsage / 1024 / 1024}MB (Chrome only)`);

// Should be <100ms init, <5MB memory
```

### Anti-Patterns to Avoid (Client-Side)

❌ **Sampling at 100%**: Results in excessive battery drain and data usage
```javascript
// DON'T
sampler: new AlwaysOnSampler()
```

✅ **Use 1-5% sampling**:
```javascript
// DO
sampler: new TraceIdRatioBasedSampler(0.01)
```

❌ **Collecting PII**: Violates GDPR, CCPA
```javascript
// DON'T
span.setAttribute('user.email', email);
```

✅ **Use anonymous IDs**:
```javascript
// DO
span.setAttribute('user.id', anonymousId);
```

❌ **Synchronous exports**: Blocks main thread
```javascript
// DON'T
exporter.export(spans);  // Blocks UI
```

✅ **Batch asynchronously**:
```javascript
// DO
provider.addSpanProcessor(new BatchSpanProcessor(exporter));
```

❌ **Large bundle size**: Increases page load time
```javascript
// DON'T: Import everything
import '@opentelemetry/auto-instrumentations-web';
```

✅ **Selective imports**:
```javascript
// DO: Only import what you need
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
```

---

## Best Practices Summary

### FaaS (Lambda, Azure, GCP) ✅

1. **Use Collector Extension/Layer**: Decouple export from execution
2. **Never Block on Export**: Use async export to avoid timeouts
3. **HTTP over gRPC**: Faster cold starts, more reliable in serverless
4. **Selective Instrumentation**: Only enable needed libraries
5. **Short Batch Timeouts**: Configure aggressive flushing (1-2 seconds)
6. **Monitor Cold Starts**: Track `faas.coldstart` attribute
7. **Set Timeouts Appropriately**: Allow time for export (30s minimum)
8. **Use Resource Attributes**: `cloud.platform`, `faas.name`, `faas.trigger`

### Client-Side Apps ✅

1. **Aggressive Sampling**: Use 1-5% sampling for mobile/browser to minimize battery drain and data usage
2. **Bundle Size Optimization**: Minimize SDK footprint with tree-shaking, selective imports (<50KB ideal)
3. **Batch Exports**: Reduce network calls with 5-10 second batch intervals
4. **Offline Support**: Buffer telemetry locally (localStorage/Room DB) when network unavailable
5. **Privacy First**: Never collect PII - use anonymous IDs, mask sensitive DOM elements
6. **CORS Configuration**: Ensure backend supports CORS headers for browser OTLP export
7. **Performance Monitoring**: Track SDK overhead (target: <1% CPU, <5MB memory, <100ms init)
8. **Async Instrumentation**: Never block main thread - use BatchSpanProcessor, not synchronous exports
9. **HTTP over gRPC**: Use HTTP/protobuf for browser compatibility (gRPC-Web not widely supported)
10. **Resource Attributes**: Include `device.model.name`, `os.version`, `service.version` for debugging

### Security & Compliance ✅

1. **Redact PII**: Never export passwords, credit cards, SSNs
2. **Use TLS**: Always encrypt telemetry in transit
3. **Authentication**: Use API keys or OAuth for OTLP export
4. **Sampling**: Reduce data exposure by sampling aggressively
5. **Data Residency**: Export to region-specific backends for GDPR

---

## Reference Links

- **Official Docs**: https://opentelemetry.io/docs/platforms/
- **Lambda Repository**: https://github.com/open-telemetry/opentelemetry-lambda
- **AWS Lambda Layers**: https://aws-otel.github.io/docs/getting-started/lambda
- **Azure Functions**: https://learn.microsoft.com/azure/azure-functions/opentelemetry
- **GCP Cloud Functions**: https://cloud.google.com/functions/docs/monitoring
- **Browser Instrumentation**: https://opentelemetry.io/docs/instrumentation/js/
- **Mobile SDKs**: https://opentelemetry.io/docs/instrumentation/
- **Swift SDK**: https://github.com/open-telemetry/opentelemetry-swift
- **Android SDK**: https://github.com/open-telemetry/opentelemetry-java

---

## Summary

Platform-specific OpenTelemetry deployments require careful consideration of:
- **Execution model** (serverless vs. long-running)
- **Performance constraints** (cold starts, timeouts, battery life)
- **Export patterns** (sync vs. async, blocking vs. non-blocking)
- **Cost implications** (billed per millisecond, data egress)

**Always prioritize non-blocking telemetry export in serverless environments to avoid timeouts and unexpected costs.**

For more information on deployment architectures, see [architecture.md](architecture.md). For instrumentation patterns, see [instrumentation.md](instrumentation.md).
