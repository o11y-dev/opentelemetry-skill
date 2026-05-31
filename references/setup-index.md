# OpenTelemetry Collector Deployment Setup Index

## Overview

This guide serves as a navigation hub for choosing the right deployment platform and pattern for your OpenTelemetry Collector. Use the decision matrix below to find the setup guide that best matches your infrastructure.

The OpenTelemetry Collector can run on virtually any platform—from Kubernetes clusters to standalone VMs, serverless environments, and containers. Your infrastructure choice determines which deployment patterns and configuration strategies apply.

## Quick Decision: Which Platform Matches Your Use Case?

| Scenario | Platform | Recommended Guide | Key Considerations |
|----------|----------|-------------------|-------------------|
| Running on Kubernetes clusters (EKS, GKE, AKS, OpenShift) | **Kubernetes** | [setup-kubernetes.md](setup-kubernetes.md) | DaemonSet for node-local collection, Gateway for aggregation, Sidecar for Fargate |
| Using AWS ECS on EC2 or Fargate | **ECS** | [setup-ecs.md](setup-ecs.md) | EC2 daemon mode, Fargate sidecar pattern, IAM roles, task metadata |
| Running Docker containers or Docker Compose locally | **Docker** | [setup-docker.md](setup-docker.md) | Compose networking, volume mounts, bridge vs host mode |
| Running on standalone VMs or EC2 instances | **VM/EC2** | [setup-vm.md](setup-vm.md) | Systemd services, binary installation, configuration management |
| Serverless functions (Lambda, Cloud Functions, Azure Functions) | **Serverless** | [platforms.md](../platforms.md#aws-lambda-best-practices) | Lambda extensions, cold starts, async export patterns |

## Deployment Patterns Quick Comparison

All platforms support three core deployment patterns. Choose based on your telemetry collection needs:

| Pattern | Description | Best For | Complexity | Scaling |
|---------|-------------|----------|-----------|---------|
| **Agent/DaemonSet** | Collector runs on each node/host, collecting local metrics and logs | Host metrics, container logs, node-level telemetry | Low | Automatic (1 per node) |
| **Gateway/Deployment** | Centralized collector instance(s) receiving telemetry from applications | Tail sampling, metric aggregation, multi-tier processing | Medium | Manual (replica count) |
| **Sidecar** | Collector runs in same pod/container group as application | Per-pod isolation, Fargate tasks, serverless functions | High | Automatic (1 per pod/function) |

## Hybrid Deployments

Production systems often combine patterns:

```
┌──────────────────────────────────────┐
│   Application Pods (with sidecars)   │
│   ↓ (traces, metrics, logs)          │
├──────────────────────────────────────┤
│   Gateway Collector (aggregation,    │
│   tail sampling, attribute enrichment)│
│   ↓                                  │
├──────────────────────────────────────┤
│   Agent Collectors (host metrics,    │
│   cluster events, log collection)    │
│   ↓                                  │
├──────────────────────────────────────┤
│   Backend Exporters (OTLP, Jaeger,   │
│   Prometheus, etc.)                  │
└──────────────────────────────────────┘
```

This hybrid setup provides:
- **Node coverage** via DaemonSet agents
- **Scalable processing** via Gateway deployments
- **Pod isolation** via optional sidecars

## Platform Selection Decision Tree

```
Is your workload orchestrated?
├─ YES: Kubernetes?
│  └─ YES → See setup-kubernetes.md
│  └─ NO: ECS?
│     ├─ YES → See setup-ecs.md
│     └─ NO: Other orchestration → See documentation for your platform
├─ NO: Containerized?
│  ├─ YES: Docker/Docker Compose → See setup-docker.md
│  └─ NO: Standalone machine → See setup-vm.md

Special cases:
- Serverless (Lambda, Cloud Functions) → See platforms.md
- Hybrid on-prem + cloud → Combine patterns from multiple guides
```

## Network & Connectivity Considerations

Regardless of platform, consider:

| Aspect | Decision |
|--------|----------|
| **Receiver Protocol** | OTLP/gRPC (4317) for high performance; OTLP/HTTP (4318) for firewall traversal |
| **Exporter Authentication** | mTLS for production; API keys/tokens for managed services (store in secrets/vaults) |
| **Network Segmentation** | Agent pattern keeps traffic local; Gateway pattern centralizes network flows |
| **Bandwidth** | Tail sampling (gateway) reduces egress; batch processor increases throughput efficiency |

## Observability Stack Architecture

A typical observability stack includes:

```
Instrumented Apps (SDKs)
    ↓ (OTLP/gRPC or OTLP/HTTP)
[Collector Agent or Sidecar]
    ↓ (internal processing, sampling, filtering)
[Collector Gateway] (optional, for aggregation)
    ↓ (batching, compression)
[Backend or Managed Service]
    → Traces (Jaeger, Tempo, Datadog, etc.)
    → Metrics (Prometheus, Cortex, M3, Datadog, etc.)
    → Logs (Loki, Elasticsearch, S3, Datadog, etc.)
```

## Next Steps

1. **Identify Your Platform**: Choose from the decision matrix above
2. **Read the Setup Guide**: Follow the guide specific to your platform
3. **Review Architecture Patterns**: Each guide explains when to use Agent, Gateway, or Sidecar
4. **Implement & Configure**: Use YAML/JSON examples from your guide
5. **Troubleshoot**: Refer to the troubleshooting section if issues arise
6. **Cross-Reference**: Link to [architecture.md](architecture.md) for detailed scaling patterns, [collector.md](collector.md) for configuration reference, and [security.md](security.md) for hardening

## Common Patterns by Organization Size

| Organization | Recommended Pattern | Rationale |
|--------------|-------------------|-----------|
| **Single application, single region** | Sidecar or Gateway only | Minimal operational overhead |
| **Multiple applications, single region** | Agent + Gateway hybrid | Centralized collection, scalable processing |
| **Multi-region, managed services** | Sidecar + regional gateways | Isolation, reduced blast radius |
| **Enterprise, compliance-sensitive** | Isolated agent/gateway per team | Security boundaries, cost allocation |

---

## Reference Links

- [setup-kubernetes.md](setup-kubernetes.md) — Kubernetes deployment patterns
- [setup-ecs.md](setup-ecs.md) — AWS ECS (EC2 and Fargate)
- [setup-docker.md](setup-docker.md) — Docker and Docker Compose
- [setup-vm.md](setup-vm.md) — Standalone VM and EC2 deployments
- [architecture.md](architecture.md) — Deep-dive on scaling, load balancing, and hybrid patterns
- [platforms.md](../platforms.md) — Serverless and client-side platforms
- [security.md](security.md) — Security hardening and TLS/mTLS
- [collector.md](collector.md) — Collector configuration reference
