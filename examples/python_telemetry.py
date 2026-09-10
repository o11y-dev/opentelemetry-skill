"""Manual Python OTel patterns; only wrap operations not already instrumented.

Provider adapters return {"usage": {"input_tokens": int, "output_tokens": int}}
when the provider supplies usage. Streaming adapters yield dictionaries and
implement aclose(). Response content is returned to the caller, never recorded.
"""
from contextlib import asynccontextmanager, contextmanager

from opentelemetry._logs import LogRecord
from opentelemetry.trace import SpanKind, StatusCode


@contextmanager
def operation(tracer, name, *, kind=SpanKind.INTERNAL, attributes=None):
    # Avoid implicit exception events/status descriptions containing user content.
    with tracer.start_as_current_span(
        name, kind=kind, attributes=attributes,
        record_exception=False, set_status_on_exception=False,
    ) as span:
        try:
            yield span
        except Exception as error:
            span.set_attribute("error.type", type(error).__name__)
            span.set_status(StatusCode.ERROR)
            raise
        # asyncio.CancelledError is a BaseException: intentional cancellation
        # ends the span without classifying it as a provider failure.


def record_usage(span, usage):
    for name in ("input_tokens", "output_tokens"):
        value = (usage or {}).get(name)
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
            span.set_attribute(f"gen_ai.usage.{name}", value)


def inference_attributes(provider, model):
    return {"gen_ai.operation.name": "chat", "gen_ai.provider.name": provider,
            "gen_ai.request.model": model}


def inference(tracer, call, *, provider, model):
    with operation(tracer, f"chat {model}", kind=SpanKind.CLIENT,
                   attributes=inference_attributes(provider, model)) as span:
        result = call()
        record_usage(span, result.get("usage"))
        return result


async def async_inference(tracer, call, *, provider, model):
    with operation(tracer, f"chat {model}", kind=SpanKind.CLIENT,
                   attributes=inference_attributes(provider, model)) as span:
        result = await call()
        record_usage(span, result.get("usage"))
        return result


@asynccontextmanager
async def streaming_inference(tracer, chunks_factory, *, provider, model):
    # Span scope belongs to the consuming task, not a generator left suspended
    # with an attached context after the consumer breaks out of its loop.
    with operation(tracer, f"chat {model}", kind=SpanKind.CLIENT,
                   attributes=inference_attributes(provider, model)) as span:
        chunks = chunks_factory()

        async def observed_chunks():
            async for chunk in chunks:
                record_usage(span, chunk.get("usage"))
                yield chunk

        try:
            yield observed_chunks()
        finally:
            await chunks.aclose()


def execute_tool(tracer, name, call):
    with operation(tracer, f"execute_tool {name}", attributes={
        "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": name,
    }):
        return call()


def emit_event(logger, name, attributes):
    # event_name is a LogRecord field, not attributes["event.name"]. The active
    # context supplies trace/span IDs; callers pass only approved metadata.
    logger.emit(LogRecord(event_name=name, attributes=attributes))


if __name__ == "__main__":
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk._logs import LoggerProvider
    from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
    from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter

    resource = Resource.create({"service.name": "python-ai-example"})
    traces = TracerProvider(resource=resource)
    logs = LoggerProvider(resource=resource)
    traces.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    logs.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter()))
    tracer = traces.get_tracer("python-ai-example")
    try:
        with operation(tracer, "invoke_agent demo", attributes={
            "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "demo",
        }):
            # Replace with an adapter for your provider, or use its instrumentor.
            inference(tracer, lambda: {"usage": {"input_tokens": 4, "output_tokens": 2}},
                      provider="example", model="example-model")
            execute_tool(tracer, "lookup", lambda: None)
            emit_event(logs.get_logger("python-ai-example"), "agent.completed", {"success": True})
    finally:
        traces.force_flush(timeout_millis=5000)
        logs.force_flush(timeout_millis=5000)
        traces.shutdown()
        logs.shutdown()
