# OpenTelemetry Collector Architecture & Deployment Patterns

## Overview

This reference provides comprehensive guidance on deploying the OpenTelemetry Collector in production environments, with a focus on Kubernetes architectures, scaling patterns, and the critical concept of **load balancing stickiness** for stateful operations like tail sampling.

## Table of Contents

1. [Deployment Decision Matrix](#deployment-decision-matrix)
2. [Agent Pattern (DaemonSet)](#agent-pattern-daemonset)
3. [Gateway Pattern (Deployment)](#gateway-pattern-deployment)
4. [Sidecar Pattern](#sidecar-pattern)
5. [Hybrid Architecture](#hybrid-architecture)
6. [Scaling Stateful Collectors](#scaling-stateful-collectors)
7. [Load Balancing & Sticky Sessions](#load-balancing--sticky-sessions)
8. [Target Allocator for Prometheus](#target-allocator-for-prometheus)
9. [Resource Sizing Guidelines](#resource-sizing-guidelines)

---

## Deployment Decision Matrix

Choose the right deployment architecture based on your requirements:

| Pattern | Use Case | Pros | Cons | When to Use |
|---------|----------|------|------|-------------|
| **Agent (DaemonSet)** | Host metrics, logs | 1 per node efficiency | No central aggregation | Logs, host metrics, K8s events |
| **Gateway (Deployment)** | Tail sampling, aggregation | Central processing, scales independently | Additional network hop | Tail sampling, metric aggregation, fan-out |
| **Sidecar** | Per-pod isolation | Strict isolation, no RBAC | High resource overhead | Serverless (Fargate), security isolation |
| **Hybrid** | Production systems | Best of both | Increased complexity | Most production deployments |

### Decision Tree

```
Do you need to collect logs or host metrics?
├─ YES → Deploy Agent (DaemonSet)
└─ NO  → Continue

Do you need tail sampling or span-to-metrics?
├─ YES → Deploy Gateway (Deployment) with sticky sessions
└─ NO  → Continue

Are you on serverless (Fargate/Lambda)?
├─ YES → Deploy Sidecar or use Lambda Extension Layer (see [platforms.md](platforms.md))
└─ NO  → Deploy Gateway for centralized export
```

---

## Agent Pattern (DaemonSet)

### Architecture

The Agent runs **one collector pod per Kubernetes node**. It collects:
- Host metrics (CPU, memory, disk, network)
- Logs from `/var/log/pods`
- Kubernetes events
- Application metrics via pod-local endpoints

### Configuration

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: otel-agent
  namespace: observability
spec:
  selector:
    matchLabels:
      app: otel-agent
  template:
    metadata:
      labels:
        app: otel-agent
    spec:
      serviceAccountName: otel-agent
      containers:
      - name: otel-collector
        image: otel/opentelemetry-collector-contrib:0.100.0
        env:
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        volumeMounts:
        - name: varlog
          mountPath: /var/log
          readOnly: true
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

### RBAC Requirements

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: otel-agent
  namespace: observability
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: otel-agent
rules:
- apiGroups: [""]
  resources: ["pods", "nodes", "namespaces"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: otel-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: otel-agent
subjects:
- kind: ServiceAccount
  name: otel-agent
  namespace: observability
```

### Best Practices

✅ **Always use DaemonSet for logs** - It's the only way to access node-local log files
✅ **Use tolerations** - Ensure the agent runs on all nodes including control plane
✅ **Resource limits** - Set conservative limits (512Mi memory) to prevent node resource exhaustion
✅ **Node-local processing** - Do heavy processing (filtering, redaction) in the agent before forwarding

---

## Gateway Pattern (Deployment)

### Architecture

The Gateway is a **stateless or stateful** collector deployment that:
- Aggregates data from multiple sources
- Performs tail sampling (requires stickiness)
- Reduces egress connections to backends
- Provides a central point for authentication

### Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-gateway
  namespace: observability
spec:
  replicas: 3
  selector:
    matchLabels:
      app: otel-gateway
  template:
    metadata:
      labels:
        app: otel-gateway
    spec:
      serviceAccountName: otel-gateway
      containers:
      - name: otel-collector
        image: otel/opentelemetry-collector-contrib:0.100.0
        ports:
        - containerPort: 4317  # OTLP gRPC
          name: otlp-grpc
        - containerPort: 4318  # OTLP HTTP
          name: otlp-http
        - containerPort: 8888  # Metrics
          name: metrics
        - containerPort: 13133 # Health check
          name: health
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        livenessProbe:
          httpGet:
            path: /
            port: 13133
        readinessProbe:
          httpGet:
            path: /
            port: 13133
---
apiVersion: v1
kind: Service
metadata:
  name: otel-gateway
  namespace: observability
spec:
  selector:
    app: otel-gateway
  ports:
  - name: otlp-grpc
    port: 4317
    targetPort: 4317
  - name: otlp-http
    port: 4318
    targetPort: 4318
  - name: metrics
    port: 8888
    targetPort: 8888
```

### Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: otel-gateway-hpa
  namespace: observability
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: otel-gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Best Practices

✅ **3 replicas minimum** - Ensures high availability during rolling updates
✅ **Resource over-provisioning** - Gateway handles bursts; set limits 2-4x requests
✅ **HPA on memory** - Collector memory usage is often the bottleneck
✅ **Health checks** - Always configure liveness and readiness probes

---

## Sidecar Pattern

### Architecture

Each application pod gets its own collector container. Use **only** for:
- Serverless environments (AWS Fargate, Google Cloud Run)
- Strict security isolation requirements
- Per-tenant data segregation

**Note**: For AWS Lambda, use the Collector Extension Layer pattern instead. See [platforms.md](platforms.md) for Lambda-specific configuration.

### Configuration

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-sidecar
spec:
  containers:
  - name: app
    image: myapp:latest
    env:
    - name: OTEL_EXPORTER_OTLP_ENDPOINT
      value: "http://localhost:4317"
  - name: otel-sidecar
    image: otel/opentelemetry-collector-contrib:0.100.0
    resources:
      requests:
        cpu: 50m
        memory: 64Mi
      limits:
        cpu: 200m
        memory: 256Mi
```

### Trade-offs

❌ **High resource overhead** - Every pod pays the memory/CPU cost
❌ **Deployment complexity** - Must update all pods to change collector config
❌ **No RBAC** - Cannot use k8sattributes processor (no cluster access)

✅ **Strong isolation** - Tenant A's collector never sees Tenant B's data
✅ **Fargate compatible** - No DaemonSet support in serverless

---

## Hybrid Architecture

### Pattern

**Agent (DaemonSet) → Gateway (Deployment) → Backend**

This is the recommended production architecture:

1. **Agent**: Collects logs, host metrics, and forwards traces to Gateway
2. **Gateway**: Performs tail sampling, aggregation, and exports to backend

### Configuration Flow

```yaml
# Agent config snippet
exporters:
  otlp:
    endpoint: otel-gateway.observability.svc.cluster.local:4317
    tls:
      insecure: true  # Within cluster

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp]  # Forward to gateway
    logs:
      receivers: [filelog]
      processors: [memory_limiter, k8sattributes, batch]
      exporters: [otlp]  # Forward to gateway
```

```yaml
# Gateway config snippet
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

---

## Scaling Stateful Collectors

### The Stickiness Problem

**Tail sampling requires all spans of a trace to arrive at the same collector instance** to make correct sampling decisions. Standard Kubernetes Service load balancing (round-robin) breaks this requirement.

#### Without Stickiness (BROKEN)

```
Span A (trace_id: 123) → Gateway Pod 1
Span B (trace_id: 123) → Gateway Pod 2  ❌ Different pod!
```

**Result**: Incomplete trace → Incorrect sampling decision

#### With Stickiness (CORRECT)

```
Span A (trace_id: 123) → Gateway Pod 1
Span B (trace_id: 123) → Gateway Pod 1  ✅ Same pod!
```

**Result**: Complete trace → Correct sampling decision

---

## Load Balancing & Sticky Sessions

### Solution: Load Balancing Exporter

Use a **two-tier architecture**:
1. **Pre-Gateway (Agents)**: Use loadbalancing exporter with traceID routing
2. **Gateway**: Runs tail_sampling processor

### Architecture

```
Agent → LoadBalancing Exporter (routing_key: traceID) → Gateway (Headless Service)
```

### Pre-Gateway Configuration

```yaml
# In the Agent or Pre-Gateway tier
exporters:
  loadbalancing:
    protocol:
      otlp:
        endpoint: placeholder  # Will be replaced by resolver
        tls:
          insecure: true
    routing_key: "traceID"  # Critical: Ensures stickiness
    resolver:
      k8s:
        service: otel-gateway-headless  # Headless Service
        ports:
          - 4317
```

### Gateway Headless Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: otel-gateway-headless
  namespace: observability
spec:
  clusterIP: None  # Headless: Resolver gets individual pod IPs
  selector:
    app: otel-gateway
  ports:
  - name: otlp-grpc
    port: 4317
    targetPort: 4317
```

### How It Works

1. **Resolver discovers pods**: The k8s resolver queries the Headless Service and gets individual pod IPs (e.g., `10.0.1.5`, `10.0.1.6`, `10.0.1.7`)
2. **Consistent hashing**: The loadbalancing exporter uses `traceID` as the routing key and applies consistent hashing to select the target pod
3. **Sticky routing**: All spans with the same `traceID` hash to the same pod IP

### Critical Requirements

⚠️ **Must use Headless Service** - Regular Service returns VIP, not individual IPs
⚠️ **Must set routing_key: traceID** - Without this, routing is random
⚠️ **Gateway must have stable network identity** - Use StatefulSet if pod IPs change frequently

---

## Target Allocator for Prometheus

### The Problem

When scaling the Prometheus receiver, every collector replica scrapes every target → **duplicate data**.

### The Solution

The **Target Allocator** (part of the OpenTelemetry Operator) shards Prometheus targets across collector replicas.

### Architecture

```
Target Allocator (Discovers targets) → Assigns targets to Collector Replicas
Collector Replica 1: Scrapes targets 1-100
Collector Replica 2: Scrapes targets 101-200
Collector Replica 3: Scrapes targets 201-300
```

### Configuration

```yaml
apiVersion: opentelemetry.io/v1alpha1
kind: OpenTelemetryCollector
metadata:
  name: otel-prometheus
spec:
  mode: statefulset
  replicas: 3
  targetAllocator:
    enabled: true
    serviceAccount: otel-prometheus-ta
    prometheusCR:
      enabled: true  # Discover ServiceMonitors and PodMonitors
  config: |
    receivers:
      prometheus:
        config:
          scrape_configs: []  # Populated by Target Allocator
        target_allocator:
          endpoint: http://otel-prometheus-targetallocator:80
          interval: 30s
          collector_id: "${POD_NAME}"
```

### Benefits

✅ **No duplicate metrics** - Each target is scraped by exactly one collector
✅ **Horizontal scaling** - Add replicas to distribute scrape load
✅ **Auto-discovery** - Integrates with Prometheus Operator CRDs

---

## Resource Sizing Guidelines

### Agent (DaemonSet)

| Workload | CPU Request | Memory Request | CPU Limit | Memory Limit |
|----------|-------------|----------------|-----------|--------------|
| Low (dev) | 100m | 128Mi | 200m | 256Mi |
| Medium | 200m | 256Mi | 500m | 512Mi |
| High (prod) | 500m | 512Mi | 1000m | 1Gi |

### Gateway (Deployment)

| Throughput | CPU Request | Memory Request | CPU Limit | Memory Limit | Replicas |
|------------|-------------|----------------|-----------|--------------|----------|
| <1k RPS | 500m | 1Gi | 1000m | 2Gi | 2 |
| 1-10k RPS | 1000m | 2Gi | 2000m | 4Gi | 3 |
| 10-50k RPS | 2000m | 4Gi | 4000m | 8Gi | 5 |
| >50k RPS | 4000m | 8Gi | 8000m | 16Gi | 10+ |

### Persistent Storage (file_storage)

| Use Case | Volume Size | IOPS Requirement |
|----------|-------------|------------------|
| Short buffer (<1h) | 5-10 GB | Standard |
| Medium buffer (1-6h) | 20-50 GB | gp3 (3000 IOPS) |
| Long buffer (>6h) | 100+ GB | gp3 (5000+ IOPS) |

---

## Reference Links

- **Deployment Patterns**: https://opentelemetry.io/docs/collector/deployment/
- **Kubernetes Operator**: https://github.com/open-telemetry/opentelemetry-operator
- **Target Allocator**: https://github.com/open-telemetry/opentelemetry-operator#target-allocator
- **Scaling Guide**: https://opentelemetry.io/docs/collector/scaling/

---

## Summary

✅ Use **DaemonSet** for logs and host metrics (always)
✅ Use **Gateway** for tail sampling with loadbalancing exporter (sticky sessions)
✅ Use **Sidecar** only for serverless or strict isolation
✅ Use **Hybrid** for production (Agent → Gateway → Backend)
✅ Use **Target Allocator** for Prometheus scraping at scale
✅ Always configure **HPA** on memory utilization for gateways
✅ Always use **Headless Service** with loadbalancing exporter

**Deployment is not just about running a binary—it's about building a resilient, scalable observability pipeline.**
