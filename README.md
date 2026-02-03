# OpenTelemetry Skill: A Cognitive Architecture for AI-Assisted Observability Engineering

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](opentelemetry-skill-LICENSE)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Enabled-blueviolet)](https://opentelemetry.io/)

## Overview

The **opentelemetry-skill** is an expert-level AI assistant skill designed to transform Large Language Models (like Claude) into Principal Observability Engineers. This skill employs **progressive disclosure** to optimize context usage and deliver production-ready OpenTelemetry configurations.

### What Makes This Different?

Unlike loading the entire OpenTelemetry documentation into an AI's context (which leads to hallucinations and information overload), this skill acts as a **cognitive router**:

1. **System 2 Thinking**: Forces the AI to analyze critical observability signals (throughput, cardinality, resiliency) before generating code
2. **Progressive Disclosure**: Loads detailed reference materials only when specific topics are triggered
3. **Production-First**: Prioritizes stability, security, and cost optimization over feature completeness
4. **Convention Enforcement**: Ensures semantic conventions, proper processor ordering, and architectural best practices

## Key Features

- 🧠 **Cognitive Architecture**: Meta-knowledge layer that teaches AI *how* to think about observability
- 📊 **Cardinality Management**: Built-in guards against metric explosion and cost overruns
- 🏗️ **Deployment Patterns**: DaemonSet vs Gateway vs Sidecar decision matrices for Kubernetes
- 🔒 **Security by Default**: PII redaction, TLS, and authentication patterns
- 🔄 **OTTL Transformations**: Comprehensive OpenTelemetry Transformation Language guidance with patterns and best practices
- 📈 **Scaling Strategies**: Load balancing with sticky sessions for tail sampling
- 🎯 **Sampling Intelligence**: Head vs tail sampling with statistical trade-off analysis
- 🔍 **Meta-Monitoring**: Self-observability patterns for collector health
- ✅ **Test & Validation Framework**: TDD-based testing methodology to ensure skill effectiveness

## Architecture Patterns

This skill establishes structured patterns for observability engineering:

| Infrastructure Concept | OpenTelemetry Concept | Rationale |
|---|---|---|
| **Modules** | **Collector Components** | Composable building blocks (receivers, processors, exporters) |
| **State Management** | **Backend Storage** | The "source of truth" for observed system state |
| **Plan/Apply** | **Instrumentation/Export** | Definition phase → Actuation phase |
| **Testing** | **Trace-based Testing** | Verification that the system behaves as expected |
| **Pre-commit Hooks** | **Config Linting** | Static analysis to prevent runtime failures |
| **Provider Auth** | **Propagators & Auth** | Context boundaries and credential management |

## Installation

### For Claude Desktop / AI Assistants

1. **Clone the skill**:
   ```bash
   git clone https://github.com/semyont/o11y.dev ~/.claude/skills/opentelemetry-skill
   ```

2. **Verify installation**:
   ```bash
   ls -la ~/.claude/skills/opentelemetry-skill/
   # Should show: SKILL.md, README.md, references/, .claude-plugin/
   ```

3. **Activate in conversation**:
   Simply mention "OpenTelemetry" or reference the skill, and the AI will automatically engage with the cognitive framework.

### For Custom AI Systems

Copy the skill directory structure into your AI agent's skill library path. The `SKILL.md` file serves as the primary instruction set.

## Architecture

```
opentelemetry-skill/
├── .claude-plugin/
│   └── marketplace.json      # Plugin metadata
├── SKILL.md                  # Cognitive router (the "brain")
├── README.md                 # This file
├── references/
│   ├── architecture.md       # Deployment patterns & scaling
│   ├── collector.md          # Pipeline configuration & components
│   ├── instrumentation.md    # SDKs & semantic conventions
│   ├── sampling.md           # Sampling strategies
│   ├── security.md           # PII redaction & authentication
│   └── monitoring.md         # Self-monitoring patterns
└── opentelemetry-skill-LICENSE  # Apache 2.0
```

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

## Progressive Disclosure Triggers

The skill uses **context triggers** to load reference material only when needed:

| Trigger Keywords | Loaded Reference | Contains |
|---|---|---|
| Kubernetes, Scaling, Load Balancing | `architecture.md` | DaemonSet patterns, sticky sessions, HPA |
| Pipeline, Processor, Queue, Memory | `collector.md` | Processor ordering, memory_limiter, persistence |
| SDK, Instrumentation, Attributes | `instrumentation.md` | Semantic conventions, cardinality rules |
| Sampling, Cost, Volume | `sampling.md` | Head/tail strategies, probabilistic math |
| Security, PII, GDPR, TLS | `security.md` | Redaction, mTLS, least privilege |
| Monitor collector, Health, Alerts | `monitoring.md` | Meta-monitoring, dashboards |

## System 2 Thinking: Critical Observability Signals

Before generating any configuration, the AI evaluates:

1. **Signal Volume & Throughput**: >10k RPS? → Sampling required
2. **Cardinality Risk**: Unbounded attributes? → Block metric usage
3. **Resiliency Requirements**: Data loss tolerance? → Persistent queues
4. **Network Topology**: Public networks? → TLS mandatory
5. **Deployment Environment**: K8s, Lambda, EC2? → Architecture choice

## Core Principles

The skill enforces these best practices:

- ✅ **Stability over Features**: Check component maturity (Alpha/Beta/Stable)
- ✅ **Convention over Configuration**: Use semantic conventions, not custom names
- ✅ **Protocol Unification**: Prefer OTLP over legacy protocols
- ✅ **Safety First**: Drop data rather than crash the collector
- ✅ **Cardinality Awareness**: No unbounded attributes in metrics

## Production-Ready Defaults

The skill generates configurations with:

- **Memory Limiter**: Always first in processor chain (80% limit, 20% spike)
- **Batch Processor**: Always included (10s timeout, 1024 batch size)
- **Persistent Queues**: Enabled for production with file_storage
- **Health Checks**: Port 13133 (localhost-only in shared networks)
- **TLS**: Enabled for cross-network communication
- **OTLP**: gRPC on port 4317 (default protocol)

## Reference Documentation

Deep-dive guides are available in the `references/` directory:

- **[architecture.md](references/architecture.md)**: Deployment patterns, load balancing, Target Allocator
- **[collector.md](references/collector.md)**: Pipeline anatomy, processor ordering, memory management
- **[instrumentation.md](references/instrumentation.md)**: SDKs, semantic conventions, cardinality management
- **[ottl.md](references/ottl.md)**: OpenTelemetry Transformation Language syntax, functions, patterns, and best practices
- **[platforms.md](references/platforms.md)**: FaaS (Lambda, Azure, GCP), client-side apps, serverless best practices
- **[sampling.md](references/sampling.md)**: Head vs tail, probabilistic strategies, sticky sessions
- **[security.md](references/security.md)**: PII redaction, TLS, extension security
- **[monitoring.md](references/monitoring.md)**: Collector metrics, dashboards, alerts

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
- **[tailsamplingprocessor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor)**: Intelligent sampling decisions (Beta)
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

- **[tests/baseline-scenarios.md](tests/baseline-scenarios.md)**: RED phase - Test scenarios to run WITHOUT skill to establish baseline behavior
- **[tests/compliance-verification.md](tests/compliance-verification.md)**: GREEN phase - Verify skill changes agent behavior as expected
- **[tests/rationalization-table.md](tests/rationalization-table.md)**: REFACTOR phase - Document and counter agent rationalizations

The testing framework validates that the skill actually changes AI behavior and doesn't allow common anti-patterns. GitHub Actions workflow automatically validates skill structure and content on every change.

## Contributing

This skill is designed to evolve with the OpenTelemetry ecosystem. Contributions are welcome:

1. **Update Reference Docs**: As OTel features stabilize, update stability warnings
2. **Add Patterns**: New deployment architectures (e.g., eBPF-based collection)
3. **Expand Examples**: Language-specific SDK patterns
4. **Improve Triggers**: Refine the progressive disclosure logic

## Compatibility

- **OpenTelemetry Collector**: v0.100.0+
- **Semantic Conventions**: v1.24.0+
- **Kubernetes**: v1.24+ (for native sidecar support)
- **Go SDK**: v1.24.0+
- **Python SDK**: v1.23.0+

## License

This skill is licensed under the **Apache License 2.0**. See [opentelemetry-skill-LICENSE](opentelemetry-skill-LICENSE) for details.

The OpenTelemetry project itself is a CNCF project licensed under Apache 2.0.

## Acknowledgments

- **OpenTelemetry Community**: For building the foundational observability standard
- **monitoringartist**: For the collector monitoring dashboards and patterns

## Related Projects

- [OpenTelemetry Collector](https://github.com/open-telemetry/opentelemetry-collector) - The core collector
- [OpenTelemetry Operator](https://github.com/open-telemetry/opentelemetry-operator) - Kubernetes operator for OTel

---

**Transform your AI into a Principal Observability Engineer. Deploy with confidence. Observe with precision.**