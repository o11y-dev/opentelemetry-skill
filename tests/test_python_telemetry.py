"""No network or model credentials: validate exported telemetry, not doc wording."""
import asyncio
import re
import unittest
from pathlib import Path
from types import SimpleNamespace

from examples.python_telemetry import (
    async_inference, emit_event, execute_tool, inference, operation, streaming_inference,
)
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import SimpleLogRecordProcessor, InMemoryLogRecordExporter


class PythonTelemetryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.exporter = InMemorySpanExporter()
        self.provider = TracerProvider()
        self.provider.add_span_processor(SimpleSpanProcessor(self.exporter))
        self.tracer = self.provider.get_tracer("test")
        self.logs = LoggerProvider()
        self.log_exporter = InMemoryLogRecordExporter()
        self.logs.add_log_record_processor(SimpleLogRecordProcessor(self.log_exporter))

    def tearDown(self):
        self.provider.shutdown()
        self.logs.shutdown()

    def test_inference_tool_event_and_privacy(self):
        with operation(self.tracer, "invoke_agent test") as parent:
            result = inference(self.tracer, lambda: {"text": "secret response", "usage": {"input_tokens": 0, "output_tokens": 3}}, provider="test", model="model")
            execute_tool(self.tracer, "lookup", lambda: "secret output")
            emit_event(self.logs.get_logger("test"), "agent.completed", {"success": True})
        spans = self.exporter.get_finished_spans()
        self.assertEqual([s.name for s in spans], ["chat model", "execute_tool lookup", "invoke_agent test"])
        self.assertTrue(all(s.parent.span_id == parent.get_span_context().span_id for s in spans[:2]))
        self.assertEqual(spans[0].attributes["gen_ai.usage.input_tokens"], 0)
        self.assertNotIn("gen_ai.usage.input_tokens", spans[1].attributes)
        self.assertEqual(result["text"], "secret response")
        self.assertNotIn("secret", str([dict(s.attributes) for s in spans]))
        event = self.log_exporter.get_finished_logs()[0].log_record
        self.assertEqual(event.event_name, "agent.completed")
        self.assertEqual(event.trace_id, parent.get_span_context().trace_id)
        self.assertEqual(event.span_id, parent.get_span_context().span_id)
        self.assertNotIn("event.name", event.attributes)

    def test_fastapi_has_one_server_span_with_remote_parent(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        app = FastAPI()

        @app.get("/health")
        def health():
            return {"ok": True}

        FastAPIInstrumentor.instrument_app(app, tracer_provider=self.provider)
        try:
            with TestClient(app) as client:
                result = client.get("/health", headers={
                    "traceparent": "00-12345678901234567890123456789012-1234567890123456-01",
                })
            self.assertEqual(result.status_code, 200)
            servers = [s for s in self.exporter.get_finished_spans() if s.kind == trace.SpanKind.SERVER]
            self.assertEqual(len(servers), 1)
            self.assertEqual(servers[0].context.trace_id, int("12345678901234567890123456789012", 16))
            self.assertEqual(servers[0].parent.span_id, int("1234567890123456", 16))
        finally:
            FastAPIInstrumentor.uninstrument_app(app)

    def test_documented_token_metric_is_histogram_without_synthetic_total(self):
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import InMemoryMetricReader

        reader = InMemoryMetricReader()
        provider = MeterProvider(metric_readers=[reader])
        try:
            text = (Path(__file__).resolve().parents[1] / "references/instrumentation.md").read_text()
            section = text.split("**Token usage metrics (Development)**:", 1)[1]
            snippet = re.search(r"```python\n(.*?)```", section, re.S).group(1)
            exec(snippet, {
                "meter": provider.get_meter("test"), "model": "model",
                "response": SimpleNamespace(usage=SimpleNamespace(prompt_tokens=5, completion_tokens=2)),
            })
            metric = reader.get_metrics_data().resource_metrics[0].scope_metrics[0].metrics[0]
            self.assertEqual(metric.name, "gen_ai.client.token.usage")
            self.assertEqual(type(metric.data).__name__, "Histogram")
            points = {p.attributes["gen_ai.token.type"]: p for p in metric.data.data_points}
            self.assertEqual(set(points), {"input", "output"})
            self.assertEqual(points["input"].sum, 5)
            self.assertEqual(points["output"].sum, 2)
        finally:
            provider.shutdown()

    async def test_concurrent_async_parentage_and_missing_usage(self):
        async def run(name):
            with operation(self.tracer, name):
                async def call():
                    await asyncio.sleep(0)
                    return {"text": "unrecorded"}
                await async_inference(self.tracer, call, provider="test", model=name)
        await asyncio.gather(run("one"), run("two"))
        spans = {s.name: s for s in self.exporter.get_finished_spans()}
        for name in ("one", "two"):
            child = spans[f"chat {name}"]
            self.assertEqual(child.parent.span_id, spans[name].context.span_id)
            self.assertFalse(any(k.startswith("gen_ai.usage.") for k in child.attributes))

    async def test_stream_lifetime_and_final_usage(self):
        closed = []
        async def chunks():
            try:
                yield {"text": "secret"}
                yield {"usage": {"input_tokens": 5, "output_tokens": 2}}
            finally:
                closed.append(True)
        async with streaming_inference(self.tracer, chunks, provider="test", model="stream") as stream:
            async for _ in stream:
                self.assertEqual(len(self.exporter.get_finished_spans()), 0)
        span, = self.exporter.get_finished_spans()
        self.assertEqual(span.attributes["gen_ai.usage.output_tokens"], 2)
        self.assertEqual(closed, [True])
        self.assertFalse(trace.get_current_span().get_span_context().is_valid)

    async def test_stream_cancellation_closes_without_leaking_context(self):
        closed = []
        async def chunks():
            try:
                yield {"text": "first"}
                await asyncio.sleep(10)
            finally:
                closed.append(True)
        with operation(self.tracer, "parent") as parent:
            with self.assertRaises(asyncio.CancelledError):
                async with streaming_inference(self.tracer, chunks, provider="test", model="stream") as stream:
                    async for _ in stream:
                        raise asyncio.CancelledError()
            self.assertEqual(trace.get_current_span(), parent)
        stream_span = self.exporter.get_finished_spans()[0]
        self.assertEqual(stream_span.status.status_code, trace.StatusCode.UNSET)
        self.assertEqual(closed, [True])

    async def test_stream_early_exit_closes_and_omits_unavailable_usage(self):
        closed = []
        async def chunks():
            try:
                yield {"text": "first"}
                yield {"usage": {"input_tokens": 5}}
            finally:
                closed.append(True)
        async with streaming_inference(self.tracer, chunks, provider="test", model="stream") as stream:
            async for _ in stream:
                break
        span, = self.exporter.get_finished_spans()
        self.assertNotIn("gen_ai.usage.input_tokens", span.attributes)
        self.assertEqual(closed, [True])

    async def test_stream_error_preserves_exception_without_content(self):
        original = ValueError("secret provider response")
        async def chunks():
            yield {"text": "first"}
            raise original
        with self.assertRaises(ValueError) as caught:
            async with streaming_inference(self.tracer, chunks, provider="test", model="stream") as stream:
                async for _ in stream:
                    pass
        self.assertIs(caught.exception, original)
        span, = self.exporter.get_finished_spans()
        self.assertEqual(span.status.status_code, trace.StatusCode.ERROR)
        self.assertEqual(span.attributes["error.type"], "ValueError")
        self.assertIsNone(span.status.description)
        self.assertEqual(len(span.events), 0)


if __name__ == "__main__":
    unittest.main()
