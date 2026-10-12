# Release-specific upgrade checks

Use these checks when upgrading the listed components. Compare the deployed and
target versions, then validate the configuration and exported data. The versions
below do not raise every existing example's minimum version.

## Collector 0.162 and Kubernetes

Read both [Core 0.162](https://github.com/open-telemetry/opentelemetry-collector/releases/tag/v0.162.0)
and [Contrib 0.162](https://github.com/open-telemetry/opentelemetry-collector-contrib/releases/tag/v0.162.0).
Retain the [0.160 migration checks](collector.md#collector-0160-upgrade-checks) when
crossing that version too.

| Change | Required review |
|---|---|
| Elasticsearch removes `flush` and `num_workers` | Use `sending_queue.num_consumers` and `sending_queue.batch` with `flush_timeout`, `max_size`, and `sizer: bytes` for the old byte threshold. Validate with the target binary. |
| Elasticsearch OTel profile datastreams require 9.6+ | For older backends, use `mapping.allowed_modes: [ecs]`; do not infer profile compatibility from successful trace/log export. |
| `queuebatch` becomes `queue_batch` | Update the Core processor ID. Contrib `grafanacloud` → `grafana_cloud` and `awss3` → `aws_s3` retain deprecated aliases. |
| Adaptive sampling selectors require an origin | Replace `root.attributes[...]` with `root.span.attributes[...]` for prior span-level behavior; use `root.resource.` or `root.any.` only when those are intended. |
| Permissive Prometheus label sanitization defaults on | Audit queries using `key__foo`; `_foo` is now preserved. A temporary feature-gate rollback is not a permanent query migration. |
| Prometheus scope extraction changes | `otel_scope_info` no longer supplies scope attributes; inspect `otel_scope_` labels. The stable `IgnoreScopeInfoMetric` gate cannot be disabled. |
| `signal_to_metrics` defaults to `error_mode: ignore` | Set the intended mode explicitly and test conversion failures; ingest success alone does not prove every derived metric was produced. |
| OTTL stable gates removed | Remove obsolete `ottl.PanicDuplicateName`, `ottl.contexts.enableOTelColContext`, and `processor.transform.defaultErrorModeIgnore` flags. |
| Kafka metadata retry configuration is now honored | Review explicit `metadata.retry.max`; the effective default remains 20. `metadata.full` is deprecated and ineffective. |
| Exporter queue batch partition limits | Review active partition cardinality and the new cache size/capacity metrics. The oversized-item splitting fix applies to logs, not automatically other signals. |

Signing-processor canonicalization also changes in 0.162, invalidating older
signatures. Verify the producer/verifier pair before upgrading an audit pipeline;
see [security guidance](security.md#release-sensitive-security-checks).

[Operator 0.160](https://github.com/open-telemetry/opentelemetry-operator/releases/tag/v0.160.0)
disables generated network policies by default. Review the Operator and operand
gates or per-resource `spec.networkPolicy.enabled`, including API-server access.
The Operator ServiceAccount needs permissions it grants to Collectors, including
Jobs/CronJobs enrichment. Inspect live CRD schemas, rendered RBAC, and admission
behavior independently of the Collector image. Target Allocator reconciliation
can revert manual edits and remove resources no longer requested.

[Collector chart 0.174.1](https://github.com/open-telemetry/opentelemetry-helm-charts/releases/tag/opentelemetry-collector-0.174.1)
restricts its profiling preset to Linux. Chart versions, image versions, Operator
versions, and CRD versions are separate compatibility axes. Existing examples do
not acquire new features merely because a chart release exists.

## SDK and instrumentation changes

| Release evidence | Action when applicable |
|---|---|
| [Python 1.45 / 0.66b0](https://github.com/open-telemetry/opentelemetry-python/releases/tag/v1.45.0) | Review custom `Logger.enabled()` implementations, HTTP transport/request limits, declarative substitution, and mixed-case View matching. See [Python migration guidance](python-instrumentation.md#python-145-upgrade-checks). |
| [Java SDK 1.66](https://github.com/open-telemetry/opentelemetry-java/releases/tag/v1.66.0) | Test OTLP HTTP `Retry-After`, mTLS with platform trust stores, and avoid mixing a key manager with an explicit SSL context. Exporter-request suppression should prevent recursive instrumentation. |
| [Java instrumentation 2.32](https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/tag/v2.32.0) | Targets SDK 1.66. Custom GenAI getters require `isRequestStreaming`; JMX SPI implementations require `getMetricNames()`. Review messaging-header selector and query-capture deprecations before a 3.x migration. A preview is not stable 3.x. |
| [Go 1.47](https://github.com/open-telemetry/opentelemetry-go/releases/tag/v1.47.0) | Review nested attribute depth (default 64) and `PeriodicReader` batch-size configuration. Experimental probability sampling/binding APIs do not become stable through a core release. |
| [Go compile-time instrumentation 1.1](https://github.com/open-telemetry/opentelemetry-go-compile-instrumentation/releases/tag/v1.1.0) | Non-streaming Anthropic instrumentation is not streaming coverage. Test SIGTERM flush and propagation in the rebuilt binary; do not assume eBPF has the same support contract. |
| [JS 2.11](https://github.com/open-telemetry/opentelemetry-js/releases/tag/v2.11.0) | Test context attach/disposal on the supported Node runtime and per-call flush timeouts. Keep [3.x readiness](javascript-otel3-readiness.md) separate from the stable 2.x example. |
| [.NET 1.19.1](https://github.com/open-telemetry/opentelemetry-dotnet/releases/tag/core-1.19.1) | Includes wildcard source/meter pattern fixes on .NET 8. Reuse providers and test large pattern sets; unrelated declarative-configuration proposals are not available options. |
| [Rust 0.33](https://github.com/open-telemetry/opentelemetry-rust/releases/tag/opentelemetry-0.33.0) | Logs/metrics APIs and SDKs are stable, but their OTLP exporters remain release candidates in this release; tracing remains pre-stable. Verify the exact later release before claiming exporter stability. |
| [C++ 1.29](https://github.com/open-telemetry/opentelemetry-cpp/releases/tag/v1.29.0) | Declarative defaults change: attribute value length becomes unlimited; ratio sampling defaults to 1.0; log batch delay becomes 1s and metric interval 60s. Specify intended limits/rates and use the new default registry factory when constructing declarative configuration. |
| [Ruby logs SDK 0.7](https://github.com/open-telemetry/opentelemetry-ruby/releases/tag/opentelemetry-logs-sdk/v0.7.0) | Updates recorded-attribute accounting; it does not establish fixes in separately versioned exporters or metric SDKs. Verify those packages independently. |
| [PHP package release relocation](https://github.com/open-telemetry/opentelemetry-php/releases/tag/has-been-moved) | Resolve versions from Packagist and the individual `opentelemetry-php` mirrors. `has-been-moved` is not a current SDK version. |
| [Swift 2.5.1](https://github.com/open-telemetry/opentelemetry-swift/releases/tag/2.5.1) | Bounds HTTP log/metric flush semaphore waits. Test shutdown under a stalled backend; this is not a general durable-delivery guarantee. |

## Conventions, privacy, and portability

[SemConv 1.44](https://github.com/open-telemetry/semantic-conventions/releases/tag/v1.44.0)
changes browser Web Vital field placement and Kubernetes paging metric names,
and models memory usage as UpDownCounters. Audit emitted data and queries before
renaming fields; the convention release does not upgrade an instrumentor.
[Specification 1.61](https://github.com/open-telemetry/opentelemetry-specification/releases/tag/v1.61.0)
adds View matching and nested attribute depth behavior and stabilizes Prometheus
resource-label configuration. SDK implementation support must be checked separately.

Keep one instrumentation owner per boundary. Test outbound W3C propagation for
exactly one `traceparent`, including when HTTP wrappers are layered; test one
SERVER/CLIENT span for each intended boundary. Issue reports about Undici,
PHP Guzzle/cURL, FastAPI, and wrappers motivate these checks but do not establish
that every installed release is affected. Disable content capture before testing
and check exporter diagnostics and actual received records, including rejection,
partial success, shutdown, and restarts.

Open proposals for TLS-skip-verification environment variables, blocking batch
queues, governance receipts, and custom propagation must not be emitted as
portable configuration. Use supported TLS settings and the existing Collector
durability pattern.

## Deployment and regression checks

Select checks relevant to the deployed component and the upgrade path.

| Boundary | Check before relying on telemetry |
|---|---|
| Collector receivers and export queues | Restart journald while an entry is retried; inject a PostgreSQL query iteration error; test oversized records separately for every signal. Inspect accepted, refused, queued, and exported counts. |
| Kubernetes admission and enrichment | On AKS with Azure RBAC, exercise the admission path with the intended identity. Render private-registry image references, pull secrets, and target-allocator settings. Verify eBPF kernel/distribution support before enabling a chart preset. |
| Go eBPF / compile-time instrumentation | Inspect local `replace` directives and resolved module versions before selecting probes; rebuild and test local-hook import cycles and emitted SDK resource attributes. An eBPF CLI release is not the core SDK version. |
| SDK metrics | Test asynchronous instruments across successive collections and View dimension removal; include histogram NaN/Infinity inputs, retries, partial success, and provider/reader ownership. Do not equate a successful HTTP response with full acceptance. |
| Async context and lifecycle | Check nested context attach/detach, cancellation, stream consumption, late callbacks, force-flush delegation, and shutdown with a stalled exporter. A fixed timeout bounds waiting; it does not prove durable delivery. |
| HTTP and messaging instrumentation | Test duplicate propagation headers, one span per boundary, empty `tracestate`, Unicode URLs, timeout completion, baggage isolation, and supported async client classes. |
| Lambda | Resolve the actual layer artifact, architecture, runtime/protobuf dependencies, and regional ARN. The 0.23.0 Collector layer notes identify Collector 0.157 and show a conflicting 0.22.0 ARN example; do not copy that ARN or infer Collector 0.162 support. |
| Local viewers | Test late parents, duplicate exports, temporality, and required signal types. A feature issue or UI release does not prove all metric types are supported. Keep local listeners private. |

The [kube-stack 0.20.6 schema fix](https://github.com/open-telemetry/opentelemetry-helm-charts/releases/tag/opentelemetry-kube-stack-0.20.6)
allows `instrumentation.java.extensions` in chart values; validate the rendered
Instrumentation resource and downloaded extension as separate steps.
[Python Azure detector 0.3.0](https://github.com/open-telemetry/opentelemetry-python-contrib/releases/tag/opentelemetry-resource-detector-azure%3D%3D0.3.0)
adds AKS detection and process-dependent App Service/Functions detection: check
the final resource per worker rather than sharing pre-fork detector results.

[Proto 1.11.1](https://github.com/open-telemetry/opentelemetry-proto/releases/tag/v1.11.1)
clarifies UTF-8 and OTLP JSON timestamp representation. OTLP JSON timestamps are
integer nanosecond values (64-bit values use decimal-string encoding), not RFC
3339 dates. OpenAPI enum fixes do not change binary protobuf wire compatibility.

The [Demo 3.0 release](https://github.com/open-telemetry/opentelemetry-demo/releases/tag/3.0.0)
renamed custom `app.*` fields to `demo.*` and now advises using
[3.1.0](https://github.com/open-telemetry/opentelemetry-demo/releases/tag/3.1.0).
Version 3.1 restores Locust, removing `loadGeneratorTraffic` and
`loadGeneratorVUs`. Pin the demo/chart together and recheck custom dashboards,
browser sessions, PostgreSQL schema permissions, and IPv6 before using it as a
validation workload. Demo fixes do not establish generic SDK behavior.
