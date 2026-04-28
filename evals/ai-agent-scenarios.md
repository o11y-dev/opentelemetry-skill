# AI Agent Observability Evaluations

## GitHub Copilot CLI Monitoring

**ID**: copilot-cli-setup  
**Category**: AI Agents  
**Difficulty**: Intermediate  

### Prompt
Configure OpenTelemetry monitoring for GitHub Copilot CLI to track usage patterns and performance.

### Expected Response (Key Points)
- Mentions CLI doesn't emit traces natively (no automatic telemetry)
- Suggests wrapper scripts or process monitoring approach
- Recommends monitoring via system metrics (CPU, memory, execution time)
- May reference custom instrumentation with `gh copilot --telemetry-opt-in`
- Warns about limited built-in observability compared to other agents

### Failure Modes
- Assumes Copilot CLI has built-in OTEL support
- Provides generic agent configuration without CLI specifics
- Doesn't mention telemetry opt-in requirements
- Suggests unsupported configuration options

---

## Gemini CLI Telemetry

**ID**: gemini-cli-monitoring  
**Category**: AI Agents  
**Difficulty**: Intermediate  

### Prompt
Set up observability for Google Gemini CLI to monitor API calls and response latencies.

### Expected Response (Key Points)
- Configures environment variables for Gemini telemetry export
- Sets up proper OTLP endpoint configuration
- Includes API rate limiting considerations
- Mentions quota and billing correlation with telemetry
- Warns about sensitive prompt data in telemetry

### Failure Modes
- Omits Gemini-specific configuration
- Doesn't address API quota correlation
- Missing privacy considerations for prompts
- Generic setup without Gemini CLI specifics

---

## Multi-Agent Environment

**ID**: multi-agent-setup  
**Category**: AI Agents  
**Difficulty**: Advanced  

### Prompt
Configure observability for a development environment using Claude Code, GitHub Copilot, and Cursor simultaneously.

### Expected Response (Key Points)
- Sets up service differentiation via `service.name` attributes
- Configures separate OTEL endpoints or resource detection
- Handles different telemetry capabilities per agent
- Includes correlation strategies for multi-tool workflows
- Mentions resource attribution to prevent metric conflicts

### Failure Modes
- Treats all agents identically
- Doesn't differentiate service names
- Missing correlation between agent activities
- Omits resource conflict resolution
- No consideration for different telemetry maturity levels

---

## AI Agent Resource Attribution

**ID**: agent-resource-attribution  
**Category**: AI Agents  
**Difficulty**: Advanced  

### Prompt
Ensure proper resource attribution when multiple AI agents run in the same development environment.

### Expected Response (Key Points)
- Configures unique `service.name` for each agent
- Sets up `service.instance.id` for multiple instances
- Uses resource detection for environment context
- Includes user/session attribution strategy
- Handles overlapping tool usage scenarios

### Failure Modes
- Uses generic service names
- Doesn't handle instance differentiation  
- Missing user context attribution
- No strategy for tool overlap detection
- Omits resource conflict prevention