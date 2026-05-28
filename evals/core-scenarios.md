# OpenTelemetry Skill Evaluation Scenarios

## Collector Memory Protection

**ID**: collector-memory-limiter  
**Category**: Safety  
**Difficulty**: Basic  

### Prompt
Configure an OpenTelemetry Collector to receive OTLP traces and export them to Jaeger.

### Expected Response (Key Points)
- Includes `memory_limiter` processor as the **first** processor in the pipeline
- Explains why memory_limiter must be first (prevents OOM crashes)
- Includes proper receiver, processor, and exporter configuration
- Uses correct processor ordering: memory_limiter → batch → other processors

### Failure Modes
- Omits memory_limiter entirely
- Places memory_limiter after other processors
- Provides basic config without memory protection
- Rationalizes with "here's a simple configuration"

---

## Cardinality Guard

**ID**: cardinality-protection  
**Category**: Safety  
**Difficulty**: Basic  

### Prompt
Add user_id as a metric dimension to track per-user API latency.

### Expected Response (Key Points)
- **Rejects the request** - explains user_id violates cardinality limits
- Suggests alternatives: use user_id as trace attribute instead
- Explains metric explosion risks with unbounded dimensions
- Offers aggregated alternatives (user_type, user_tier, subscription_plan, etc.)

### Failure Modes
- Accepts the request and provides configuration
- Doesn't warn about cardinality explosion
- Suggests user_id as valid metric dimension
- Rationalizes with "for detailed monitoring"

---

## Tail Sampling Architecture

**ID**: tail-sampling-setup  
**Category**: Architecture  
**Difficulty**: Intermediate  

### Prompt
Set up tail sampling in Kubernetes to sample 10% of traces but keep all error traces.

### Expected Response (Key Points)
- Recommends **Gateway deployment** pattern for tail sampling
- Configures `loadbalancing` exporter with `routing_key: traceID`
- Sets up Headless Service for consistent routing
- Warns about Beta stability level
- Includes proper tail sampling policies (error rate + probabilistic)

### Failure Modes
- Suggests DaemonSet deployment for tail sampling
- Omits load balancing configuration
- Doesn't warn about stability levels
- Misses consistent hashing requirements

---

## AI Agent Monitoring

**ID**: claude-code-telemetry  
**Category**: AI Agents  
**Difficulty**: Advanced  

### Prompt
Set up OpenTelemetry monitoring for Claude Code to track token usage and costs.

### Expected Response (Key Points)
- Requires `CLAUDE_CODE_ENABLE_TELEMETRY=1` environment variable
- Mentions `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`
- References `~/.claude/settings.json` for persistent config
- Includes privacy controls (`OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_TOOL_DETAILS`)
- Warns about `session.id` cardinality in metrics

### Failure Modes
- Suggests generic OTEL setup without Claude Code specifics
- Misses telemetry enablement flag
- Doesn't mention privacy configuration options
- Uses wrong metric temporality preference
- Omits Claude Code-specific considerations