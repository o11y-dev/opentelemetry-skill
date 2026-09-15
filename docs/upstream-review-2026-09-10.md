# Upstream maintenance review — September 10, 2026

Reviewed the open repository issues against source commit `5801948` (skill 0.5.3).
These notes describe the local maintenance changes; they do not close issues or
claim a published release.

| Issue | Addressed | Deferred / boundary |
|---|---|---|
| [#90 daily](https://github.com/o11y-dev/opentelemetry-skill/issues/90) | Collector 0.160 configuration migration; current GenAI span/metric naming; actual daily selection of critical watches; separate GenAI/Python GenAI sources | Unrelated component issues and proposals are not automatically promoted into guidance |
| [#91 weekly](https://github.com/o11y-dev/opentelemetry-skill/issues/91) | Python 1.44 events/configuration, coding-agent schema corrections, Operator networking/metrics, filtered issue selection, digest provenance | Agent version numbers alone do not establish new telemetry capabilities; existing PRs #87/#78 remain separate |
| [#100 monthly](https://github.com/o11y-dev/opentelemetry-skill/issues/100) | Python contrib moved to weekly; package release handling; FastAPI/Starlette overlap guidance; monthly lookback expanded to 35 days | Remaining SDK/platform releases need release-specific review. Java instrumentation #19866 was closed when checked, but no fixed release was established; no blanket vulnerability/version claim added |
| [#98 directory invitation](https://github.com/o11y-dev/opentelemetry-skill/issues/98) | None | External directory submission is separate work |

The optional Kafka buffering example already existed. It now validates against
Collector 0.160; it is not a new infrastructure dependency. Python/AI telemetry
can use direct OTLP export.

Python GenAI package migration and released/beta versus skeleton status come
from the [new upstream repository](https://github.com/open-telemetry/opentelemetry-python-genai).
See [Python guidance](../references/python-instrumentation.md) for the supported
package snapshot and source links. Collector migration sources are linked in
[the Collector reference](../references/collector.md#collector-0160-upgrade-checks).

## Validation evidence

- Node 20: 19 watcher tests passed, including full daily/weekly/monthly generation
  with fixture APIs and idempotent issue updating with intercepted writes.
- Python 3.12 / OTel SDK 1.44 / FastAPI instrumentation 0.65b0: eight tests passed
  for async parentage, one SERVER span per request, events, stream lifecycle,
  usage availability, histogram metric shape, and content omission.
- Collector Contrib 0.160: all three documented multi-agent/Kafka configurations
  passed `validate` in network-isolated containers. This does not establish
  backend delivery or production storage/network readiness.
- Skill validation, JSON/YAML parsing, local links, and watcher mappings passed.
- Live read-only daily and weekly generation succeeded locally. Both existing
  blog feeds returned posts; no retrieval failures were reported. Busy repositories
  hit the 300-item inspection limit, which the digest reports explicitly.
- The Python package repositories returned no GitHub releases within the 14-day
  lookback. This is not evidence that no PyPI packages exist: package inventory
  and GitHub release activity are different sources. The watcher does not poll PyPI.
- Three behavioral task/criteria pairs were added. Model-based Tessl evaluations
  were not run; executable tests are not a substitute for their scores.

No issue posts, workflow dispatches, publishing, or local skill installations were
performed. Existing automatic patch publishing is preserved.
