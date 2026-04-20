#!/usr/bin/env node
// Batched GraphQL poll of upstream OpenTelemetry repositories.
//
// Usage:
//   node poll-upstreams.mjs <tier>
//     tier: tier1 | tier2 | tier3 | all
//
// Reads:
//   .github/scripts/repos.json        (tier membership)
//   .github/state/upstream-state.json (prior heartbeat state)
//
// Writes:
//   .github/state/upstream-state.json (updated heartbeat state)
//   context/poll.json                  (per-repo old/new heartbeat, for downstream steps)
//
// Requires env: GH_TOKEN or GITHUB_TOKEN with `metadata: read` scope.

import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const REPOS_FILE = path.join(REPO_ROOT, '.github', 'scripts', 'repos.json');
const STATE_FILE = path.join(REPO_ROOT, '.github', 'state', 'upstream-state.json');
const CONTEXT_DIR = path.join(REPO_ROOT, 'context');
const POLL_OUT = path.join(CONTEXT_DIR, 'poll.json');

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
if (!token) {
  console.error('missing GH_TOKEN / GITHUB_TOKEN');
  process.exit(1);
}

function aliasFor(repo) {
  // GraphQL aliases cannot contain hyphens or slashes; sanitize.
  return 'r_' + repo.replace(/[^a-zA-Z0-9]/g, '_');
}

function buildQuery(repos) {
  const fragments = repos.map((repo) => {
    const [owner, name] = repo.split('/');
    const alias = aliasFor(repo);
    return `${alias}: repository(owner: "${owner}", name: "${name}") {
      nameWithOwner
      latestRelease { tagName name url publishedAt description }
      defaultBranchRef {
        name
        target {
          ... on Commit { oid committedDate messageHeadline }
        }
      }
    }`;
  });
  return `query UpstreamHeartbeat { ${fragments.join('\n')} }`;
}

async function postGraphQL(query) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'otel-upstream-watcher',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  if (body.errors) {
    // Partial failures are common (repo renamed, temporarily unavailable). Log and
    // let the caller handle nulls per-alias rather than aborting the whole tier.
    for (const err of body.errors) {
      console.warn('[graphql] partial error:', err.message);
    }
  }
  return body.data ?? {};
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw err;
  }
}

function selectRepos(reposCfg, tier) {
  if (tier === 'all') {
    return Array.from(new Set([
      ...reposCfg.tiers.tier1,
      ...reposCfg.tiers.tier2,
      ...reposCfg.tiers.tier3,
    ]));
  }
  if (!reposCfg.tiers[tier]) {
    throw new Error(`unknown tier: ${tier}`);
  }
  return reposCfg.tiers[tier];
}

async function main() {
  const tier = process.argv[2] ?? 'tier1';
  const reposCfg = await readJson(REPOS_FILE);
  const state = await readJson(STATE_FILE);
  const repos = selectRepos(reposCfg, tier);

  console.error(`[poll] tier=${tier} repos=${repos.length}`);

  const data = await postGraphQL(buildQuery(repos));

  const pollResult = {
    tier,
    polled_at: new Date().toISOString(),
    repos: {},
  };

  for (const repo of repos) {
    const alias = aliasFor(repo);
    const node = data[alias];
    if (!node) {
      console.warn(`[poll] no data for ${repo} (alias ${alias})`);
      pollResult.repos[repo] = { error: 'no_data' };
      continue;
    }
    const prior = state.repos[repo] ?? {
      last_release: null,
      last_release_published_at: null,
      last_commit_sha: null,
      last_committed_date: null,
    };
    const nextRelease = node.latestRelease?.tagName ?? null;
    const nextReleaseAt = node.latestRelease?.publishedAt ?? null;
    const nextCommit = node.defaultBranchRef?.target?.oid ?? null;
    const nextCommitDate = node.defaultBranchRef?.target?.committedDate ?? null;

    const releaseChanged = nextRelease && nextRelease !== prior.last_release;
    const commitChanged = nextCommit && nextCommit !== prior.last_commit_sha;

    pollResult.repos[repo] = {
      prior,
      current: {
        last_release: nextRelease,
        last_release_published_at: nextReleaseAt,
        last_release_url: node.latestRelease?.url ?? null,
        last_release_description: node.latestRelease?.description ?? null,
        last_commit_sha: nextCommit,
        last_committed_date: nextCommitDate,
        default_branch: node.defaultBranchRef?.name ?? null,
        last_commit_message: node.defaultBranchRef?.target?.messageHeadline ?? null,
      },
      release_changed: Boolean(releaseChanged),
      commit_changed: Boolean(commitChanged),
      first_poll: prior.last_commit_sha === null && prior.last_release === null,
    };

    // Write through to state so the commit-back captures progress. First-poll
    // entries are seeded without being flagged as "changed" — we only have
    // actionable diffs from the *second* run onwards.
    state.repos[repo] = {
      last_release: nextRelease,
      last_release_published_at: nextReleaseAt,
      last_commit_sha: nextCommit,
      last_committed_date: nextCommitDate,
    };
  }

  await fs.mkdir(CONTEXT_DIR, { recursive: true });
  await fs.writeFile(POLL_OUT, JSON.stringify(pollResult, null, 2) + '\n');
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2) + '\n');

  const changed = Object.entries(pollResult.repos).filter(
    ([, r]) => !r.first_poll && (r.release_changed || r.commit_changed),
  );
  console.error(`[poll] changed=${changed.length} (first_poll rows excluded)`);
  for (const [repo, r] of changed) {
    const bits = [];
    if (r.release_changed) bits.push(`release ${r.prior.last_release ?? 'none'} -> ${r.current.last_release}`);
    if (r.commit_changed) bits.push(`commit ${(r.prior.last_commit_sha ?? '').slice(0, 7)} -> ${(r.current.last_commit_sha ?? '').slice(0, 7)}`);
    console.error(`  ${repo}: ${bits.join(', ')}`);
  }

  // Expose a has_changes signal for the GitHub Actions workflow.
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `has_changes=${changed.length > 0}\n`);
    await fs.appendFile(process.env.GITHUB_OUTPUT, `changed_count=${changed.length}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
