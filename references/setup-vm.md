# Standalone VM/EC2 Collector Deployment

## Overview

Running the OpenTelemetry Collector on standalone virtual machines (EC2, Azure VMs, GCE, or on-premises) is the most direct deployment model. This guide covers binary installation, systemd service setup, and configuration management across Linux, Windows, and macOS.

## Install Methods Comparison

| Method | Platform | Pros | Cons | When to Use |
|--------|----------|------|------|------------|
| **Binary Download** | Linux/macOS/Windows | Full control, lightweight | Manual updates | VMs, testing, air-gapped networks |
| **Package Manager** | Linux (apt, yum) | System integration, auto-updates | Repo must be available | Production Linux fleets |
| **Container (OCI)** | Any with container runtime | Consistent images | Extra runtime overhead | VMs with Docker/Podman installed |
| **Ansible/Chef/Puppet** | Linux/Windows | Repeatable, versioned, auditable | Infrastructure-as-code learning curve | Managed VM fleets |

## Linux Standalone Installation

### Binary Download & Extract

```bash
# Download latest release for your architecture
export VERSION="0.104.0"
export ARCH="linux_amd64"  # or amd64, arm64, etc.

curl -L "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${VERSION}/otelcontribcol_${VERSION}_${ARCH}.tar.gz" \
  -o otelcontribcol_${VERSION}_${ARCH}.tar.gz

# Verify checksum (optional but recommended)
curl -L "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${VERSION}/checksums.txt" \
  | grep "otelcontribcol_${VERSION}_${ARCH}.tar.gz" | sha256sum -c

# Extract to installation directory
sudo mkdir -p /opt/otel/collector
sudo tar -xzf otelcontribcol_${VERSION}_${ARCH}.tar.gz -C /opt/otel/collector
sudo chmod +x /opt/otel/collector/otelcontribcol

# Verify installation
/opt/otel/collector/otelcontribcol --version
```

### Package Manager Installation (Linux)

#### Ubuntu/Debian (APT)

```bash
# Add OpenTelemetry repository
curl -s https://apt.fury.io/otel/ | sudo bash

# Install Collector
sudo apt-get update
sudo apt-get install opentelemetry-collector-contrib

# Verify
opentelemetry-collector-contrib --version
```

#### RedHat/CentOS (YUM)

```bash
# Add repository (create /etc/yum.repos.d/otel.repo)
sudo tee /etc/yum.repos.d/otel.repo > /dev/null << EOF
[otel]
name=OpenTelemetry Collector
baseurl=https://yum.fury.io/otel/
enabled=1
gpgcheck=0
EOF

# Install
sudo yum install opentelemetry-collector-contrib

# Verify
opentelemetry-collector-contrib --version
```

## Linux: Systemd Service

### Systemd Unit File

Create `/etc/systemd/system/otel-collector.service`:

```ini
[Unit]
Description=OpenTelemetry Collector
Documentation=https://opentelemetry.io/docs/reference/specification/protocol/exporter/
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=otel
Group=otel
WorkingDirectory=/opt/otel/collector

# Load environment variables from file
EnvironmentFile=/etc/default/otel-collector
EnvironmentFile=-/etc/sysconfig/otel-collector

# Logging to journal
StandardOutput=journal
StandardError=journal
SyslogIdentifier=otel-collector

# Service runtime
ExecStart=/opt/otel/collector/otelcontribcol \
  --config=/etc/otel/collector/config.yaml
ExecReload=/bin/kill -HUP $MAINPID

# Restart policy
Restart=on-failure
RestartSec=10s

# Resource limits
LimitNOFILE=65536
MemoryMax=1G

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/otel

[Install]
WantedBy=multi-user.target
```

### Environment File

Create `/etc/default/otel-collector`:

```bash
# Log level
OTEL_LOG_LEVEL=info

# Resource limits
GOGC=80
GOMEMLIMIT=800MiB

# Exporter configuration
OTEL_EXPORTER_OTLP_ENDPOINT="https://backend.example.com:4317"
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer ${BACKEND_API_KEY}"

# Traces sampling
OTEL_TRACES_SAMPLER=jaeger_remote
OTEL_TRACES_SAMPLER_ARG=http://localhost:14250
```

### User & Group Setup

```bash
# Create otel user and group (no shell, no home)
sudo useradd --system --no-create-home --shell /usr/sbin/nologin otel

# Create necessary directories with correct permissions
sudo mkdir -p /etc/otel/collector /var/lib/otel /var/log/otel
sudo chown otel:otel /etc/otel/collector /var/lib/otel /var/log/otel
sudo chmod 755 /etc/otel/collector /var/lib/otel
sudo chmod 750 /var/log/otel
```

### Enable & Start Service

```bash
# Reload systemd configuration
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable otel-collector

# Start service
sudo systemctl start otel-collector

# Check status
sudo systemctl status otel-collector

# View logs
sudo journalctl -u otel-collector -f

# Check service after reboot
sudo systemctl is-active otel-collector
```

## Linux Collector Configuration

### Config File Location

```
/etc/otel/collector/config.yaml
```

### Minimal Config Example

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    send_batch_size: 512
    timeout: 5s
  memory_limiter:
    check_interval: 1s
    limit_mib: 768
    spike_limit_mib: 256

exporters:
  otlp:
    endpoint: backend.example.com:4317
    headers:
      Authorization: "Bearer ${OTEL_EXPORTER_OTLP_HEADERS}"

extensions:
  file_storage:
    directory: /var/lib/otel
    compaction:
      interval: 1m

service:
  extensions: [file_storage]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, memory_limiter]
      exporters: [otlp]
    metrics:
      receivers: [otlp]
      processors: [batch, memory_limiter]
      exporters: [otlp]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]
```

## Windows Standalone

### Binary Installation

```powershell
# Create installation directory
New-Item -ItemType Directory -Path "C:\Program Files\OTel" -Force

# Download collector
$version = "0.104.0"
$url = "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v$version/otelcontribcol_${version}_windows_amd64.zip"

Invoke-WebRequest -Uri $url -OutFile "otelcontribcol.zip"
Expand-Archive -Path "otelcontribcol.zip" -DestinationPath "C:\Program Files\OTel"
Remove-Item "otelcontribcol.zip"

# Verify
& "C:\Program Files\OTel\otelcontribcol.exe" --version
```

### Windows Service (sc.exe)

```powershell
# Create Windows service
sc.exe create OpenTelemetryCollector `
  binPath="C:\Program Files\OTel\otelcontribcol.exe --config=C:\ProgramData\otel\collector\config.yaml" `
  DisplayName="OpenTelemetry Collector" `
  start=auto

# Set service description
sc.exe description OpenTelemetryCollector "Collects and exports telemetry data"

# Start service
Start-Service -Name OpenTelemetryCollector

# Check service status
Get-Service -Name OpenTelemetryCollector

# View service logs (Event Viewer or PowerShell)
Get-EventLog -LogName Application -Source OpenTelemetryCollector -Newest 10
```

### Alternative: Task Scheduler

```powershell
# Create Task Scheduler task
$taskAction = New-ScheduledTaskAction -Execute "C:\Program Files\OTel\otelcontribcol.exe" `
  -Argument "--config=C:\ProgramData\otel\collector\config.yaml"

$taskTrigger = New-ScheduledTaskTrigger -AtStartup

$taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount

Register-ScheduledTask -TaskName "OpenTelemetryCollector" `
  -Action $taskAction `
  -Trigger $taskTrigger `
  -Principal $taskPrincipal
```

## macOS Standalone

### Homebrew Installation

```bash
# Tap OpenTelemetry formula (if available)
brew tap open-telemetry/otel-repo

# Install
brew install opentelemetry-collector-contrib

# Verify
opentelemetry-collector-contrib --version
```

### Binary Installation

```bash
# Download macOS binary
VERSION="0.104.0"
ARCH="darwin_arm64"  # or darwin_amd64

curl -L "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${VERSION}/otelcontribcol_${VERSION}_${ARCH}.tar.gz" \
  -o otelcontribcol_${VERSION}_${ARCH}.tar.gz

tar -xzf otelcontribcol_${VERSION}_${ARCH}.tar.gz
sudo mv otelcontribcol /usr/local/bin/
```

### LaunchAgent (User-Level Daemon)

Create `~/Library/LaunchAgents/com.opentelemetry.collector.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.opentelemetry.collector</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/otelcontribcol</string>
        <string>--config=/Users/username/.config/otel/config.yaml</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>StandardOutPath</key>
    <string>/var/log/otel-collector.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/otel-collector.log</string>
</dict>
</plist>
```

### Load & Manage LaunchAgent

```bash
# Load agent
launchctl load ~/Library/LaunchAgents/com.opentelemetry.collector.plist

# Check status
launchctl list | grep otel

# View logs
tail -f /var/log/otel-collector.log

# Stop agent
launchctl unload ~/Library/LaunchAgents/com.opentelemetry.collector.plist
```

## Configuration Management

### Ansible Playbook Skeleton

```yaml
---
- hosts: collectors
  become: true
  vars:
    otel_version: "0.104.0"
    otel_user: "otel"
    otel_config_path: "/etc/otel/collector/config.yaml"
  
  tasks:
    - name: Create otel user
      user:
        name: "{{ otel_user }}"
        system: yes
        shell: /usr/sbin/nologin

    - name: Download Collector binary
      get_url:
        url: "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v{{ otel_version }}/otelcontribcol_{{ otel_version }}_linux_amd64.tar.gz"
        dest: /tmp/otelcontribcol.tar.gz
        checksum: "sha256:{{ otel_checksum }}"

    - name: Extract collector
      unarchive:
        src: /tmp/otelcontribcol.tar.gz
        dest: /opt/otel/collector/
        remote_src: yes
        owner: "{{ otel_user }}"
        group: "{{ otel_user }}"

    - name: Install systemd unit
      template:
        src: otel-collector.service.j2
        dest: /etc/systemd/system/otel-collector.service
      notify: Reload systemd

    - name: Deploy config
      template:
        src: config.yaml.j2
        dest: "{{ otel_config_path }}"
        owner: "{{ otel_user }}"
        group: "{{ otel_user }}"
        mode: 0644
      notify: Restart otel-collector

    - name: Start service
      systemd:
        name: otel-collector
        enabled: yes
        state: started

  handlers:
    - name: Reload systemd
      command: systemctl daemon-reload

    - name: Restart otel-collector
      systemd:
        name: otel-collector
        state: restarted
```

### Terraform (AWS EC2 Example)

```hcl
resource "aws_instance" "otel_collector" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.medium"
  
  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    otel_version  = "0.104.0"
    backend_endpoint = var.backend_endpoint
    backend_api_key  = var.backend_api_key
  }))

  tags = {
    Name = "otel-collector"
  }
}

# Create user-data.sh script
resource "local_file" "user_data" {
  filename = "${path.module}/user-data.sh"
  content  = templatefile("${path.module}/user-data.tpl", {
    otel_version  = "0.104.0"
    backend_endpoint = var.backend_endpoint
  })
}
```

Sample `user-data.sh`:

```bash
#!/bin/bash
set -e

# Update system
apt-get update
apt-get install -y curl

# Create otel user
useradd -r -s /sbin/nologin otel || true

# Download and install
mkdir -p /opt/otel/collector
cd /tmp
curl -L https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v0.104.0/otelcontribcol_0.104.0_linux_amd64.tar.gz \
  -o otelcontribcol.tar.gz
tar -xzf otelcontribcol.tar.gz -C /opt/otel/collector

# Install systemd unit and config (from template or S3)
# ...

# Start service
systemctl enable otel-collector
systemctl start otel-collector
```

## State & Queue Directory

### File Storage Location

```bash
# Linux
/var/lib/otel

# Windows
C:\ProgramData\otel

# macOS
/usr/local/var/otel
```

### Permissions

```bash
# Ensure otel user owns queue directory
sudo chown otel:otel /var/lib/otel
sudo chmod 755 /var/lib/otel

# Verify collector can write
ls -la /var/lib/otel
```

## Troubleshooting

### Systemd service won't start

**Diagnostic steps:**
```bash
# Check service status
sudo systemctl status otel-collector

# View full logs
sudo journalctl -u otel-collector -n 50

# Check service file syntax
sudo systemctl validate otel-collector.service

# Start in foreground for debugging
/opt/otel/collector/otelcontribcol --config=/etc/otel/collector/config.yaml
```

**Common causes:**
- Config file invalid YAML: validate with `yamllint /etc/otel/collector/config.yaml`
- Port already in use: check `sudo netstat -tlnp | grep 4317`
- Permission denied on config: verify `chmod 644 /etc/otel/collector/config.yaml`
- User otel doesn't exist: run `sudo useradd -r -s /sbin/nologin otel`

### Collector crashes after restart

**Diagnostic steps:**
```bash
# Check if queue directory exists and has correct permissions
ls -la /var/lib/otel
sudo chown otel:otel /var/lib/otel

# Verify config loads without errors
/opt/otel/collector/otelcontribcol --config=/etc/otel/collector/config.yaml --dry-run

# Check system resources
free -h
df -h /var/lib
```

**Common causes:**
- Queue storage permission denied: run `sudo chown otel:otel /var/lib/otel`
- Disk full: check `df -h` and clean up old data
- Config syntax error: validate YAML before deployment

### Can't reach backend from VM

**Diagnostic steps:**
```bash
# Test DNS resolution
nslookup backend.example.com

# Test network connectivity
curl -v https://backend.example.com:4317

# Check firewall rules
sudo iptables -L -n -v

# Monitor outgoing connections
sudo netstat -tlnp | grep otelcontribcol

# Check security group (AWS)
aws ec2 describe-security-groups --group-ids sg-xxx
```

**Common causes:**
- Firewall blocking outbound: allow `HTTPS 443` or specific backend port
- Security Group missing egress rule: add rule to allow `0.0.0.0/0` on backend port
- DNS not resolving: check `/etc/resolv.conf` and use `8.8.8.8` for testing
- Proxy required: configure `HTTPS_PROXY` in environment or collector config

---

## Reference Links

- [setup-index.md](setup-index.md) — Platform selection guide
- [setup-kubernetes.md](setup-kubernetes.md) — Kubernetes deployments
- [setup-ecs.md](setup-ecs.md) — ECS deployments
- [security.md](security.md) — Securing credentials and secrets
- [collector.md](collector.md) — Collector configuration reference
