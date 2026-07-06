Deploy the OpenTelemetry Collector as a sidecar container within an ECS task to collect telemetry from the application. The setup should:
- Define the collector as a sidecar container in the task definition
- Configure the application to send telemetry to the collector using the container name as hostname
- Use Fargate launch type constraints
- Ensure the collector has sufficient CPU and memory resources
- Implement logging for the collector container
