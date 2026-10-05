Review this upgrade plan for a production OpenTelemetry deployment:

- Upgrade the Collector Contrib distribution to v0.162.0. Its Elasticsearch exporter uses `flush` and `num_workers`, the `grafanacloud` and `awss3` component IDs, adaptive tail-sampling selectors such as `root.attributes["service.name"]`, and Prometheus labels beginning with `_`.
- Export profiles to Elasticsearch 9.5 using `mapping.mode: otel`.
- Deploy through the OpenTelemetry Operator to Kubernetes 1.37. Existing manifests use `OpenTelemetryCollector` `v1alpha1`, a string-valued Collector config, and Target Allocator Prometheus CR selector maps.
- Find and update any saved dashboards, alerts, or queries affected by the upgrade.

Identify configuration changes that can break startup or alter telemetry, explain the Operator/Kubernetes compatibility checks and CRD migration, and propose a release-specific validation plan. Distinguish changes confirmed in the tagged release notes from compatibility checks that still need to be performed; do not invent saved-query changes if upstream does not document any.
