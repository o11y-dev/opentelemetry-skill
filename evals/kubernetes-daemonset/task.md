Deploy the OpenTelemetry Collector as a DaemonSet in a Kubernetes cluster to collect telemetry from all nodes. The collector should:
- Run on every node to collect node-level metrics and container logs
- Use node affinity to avoid collecting telemetry on specific nodes
- Implement resource limits to prevent node resource exhaustion
- Include health checks to ensure collector availability
- Use RBAC to grant minimum required permissions
