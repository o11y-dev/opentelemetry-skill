# OpenTelemetry Validation and Error Recovery

Use this reference when users ask to validate collector configs, verify live pipelines, or recover from runtime failures.

## Validate before deploying

```bash
# Syntax and structural validation (local binary)
otelcol validate --config config.yaml

# Container-based dry-run (no outbound traffic)
docker run --rm -v $(pwd)/config.yaml:/etc/otelcol/config.yaml \
  otel/opentelemetry-collector-contrib:latest \
  validate --config /etc/otelcol/config.yaml
```

## Verify a live pipeline

```bash
# Health endpoint — returns 200 when collector is ready
curl -sf http://localhost:13133/ && echo "healthy"

# Tail logs for pipeline errors and dropped data
kubectl logs -l app=otelcol -f | grep -E "error|dropped|refused|timeout"

# Collector self-metrics (Prometheus scrape)
curl -s http://localhost:8888/metrics | grep -E "otelcol_processor_dropped|otelcol_exporter_send_failed"
```

## Error recovery guidance

| Symptom | Likely cause | Fix |
|---|---|---|
| Collector exits at start | Config parse error | Run `otelcol validate`; check indentation and quoted strings |
| `memory_limiter: data dropped` in logs | Memory limit hit | Increase `limit_percentage`, reduce `send_batch_size`, or add upstream sampling |
| `exporter queue is full` | Backend unreachable or slow | Verify endpoint reachability; increase `queue_size`; check `retry_on_failure` settings |
| `pipeline drops data` on restart | No persistent queue | Add `file_storage` extension and set `storage: file_storage/queue` in exporter sending_queue |
| OTTL statement silently skipped | Type mismatch or nil value | Add `error_mode: ignore`; guard with `where attributes["key"] != nil`; use `Int()` / `String()` converters |
| Tail sampling misses spans | Spans split across collector instances | Use `loadbalancing` exporter with `routing_key: traceID` upstream |
