Deploy the OpenTelemetry Collector as a sidecar container within a Kubernetes pod alongside your application. The setup should:
- Define the collector container in the pod specification
- Configure the application to send telemetry to the collector using localhost
- Ensure collector and application have appropriate resource requests/limits
- Include proper logging and error handling for the collector
- Explain when sidecar pattern is appropriate vs. DaemonSet/Gateway
