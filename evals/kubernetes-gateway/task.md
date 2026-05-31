Deploy the OpenTelemetry Collector as a Gateway (Deployment) in Kubernetes to receive telemetry from distributed applications. The collector should:
- Run as a Deployment (not DaemonSet) with configurable replicas
- Use a load balancer service for distributing traffic
- Implement a loadbalancing exporter to route traces by trace ID for tail sampling
- Configure resource requests and limits appropriate for centralized processing
- Use persistent queues for resilience against backend outages
