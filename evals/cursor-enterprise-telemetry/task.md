Our team uses Cursor Enterprise across desktop, CLI, and cloud agents, plus Claude Code. We have an existing OTLP backend. We want Cursor token/cost trends and tool-execution investigations without collecting prompts or tool payloads. Some developers already run opentelemetry-hooks.

Should we keep hooks, replace them, or combine them with Cursor's native export? Give a configuration and validation plan using current first-party documentation. Explain how to correlate activity, avoid duplicate counts, and interpret duration and cost correctly across these execution surfaces.
