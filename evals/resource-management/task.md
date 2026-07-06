Configure resource management for an OpenTelemetry Collector processing 100k traces per second. The configuration should:
- Set appropriate memory_limiter processor to prevent out-of-memory errors
- Configure queue settings for backpressure handling
- Set resource requests and limits in Kubernetes
- Explain how to monitor memory usage
- Include guidance on when to scale horizontally
