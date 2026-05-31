Deploy the OpenTelemetry Collector as a daemon service in AWS ECS on EC2 instances with the following requirements:
- Configure collector to run as a service on every EC2 instance
- Set up applications to send telemetry to the EC2 host IP (not localhost or container name)
- Configure IAM roles for collector to access AWS services
- Implement service discovery for applications to find the collector
- Handle collector failures and auto-restart
