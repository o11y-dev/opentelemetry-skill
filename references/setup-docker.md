# Docker & Docker Compose Deployment

## Overview

Docker provides the simplest starting point for running the OpenTelemetry Collector outside of orchestration platforms. This guide covers standalone containers and Docker Compose multi-container deployments, ideal for development, testing, and small-scale production environments.

## Standalone Container

### Docker Run Command

```bash
docker run -d \
  --name otel-collector \
  --restart unless-stopped \
  -p 4317:4317/tcp \
  -p 4318:4318/tcp \
  -p 8888:8888/tcp \
  -e GOGC=80 \
  -e OTEL_EXPORTER_OTLP_ENDPOINT="https://backend.example.com:4317" \
  -e OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer $(cat /run/secrets/backend_token)" \
  -v $(pwd)/config.yaml:/etc/otel/config.yaml:ro \
  -v otel-queue:/var/lib/otel \
  --log-driver json-file \
  --log-opt max-size=100m \
  --log-opt max-file=3 \
  otel/opentelemetry-collector-contrib:latest
```

**Flags explained:**
- `-d` — Run detached (background)
- `--restart unless-stopped` — Restart on crash, but respect manual stop
- `-p 4317:4317/tcp` — Publish OTLP/gRPC on TCP port 4317
- `-e` — Environment variables (config overrides)
- `-v config.yaml:/etc/otel/config.yaml:ro` — Mount config file read-only
- `-v otel-queue:/var/lib/otel` — Mount named volume for queue persistence
- `--log-driver json-file` — Use JSON logging for easy log collection

### Verify Container is Running

```bash
# Check status
docker ps | grep otel-collector

# View logs
docker logs -f otel-collector

# Health check
docker exec otel-collector curl -s http://localhost:13133/ | jq .

# Inspect memory usage
docker stats otel-collector
```

## Volume Mount Patterns

### Read-only Config

```bash
# Mount config as read-only to prevent accidental modification
docker run -d \
  -v /etc/otel/collector/config.yaml:/etc/otel/config.yaml:ro \
  otel/opentelemetry-collector-contrib:latest
```

### Writable State Directory

```bash
# Create persistent volume for queue storage
docker volume create otel-queue

docker run -d \
  -v otel-queue:/var/lib/otel \
  otel/opentelemetry-collector-contrib:latest
```

### Host Metrics Collection (bind mount)

```bash
# Collect host metrics from /proc and /sys
docker run -d \
  --privileged \
  -v /proc:/proc:ro \
  -v /sys:/sys:ro \
  -v /etc:/etc:ro \
  otel/opentelemetry-collector-contrib:latest
```

**Warning:** `--privileged` grants full access to host resources; use only in trusted environments.

## Network Mode Considerations

| Mode | Use Case | Pros | Cons |
|------|----------|------|------|
| **bridge** (default) | App + collector communication via container network | Isolation, custom DNS | Extra network hop, NAT overhead |
| **host** | Direct host network access | No NAT, lower latency | Security risk, port conflicts possible |
| **container:name** | Share network with another container | Simplicity, same IP | Limited isolation |
| **none** | Disable networking | Maximum isolation | Can't reach backend |

```bash
# Bridge mode (default)
docker run -d -p 4317:4317 otel/opentelemetry-collector-contrib:latest

# Host mode (low latency, but security risk)
docker run -d --net host otel/opentelemetry-collector-contrib:latest

# Custom bridge network (app + collector)
docker network create observability
docker run -d --net observability --name otel-collector otel/opentelemetry-collector-contrib:latest
docker run -d --net observability -e OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-collector:4317" myapp:latest
```

## Docker Compose with Collector Sidecar

```yaml
version: '3.8'

services:
  # Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: myapp:latest
    container_name: myapp
    environment:
      # Point to collector sidecar on localhost
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4317"
      OTEL_SERVICE_NAME: "myapp"
      OTEL_EXPORTER_OTLP_INSECURE: "true"
    ports:
      - "8080:8080"
    networks:
      - observability
    depends_on:
      otel-collector:
        condition: service_healthy
    restart: unless-stopped

  # OpenTelemetry Collector (sidecar pattern)
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    container_name: otel-collector
    command:
      - "--config=/etc/otel/config.yaml"
    volumes:
      - ./collector-config.yaml:/etc/otel/config.yaml:ro
      - otel-queue:/var/lib/otel
    ports:
      - "4317:4317"  # OTLP gRPC
      - "4318:4318"  # OTLP HTTP
      - "8888:8888"  # Prometheus metrics
      - "13133:13133" # Health check
    environment:
      GOGC: "80"
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://backend.example.com:4317"
      # Load API key from .env file (NOT hardcoded)
      BACKEND_API_KEY: "${BACKEND_API_KEY}"
    networks:
      - observability
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:13133/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"

  # Optional: Backend proxy or gateway (if running locally)
  # otel-gateway:
  #   image: otel/opentelemetry-collector-contrib:latest
  #   ports:
  #     - "4317:4317"
  #   environment:
  #     OTEL_EXPORTER_OTLP_ENDPOINT: "${BACKEND_ENDPOINT}"

networks:
  observability:
    driver: bridge

volumes:
  otel-queue:
    driver: local
```

### Service Discovery (Docker Compose)

Within Compose, services communicate via service name:

```yaml
environment:
  # App discovers collector by service name
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4317"
  # Gateway exports to external backend
  # Use ${BACKEND_ENDPOINT} from .env
  OTEL_EXPORTER_OTLP_BACKEND: "${BACKEND_ENDPOINT}"
```

Create `.env` file:

```env
BACKEND_ENDPOINT=https://api.example.com:4317
BACKEND_API_KEY=sk_live_xxxxx
```

## State & Queue Persistence

### Named Volume for Queue

```bash
# Create volume explicitly
docker volume create otel-queue

# Mount in container
docker run -d \
  -v otel-queue:/var/lib/otel \
  otel/opentelemetry-collector-contrib:latest
```

In collector config (`config.yaml`):

```yaml
extensions:
  file_storage:
    directory: /var/lib/otel
    timeout: 10s
    compaction:
      interval: 5m

exporters:
  otlp:
    endpoint: backend:4317
    sending_queue:
      storage: file_storage
      enabled: true

service:
  extensions: [file_storage]
  pipelines:
    traces:
      exporters: [otlp]
    metrics:
      exporters: [otlp]
    logs:
      exporters: [otlp]
```

### Inspect Queue State

```bash
# List volumes
docker volume ls | grep otel

# Inspect volume mount point
docker volume inspect otel-queue

# View queued data
docker run --rm -v otel-queue:/var/lib/otel alpine:latest \
  ls -lah /var/lib/otel
```

## Environment Configuration

```bash
# Via -e flag
docker run -e OTEL_EXPORTER_OTLP_ENDPOINT="http://backend:4317" ...

# Via .env file (compose only)
docker-compose --env-file .env up

# Via environment file mounted
docker run --env-file /path/to/env-file ...
```

Sample `.env.example`:

```env
# Backend configuration
OTEL_EXPORTER_OTLP_ENDPOINT=https://backend.example.com:4317
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer YOUR_API_KEY"

# Collector tuning
GOGC=80
GOMEMLIMIT=500MiB

# Sampling
OTEL_TRACES_SAMPLER=jaeger_remote
OTEL_TRACES_SAMPLER_ARG=http://localhost:14250
```

## Troubleshooting

### Container won't start

**Diagnostic steps:**
```bash
# Check logs immediately after start
docker logs otel-collector

# Inspect container status
docker inspect otel-collector | jq '.[0].State'

# Re-run in foreground for verbose output
docker run --rm \
  -v $(pwd)/config.yaml:/etc/otel/config.yaml:ro \
  otel/opentelemetry-collector-contrib:latest
```

**Common causes:**
- Config file not found: verify `-v` mount path
- Invalid YAML in config: use `yamllint config.yaml`
- Port already in use: check `docker ps` for conflicting containers or `lsof -i :4317`

### No network connectivity between containers

**Diagnostic steps:**
```bash
# List networks
docker network ls | grep observability

# Inspect network
docker network inspect observability

# Test DNS resolution from app container
docker exec myapp nslookup otel-collector

# Test connectivity
docker exec myapp curl http://otel-collector:4317/healthz
```

**Common causes:**
- Services not on same network: add both to `networks: [observability]`
- Firewall blocking internal traffic: Docker bridge should allow by default
- DNS not resolving: ensure service name matches container name or service alias

### Permission errors on volume mounts

**Symptom:** `permission denied` when accessing mounted config or queue

**Diagnostic steps:**
```bash
# Check file permissions
ls -la /path/to/config.yaml
ls -la $(docker volume inspect otel-queue | jq -r '.[0].Mountpoint')

# Check container user
docker inspect otel-collector | jq '.[0].Config.User'
```

**Solutions:**
```bash
# Fix file permissions (read-only config)
chmod 644 /path/to/config.yaml

# Fix volume ownership
sudo chown -R 1000:1000 /var/lib/docker/volumes/otel-queue/_data

# Or run container as root (less secure)
docker run -u root ... otel/opentelemetry-collector-contrib:latest
```

---

## Reference Links

- [setup-index.md](setup-index.md) — Platform selection guide
- [setup-kubernetes.md](setup-kubernetes.md) — Kubernetes deployments
- [security.md](security.md) — Secrets and credential management
- [collector.md](collector.md) — Configuration reference
