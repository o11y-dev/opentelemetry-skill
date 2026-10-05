# OpenTelemetry JavaScript 3.0 Readiness

Use this checklist to assess applications, libraries, and custom instrumentation before adopting OpenTelemetry JS 3.0. The upstream announcement targeted September 30, 2026, but a target date is not proof that a stable package has shipped. Verify the release tag and npm `latest` dist-tag before upgrading.

## Readiness checklist

- [ ] Confirm the stable 3.x release and its release notes. Do not treat a development/canary version as a production release.
- [ ] Set the application and CI Node.js floor to **22.15.0 or later**. The upstream announcement exempts `@opentelemetry/api` and `@opentelemetry/semantic-conventions` from this SDK runtime floor; verify the requirements of each installed package.
- [ ] Remove packages scheduled for removal: `@opentelemetry/propagator-jaeger`, `@opentelemetry/exporter-jaeger`, `@opentelemetry/shim-opentracing`, `@opentelemetry/shim-opencensus`, `@opentelemetry/api-logs`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/sdk-trace-node`, and `@opentelemetry/sdk-trace-web`. Check the final stable migration guide because removals may shift before release.
- [ ] Migrate tracing SDK imports to `@opentelemetry/sdk-trace`. Replace `BasicTracerProvider` with `TracerProvider`; register the provider, context manager, and propagator explicitly where prior Node/Web provider `.register()` behavior was used.
- [ ] Review span processor construction for the new options-object form, including `{ exporter }`, and move environment/file-driven configuration to `sdk-node` if needed; the consolidated trace SDK no longer reads the listed trace/provider and span-processor environment variables.
- [ ] Review custom instrumentation separately. Code using only the stable `@opentelemetry/api` is expected to remain compatible; instrumentation authors and packages that depend on SDK classes, removed utilities, or `@opentelemetry/instrumentation` internals require explicit source review and tests. Do not infer compatibility from an API-only guarantee.
- [ ] Run unit/integration tests on the minimum supported Node version and verify context propagation, span export, instrumentation patching, and graceful shutdown.

## Lightweight repository scanner

Run the dependency/source scanner from the repository root:

```bash
node .github/scripts/scan-js-otel3-readiness.mjs [path]
```

It reports Node version declarations that need review, dependencies on packages listed for removal, imports from the split tracing SDK packages, and custom instrumentation references for manual compatibility review. The scanner is a static aid: it does not resolve semver, prove runtime compatibility, or replace checking the stable migration guide and running tests.

## Upstream references

- [OpenTelemetry JS 3.x announcement](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/3.x/announcement.md)
- [OpenTelemetry JS 3.x migration guide](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/3.x/migration-guide.md)
- [OpenTelemetry JS releases](https://github.com/open-telemetry/opentelemetry-js/releases)
- [npm stable package metadata](https://registry.npmjs.org/%40opentelemetry%2Fsdk-trace/latest)
