# Python instrumentation and GenAI

Use this reference for Python SDK setup, framework instrumentation, async or
streaming AI applications, and log-based events. For coding-agent products such
as Claude Code, Gemini CLI, or Antigravity, use [ai-agents.md](ai-agents.md).

## Choose one initialization and instrumentation owner

- **Zero code:** install `opentelemetry-distro`, an OTLP exporter, and the matching
  framework instrumentors; launch with `opentelemetry-instrument`. Run bootstrap
  during image/environment construction, then lock the resolved dependencies.
- **Application owned:** initialize providers once during application startup,
  explicitly instrument supported libraries once, and add manual business spans.
  Do not also launch the same process through an auto-instrumenting entrypoint.
- **Framework native:** inspect the installed framework and middleware before
  adding contrib instrumentation. A class being importable does not prove the
  middleware is active. Choose the native middleware or contrib instrumentor for
  the same HTTP server boundary; keep separate client/DB instrumentation.

FastAPI [0.142.0](https://github.com/fastapi/fastapi/releases/tag/0.142.0) adds native
OpenTelemetry support. This does not establish support in earlier FastAPI or every
Starlette release. The [coexistence issue][fastapi-issue] and
[native-support discussion](https://github.com/open-telemetry/opentelemetry-python-contrib/issues/5108)
track integration with contrib; avoid assuming that two middleware layers are
needed or that every combination behaves identically.
Verify the installed versions and one exported SERVER span per request before
claiming this combination works. ASGI send/receive child spans are not duplicate
SERVER spans.

With FastAPI 0.142, environment-driven export is a separate ownership concern:
when your application or distro owns providers/exporters, use
`FastAPI(telemetry={"auto_configure": False})`. Native startup can otherwise add
HTTP exporters from `OTEL_*` endpoints; it does not deduplicate exporters owned
by another component. Automatic export requires the relevant FastAPI extra.
See the [tagged runtime](https://github.com/fastapi/fastapi/blob/0.142.0/fastapi/telemetry/_runtime.py).
Verify both span ownership and exporter ownership; one SERVER span in memory does
not rule out exporting that span twice.

For an explicit Python 1.44 example baseline:

```bash
python -m pip install opentelemetry-sdk==1.44.0 \
  opentelemetry-exporter-otlp-proto-grpc==1.44.0
export OTEL_SERVICE_NAME=my-python-service
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
```

The HTTP endpoint above is a local development example. Use TLS and the chosen
exporter's authentication settings across trust boundaries. For HTTP/protobuf,
install the HTTP exporter and use port 4318; do not send gRPC to an HTTP endpoint.
Keep SDK/API/exporter versions aligned and let the instrumentor's dependency
constraints determine its compatible beta version; do not give every package the
SDK version number. Python 1.44 corresponds to the 0.65b0 release train.

## Python 1.44 migration notes

The [1.44.0 release][python-release] changes these application-facing behaviors:

- The deprecated Events API/SDK is removed. Emit a `LogRecord` with its
  **`event_name` field**, not just an `attributes["event.name"]` entry. Existing
  backend attribute aliases are a separate compatibility concern.
- Declarative configuration moved to the experimental
  `opentelemetry-configuration` package (`opentelemetry.configuration`).
  `opentelemetry-sdk[file-configuration]` remains an installation alias.
- With `OTEL_CONFIG_FILE`, the environment-based initialization path is skipped;
  `OTEL_PYTHON_*` extensions are bypassed. Put the intended settings in the file
  and verify emitted resources, active instrumentors, and exporter destinations.
  This is not a universal precedence rule for every exporter environment variable.
- `ProcessResourceDetector` no longer captures `process.command_args` or
  `process.command_line` by default. Do not re-enable `include_command_args=True`
  merely to restore a dashboard: arguments can contain credentials or user input.
- Log attribute limits are configurable through
  `OTEL_LOGRECORD_ATTRIBUTE_COUNT_LIMIT` and
  `OTEL_LOGRECORD_ATTRIBUTE_VALUE_LENGTH_LIMIT` on the environment path. These
  bound attributes, not arbitrary log bodies or sensitive-content exposure.

## Python 1.45 upgrade checks

The [1.45.0 / 0.66b0 release](https://github.com/open-telemetry/opentelemetry-python/releases/tag/v1.45.0)
is a separate tested target from the 1.44 example baseline above. Align API, SDK,
exporter, and instrumentation dependencies when upgrading.

- Custom Logger implementations must implement `enabled()`. Exercise custom
  subclasses and bridges, not only the default SDK logger.
- OTLP HTTP/protobuf uses the new shared HTTP transport with urllib3 by default.
  Recheck custom sessions, proxies, certificates, and timeouts. The default
  `max_request_size` is 64 MiB of serialized data before compression; `0` disables
  this limit. This is neither a content-redaction control nor a backend guarantee.
- An explicit HTTP exporter `endpoint=` is the complete signal URL, including
  `/v1/traces`, `/v1/metrics`, or `/v1/logs`; do not assume base-URL expansion.
- Declarative environment substitution applies to parsed scalar values, not
  comments or mapping keys. Missing variables become empty values; null results
  can be skipped with a warning. Inspect the resulting configuration and resource
  attributes before deployment, especially when secrets are missing.
- Test View matching with mixed-case instrument names and custom aggregation.
  Flush/shutdown remains required; the default log `force_flush` timeout is 30s.
- [Contrib 0.66b0](https://github.com/open-telemetry/opentelemetry-python-contrib/releases/tag/v0.66b0)
  promotes Python logging's `otel.event.name` into `LogRecord.event_name`.
  Recheck backend mapping rather than duplicating the event-name attribute.
  GenAI package moves and removal of `kafka-python-ng` instrumentation require
  checking the installed package set, not simply bumping the SDK.

## Python AI instrumentation packages

Python GenAI development now lives in [opentelemetry-python-genai][python-genai].
Old contrib `instrumentation-genai` packages are deprecated and receive security
patches only. Read the destination package's README before replacing a package:
names, imports, configuration, and emitted attributes can change. Do not install
old and replacement instrumentors together.

Inventory checked October 12, 2026 against the upstream released-package table;
these are **beta**, not stability guarantees:

| Library/framework | Destination package | Released version | Supported library range |
|---|---|---|---|
| OpenAI Python | `opentelemetry-instrumentation-genai-openai` | 1.2b0 | `openai >=1.26.0,<4` |
| Anthropic Python | `opentelemetry-instrumentation-genai-anthropic` | 1.2b0 | `anthropic >=0.51.0,<2` |
| Google GenAI | `opentelemetry-instrumentation-google-genai` | 1.2b0 | `google-genai >=1.32.0,<3` |
| LangChain | `opentelemetry-instrumentation-genai-langchain` | 1.2b0 | `langchain >=0.3.21,<2` |
| OpenAI Agents | `opentelemetry-instrumentation-genai-openai-agents` | 1.2b0 | `openai-agents >=0.3.3,<1` |
| DSPy | `opentelemetry-instrumentation-genai-dspy` | 1.2b0 | `dspy >=3.3.0,<4` |
| LlamaIndex | `opentelemetry-instrumentation-genai-llama-index` | 1.2b0 | `llama-index-core >=0.14.19,<1`; instrumentation `>=0.4.3,<1`; workflows `>=2.17.1,!=2.24.0,<3` |

Upstream also lists released Agno, Bedrock, Portkey, Qwen Agent, and Smolagents
instrumentors; consult their package constraints before selecting them.
Upstream lists Claude Agent SDK, CrewAI, and Weaviate instrumentations as
unreleased skeletons at this snapshot. A folder in the repository is not proof of
an installable implementation. Verify package release and supported library range
when selecting instrumentation. The ranges above do not imply validation of every
SDK/framework combination by this skill.

Prefer an instrumentor that already covers your operations. Use the manual
patterns below only for missing coverage; layering another inference span around
an instrumented client will double-count operations and possibly token metrics.

## Async, streaming, and tool calls

[GenAI conventions][genai-spans] are Development. Pin the source revision used by
your instrumentation/dashboard contract and preserve native fields during migration.

- Inference spans use `chat {model}` (or the actual operation, such as
  `generate_content`), with CLIENT kind for a remote model. Set provider identity
  in `gen_ai.provider.name`; do not substitute the agent product name.
- An in-process agent invocation is an INTERNAL `invoke_agent {agent name}` span.
  Inference and subsequent tool execution are separate children of that invocation.
- Tool spans use `execute_tool {tool name}`, INTERNAL kind, and
  `gen_ai.operation.name=execute_tool` plus `gen_ai.tool.name`. Use the registered
  tool name, not arguments, paths, or request IDs. Do not rewrite vendor-native
  spans solely to force this naming template.
- A streaming inference span covers stream creation **and consumption** until
  completion, error, cancellation, or explicit close. Ending it when the iterator
  is returned understates latency and loses late usage data.
- OTel context follows normal `asyncio` task creation. Preserve or explicitly
  propagate context at detached tasks, threads, queues, and process boundaries.
  Create tasks inside the intended parent scope and await owned work before ending it.
- Record provider-reported usage when available, including real zero values.
  Missing usage is unknown, not zero. Do not attach token usage to tool spans or
  add cache/reasoning subtotals to totals that already include them.
- Disable prompts, responses, tool arguments/results, and exception messages in
  default telemetry. Keep request/session identifiers out of metric dimensions.

The executable [manual example](../examples/python_telemetry.py) uses small
provider-neutral adapters and never records response content. Real provider
adapters map usage into its input/output keys and expose an async iterator with
`aclose()`; cleanup must close the underlying provider stream.

```python
from examples.python_telemetry import operation, streaming_inference, execute_tool

# tracer is obtained from the application's provider; chunks_factory is an
# adapter around the selected provider's streaming API, created inside the span.
async def run_agent(tracer, chunks_factory):
    with operation(tracer, "invoke_agent assistant", attributes={
        "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "assistant",
    }):
        async with streaming_inference(
            tracer, chunks_factory, provider="example", model="example-model",
        ) as chunks:
            async for chunk in chunks:
                consume_in_application(chunk)  # application code; no content telemetry
        execute_tool(tracer, "lookup", lookup)  # application callable
```

The example leaves intentional `asyncio.CancelledError` status UNSET and records
only an error class on other failures, re-raising the original exception. Classify
application timeouts separately from intentional cancellation. The outer context
manager closes the stream even when a consumer exits early.

## Events, export, and shutdown

```python
from opentelemetry._logs import LogRecord

# Obtain this logger from the application's configured LoggerProvider.
# Run while the intended span is current; LogRecord captures its context.
def completed(logger):
    logger.emit(LogRecord(event_name="agent.completed", attributes={"success": True}))
```

Python 1.44 exposes these log APIs under `_logs`; verify imports when changing the
pin. The executable example includes complete trace/log providers, OTLP exporters,
and flushing. Production services should use batch processors, own providers once
per worker, and flush/shut down during graceful termination. Do not flush every
request or share an initialized exporter across a pre-fork worker boundary.

Run the isolated tests without model credentials or a Collector:

```bash
uv run --no-project --python 3.12 \
  --with opentelemetry-sdk==1.44.0 \
  --with opentelemetry-exporter-otlp-proto-grpc==1.44.0 \
  --with opentelemetry-instrumentation-fastapi==0.65b0 \
  --with fastapi==0.116.1 --with httpx==0.28.1 \
  python -m unittest discover -s tests -p 'test_python_telemetry.py'
```

Before rollout, inspect serialized OTLP at the Collector/backend: one server
boundary per request, correct parentage, accurate span duration, log trace/span
IDs, an event name field, and no sensitive content. In-memory tests alone do not
prove the backend mapping or exporter configuration.

[python-release]: https://github.com/open-telemetry/opentelemetry-python/releases/tag/v1.44.0
[fastapi-issue]: https://github.com/open-telemetry/opentelemetry-python-contrib/issues/5000
[python-genai]: https://github.com/open-telemetry/opentelemetry-python-genai
[genai-spans]: https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md
