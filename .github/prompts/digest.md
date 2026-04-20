# OpenTelemetry upstream digest — synthesis prompt

You are assisting the maintainer of an OpenTelemetry expertise skill (this repository). The upstream watcher has polled the OpenTelemetry GitHub organization and staged structured context under `context/`:

- `context/poll.json` — per-repo old/new heartbeat and a `release_changed` / `commit_changed` flag.
- `context/repos/<owner>__<name>.json` — per-repo compare payload with file list, CHANGELOG section for any new release, and release body.
- `context/flagged-skills.json` — skill references in this repo that the `upstream-map.yaml` mapping flagged as potentially affected.
- `digest.md` — a pre-rendered fallback digest produced by `.github/scripts/build-digest.mjs`. You may overwrite it.
- `pr-body.md` — a short PR body. You may overwrite it.

## What to do

1. Read `context/poll.json` first to see which repos changed this run. Skip entries where `first_poll: true` or no flags are set.
2. For each changed repo, read the corresponding `context/repos/<owner>__<name>.json`. Pay particular attention to:
   - For `open-telemetry/semantic-conventions`: attribute renames inside `model/**/*.yaml` (the `deprecated:` field pointing to a new name), stability transitions, and especially any change under `model/gen-ai/**` or `docs/gen-ai/**`.
   - For `open-telemetry/opentelemetry-collector-contrib`: emoji-tagged changelog sections (🛑 breaking, 🚩 deprecation, 🚀 new, 💡 enhancement, 🧰 fix) and diffs to `**/metadata.yaml` `status.stability` subtrees — these precede releases and matter more than the release tag.
   - For `open-telemetry/opentelemetry-collector`: `config/**` and `service/**` changes.
   - For `open-telemetry/opentelemetry-operator`: CRD changes under `apis/**` or `config/crd/bases/**`, and feature-gate promotions/removals.
   - For `open-telemetry/opentelemetry-proto`: any `.proto` diff is a protocol change.
   - For `open-telemetry/opentelemetry-specification` and `open-telemetry/oteps`: new normative language or merged OTEPs.
3. Read `context/flagged-skills.json` and cross-reference each flagged skill file (`SKILL.md`, `references/*.md`) with the relevant upstream changes. For each flagged skill, decide whether the skill file needs an edit.
4. Overwrite `digest.md` with a single well-organized markdown document:
   - Lead with a short summary table: repo · old → new · impact badge (🔴 breaking / 🟡 stability / 🔵 new / 🟢 non-material) · count of affected skill references.
   - Then one `<details>` block per changed repo, grouping the changelog by emoji section when available and calling out the specific attribute/component/CRD names that moved.
   - Then a "Flagged skill references" section that, for every flagged skill, lists what needs changing and why (cite the upstream file path and the skill file path/section). If no edit is needed, say so explicitly with one sentence of justification.
   - Stay under 55 KB to leave headroom under GitHub's 65 KB issue body limit. Truncate long changelog bodies rather than eliding structure.
5. Overwrite `pr-body.md` with a concise PR description (≤40 lines) that lists the heartbeat deltas and any skill files you have directly edited.
6. For high-confidence edits only (an attribute rename the upstream changelog explicitly documents, a removed component the skill cites by name, a stability flip for a component the skill references), apply the edit to the skill file directly using the Write/Edit tool. Do **not** invent changes or refactor surrounding content. When in doubt, leave the skill file untouched and describe the needed edit in `digest.md` for a human to review.

## Constraints

- Do not touch anything outside `digest.md`, `pr-body.md`, `SKILL.md`, or `references/**/*.md`.
- Do not edit `.github/state/upstream-state.json` — the heartbeat is already written by the poller.
- Do not fetch the network; all context you need is already in `context/`.
- Critical skill references (`priority: critical` in `flagged-skills.json`) — notably `references/ai-agents.md` and `references/security.md` — should always be enumerated in the digest even when no direct edit is applied, because these lanes move fastest.
- Prefer accuracy over completeness: a short, correct digest beats a long one with hedged guesses. If a repo's changelog is missing or unparseable, say so in one line and move on.
