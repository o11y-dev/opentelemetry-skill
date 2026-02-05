# OpenTelemetry Security & Compliance

## Overview

Security in observability systems is critical: telemetry data often contains sensitive information (PII, credentials, business logic), and the collector itself is a privileged component with broad network access. This reference provides comprehensive guidance on PII redaction, TLS configuration, authentication, and extension security.

## Table of Contents

1. [Data Redaction & Sanitization](#data-redaction--sanitization)
2. [TLS & Encryption](#tls--encryption)
3. [Authentication & Authorization](#authentication--authorization)
4. [Extension Security](#extension-security)
5. [Least Privilege & RBAC](#least-privilege--rbac)
6. [Compliance Patterns](#compliance-patterns)

---

## Data Redaction & Sanitization

### The PII Problem

Telemetry data frequently captures sensitive information:
- **HTTP headers**: `Authorization`, `Cookie`, `X-Api-Key`
- **URLs**: Query parameters with tokens, passwords
- **Database statements**: `INSERT INTO users (email, password) VALUES (...)`
- **Custom attributes**: Credit card numbers, SSNs, phone numbers

**Regulation**: GDPR, CCPA, PCI-DSS, HIPAA mandate PII protection.

### Redaction Strategies

| Strategy | Pros | Cons | Use Case |
|----------|------|------|----------|
| **Drop** | Complete removal | No context | Highly sensitive (passwords, SSNs) |
| **Hash** | Deterministic, correlation-friendly | Reversible with rainbow tables | User IDs, emails (for tracking) |
| **Mask** | Partial visibility | Fixed pattern | Credit cards (show last 4 digits) |
| **Truncate** | Preserves structure | Partial exposure | URLs (remove query params) |

### Configuration: Attributes Processor

```yaml
processors:
  attributes:
    actions:
      # Drop sensitive headers
      - key: http.request.header.authorization
        action: delete
      
      - key: http.request.header.cookie
        action: delete
      
      - key: http.request.header.x-api-key
        action: delete
      
      # Hash email addresses
      - key: user.email
        action: hash
      
      # Mask credit card numbers (keep last 4 digits)
      - key: payment.card_number
        action: update
        value: "****-****-****-1234"
      
      # Drop entire span if it contains PII
      - key: contains_pii
        action: delete
        value: "true"
```

### Configuration: Redaction Processor (Contrib)

The `redaction` processor uses regex patterns to automatically detect and redact PII:

```yaml
processors:
  redaction:
    allowed_keys:
      - http.request.method
      - http.response.status_code
      - http.route
    
    blocked_values:
      # Credit card patterns (Luhn algorithm compatible)
      - "\\b(?:\\d{4}[- ]?){3}\\d{4}\\b"
      
      # SSN pattern
      - "\\b\\d{3}-\\d{2}-\\d{4}\\b"
      
      # Email addresses
      - "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b"
      
      # AWS keys
      - "AKIA[0-9A-Z]{16}"
      
      # JWT tokens
      - "eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_.+/=]+"
    
    summary: replace  # Options: replace, silent

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, redaction, batch]
      exporters: [otlp]
```

### SDK-Level Redaction (Best Practice)

Redact at the **source** (SDK) to prevent PII from ever leaving the application:

**Python**:
```python
from opentelemetry.sdk.trace import SpanProcessor
import re

class RedactionSpanProcessor(SpanProcessor):
    CREDIT_CARD_PATTERN = re.compile(r'\b(?:\d{4}[- ]?){3}\d{4}\b')
    
    def on_start(self, span, parent_context):
        pass
    
    def on_end(self, span):
        # Redact attributes
        for key, value in list(span.attributes.items()):
            if isinstance(value, str):
                if self.CREDIT_CARD_PATTERN.search(value):
                    span.set_attribute(key, "[REDACTED:CREDIT_CARD]")
        
        # Redact span name
        if self.CREDIT_CARD_PATTERN.search(span.name):
            span.update_name("[REDACTED:CREDIT_CARD]")

# Register processor
provider.add_span_processor(RedactionSpanProcessor())
```

**Go**:
```go
import (
    "regexp"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

var creditCardPattern = regexp.MustCompile(`\b(?:\d{4}[- ]?){3}\d{4}\b`)

type RedactionSpanProcessor struct{}

func (p *RedactionSpanProcessor) OnStart(parent context.Context, s sdktrace.ReadWriteSpan) {}

func (p *RedactionSpanProcessor) OnEnd(s sdktrace.ReadOnlySpan) {
    for _, attr := range s.Attributes() {
        if str, ok := attr.Value.AsString(); ok {
            if creditCardPattern.MatchString(str) {
                s.SetAttribute(attr.Key, "[REDACTED:CREDIT_CARD]")
            }
        }
    }
}

provider.RegisterSpanProcessor(&RedactionSpanProcessor{})
```

### Common PII Patterns

| Data Type | Regex Pattern | Example |
|-----------|---------------|---------|
| **Credit Card** | `\b(?:\d{4}[- ]?){3}\d{4}\b` | 4111-1111-1111-1111 |
| **SSN** | `\b\d{3}-\d{2}-\d{4}\b` | 123-45-6789 |
| **Email** | `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z\|a-z]{2,}\b` | user@example.com |
| **Phone (US)** | `\b\d{3}[-.]?\d{3}[-.]?\d{4}\b` | 555-123-4567 |
| **IP Address** | `\b(?:\d{1,3}\.){3}\d{1,3}\b` | 192.168.1.1 |
| **AWS Key** | `AKIA[0-9A-Z]{16}` | AKIAIOSFODNN7EXAMPLE |
| **JWT** | `eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.` | eyJhbGciOiJIUzI1NiIsIn... |

---

## TLS & Encryption

### Why TLS?

**Without TLS**:
- Telemetry data (including credentials, PII) transmitted in plaintext
- Vulnerable to network sniffing and man-in-the-middle attacks

**With TLS**:
- ✅ Encrypted transport (AES-256-GCM)
- ✅ Authentication (verify collector identity)
- ✅ Integrity (prevent tampering)

### Receiver TLS Configuration

**Collector** (server-side TLS):

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
        tls:
          cert_file: /etc/otel/certs/server.crt
          key_file: /etc/otel/certs/server.key
          client_ca_file: /etc/otel/certs/ca.crt  # For mTLS
          min_version: "1.3"  # TLS 1.3 only
```

### Exporter TLS Configuration

**Collector** (client-side TLS):

```yaml
exporters:
  otlp:
    endpoint: backend.example.com:4317
    tls:
      insecure: false  # Enforce TLS
      ca_file: /etc/otel/certs/ca.crt
      cert_file: /etc/otel/certs/client.crt  # For mTLS
      key_file: /etc/otel/certs/client.key   # For mTLS
      insecure_skip_verify: false  # NEVER set to true in production
      server_name_override: "backend.example.com"  # For SNI
```

### Mutual TLS (mTLS)

**mTLS** ensures both client and server authenticate each other.

**Use case**: Multi-tenant environments, zero-trust networks

**Configuration**:

**Collector (server)**:
```yaml
receivers:
  otlp:
    protocols:
      grpc:
        tls:
          cert_file: /etc/otel/certs/server.crt
          key_file: /etc/otel/certs/server.key
          client_ca_file: /etc/otel/certs/ca.crt  # Verify client certificates
          client_auth_type: require_and_verify_client_cert
```

**SDK (client)**:
```python
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

exporter = OTLPSpanExporter(
    endpoint="collector.example.com:4317",
    credentials=grpc.ssl_channel_credentials(
        root_certificates=open("/etc/otel/ca.crt", "rb").read(),
        private_key=open("/etc/otel/client.key", "rb").read(),
        certificate_chain=open("/etc/otel/client.crt", "rb").read(),
    ),
)
```

### Kubernetes TLS with cert-manager

**Automatically provision TLS certificates**:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: otel-collector-tls
spec:
  secretName: otel-collector-tls
  issuerRef:
    name: ca-issuer
    kind: ClusterIssuer
  dnsNames:
    - otel-collector.observability.svc.cluster.local
  privateKey:
    algorithm: RSA
    size: 2048
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-collector
spec:
  template:
    spec:
      containers:
      - name: otel-collector
        volumeMounts:
        - name: tls
          mountPath: /etc/otel/certs
      volumes:
      - name: tls
        secret:
          secretName: otel-collector-tls
```

---

## Authentication & Authorization

### Bearer Token Authentication

**Extension: bearertokenauth**

```yaml
extensions:
  bearertokenauth:
    scheme: "Bearer"
    token: "secret_token_here"  # Better: Use env var

receivers:
  otlp:
    protocols:
      grpc:
        auth:
          authenticator: bearertokenauth

service:
  extensions: [bearertokenauth]
```

**Environment variable (recommended)**:
```bash
export OTEL_BEARER_TOKEN="secret_token_here"
```

```yaml
extensions:
  bearertokenauth:
    token: ${OTEL_BEARER_TOKEN}
```

### Basic Authentication

```yaml
extensions:
  basicauth:
    username: "otel_user"
    password: "otel_password"  # Better: Use env var

receivers:
  otlp:
    protocols:
      http:
        auth:
          authenticator: basicauth
```

### OIDC Authentication

**Extension: oidcauth**

```yaml
extensions:
  oidc:
    issuer_url: https://auth.example.com
    client_id: otel-collector
    client_secret: ${OIDC_CLIENT_SECRET}
    audience: otel-api

receivers:
  otlp:
    protocols:
      grpc:
        auth:
          authenticator: oidc
```

### API Key Authentication

**Custom header authentication**:

```yaml
processors:
  filter:
    traces:
      span:
        - 'resource.attributes["http.request.header.x-api-key"] != "valid_key"'
```

---

## Exploit Mitigations & Hardening Checklist

- **Transport**: Enforce TLS 1.3 with mTLS for cross-network traffic; never set `insecure_skip_verify: true`.
- **Authentication**: Require bearer/OIDC/basic auth on receivers; pull secrets from env vars/secret managers, not inline YAML.
- **Image Provenance**: Pin collector images to specific tags or digests (no `:latest`); prefer signed images and verify SBOMs.
- **Ingress Defense**: Apply rate limits/body size limits in gateways/proxies to reduce DoS and log-injection risk.
- **Surface Area**: Bind pprof/zpages/health_check to `localhost`; restrict via NetworkPolicy or firewall rules.
- **Runtime Hardening**: Run as non-root with read-only root filesystem, drop all Linux capabilities, and mount tmpfs for scratch.
- **Auditability**: Enable audit logging for auth failures and config changes; rotate tokens/certs on a defined schedule.

---

## Extension Security

### Dangerous Extensions

| Extension | Port | Risk | Exposure Impact |
|-----------|------|------|-----------------|
| `pprof` | 1777 | **Critical** | Heap dumps, CPU profiling → DoS, memory disclosure |
| `zpages` | 55679 | **High** | Live trace data → PII exposure |
| `health_check` | 13133 | Low | Readiness status → minimal risk |

### Secure Configuration

❌ **NEVER do this**:
```yaml
extensions:
  pprof:
    endpoint: "0.0.0.0:1777"  # Exposed to entire network!
```

✅ **Always do this**:
```yaml
extensions:
  pprof:
    endpoint: "localhost:1777"  # Only accessible via kubectl port-forward
```

### Kubernetes NetworkPolicy

Block external access to debug extensions:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: otel-collector-netpol
spec:
  podSelector:
    matchLabels:
      app: otel-collector
  policyTypes:
  - Ingress
  ingress:
  # Allow OTLP traffic
  - from: []
    ports:
    - protocol: TCP
      port: 4317
    - protocol: TCP
      port: 4318
  
  # Block pprof and zpages
  - from:
    - podSelector:
        matchLabels:
          role: debug  # Only allow from specific debug pods
    ports:
    - protocol: TCP
      port: 1777
    - protocol: TCP
      port: 55679
```

### Accessing pprof Securely

**Using kubectl port-forward**:
```bash
kubectl port-forward -n observability svc/otel-collector 1777:1777

# In another terminal
go tool pprof http://localhost:1777/debug/pprof/heap
```

---

## Least Privilege & RBAC

### Kubernetes ServiceAccount

The collector requires specific RBAC permissions for k8sattributes processor:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: otel-collector
  namespace: observability
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: otel-collector
rules:
- apiGroups: [""]
  resources: ["pods", "namespaces", "nodes"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["replicasets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: otel-collector
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: otel-collector
subjects:
- kind: ServiceAccount
  name: otel-collector
  namespace: observability
```

**Principle**: Grant **only** the permissions required. Do not use `cluster-admin`.

### Pod Security Standards

**Restrict collector pods**:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: otel-collector
spec:
  serviceAccountName: otel-collector
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    fsGroup: 10001
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: otel-collector
    image: otel/opentelemetry-collector-contrib:0.100.0
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
    volumeMounts:
    - name: tmpfs
      mountPath: /tmp
  volumes:
  - name: tmpfs
    emptyDir: {}
```

---

## Compliance Patterns

### GDPR Compliance

**Requirements**:
1. **Data Minimization**: Collect only necessary data
2. **Right to be Forgotten**: Delete user data on request
3. **Transparency**: Document what data is collected

**Implementation**:
```yaml
processors:
  # Redact PII
  attributes:
    actions:
      - key: user.email
        action: hash
      - key: user.phone
        action: delete
  
  # Filter out specific users (for deletion requests)
  filter:
    traces:
      span:
        - 'attributes["user.id"] == "deleted_user_123"'
```

### PCI-DSS Compliance

**Requirement**: Never store credit card numbers, CVV, or full magnetic stripe data.

**Implementation**:
```yaml
processors:
  redaction:
    blocked_values:
      # Credit card (any brand)
      - "\\b(?:\\d{4}[- ]?){3}\\d{4}\\b"
      
      # CVV
      - "\\bcvv:\\s*\\d{3,4}\\b"
```

### HIPAA Compliance

**Requirement**: Encrypt PHI (Protected Health Information) in transit and at rest.

**Implementation**:
- ✅ Enable TLS 1.3 for all receivers/exporters
- ✅ Use persistent queues with encrypted storage (AWS EBS encryption, GCP disk encryption)
- ✅ Implement access controls (RBAC, NetworkPolicy)
- ✅ Enable audit logging

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        tls:
          min_version: "1.3"

exporters:
  otlp:
    endpoint: backend.example.com:4317
    tls:
      insecure: false
      ca_file: /etc/otel/ca.crt

extensions:
  file_storage:
    directory: /mnt/encrypted-volume/otel  # Encrypted EBS/disk
```

---

## Reference Links

- **Security Documentation**: https://opentelemetry.io/docs/specs/otel/protocol/exporter/#security
- **Authentication Guide**: https://opentelemetry.io/docs/collector/configuration/#authentication
- **TLS Configuration**: https://opentelemetry.io/docs/specs/otel/protocol/exporter/#tls-configuration
- **Attributes Processor**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/attributesprocessor
- **Redaction Processor**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/redactionprocessor

---

## Summary

✅ **Redact PII** at the SDK or collector using attributes/redaction processors
✅ **Enable TLS** for all receivers and exporters (min version: 1.3)
✅ **Use mTLS** in zero-trust or multi-tenant environments
✅ **Never expose pprof/zpages** on `0.0.0.0`—bind to `localhost` only
✅ **Use RBAC** with least privilege for Kubernetes collectors
✅ **Implement NetworkPolicy** to restrict access to debug endpoints
✅ **Monitor for PII exposure** with automated scanning (regex patterns)
✅ **Document compliance** requirements (GDPR, PCI-DSS, HIPAA)

**Security is not a feature—it's a foundational requirement for observability systems handling production data.**
