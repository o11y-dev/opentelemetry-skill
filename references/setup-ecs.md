# ECS Collector Deployment Patterns

## Overview

AWS ECS (Elastic Container Service) supports two compute models: EC2 and Fargate. This guide covers OpenTelemetry Collector deployment patterns for both, with emphasis on AWS-specific networking, IAM roles, and task metadata integration.

Unlike Kubernetes, ECS lacks native DaemonSet support on EC2, so collectors must be deployed as replica services running on each instance via ASG-level scaling or explicit daemon scheduling.

## Architecture Overview

```
EC2 Cluster Model:
┌──────────────────────────────────┐
│   Auto Scaling Group              │
│  ┌────────────────────────────┐   │
│  │ EC2 Instance               │   │
│  │ ┌──────────────────────┐   │   │
│  │ │ App Task + Collector │   │   │
│  │ └──────────────────────┘   │   │
│  │ ┌──────────────────────┐   │   │
│  │ │ Collector (daemon)   │   │   │
│  │ │ • host metrics       │   │   │
│  │ │ • local logs         │   │   │
│  │ └──────────────────────┘   │   │
│  └────────────────────────────┘   │
│  ┌────────────────────────────┐   │
│  │ EC2 Instance               │   │
│  │ (same layout)              │   │
│  └────────────────────────────┘   │
└──────────────────────────────────┘
           ↓ (OTLP:4317)
     Backend/Gateway


Fargate Cluster Model:
┌──────────────────────────────────┐
│   Fargate (serverless)            │
│  ┌────────────────────────────┐   │
│  │ Task (similar to pod)      │   │
│  │ ├─ App Container           │   │
│  │ ├─ Collector Sidecar       │   │
│  │ └─ CloudWatch Agent        │   │
│  │    (optional)              │   │
│  └────────────────────────────┘   │
│  ┌────────────────────────────┐   │
│  │ Task (another deployment)  │   │
│  │ (same layout)              │   │
│  └────────────────────────────┘   │
└──────────────────────────────────┘
        ↓ (via NAT/IGW)
     Backend/Gateway
```

## EC2 vs Fargate Comparison

| Aspect | EC2 | Fargate |
|--------|-----|--------|
| **Cost Model** | Pay per instance (shared resources) | Pay per task (isolated) |
| **Host Metrics** | ✓ Available (via host bind mount or IAM) | ✗ Not available (no host access) |
| **Collector Placement** | DaemonSet-style service or per-task | Sidecar only (per-task) |
| **Networking** | Flexible (host port, dynamic mapping) | Only awsvpc mode, no port mapping |
| **Node Management** | Required (patching, scaling) | Managed by AWS |
| **Cold Starts** | Faster (warm instances) | Slower (on-demand provisioning) |

## EC2 Cluster: DaemonSet-like Pattern

### Use Case & Benefits

- Single collector instance per EC2 node (cost-efficient)
- Collects host metrics without app dependency
- Collects logs via volumes
- Scales with ASG

### Task Definition JSON

```json
{
  "family": "otel-collector-daemon",
  "networkMode": "host",
  "requiresCompatibilities": ["EC2"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "otel-collector",
      "image": "otel/opentelemetry-collector-contrib:latest",
      "cpu": 256,
      "memory": 512,
      "essential": true,
      "portMappings": [
        {
          "containerPort": 4317,
          "hostPort": 4317,
          "protocol": "tcp"
        },
        {
          "containerPort": 4318,
          "hostPort": 4318,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "GOGC",
          "value": "80"
        },
        {
          "name": "OTEL_EXPORTER_OTLP_ENDPOINT",
          "value": "http://10.0.0.10:4317"
        }
      ],
      "mountPoints": [
        {
          "sourceVolume": "logs",
          "containerPath": "/var/log",
          "readOnly": true
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/otel-collector",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "volumes": [
    {
      "name": "logs",
      "host": {
        "sourcePath": "/var/log"
      }
    }
  ]
}
```

### Service Configuration (EC2 Daemon)

```json
{
  "cluster": "my-cluster",
  "serviceName": "otel-collector-daemon",
  "taskDefinition": "otel-collector-daemon:1",
  "desiredCount": 0,
  "launchType": "EC2",
  "schedulingStrategy": "DAEMON",
  "deploymentConfiguration": {
    "maximumPercent": 200,
    "minimumHealthyPercent": 100
  },
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-xxx", "subnet-yyy"],
      "securityGroups": ["sg-xxx"],
      "assignPublicIp": "DISABLED"
    }
  }
}
```

**Key gotchas (EC2):**
- **localhost vs 127.0.0.1**: On EC2, `localhost` resolves to 127.0.0.1 inside the container, not the host IP; use host networking or IMDSv2 to discover host IP
- **Port conflicts**: If two tasks try to bind hostPort, ECS schedules to different nodes (unless using bridge network mode)
- **Log permissions**: Collector must have read access to `/var/log` (may need `--user root` or uid adjustment)

## Fargate: Sidecar Pattern

### Use Case & Benefits

- No host access required (compliance, security)
- Per-task isolation (tracing scoped to single app)
- Automatic scaling with task count
- No host maintenance overhead

### Task Definition JSON (Fargate)

```json
{
  "family": "app-with-collector",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/app-task-role",
  "containerDefinitions": [
    {
      "name": "my-app",
      "image": "myapp:latest",
      "cpu": 256,
      "memory": 512,
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "OTEL_EXPORTER_OTLP_ENDPOINT",
          "value": "http://localhost:4317"
        },
        {
          "name": "OTEL_SERVICE_NAME",
          "value": "my-app"
        }
      ],
      "dependsOn": [
        {
          "containerName": "otel-collector",
          "condition": "START"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/my-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    },
    {
      "name": "otel-collector",
      "image": "otel/opentelemetry-collector-contrib:latest",
      "cpu": 256,
      "memory": 512,
      "essential": false,
      "portMappings": [
        {
          "containerPort": 4317,
          "protocol": "tcp"
        },
        {
          "containerPort": 4318,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "GOGC",
          "value": "80"
        },
        {
          "name": "OTEL_EXPORTER_OTLP_ENDPOINT",
          "value": "https://backend.example.com:4317"
        }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:13133/ || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 10
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/otel-collector",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

**Key gotchas (Fargate):**
- **Task metadata v3**: Use `http://169.254.170.2${AWS_CONTAINER_CREDENTIALS_FULL_URI}` to access task metadata
- **Networking**: Only `awsvpc` mode supported; no hostPort mapping
- **Memory sharing**: Total memory split between app + collector (careful with memory limits)
- **Sidecar secret injection**: Use `secretsManager` or Secrets Manager integration; don't hardcode in env

### Health Check & Container Dependencies

```json
"dependsOn": [
  {
    "containerName": "otel-collector",
    "condition": "HEALTHY"
  }
],
"healthCheck": {
  "command": ["CMD-SHELL", "curl -f http://localhost:13133/ || exit 1"],
  "interval": 30,
  "timeout": 5,
  "retries": 3,
  "startPeriod": 10
}
```

## Network Modes & Service Discovery

### awsvpc Mode (Fargate, modern EC2)

```json
"networkMode": "awsvpc",
"networkConfiguration": {
  "awsvpcConfiguration": {
    "subnets": ["subnet-xxx", "subnet-yyy"],
    "securityGroups": ["sg-collector"],
    "assignPublicIp": "DISABLED"
  }
}
```

**Service Discovery** (AWS CloudMap):

```json
{
  "serviceName": "otel-gateway",
  "cluster": "my-cluster",
  "taskDefinition": "otel-gateway",
  "desiredCount": 2,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-xxx"],
      "securityGroups": ["sg-gateway"],
      "assignPublicIp": "DISABLED"
    }
  },
  "serviceRegistries": [
    {
      "registryArn": "arn:aws:servicediscovery:us-east-1:ACCOUNT:service/sd/otel-gateway"
    }
  ]
}
```

In collector config, use `otel-gateway.sd:4317` as endpoint.

## Exporter Configuration

### OTLP over HTTP to External Backend

```yaml
exporters:
  otlp:
    endpoint: https://api.example.com:4317
    headers:
      Authorization: "Bearer ${BACKEND_API_KEY}"
      X-Trace-Source: "ecs-fargate"
```

Inject via environment:

```json
"environment": [
  {
    "name": "BACKEND_API_KEY",
    "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:backend-key:token::"
  }
]
```

### CloudWatch Integration (Optional)

```yaml
exporters:
  awsemf:
    namespace: "OpenTelemetry"
    region: "us-east-1"
    metric_declaration:
      - dimensions: ["Service"]
        metric_name_pattern: ".*"
```

## Troubleshooting

### Cannot reach backend from Fargate task

**Diagnostic steps:**
```bash
# Check task networking
aws ecs describe-tasks --cluster my-cluster --tasks arn:... \
  --query 'tasks[0].attachments'

# Verify Security Group allows egress
aws ec2 describe-security-groups --group-ids sg-xxx

# Test connectivity from container
aws ecs execute-command --cluster my-cluster --task <task-id> \
  --container otel-collector \
  --command "curl -v https://backend.example.com:4317"
```

**Common causes:**
- Security Group missing egress rule: add rule `HTTPS 443 to 0.0.0.0/0`
- Subnet missing NAT Gateway: tasks without public IPs need NAT to reach internet
- Endpoint DNS not resolving: verify DNS in VPC settings (Route53, custom DNS)

### Collector crashes with OOM

**Diagnostic steps:**
```bash
# Check memory allocation
aws ecs describe-task-definition --task-definition app-with-collector:1 \
  --query 'taskDefinition.containerDefinitions[?name==`otel-collector`].memory'

# View CloudWatch logs for OOM kill
aws logs tail /ecs/otel-collector --follow

# Check actual memory usage in task stats
aws ecs describe-tasks --cluster my-cluster --tasks arn:... \
  --query 'tasks[0].containers[?name==`otel-collector`].lastStatus'
```

**Common causes:**
- Memory limit too low for traffic volume: increase from 512Mi to 1Gi+
- Memory limiter not configured: add `memory_limiter` processor
- Batch processor buffer size too large: reduce `send_batch_size`

### No metrics being scraped

**Diagnostic steps:**
```bash
# Verify Prometheus receiver is enabled in config
aws ecs describe-task-definition --task-definition otel-collector-daemon:1 \
  --query 'taskDefinition.containerDefinitions[0].environment'

# Check IAM role permissions for EC2 scraping
aws iam get-role-policy --role-name collector-task-role --policy-name ...

# Test scrape endpoint from task
aws ecs execute-command --cluster my-cluster --task <task-id> \
  --container otel-collector \
  --command "curl -s http://localhost:8888/metrics | head -20"
```

**Common causes:**
- Prometheus receiver not in config: add to `receivers:` section
- IAM role missing EC2 DescribeInstances permission: add `ec2:DescribeInstances` to policy
- Scrape targets not in service security group: allow inbound on port 8888 from collector SG

---

## Reference Links

- [setup-index.md](setup-index.md) — Platform selection guide
- [setup-docker.md](setup-docker.md) — Container deployments
- [security.md](security.md) — IAM roles, secrets management
- [collector.md](collector.md) — Collector configuration reference
