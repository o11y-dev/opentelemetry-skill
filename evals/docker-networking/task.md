Configure networking for the OpenTelemetry Collector in Docker to enable communication between:
- Application container sending telemetry to the collector
- Collector exporting data to backend observability platform
- External systems accessing collector metrics

Requirements:
- Use bridge network or custom network for service-to-service communication
- Expose collector ports appropriately (internal vs. external)
- Handle firewall and proxy considerations
- Implement DNS service discovery if applicable
