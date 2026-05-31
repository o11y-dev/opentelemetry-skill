Configure mutual TLS (mTLS) between your application and the OpenTelemetry Collector in Kubernetes. The setup should:
- Generate self-signed certificates for both client and server
- Configure the collector to require and verify client certificates
- Configure the application SDK to present client certificates
- Include certificate rotation strategy
- Explain how to update certificate secret when certificates expire
