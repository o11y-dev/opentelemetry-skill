# OpenTelemetry Production Playbooks

## Overview

This reference is a **routing-friendly playbook index** for OpenTelemetry blog
content that is relevant to this skill. The goal is not to retell one company
story in detail. The goal is to help the skill map user questions to the most
relevant upstream operating patterns, then load the right deep-dive references
from this repository.

The 2025 [Developer Experience SIG survey](https://opentelemetry.io/blog/2025/devex-survey/)
explicitly called out the need for better production examples, debugging
guidance, and more concrete deployment guidance. This document turns that need
into a scalable maintenance model for future blog routing.

Use this document when a user asks for:

- a **real-world deployment pattern**
- a **production rollout model** for a platform team
- a **blog-derived example** instead of a purely theoretical recommendation
- a recent **opentelemetry.io article** that is relevant to a practical OTel
  task
- a **generic playbook** that should remain reusable as more blogs are added

## Table of Contents

1. [How to Use This Reference](#how-to-use-this-reference)
2. [Playbook Routing Format](#playbook-routing-format)
3. [Relevant 2025-2026 Blogs for This Skill](#relevant-2025-2026-blogs-for-this-skill)
4. [Generic Playbook Patterns](#generic-playbook-patterns)
5. [Common Failure Modes](#common-failure-modes)

---

## How to Use This Reference

These playbooks are not meant to be copied verbatim. They should be used to
answer questions like:

- "Which upstream blog should I route to for this production question?"
- "What real-world pattern covers self-service onboarding on Kubernetes?"
- "What blog is most relevant for Lambda, logs, sampling, or naming?"
- "Which reference docs should the skill load after matching a blog-derived
  pattern?"

For each routed playbook, load deeper reference material from this repository as
needed:

- [architecture.md](architecture.md) for deployment models, multi-cluster, and
  scaling
- [collector.md](collector.md) for collector pipeline structure and operational
  mechanics
- [connectors.md](connectors.md) for routing and cross-pipeline patterns
- [instrumentation.md](instrumentation.md) for SDKs, auto-instrumentation,
  naming, and signal semantics
- [monitoring.md](monitoring.md) for health, failure visibility, and alerting
- [platforms.md](platforms.md) for Kubernetes, FaaS, browser, and platform
  patterns
- [sampling.md](sampling.md) for head, tail, and probability-based sampling
- [security.md](security.md) for TLS, auth, and exposure boundaries

---

## Playbook Routing Format

As more OpenTelemetry.io blog posts are integrated, keep each playbook entry in
this shape:

1. **Source**: the blog post URL and title
2. **Routing signals**: the kinds of user questions or keywords that should load
   it
3. **Playbook theme**: the reusable operational or instrumentation pattern
4. **Why it matters**: what skill behavior or production decision it informs
5. **Load next**: which local references should be loaded after routing
6. **Caveats**: limitations, maturity notes, or operational trade-offs

This structure keeps the skill generic. It routes by user intent and technical
problem space, not by a specific company name.

---

## Relevant 2025-2026 Blogs for This Skill

These are the most relevant recent 2025 and early-2026 `opentelemetry.io` blog
posts to route through this skill today. The list is intentionally
**topic-driven** and **open-ended** so future entries can be added without
restructuring the
document.

| Blog | Primary routing signals | Why it matters for the skill | Load next |
| :--- | :--- | :--- | :--- |
| [Kubernetes annotation-based discovery for the OpenTelemetry Collector](https://opentelemetry.io/blog/2025/otel-collector-k8s-discovery/) | `receiver_creator`, annotation-based discovery, Kubernetes self-service scraping, pod annotations | Strong playbook for self-service Collector onboarding with platform safety rails | [collector][collector-ref], [platforms][platforms-ref] |
| [Observing Lambdas using the OpenTelemetry Collector Extension Layer](https://opentelemetry.io/blog/2025/observing-lambdas/) | Lambda, serverless, extension layer, `decouple` processor, delayed export | Covers ephemeral runtime constraints and decoupled export patterns | [platforms][platforms-ref], [collector][collector-ref], [monitoring][monitoring-ref] |
| [Exposing OTel Collector in Kubernetes with Gateway API & mTLS](https://opentelemetry.io/blog/2025/expose-otel-collector-gateway-api/) | Gateway API, mTLS, external OTLP ingress, multi-cluster collector, hybrid cloud | Practical security and ingress pattern for centralized collector deployments | [security][security-ref], [architecture][architecture-ref], [collector][collector-ref] |
| [How Mastodon Runs OpenTelemetry Collectors in Production](https://opentelemetry.io/blog/2026/devex-mastodon/) | small team, one collector per namespace, OpenTelemetry Operator, Argo CD, tail sampling, vendor-neutral observability | Strong operating model for keeping collector deployments simple, declarative, and reliable while preserving backend choice at production scale | [architecture][architecture-ref], [collector][collector-ref], [monitoring][monitoring-ref] |
| [OpenTelemetry Profiles Enters Public Alpha](https://opentelemetry.io/blog/2026/profiles-alpha/) | profiles, profiling, OTLP Profiles, eBPF profiler, `pprof` receiver, profile correlation | Good routing target when users ask how continuous profiling fits into OpenTelemetry, especially around collector support and cross-signal correlation | [collector][collector-ref], [platforms][platforms-ref], [monitoring][monitoring-ref] |
| [Demystifying Automatic Instrumentation: How the Magic Actually Works](https://opentelemetry.io/blog/2025/demystifying-auto-instrumentation/) | auto-instrumentation, zero-code, bytecode instrumentation, eBPF, runtime hooks | Helps the skill explain *which* automatic instrumentation mechanism fits a runtime | [instrumentation][instrumentation-ref], [platforms][platforms-ref] |
| [OpenTelemetry Logging and You](https://opentelemetry.io/blog/2025/opentelemetry-logging-and-you/) | logs, events, Logs API, log bridges, signal correlation | Useful when users ask how logs relate to traces and metrics in OTel's model | [instrumentation][instrumentation-ref], [collector][collector-ref] |
| [How to Name Your Spans](https://opentelemetry.io/blog/2025/how-to-name-your-spans/) | span naming, low cardinality, semantic conventions, business spans | Good routing target for custom instrumentation and naming guidance | [instrumentation][instrumentation-ref] |
| [How to Name Your Span Attributes](https://opentelemetry.io/blog/2025/how-to-name-your-span-attributes/) | attribute naming, semantic conventions, custom attributes, reserved namespaces | Helps the skill answer detailed questions about attribute design and stability | [instrumentation][instrumentation-ref] |
| [How to Name Your Metrics](https://opentelemetry.io/blog/2025/how-to-name-your-metrics/) | metric naming, units, metric cardinality, `service.name`, semantic conventions | Important for metric schema hygiene and cross-service aggregation advice | [instrumentation][instrumentation-ref], [monitoring][monitoring-ref] |
| [OpenTelemetry Sampling update](https://opentelemetry.io/blog/2025/sampling-milestones/) | consistent sampling, TraceState, probability sampling, W3C TraceContext | Strong route for advanced sampling questions beyond basic head vs tail framing | [sampling][sampling-ref] |
| [The Declarative configuration journey: Why it took 5 years to ignore health check endpoints in tracing](https://opentelemetry.io/blog/2025/declarative-config/) | declarative config, config file, health check exclusion, Java agent config | Good route for questions about portable config, rule-based routing, and YAML-first OTel setup | [instrumentation][instrumentation-ref], [sampling][sampling-ref] |
| [OTTL contexts just got easier with context inference](https://opentelemetry.io/blog/2025/ottl-contexts-just-got-easier/) | OTTL, transform processor, context inference, Collector transforms | Useful when users need simpler transform-processor guidance and want to avoid manual context selection mistakes | [collector][collector-ref], [connectors][connectors-ref] |
| [Announcing Support for Complex Attribute Types in OTel](https://opentelemetry.io/blog/2025/complex-attribute-types/) | complex attributes, maps, heterogeneous arrays, structured telemetry | Helps the skill answer when complex payloads belong in attributes and when flat attributes remain the better design | [instrumentation][instrumentation-ref] |
| [Announcing the Beta Release of OpenTelemetry Go Auto-Instrumentation using eBPF](https://opentelemetry.io/blog/2025/go-auto-instrumentation-beta/) | Go auto-instrumentation, eBPF, runtime hooks, zero-code Go | Adds a concrete runtime-specific route for Go users beyond generic auto-instrumentation explanations | [instrumentation][instrumentation-ref], [platforms][platforms-ref] |
| [Alibaba, Datadog, and Quesma Join Forces on Go Compile-Time Instrumentation](https://opentelemetry.io/blog/2025/go-compile-time-instrumentation/) | Go compile-time instrumentation, `toolexec`, zero-code Go, build-time instrumentation | Good route when users compare compile-time instrumentation with eBPF or manual Go instrumentation | [instrumentation][instrumentation-ref] |
| [Announcing the RPC Semantic Conventions stabilization project](https://opentelemetry.io/blog/2025/stabilizing-rpc-conventions/) | RPC semantic conventions, gRPC telemetry, convention migration, stabilization | Useful for questions about RPC naming, migration windows, and convention stability expectations | [instrumentation][instrumentation-ref] |
| [Contributing the Unroll Processor to the OpenTelemetry Collector Contrib](https://opentelemetry.io/blog/2025/contrib-unroll-processor/) | unroll processor, bundled logs, record expansion, transform vs purpose-built processor | Adds a routing path for log-pipeline questions where bundled payload expansion should not be forced into OTTL transforms | [collector][collector-ref], [monitoring][monitoring-ref] |
| [How Mastodon Runs OpenTelemetry Collectors in Production](https://opentelemetry.io/blog/2026/devex-mastodon/) | small team, Operator-managed collectors, one collector per namespace, Datadog connector, tail sampling in production | Strong production routing example for keeping collector architecture simple, using the OpenTelemetry Operator for lifecycle, and controlling volume with aggressive error-first sampling | [architecture][architecture-ref], [collector][collector-ref], [sampling][sampling-ref] |
| [OpenTelemetry Profiles Enters Public Alpha](https://opentelemetry.io/blog/2026/profiles-alpha/) | profiles, continuous profiling, eBPF profiler, pprof receiver, profile signal | Useful when users ask about bringing profiling into an OTel pipeline; it sets the right expectation that Profiles are practical to evaluate but still Alpha for critical production workloads | [collector][collector-ref], [platforms][platforms-ref] |

### Routing notes for future maintenance

- Prefer adding new entries to this list rather than creating one-off narrative
  sections.
- Route by **technical intent** such as sampling, logs, serverless, ingress,
  naming, or self-service onboarding.
- Keep source links stable and place company-specific stories in
  [Reference Links](#reference-links) unless their patterns become broadly
  generic and reusable.

---

## Generic Playbook Patterns

These patterns are intentionally generic so the skill can scale as more blogs
are added.

### Route by problem, not by company

The skill should match on the user's technical goal—such as Lambda export,
secure collector ingress, or naming guidance—not on a company name from a blog
post.

### Prefer self-service with safety rails

Good playbooks let application teams opt in through narrow, well-defined
interfaces while the platform retains the right guardrails.

### Keep semantic context out of names

For spans, attributes, and metrics, prefer low-cardinality names and put varying
context in attributes or resource metadata.

### Treat external collector ingress as a security boundary

If telemetry crosses clusters, networks, or trust domains, route to patterns
that include explicit authentication, encryption, and ownership boundaries.

### Adapt the topology to the runtime

Ephemeral runtimes like Lambda need different collector and export patterns than
long-running Kubernetes workloads.

### Choose auto-instrumentation mechanisms deliberately

"Auto-instrumentation" is not a single implementation strategy. The right
mechanism depends on runtime behavior, deployment model, and operational
constraints.

### Prefer declarative and portable configuration where possible

As OTel setups grow, YAML-first or schema-driven configuration becomes easier to
review, reuse, and scale than scattered ad hoc flags.

### Always connect a playbook to deeper docs

A blog route should be the front door. The implementation details should still
come from the local references in this repository.

---

## Common Failure Modes

### ❌ Routing on company names instead of technical intent

This makes the skill brittle and limits reuse as more upstream blogs are added.

### ❌ Treating all auto-instrumentation as the same thing

Different runtimes use different mechanisms with different trade-offs.

### ❌ Putting dynamic context into span or metric names

That breaks aggregation, increases cardinality, and makes dashboards harder to
reuse.

### ❌ Exposing collectors without a clear trust model

External OTLP ingress should be treated as a security-sensitive boundary.

### ❌ Blocking ephemeral runtimes on exporter completion

Serverless systems need export paths that respect execution and billing limits.

### ❌ Letting configuration sprawl across ad hoc flags and one-off tweaks

As environments scale, declarative and shared configuration becomes more
maintainable.

### ❌ Answering advanced sampling questions with only basic head-vs-tail advice

Some user questions require consistent probability sampling and TraceState-aware
explanations.

---

## Reference Links

- **OTel blog**: https://opentelemetry.io/blog/
- **Developer Experience survey**: https://opentelemetry.io/blog/2025/devex-survey/
- **Adobe source link**: https://opentelemetry.io/blog/2026/devex-adobe/
- **K8s discovery playbook source**: https://opentelemetry.io/blog/2025/otel-collector-k8s-discovery/
- **Gateway API + mTLS playbook source**: https://opentelemetry.io/blog/2025/expose-otel-collector-gateway-api/
- **Mastodon production collectors source**: https://opentelemetry.io/blog/2026/devex-mastodon/
- **Profiles alpha source**: https://opentelemetry.io/blog/2026/profiles-alpha/
- **Lambda extension playbook source**: https://opentelemetry.io/blog/2025/observing-lambdas/
- **Auto-instrumentation strategy source**: https://opentelemetry.io/blog/2025/demystifying-auto-instrumentation/
- **Logging source**: https://opentelemetry.io/blog/2025/opentelemetry-logging-and-you/
- **Span naming source**: https://opentelemetry.io/blog/2025/how-to-name-your-spans/
- **Span attributes naming source**: https://opentelemetry.io/blog/2025/how-to-name-your-span-attributes/
- **Metric naming source**: https://opentelemetry.io/blog/2025/how-to-name-your-metrics/
- **Sampling update source**: https://opentelemetry.io/blog/2025/sampling-milestones/
- **Declarative config source**: https://opentelemetry.io/blog/2025/declarative-config/
- **OTTL context inference source**: https://opentelemetry.io/blog/2025/ottl-contexts-just-got-easier/
- **Complex attribute types source**: https://opentelemetry.io/blog/2025/complex-attribute-types/
- **Go auto-instrumentation beta source**: https://opentelemetry.io/blog/2025/go-auto-instrumentation-beta/
- **Go compile-time instrumentation source**: https://opentelemetry.io/blog/2025/go-compile-time-instrumentation/
- **RPC semantic conventions source**: https://opentelemetry.io/blog/2025/stabilizing-rpc-conventions/
- **Unroll processor source**: https://opentelemetry.io/blog/2025/contrib-unroll-processor/
- **Mastodon production story source**: https://opentelemetry.io/blog/2026/devex-mastodon/
- **Profiles alpha source**: https://opentelemetry.io/blog/2026/profiles-alpha/

---

[architecture-ref]: architecture.md
[collector-ref]: collector.md
[connectors-ref]: connectors.md
[instrumentation-ref]: instrumentation.md
[monitoring-ref]: monitoring.md
[platforms-ref]: platforms.md
[sampling-ref]: sampling.md
[security-ref]: security.md

---

## Summary

✅ Keep production playbooks **generic, reusable, and routing-friendly**
✅ Use an **expandable 2025-2026 blog routing scan** instead of centering the
document on one org
✅ Route by **technical problem space** such as serverless, ingress, logs,
metrics, naming, transforms, and sampling
✅ Treat blog posts as **entry points** and local references as the detailed
implementation guides
⚠️ Avoid coupling the skill to **company-specific narratives** when the same
pattern can be expressed generically
⚠️ Keep expanding this index as new upstream blog posts become relevant to the
skill
