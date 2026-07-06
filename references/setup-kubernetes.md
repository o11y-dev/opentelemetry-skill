# Kubernetes Collector Deployment Patterns

## Overview

Kubernetes is the preferred platform for deploying the OpenTelemetry Collector at scale. This guide covers three core patterns: Agent (DaemonSet), Gateway (Deployment), and Sidecar, along with platform-specific considerations for EKS, GKE, AKS, and OpenShift.

The Kubernetes ecosystem provides native abstractions for resilience, scaling, and RBAC that simplify collector deployments compared to VMs.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│         Application Pods (any namespace)        │
│  ┌────────────────────────────────────────────┐ │
│  │ App Container    │ Sidecar Collector       │ │
│  │ (instrumented)   │ (optional)              │ │
│  └────────────────────────────────────────────┘ │
└──────────┬──────────────────────────┬───────────┘
           │ (localhost:4317)         │
    ┌──────┴──────────────────────────┴───────┐
    │    Gateway Collector (Deployment)       │
    │    • Tail sampling                      │
    │    • Attribute enrichment               │
    │    • Batching & compression             │
    │    • 2-5 replicas (sticky routing)     │
    └──────────────┬──────────────────────────┘
                   │
    ┌──────────────┴──────────────────────────┐
    │    Agent Collector (DaemonSet)         │
    │    • Node metrics (CPU, memory, etc.)   │
    │    • kubelet stats                      │
    │    • Pod logs via volume mounts         │
    │    • Kubernetes events                  │
    │    One per cluster node                 │
    └──────────────┬──────────────────────────┘
                   │
    ┌──────────────┴──────────────────────────┐
    │    Backend Exporters (OTLP, etc.)      │
    │    • Traces, Metrics, Logs             │
    │    • Managed backends or on-prem      │
    └──────────────────────────────────────────┘
```

## Kubernetes Platform Support

| Platform | Notes | Networking | RBAC | DaemonSet Support |
|----------|-------|-----------|------|------------------|
| **EKS** | AWS managed, fully compatible | VPC CNI, Security Groups | IAM via IRSA | Yes |
| **GKE** | Google managed, fully compatible | VPC, Cloud Armor | IAM Service Accounts | Yes |
| **AKS** | Azure managed, fully compatible | Virtual Networks, NSGs | RBAC with Entra ID | Yes |
| **OpenShift** | Red Hat distribution, additional security | OVN/Calico | RBAC + SCCs (Security Context Constraints) | Yes, with SCC exceptions |
| **Self-managed (kubeadm, kops, etc.)** | Custom networking and RBAC setup | Your choice (Calico, Weave, etc.) | Your RBAC policy | Yes |

## Deployment Pattern Selection

### Agent Pattern (DaemonSet)

**When to use:**
- Collecting host metrics (CPU, memory, disk, network per node)
- Collecting pod logs via `/var/log/pods`
- Collecting Kubernetes events
- Building a cluster observability foundation

**Single-node collection breakdown:**
```yaml
DaemonSet Replica on each node:
  │
  ├─ hostNetwork: true (access to host metrics)
  ├─ hostPID: true (optional, for host processes)
  ├─ Prometheus receiver → kubelet stats (:10250)
  ├─ Filelog receiver → /var/log/pods/* (mounted)
  ├─ K8s events receiver → Kubernetes API
  └─ Processors (batch, memory limiter, etc.)
  └─ Exporters (OTLP to gateway or backend)
```

**Example YAML:**

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
      tier: agent
  template:
    metadata:
      labels:
        app: otel-agent
        tier: agent
    spec:
      serviceAccountName: otel-agent
      # Tolerations for node taints (control plane, workload-specific)
      tolerations:
      - effect: NoSchedule
        operator: Exists
      - effect: NoExecute
        operator: Exists
      hostNetwork: true  # Required for kubelet stats
      hostPID: false     # Set to true only if monitoring host processes
      containers:
      - name: otel-collector
        image: otel/opentelemetry-collector-contrib:latest
        imagePullPolicy: IfNotPresent
        ports:
        - name: otlp-grpc
          containerPort: 4317
          protocol: TCP
          hostPort: 4317  # Required for pod-to-agent discovery
        - name: otlp-http
          containerPort: 4318
          protocol: TCP
          hostPort: 4318
        - name: metrics
          containerPort: 8888
          protocol: TCP
        env:
        - name: GOGC
          value: "80"
        - name: OTEL_EXPORTER_OTLP_ENDPOINT
          value: "http://otel-gateway.observability:4317"
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        volumeMounts:
        - name: varlog
          mountPath: /var/log
          readOnly: true
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        securityContext:
          runAsUser: 0
          runAsGroup: 0
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

### Gateway Pattern (Deployment)

**When to use:**
- Performing tail sampling across multiple traces
- Aggregating metrics or logs
- Enriching attributes with cluster metadata
- Reducing backend load via batching and compression
- Multi-tier processing (e.g., sampling decision after initial processing)

**YAML example (Deployment + Service):**

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-gateway
  namespace: observability
spec:
  replicas: 3  # Odd number for quorum-based decisions
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
        image: otel/opentelemetry-collector-contrib:latest
        ports:
        - name: otlp-grpc
          containerPort: 4317
        - name: otlp-http
          containerPort: 4318
        - name: metrics
          containerPort: 8888
        env:
        - name: GOGC
          value: "80"
        - name: OTEL_EXPORTER_OTLP_ENDPOINT
          value: "https://backend.example.com:4317"
        - name: OTEL_EXPORTER_OTLP_HEADERS
          valueFrom:
            secretKeyRef:
              name: backend-credentials
              key: headers
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /
            port: 13133
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /
            port: 13133
          initialDelaySeconds: 5
          periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: otel-gateway
  namespace: observability
spec:
  type: ClusterIP
  clusterIP: None
  selector:
    app: otel-gateway
  ports:
  - name: otlp-grpc
    port: 4317
    targetPort: 4317
    protocol: TCP
  - name: otlp-http
    port: 4318
    targetPort: 4318
    protocol: TCP
```

**Key gotchas:**
- **TraceID routing for tail sampling**: Kubernetes `sessionAffinity: ClientIP` is still a valid option for ordinary gateway scale-out and for topologies where all spans for a trace arrive from the same client source. It is not trace-aware, so traces that include spans from multiple pods or services can still be split across gateway replicas. For tail sampling in multi-source traces, send traces through upstream agents that use the `loadbalancing` exporter with `routing_key: traceID` and resolve this headless service.
- **Replica count strategy**: Use odd numbers (3, 5, 7) for better distribution; avoid 2 or 4
- **Memory limiter**: Set aggressive `memory_limiter` in config to prevent OOM kills during traffic spikes
- **Tracestate headers**: Tail sampling decisions rely on consistent routing; if sticky routing fails, sampling is non-deterministic

ClientIP stickiness option for non-tail-sampling gateway scale-out:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: otel-gateway
  namespace: observability
spec:
  type: ClusterIP
  selector:
    app: otel-gateway
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIPConfig:
      timeoutSeconds: 3600
  ports:
  - name: otlp-grpc
    port: 4317
    targetPort: 4317
    protocol: TCP
```

Agent exporter for tail-sampling stickiness:

```yaml
exporters:
  loadbalancing:
    routing_key: traceID
    protocol:
      otlp:
        endpoint: placeholder
        tls:
          insecure: true
    resolver:
      k8s:
        service: otel-gateway
        ports: [4317]
```

### Sidecar Pattern

**When to use:**
- Strict pod isolation (compliance, multi-tenant)
- Fargate deployments (no DaemonSet access)
- Per-pod telemetry queuing (resilience)

**Example: Init container pattern or Helm subcharts**

Sidecar collectors are typically injected via:
1. Kubernetes mutating webhooks (automatic injection)
2. Init containers that seed config volumes
3. Helm chart with shared collectors

Example init container pattern:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-collector
spec:
  initContainers:
  - name: init-collector-config
    image: otel/opentelemetry-collector-contrib:latest
    command: ["cp", "/etc/collector/config.yaml", "/var/shared/config.yaml"]
    volumeMounts:
    - name: collector-config
      mountPath: /etc/collector
      readOnly: true
    - name: shared-config
      mountPath: /var/shared
  containers:
  - name: app
    image: myapp:latest
    env:
    - name: OTEL_EXPORTER_OTLP_ENDPOINT
      value: "http://localhost:4317"
  - name: otel-collector
    image: otel/opentelemetry-collector-contrib:latest
    ports:
    - containerPort: 4317
    volumeMounts:
    - name: shared-config
      mountPath: /etc/otel
  volumes:
  - name: collector-config
    configMap:
      name: otel-collector-config
  - name: shared-config
    emptyDir: {}
```

## Common Gotchas & Solutions

### Gotcha 1: hostNetwork + Port Conflicts

**Symptom:** DaemonSet collector fails to bind to port 4317

**Cause:** `hostNetwork: true` with conflicts from other processes

**Solution:**
```yaml
# Change the receiver and exposed host port to an explicit unused port.
spec:
  template:
    spec:
      hostNetwork: true
      containers:
      - name: otel-collector
        ports:
        - containerPort: 14317
          hostPort: 14317
          name: otlp-grpc-alt
```

Update the collector OTLP receiver to bind to the same port, for example `0.0.0.0:14317`.

Alternative: use `hostNetwork: false` and expose the DaemonSet behind a Service if your network layer allows pod-to-pod discovery.

### Gotcha 2: Node Affinity & Taint Tolerations

**Symptom:** DaemonSet replicas missing on certain nodes

**Cause:** Missing tolerations for node taints

**Solution:**
```yaml
spec:
  template:
    spec:
      tolerations:
      # Tolerate NoSchedule taint (common on control planes)
      - key: node-role.kubernetes.io/control-plane
        operator: Equal
        effect: NoSchedule
      # Tolerate NoExecute with grace period
      - key: any-key
        operator: Exists
        effect: NoExecute
        tolerationSeconds: 300
      # For GPU nodes, workload-specific taints, etc.
      - key: workload-type
        operator: Equal
        value: gpu
        effect: NoSchedule
```

### Gotcha 3: RBAC & ServiceAccount

**Symptom:** Collector can't query Kubernetes API for events or metadata

**Cause:** Missing RBAC bindings

**Solution:**
```yaml
---
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
  resources: ["events"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods", "namespaces", "nodes"]
  verbs: ["get", "list"]
- apiGroups: ["apps"]
  resources: ["replicasets"]
  verbs: ["get", "list"]

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

### Gotcha 4: Resource Limits Too Low

**Symptom:** Collector killed with OOM or CPU throttling

**Cause:** Insufficient requests/limits

**Solution:** Start conservative, monitor, and adjust:
```yaml
resources:
  requests:
    cpu: 100m      # Agent: 100m, Gateway: 500m
    memory: 256Mi   # Agent: 256Mi, Gateway: 1Gi
  limits:
    cpu: 500m       # Agent: 500m, Gateway: 2000m
    memory: 512Mi   # Agent: 512Mi, Gateway: 2Gi
```

Monitor actual usage: `kubectl top pods -n observability`

### Gotcha 5: Persistent Queue Storage Missing

**Symptom:** Data loss when collector restarts; tail sampling state lost

**Cause:** File storage not mounted; using in-memory queues

**Solution:** Mount a PVC for queue persistence:
```yaml
spec:
  template:
    spec:
      volumes:
      - name: collector-queue
        persistentVolumeClaim:
          claimName: otel-queue
      containers:
      - name: otel-collector
        volumeMounts:
        - name: collector-queue
          mountPath: /var/lib/otel
```

In collector config (`config.yaml`):
```yaml
exporters:
  otlp:
    endpoint: backend:4317
    sending_queue:
      storage: file_storage  # Persistent queue

extensions:
  file_storage:
    directory: /var/lib/otel
    timeout: 10s
    compaction:
      directory: /var/lib/otel
      renotify_on_update: true
      renotify_on_start: true
      interval: 5m
      on_start: true
```

## Troubleshooting

### Collector pod not starting

**Diagnostic steps:**
```bash
# Check pod status
kubectl describe pod -n observability otel-agent-xxxxx

# View collector logs
kubectl logs -n observability -l app=otel-agent --tail=100

# Check image availability
kubectl describe pods -n observability otel-agent-xxxxx | grep -A 5 "Containers:"

# Verify RBAC permissions
kubectl auth can-i get events --as=system:serviceaccount:observability:otel-agent
```

**Common causes:**
- Image pull errors: check `imagePullSecrets` and registry credentials
- RBAC denied: verify ServiceAccount and ClusterRoleBinding
- Resource constraints: check node capacity with `kubectl describe nodes`

### No telemetry received from nodes

**Diagnostic steps:**
```bash
# Verify hostNetwork connectivity
kubectl exec -it otel-agent-xxxxx -n observability -- netstat -tlnp | grep 4317

# Test OTLP endpoint from pod
kubectl exec -it otel-agent-xxxxx -n observability -- curl -s http://localhost:4317/healthz

# Check collector config in ConfigMap
kubectl get configmap -n observability otel-collector-config -o yaml

# Verify environment variables in pod
kubectl exec -it otel-agent-xxxxx -n observability -- env | grep OTEL
```

**Common causes:**
- `hostNetwork: false` prevents pod-local collection: set `hostNetwork: true` for DaemonSet agents
- OTLP receiver disabled in config: verify `otlp:` receiver in `collectors:` section
- Firewall/Security Group blocking access: check ingress rules for port 4317

### High memory usage or OOM kills

**Diagnostic steps:**
```bash
# Check memory limits vs actual usage
kubectl top pods -n observability -l app=otel-gateway

# View OOM kills in events
kubectl get events -n observability --sort-by='.lastTimestamp' | grep -i oom

# Inspect memory_limiter config
kubectl exec -it otel-gateway-xxxxx -n observability -- cat /etc/otel/config.yaml | grep -A 5 memory_limiter
```

**Common causes:**
- Memory limiter not configured: add `memory_limiter` processor before exporters
- Tail sampling with large traces: adjust sampling ratios or increase memory
- Metric cardinality explosion: use `attributes` processor to drop high-cardinality dimensions
- Batch size too large: reduce `send_batch_size` in batch processor

---

## Reference Links

- [setup-index.md](setup-index.md) — Platform selection guide
- [architecture.md](architecture.md) — Deep-dive on scaling and load balancing
- [security.md](security.md) — mTLS, RBAC hardening, and compliance
- [collector.md](collector.md) — Full configuration reference
