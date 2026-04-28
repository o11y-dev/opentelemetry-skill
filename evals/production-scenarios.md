# Production & Security Evaluations

## PII Redaction

**ID**: pii-redaction-setup  
**Category**: Security  
**Difficulty**: Intermediate  

### Prompt
Configure OpenTelemetry to redact sensitive data like email addresses and API keys from traces before export.

### Expected Response (Key Points)
- Uses `transform` processor with OTTL redaction functions
- Includes regex patterns for email, API key detection
- Applies redaction to multiple signal types (traces, logs, metrics)
- Mentions performance impact of regex operations
- Suggests sampling-aware redaction strategies

### Failure Modes
- Omits transform processor entirely
- Uses simple string replacement instead of regex
- Only redacts one signal type
- Doesn't warn about performance impact
- Missing common PII patterns

---

## Production Scaling

**ID**: production-scaling  
**Category**: Architecture  
**Difficulty**: Advanced  

### Prompt
Scale an OpenTelemetry Collector deployment to handle 50,000 spans per second in production.

### Expected Response (Key Points)
- Recommends Gateway pattern with multiple replicas
- Configures horizontal pod autoscaling (HPA)
- Sets appropriate resource limits (CPU/memory)
- Includes persistent queues for reliability
- Mentions load balancing considerations
- Suggests monitoring collector health metrics

### Failure Modes
- Suggests vertical scaling only
- Omits persistent storage for queues
- Doesn't mention HPA configuration
- Missing collector self-monitoring
- No load balancing strategy

---

## Component Stability

**ID**: stability-awareness  
**Category**: Production  
**Difficulty**: Basic  

### Prompt
Use the k8sattributes processor to enrich traces with Kubernetes metadata.

### Expected Response (Key Points)
- **Warns about Beta stability level** of k8sattributes processor
- Recommends pinning to specific collector version
- Explains rollback strategy if issues occur
- Mentions alternative approaches (resourcedetection processor)
- Includes proper RBAC configuration for k8s API access

### Failure Modes
- Doesn't mention stability level
- Provides configuration without warnings
- No version pinning recommendations
- Omits RBAC requirements
- Missing rollback planning

---

## Persistent Queues

**ID**: persistent-queues-setup  
**Category**: Reliability  
**Difficulty**: Intermediate  

### Prompt
Prevent telemetry data loss during collector restarts and backend outages.

### Expected Response (Key Points)
- Configures `file_storage` extension
- Attaches persistent queues to exporters
- Calculates disk space requirements
- Provides PersistentVolume configuration for Kubernetes
- Explains queue behavior during outages
- Mentions performance implications

### Failure Modes
- Uses memory queues only
- Doesn't configure file_storage extension
- Missing disk space calculations
- No Kubernetes storage examples
- Omits performance considerations