# Collector Baseline Configuration

Start from this local receiver baseline, then adapt it to the confirmed deployment. Before use, replace `your-backend:4317` with a TLS-enabled backend, supply its authentication as required, and provision writable queue and compaction directories (`/var/lib/otelcol/queue` and `/var/lib/otelcol/file_storage`) and persist the queue directory. Network-facing receivers need explicit bind addresses, TLS/authentication, and network access controls from [security.md](security.md).

```yaml
extensions:
  health_check:
    endpoint: "127.0.0.1:13133"
  file_storage/queue:
    directory: /var/lib/otelcol/queue
    timeout: 10s
    compaction:
      on_start: true
      on_rebound: false

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: "127.0.0.1:4317"
      http:
        endpoint: "127.0.0.1:4318"

processors:
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 20
  batch:
    timeout: 10s
    send_batch_size: 1024

exporters:
  otlp:
    endpoint: "your-backend:4317"
    sending_queue:
      enabled: true
      storage: file_storage/queue
      num_consumers: 4
      queue_size: 1024
    retry_on_failure:
      enabled: true
      initial_interval: 1s
      max_interval: 30s
      max_elapsed_time: 300s
  # otlphttp:                        # HTTP exporter — use when backend requires HTTP
  #   endpoint: "https://your-backend:4318"
  #   sending_queue: { enabled: true, storage: file_storage/queue }

service:
  extensions: [health_check, file_storage/queue]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

Deployment notes:

- `batch` reduces exporter network calls.
- `file_storage` preserves queues across restarts only on the same host/volume. In Kubernetes, back `/var/lib/otelcol/queue` with a `ReadWriteOnce` block-backed PVC, not RWX/network storage.
- Loopback listeners are reachable only within the same network namespace. For Kubernetes HTTP probes or remote clients, bind the required endpoint to the pod interface and restrict access; otherwise the probe/client cannot connect.
