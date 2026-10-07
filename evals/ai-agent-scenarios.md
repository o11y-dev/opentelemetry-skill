# AI Agent Observability Evaluations

## GitHub Copilot CLI Monitoring

**ID**: copilot-cli-setup  
**Category**: AI Agents  
**Difficulty**: Intermediate  

### Prompt
Configure OpenTelemetry monitoring for GitHub Copilot CLI to track usage patterns and performance.

### Expected Response (Key Points)
- Uses current Copilot CLI OpenTelemetry documentation rather than assuming no native signals
- Describes documented traces, metrics, and events with the supported endpoint/configuration path
- Distinguishes native telemetry from community lifecycle hooks
- Checks the installed CLI/version and avoids inventing flags such as `gh copilot --telemetry-opt-in`
- Mentions content-capture and metric-cardinality risks where relevant

### Failure Modes
- Claims Copilot CLI lacks native OTEL solely from stale guidance
- Provides generic agent configuration without CLI specifics
- Doesn't verify telemetry enablement/configuration
- Suggests unsupported configuration options

---

## Google Antigravity Telemetry

**ID**: antigravity-telemetry-review  
**Category**: AI Agents  
**Difficulty**: Intermediate  

### Prompt
Review the native OpenTelemetry support for Google Antigravity and recommend an observability approach for API calls and response latencies.

### Expected Response (Key Points)
- Verifies native telemetry, configuration, and privacy behavior using first-party documentation for the installed Antigravity version
- Does not carry over legacy Google CLI environment variables, config files, or support claims
- Marks unsupported or undocumented native signals as unknown rather than inventing options
- Separates the community Antigravity workflow hook from vendor-native telemetry
- Recommends event-hook instrumentation only when the runner exposes compatible events
- Calls out MCP payload logging being enabled by default and prompt masking being opt-in

### Failure Modes
- Presents legacy Google CLI settings as Antigravity settings
- Claims native traces, metrics, logs, or GenAI conventions without version-specific evidence
- Implies community event hooks establish native Antigravity support or generic process metrics
- Omits privacy considerations for captured output

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

---

## GenAI Tool-Call Span Naming

**ID**: genai-tool-span-naming  
**Category**: AI Agents  
**Difficulty**: Advanced  

### Prompt
I'm instrumenting an AI coding agent that calls `bash` and `search_code`. Show me how the OpenTelemetry spans should be named.

### Expected Response (Key Points)
- Uses the Development-convention `execute_tool {gen_ai.tool.name}` span name for each tool invocation
- Preserves the actual tool name in `gen_ai.tool.name`
- Uses registered tool names without arguments, paths, or request IDs

### Failure Modes
- Encodes unbounded tool names into span names
- Omits `gen_ai.tool.name`
- Gives generic tracing advice without tool-call specifics