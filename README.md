# OpenTelemetry Skill: A Cognitive Architecture for AI-Assisted Observability Engineering

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Enabled-blueviolet)](https://opentelemetry.io/)
[![Tessl Registry](https://img.shields.io/endpoint?url=https%3A%2F%2Fapi.tessl.io%2Fv1%2Fbadges%2Fo11y-dev%2Fopentelemetry-skill)](https://tessl.io/registry/o11y-dev/opentelemetry-skill)

## Overview

The **opentelemetry-skill** is an AI assistant skill designed to help with OpenTelemetry configuration and observability engineering tasks. This skill employs **progressive disclosure** to optimize context usage and deliver production-ready OpenTelemetry configurations.

This repository contains the source code for the **OpenTelemetry Skill** tile released by Tessl.

- **Published versions**: https://tessl.io/registry/o11y-dev/opentelemetry-skill
- **Source code**: https://github.com/o11y-dev/opentelemetry-skill

## Key Features

**Comprehensive Coverage**: Specialized reference docs covering collector architecture, security, sampling, AI agents, and compatibility

**Production Focus**: Emphasizes stability, security, and cost optimization patterns

**AI Agent Support**: Configuration guidance for monitoring AI coding agents alongside traditional applications

**Progressive Loading**: Context-aware reference loading prevents information overload

**Continuous Updates**: Automated upstream monitoring tracks OpenTelemetry releases and AI agent repositories

## 📋 Table of Contents

- [Key Features](#key-features)
- [What Makes This Different?](#what-makes-this-different)
- [Core Features](#core-features)
- [Skill Structure](#skill-structure)
- [Installation](#installation)
- [Architecture](#architecture)
- [Architecture Patterns](#architecture-patterns)
- [Usage Examples](#usage-examples)
- [Reference Documentation](#reference-documentation)
- [Contrib Components & Example Configs](#contrib-components--example-configs)
- [Testing & Validation](#testing--validation)
- [Contributing](#contributing)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Compatibility](#compatibility)
- [License](#license)
- [Related Projects](#related-projects)

### What Makes This Different?

Unlike loading the entire OpenTelemetry documentation into an AI's context (which leads to hallucinations and information overload), this skill acts as a **cognitive router**:

1. **System 2 Thinking**: Forces the AI to analyze critical observability signals (throughput, cardinality, resiliency) before generating code
2. **Progressive Disclosure**: Loads detailed reference materials only when specific topics are triggered
3. **Production-First**: Prioritizes stability, security, and cost optimization over feature completeness
4. **Convention Enforcement**: Ensures semantic conventions, proper processor ordering, and architectural best practices
5. **AI Agent Support**: Includes guidance for observing AI coding agents in production environments

## Core Features

- 🧠 **Cognitive Architecture**: Meta-knowledge layer that teaches AI *how* to think about observability
- 📊 **Cardinality Management**: Built-in guards against metric explosion and cost overruns
- 🏗️ **Deployment Patterns**: Platform-specific setup guides for Kubernetes, ECS, Docker, and standalone VMs
- 🎯 **Multi-Platform Support**: DaemonSet vs Gateway vs Sidecar decision matrices for Kubernetes; EC2 daemon and Fargate patterns for ECS; Docker Compose patterns
- 🔒 **Security by Default**: PII redaction, TLS/mTLS configuration, and authentication patterns with platform-specific guidance
- 🔄 **OTTL Transformations**: Comprehensive OpenTelemetry Transformation Language guidance with patterns and best practices
- 📈 **Scaling Strategies**: Load balancing with sticky sessions for tail sampling, resource management for high-throughput collectors
- 🎯 **Sampling Intelligence**: Head vs tail sampling with statistical trade-off analysis
- 🔍 **Meta-Monitoring**: Self-observability patterns for collector health
- 🤖 **AI Agent Observability**: Configuration guides for monitoring AI coding agents including Claude Code, Gemini CLI, GitHub Copilot, Codex, Qwen Code, Pi Agent, and more via OpenTelemetry
- ✅ **Test & Validation Framework**: TDD-based testing methodology and 20+ comprehensive evaluation scenarios to ensure skill effectiveness

## Skill Structure

`SKILL.md` acts as the **cognitive router** — a compact instruction set that tells the AI how to reason about observability before generating any output. `docs/index.md` is the tile's on-demand documentation entrypoint for Tessl, and `references/` contains the deep-dive documents that the skill links to when specific topics are triggered.

The skill now includes **5 platform-specific setup guides** (`setup-kubernetes.md`, `setup-ecs.md`, `setup-docker.md`, `setup-vm.md`) that provide concrete deployment patterns and copy-paste-ready configurations for multiple cloud providers and deployment scenarios.

### 📊 **Content Overview**

- **Packaged reference docs** for architecture, collector design, instrumentation, security, sampling, AI agents, and compatibility
- **Platform-specific setup guides** for Kubernetes (EKS/GKE/AKS/OpenShift/Autopilot/Fargate), AWS ECS (EC2/Fargate), Docker/Compose, and standalone VMs
- **AI coding agent coverage** tracked with upstream monitoring  
- **Production-tested** configurations with validation commands and 20+ comprehensive evaluation scenarios
- **Current & updated** - automatically synced with latest OpenTelemetry releases

## Installation

### Tessl Registry

Install this tile from the Tessl registry (workspace: `o11y-dev`):

```bash
tessl tile install o11y-dev/opentelemetry-skill
```

### Claude

Add `SKILL.md` to your project knowledge or paste it into your system prompt. The skill is also available as a Claude plugin via the Claude marketplace.

### Cursor

Plugin manifests are available in `.cursor-plugin/` for use with the Cursor marketplace.

### OpenAI Codex

The skill is available as a Codex plugin with comprehensive deployment and configuration guidance. Manifests are available in `.codex-plugin/` for use with the OpenAI Codex marketplace.

### GitHub Copilot

Attach `SKILL.md` as a custom instructions file, or reference the repository as a Copilot Skill in your Copilot settings: [`https://github.com/o11y-dev/opentelemetry-skill`](https://github.com/o11y-dev/opentelemetry-skill)

### Other AI Systems

Point your agent at `SKILL.md` as the primary instruction set, with `references/` available for context loading.

## Architecture

```
opentelemetry-skill/
├── .claude-plugin/
│   └── marketplace.json      # Plugin metadata (Claude marketplace)
├── .codex-plugin/
│   └── plugin.json           # Codex plugin manifest (OpenAI Codex)
├── .cursor-plugin/
│   ├── marketplace.json      # Cursor marketplace metadata
│   └── plugin.json           # Cursor plugin manifest
├── docs/
│   └── index.md              # Tessl docs entrypoint for bundled references and eval assets
├── SKILL.md                  # Cognitive router (the "brain")
├── README.md                 # This file
├── references/
│   ├── ai-agents.md          # AI agent observability patterns & configurations
│   ├── architecture.md       # Deployment patterns & scaling
│   ├── collector.md          # Pipeline configuration & components
│   ├── compatibility.md      # Version-sensitive support and compatibility notes
│   ├── instrumentation.md    # SDKs & semantic conventions
│   ├── monitoring.md         # Self-monitoring patterns
│   ├── ottl.md               # OpenTelemetry Transformation Language
│   ├── platforms.md          # Serverless & FaaS patterns
│   ├── playbooks.md          # Production incident response playbooks
│   ├── sampling.md           # Sampling strategies
│   ├── security.md           # PII redaction, TLS & authentication
│   ├── setup-index.md        # Platform deployment decision tree
│   ├── setup-kubernetes.md   # Kubernetes DaemonSet/Gateway/Sidecar deployment
│   ├── setup-ecs.md          # AWS ECS EC2 & Fargate deployment
│   ├── setup-docker.md       # Docker & Docker Compose deployment
│   └── setup-vm.md           # Standalone VM/EC2 deployment
├── evals/                    # Comprehensive evaluation scenarios (20+ evals)
└── LICENSE                   # Apache 2.0
```

## Architecture Patterns

| Category | Pattern | Reference | Description |
|----------|---------|-----------|-------------|
| **Kubernetes** | **DaemonSet / Gateway / Sidecar** | [setup-kubernetes.md](references/setup-kubernetes.md) | Choose based on workload type and data volume (EKS/GKE/AKS/OpenShift/Autopilot/Fargate) |
| **AWS ECS** | **EC2 Daemon / Fargate Sidecar** | [setup-ecs.md](references/setup-ecs.md) | EC2 daemon service with host IP networking; Fargate sidecar with container networking |
| **Docker** | **Standalone / Compose** | [setup-docker.md](references/setup-docker.md) | Docker container with volumes and restart policies; Docker Compose with service discovery |
| **Standalone VM** | **Linux / Windows / macOS** | [setup-vm.md](references/setup-vm.md) | systemd service (Linux), Windows Service, LaunchAgent (macOS), Terraform IaC |
| **Sampling** | **Head / Tail Sampling** | [sampling.md](references/sampling.md) | Trade-off between cost and completeness |
| **Security** | **mTLS + RBAC** | [security.md](references/security.md) | Secure cross-network telemetry pipelines with platform-specific configuration |
| **AI Agents** | **Agent Telemetry** | [ai-agents.md](references/ai-agents.md) | Monitor coding agents as first-class services in your observability stack |

## Usage Examples

### Example 1: Gateway Deployment for Tail Sampling

**User**: "I need to deploy an OpenTelemetry gateway in Kubernetes for tail sampling."

**AI Response** (leveraging the skill):
- ✅ Asks about throughput to size replicas
- ✅ Loads `references/architecture.md` and `references/sampling.md`
- ✅ Generates Deployment with loadbalancing exporter (routing_key: traceID)
- ✅ Includes Headless Service for sticky sessions
- ✅ Configures tail_sampling processor with error/latency policies
- ✅ Warns about Beta stability level
- ✅ Provides validation commands

### Example 2: Preventing Data Loss

**User**: "Ensure we don't lose telemetry data if the backend goes down."

**AI Response**:
- ✅ Loads `references/collector.md`
- ✅ Configures file_storage extension
- ✅ Attaches persistent queues to exporters
- ✅ Explains disk space requirements
- ✅ Provides PersistentVolume YAML for Kubernetes

### Example 3: Cardinality Guard

**User**: "Add user_id as a metric dimension."

**AI Response**:
- ❌ **Blocks the request**: "user_id violates the Rule of 100—it's unbounded and will cause metric explosion."
- ✅ Suggests alternative: "Use user_id as a trace attribute instead, and create a metric for aggregated user counts."
- ✅ Loads `references/instrumentation.md` to explain cardinality management

### Example 4: Reviewing Existing Helm Values

**User**: "Review this collector Helm values file and tell me what's risky."

**AI Response**:
- ✅ Audits cross-field contradictions, not just YAML syntax
- ✅ Compares `memory_limiter` settings to container memory limits
- ✅ Flags scaled `tail_sampling` without sticky routing
- ✅ Questions `hostPort` on gateway Deployments
- ✅ Calls out retry/queue durability gaps, unsafe RWX/EFS-backed `file_storage`, and rollout-setting conflicts
- ✅ Audits metrics temporality conversions such as `deltatocumulative` when restart or scaling behavior would make the state unsafe
- ✅ Corrects OTTL type mismatches and stale semantic convention keys

See [`SKILL.md`](SKILL.md) for the full list of progressive disclosure triggers, System 2 thinking signals, core principles, and production-ready configuration defaults.

## Reference Documentation

Deep-dive guides are available in the `references/` directory:

### Platform-Specific Deployment Guides
- **[setup-index.md](references/setup-index.md)**: Platform selection decision tree (when to use DaemonSet vs Gateway vs Sidecar)
- **[setup-kubernetes.md](references/setup-kubernetes.md)**: Kubernetes deployment patterns including DaemonSet, Gateway, Sidecar, with support for EKS, GKE, AKS, OpenShift, Autopilot, and Fargate
- **[setup-ecs.md](references/setup-ecs.md)**: AWS ECS deployment patterns for EC2 daemon service and Fargate sidecar
- **[setup-docker.md](references/setup-docker.md)**: Docker and Docker Compose deployment patterns
- **[setup-vm.md](references/setup-vm.md)**: Standalone VM/EC2 deployment guidance for Linux (systemd), Windows (Service), macOS (LaunchAgent), and Infrastructure-as-Code (Terraform)

### Core Reference Guides
- **[ai-agents.md](references/ai-agents.md)**: AI agent observability patterns, per-agent setup guidance, dashboards, and operational caveats
- **[architecture.md](references/architecture.md)**: Deployment patterns, load balancing, Target Allocator, and platform setup guide cross-links
- **[collector.md](references/collector.md)**: Pipeline anatomy, processor ordering, memory management, and exporter configuration patterns
- **[instrumentation.md](references/instrumentation.md)**: SDKs, semantic conventions, cardinality management, and collector deployment guidance
- **[ottl.md](references/ottl.md)**: OpenTelemetry Transformation Language syntax, functions, patterns, and best practices
- **[platforms.md](references/platforms.md)**: FaaS (Lambda, Azure, GCP), client-side apps, serverless best practices
- **[sampling.md](references/sampling.md)**: Head vs tail, probabilistic strategies, sticky sessions
- **[security.md](references/security.md)**: PII redaction, TLS/mTLS configuration, platform-specific security guidance
- **[monitoring.md](references/monitoring.md)**: Collector metrics, dashboards, alerts
- **[playbooks.md](references/playbooks.md)**: Reusable production playbooks distilled from OpenTelemetry blog posts and real-world deployment stories

## Contrib Components & Example Configs

The OpenTelemetry Collector Contrib repository contains extended components and curated example configurations. Always verify component stability and pin to released versions (e.g., `v0.100.0+`) instead of `main`.

### Stability & Registry
- **[VERSIONING.md](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/VERSIONING.md)**: Component stability matrix (Stable/Beta/Alpha/Development)

### Component Directories
- **[Receivers](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver)**: Entry points for telemetry data
- **[Processors](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor)**: Transform, filter, and enrich data
- **[Exporters](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter)**: Send data to backends

### Key Components (Production-Ready)
- **[transformprocessor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/transformprocessor)**: Apply OTTL transformations
- **[filterprocessor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/filterprocessor)**: Drop spans/metrics based on conditions
- **[k8sattributesprocessor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/k8sattributesprocessor)**: Enrich with Kubernetes metadata
- **[tailsamplingprocessor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor)**: Intelligent sampling decisions
- **[filelogreceiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/filelogreceiver)**: Read logs from disk
- **[loadbalancingexporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/loadbalancingexporter)**: Route to multiple backends with consistent hashing

### Example Configurations
- **[examples/](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/examples)**: Curated collector configurations
  - Gateway deployments with tail sampling
  - Agent/DaemonSet configurations for Kubernetes
  - Logging and filelog receiver examples
  - Kubernetes attribute enrichment patterns

**Best Practice**: Always pin to released tags matching your collector version (e.g., `v0.100.0+`) instead of using `main` branch for production stability.

## Testing & Validation

This skill includes a comprehensive test and validation framework following TDD (Test-Driven Development) principles:

- **Structured Tessl evals** live in [`evals/`](evals/README.md) and are the canonical published scenarios
- **[tests/baseline-scenarios.md](tests/baseline-scenarios.md)**: RED phase support document for baseline behavior capture
- **[tests/compliance-verification.md](tests/compliance-verification.md)**: GREEN phase support document for verifying behavior changes
- **[tests/rationalization-table.md](tests/rationalization-table.md)**: REFACTOR phase log of agent rationalizations and counters

The testing framework validates that the skill actually changes AI behavior and doesn't allow common anti-patterns. GitHub Actions automatically validates skill structure and content on every change, and the Tessl report workflow posts best-practice review feedback on every pull request.

An additional GitHub Agentic Workflow (`.github/workflows/otel-upstream-maintenance.yml`) runs weekly to create an upstream maintenance digest issue with recent OpenTelemetry GitHub issues, releases, and blog/community updates for practical repository refreshes.

## Contributing

This skill is designed to evolve with the OpenTelemetry ecosystem. Contributions are welcome:

1. **Update Reference Docs**: As OTel features stabilize, update stability warnings
2. **Add Patterns**: New deployment architectures (e.g., eBPF-based collection)
3. **Expand Examples**: Language-specific SDK patterns
4. **Improve Triggers**: Refine the progressive disclosure logic

## Known Limitations

- **AI agent trace coverage varies**: Claude Code does not emit traces natively; observability relies on [opentelemetry-hooks](https://github.com/o11y-dev/opentelemetry-hooks) or native logs/metrics. Each agent has different signal coverage.
- **Tail sampling memory**: Scales with in-flight trace count. Beyond 10k RPS, consider tiered architecture (Agent -> Gateway -> Analysis) rather than single-collector tail sampling.
- **OTTL regex transforms**: Can impact p99 latency at high span volume. Profile with production traffic before deploying regex-heavy transformations.
- **Semantic conventions are evolving**: The `gen_ai.*` namespace is experimental. Attribute names may change in future OpenTelemetry releases.
- **Kubernetes version requirements**: Native sidecar container support requires v1.24+. Earlier versions need traditional sidecar patterns.

## Roadmap

- Expand AI agent observability coverage as new agents ship native telemetry (Qwen Code, Windsurf, Zed)
- Track OpenTelemetry semantic convention releases for `gen_ai` namespace stabilization
- Add cost optimization patterns for high-volume agent deployments
- Expand production playbook coverage with new upstream blog posts
- Add eBPF-based collection patterns for auto-instrumentation
- Collector processor stability matrix tracking across releases

## Compatibility

Compatibility details move faster than the cognitive-router guidance in `SKILL.md`. See [`references/compatibility.md`](references/compatibility.md) for the current version floors and AI agent support notes.

## License

This skill is licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for details.

The OpenTelemetry project itself is a CNCF project licensed under Apache 2.0.

## Acknowledgments

- **OpenTelemetry Community**: For building the foundational observability standard
- **monitoringartist**: For the collector monitoring dashboards and patterns

## Related Projects

- [OpenTelemetry Collector](https://github.com/open-telemetry/opentelemetry-collector) - The core collector
- [OpenTelemetry Operator](https://github.com/open-telemetry/opentelemetry-operator) - Kubernetes operator for OTel

---

**Transform your AI into an observability-focused assistant. Production-ready. AI-agent aware.**  
**Deploy with confidence. Observe with precision.**
