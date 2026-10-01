import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, writeFile, rm, cp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { collectRepo, lookbackDays, provenance, relevantIssue, renderRepos, selectRepos } from './repo-digest.mjs';

const NOW = new Date('2026-09-10T12:00:00Z');
const issue = (n, overrides = {}) => ({ title: `OTel issue ${n}`, state: 'open', html_url: `https://github.com/test/repo/issues/${n}`, updated_at: NOW.toISOString(), ...overrides });
const release = (tag, overrides = {}) => ({ tag_name: tag, html_url: `https://github.com/test/repo/releases/tag/${tag}`, published_at: NOW.toISOString(), draft: false, prerelease: false, ...overrides });
const noReleases = async (url) => {
  if (url.endsWith('/releases/latest')) throw Object.assign(new Error('not found'), { status: 404 });
  return { name: 'repo' };
};

test('daily includes critical-only watches once; weekly/monthly retain membership', () => {
  const config = { frequencies: { daily: ['a'], weekly: ['b'], monthly: ['c'] } };
  const mappings = [{ priority: 'critical', watches: [{ repo: 'a' }, { repo: 'd' }, { repo: 'd' }] }];
  assert.deepEqual(selectRepos(config, mappings, 'daily'), ['a', 'd']);
  assert.deepEqual(selectRepos(config, mappings, 'weekly'), ['b']);
  assert.deepEqual(selectRepos(config, mappings, 'monthly'), ['c']);
  assert.throws(() => selectRepos(config, mappings, 'invalid'), /unknown frequency/);
  assert.equal(lookbackDays('monthly'), 35);
  assert.equal(lookbackDays('weekly'), 14);
});

test('configured Python and GenAI coverage includes both package repositories', async () => {
  const cfg = JSON.parse(await readFile(new URL('./repos.json', import.meta.url)));
  assert(cfg.frequencies.daily.includes('open-telemetry/opentelemetry-python-genai'));
  assert(cfg.frequencies.daily.includes('open-telemetry/semantic-conventions-genai'));
  assert(cfg.frequencies.weekly.includes('open-telemetry/opentelemetry-python-contrib'));
  assert(!cfg.frequencies.monthly.includes('open-telemetry/opentelemetry-python-contrib'));
  assert.equal(cfg.package_release_repos.length, 2);
});

test('issue filtering keeps telemetry labels, excludes dashboards/PRs, preserves non-agent scope', () => {
  assert(!relevantIssue(issue(1, { pull_request: {} }), false));
  assert(!relevantIssue(issue(1, { title: 'Dependency Dashboard' }), false));
  assert(!relevantIssue(issue(1, { title: 'Pull Request Dashboard' }), false));
  assert(!relevantIssue(issue(1, { title: 'Desktop keyboard shortcut' }), true));
  assert(relevantIssue(issue(1, { title: 'Export loses data', labels: [{ name: 'gen-ai' }] }), true));
  assert(relevantIssue(issue(1, { title: 'FastAPI middleware duplicates requests' }), false));
});

test('pagination reaches relevant issues behind PRs and uses monthly lookback', async () => {
  const urls = [];
  const row = await collectRepo('test/repo', {}, 'monthly', async (url) => {
    urls.push(url);
    if (!url.includes('/issues?')) return noReleases(url);
    return url.endsWith('page=1') ? Array.from({ length: 100 }, (_, i) => issue(i, { pull_request: {} })) : [issue(101, { state: 'closed', updated_at: '2026-08-10T12:00:00Z' })];
  }, NOW);
  assert.equal(row.issues.length, 1);
  assert.equal(row.issues[0].state, 'closed');
  assert(urls.some((url) => url.includes('since=2026-08-06T12%3A00%3A00.000Z')));
  assert.equal(row.releaseError, null);
  assert.match(renderRepos([row], 'monthly').join('\n'), /closed; updated 2026-08-10/);
});

test('package releases retain beta labels and individual names, excluding drafts and old releases', async () => {
  const row = await collectRepo('test/repo', { package_release_repos: ['test/repo'] }, 'daily', async (url) => url.includes('/issues?') ? [] : [
    release('genai-openai-1.1b0'), release('resource-azure-0.2.0'),
    release('draft-1', { draft: true }), release('old-1', { published_at: '2026-08-01T00:00:00Z' }),
  ], NOW);
  assert.deepEqual(row.releases.map((r) => r.tag_name), ['genai-openai-1.1b0', 'resource-azure-0.2.0']);
  const rendered = renderRepos([row], 'daily').join('\n');
  assert.match(rendered, /genai-openai-1.1b0.*beta\/prerelease/);
  assert.match(rendered, /resource-azure-0.2.0/);
});

test('retrieval and output caps remain visible', async () => {
  const row = await collectRepo('test/repo', { package_release_repos: ['test/repo'] }, 'daily', async (url) =>
    Array.from({ length: 100 }, (_, n) => url.includes('/issues?') ? issue(n) : release(`package-${n}`)), NOW);
  assert.equal(row.issues.length, 5);
  assert.equal(row.releases.length, 20);
  assert(row.warnings.some((w) => w.includes('retrieval capped at 300')));
  assert(row.warnings.some((w) => w.includes('showing 5 of 300')));
  assert(row.warnings.some((w) => w.includes('showing 20 of 300')));
});

test('release failure preserves issues and is not rendered as no release', async () => {
  const row = await collectRepo('test/repo', {}, 'daily', async (url) => {
    if (url.includes('/issues?')) return [issue(1)];
    throw new Error('HTTP 403 rate limit');
  }, NOW);
  assert.equal(row.issues.length, 1);
  const output = renderRepos([row], 'daily').join('\n');
  assert.match(output, /HTTP 403 rate limit/);
  assert.doesNotMatch(output, /no release found/);
});

test('inaccessible repository and failed issue pagination are visible', async () => {
  const row = await collectRepo('test/repo', {}, 'daily', async () => {
    throw Object.assign(new Error('HTTP 404 inaccessible'), { status: 404 });
  }, NOW);
  assert.match(row.releaseError, /inaccessible/);
  assert.match(row.issueError, /inaccessible/);
});

test('provenance links generating commit and workflow without inventing local SHA', () => {
  const lines = provenance({ GITHUB_REPOSITORY: 'test/repo', GITHUB_SHA: 'abcdef123456789', GITHUB_RUN_ID: '42' }, 'monthly').join('\n');
  assert.match(lines, /35 days/);
  assert.match(lines, /commit\/abcdef123456789/);
  assert.match(lines, /actions\/runs\/42/);
  assert.match(provenance({}, 'daily').join('\n'), /unavailable/);
});

test('issue updater preserves labels and skips a second identical update', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'otel-digest-test-'));
  try {
    const body = path.join(dir, 'digest.md');
    const state = path.join(dir, 'state.json');
    const mock = path.join(dir, 'mock.mjs');
    await writeFile(body, 'new digest\n');
    await writeFile(state, JSON.stringify({ number: 91, title: 'Weekly upstream digest', body: 'old', labels: [{ name: 'upstream-digest' }, { name: 'weekly' }, { name: 'maintainer' }], html_url: 'https://github.com/test/repo/issues/91', writes: 0 }));
    await writeFile(mock, `import fs from 'node:fs';
      globalThis.fetch = async (url, options) => {
        const file = ${JSON.stringify(state)};
        let issue = JSON.parse(fs.readFileSync(file));
        if (options.method === 'GET') return { ok: true, status: 200, json: async () => [issue] };
        if (options.method !== 'PATCH' || !url.endsWith('/issues/91')) throw new Error('unexpected write');
        issue = { ...issue, ...JSON.parse(options.body), writes: issue.writes + 1 };
        fs.writeFileSync(file, JSON.stringify(issue));
        return { ok: true, status: 200, json: async () => issue };
      };`);
    for (let n = 0; n < 2; n++) {
      const result = spawnSync(process.execPath, ['--import', mock, '.github/scripts/create-or-update-digest-issue.mjs', 'Weekly upstream digest', body, 'upstream-digest,weekly'], {
        env: { PATH: process.env.PATH, GH_TOKEN: 'fixture', GITHUB_REPOSITORY: 'test/repo' }, encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
    }
    const stored = JSON.parse(await readFile(state));
    assert.equal(stored.writes, 1);
    assert.deepEqual(stored.labels, ['upstream-digest', 'weekly', 'maintainer']);
    assert.equal(stored.body, 'new digest\n');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('full builder loads real mappings and preserves feeds across all frequencies', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'otel-builder-test-'));
  try {
    const scripts = path.join(dir, '.github/scripts');
    await mkdir(scripts, { recursive: true });
    for (const name of ['build-digest.mjs', 'repo-digest.mjs', 'feed-utils.mjs', 'repos.json']) {
      await cp(new URL(name, import.meta.url), path.join(scripts, name));
    }
    await cp(new URL('../upstream-map.yaml', import.meta.url), path.join(dir, '.github/upstream-map.yaml'));
    const mock = path.join(dir, 'mock.mjs');
    await writeFile(mock, `globalThis.fetch = async (url) => {
      if (!url.startsWith('https://api.github.com/repos/')) return { ok: false, status: 503, statusText: 'Fixture feed outage' };
      const item = { tag_name: 'package-1.1b0', html_url: 'https://github.com/test/repo/releases/tag/package-1.1b0', published_at: new Date().toISOString() };
      const data = url.includes('/issues?') ? [] : url.includes('/releases?') ? [item] : item;
      return { ok: true, status: 200, json: async () => data };
    };`);
    for (const frequency of ['daily', 'weekly', 'monthly']) {
      const result = spawnSync(process.execPath, ['--import', mock, path.join(scripts, 'build-digest.mjs'), frequency], {
        env: { PATH: process.env.PATH, GH_TOKEN: 'fixture', GITHUB_REPOSITORY: 'test/repo', GITHUB_SHA: 'abc123', GITHUB_RUN_ID: '42' },
        encoding: 'utf8', timeout: 10000,
      });
      assert.equal(result.status, 0, result.stderr);
      const output = await readFile(path.join(dir, 'digest.md'), 'utf8');
      assert.match(output, /commit\/abc123/);
      assert.match(output, new RegExp(`last ${lookbackDays(frequency)} days`));
      if (frequency === 'daily') {
        assert.equal(output.split('\n').filter((l) => l.startsWith('| open-telemetry/opentelemetry-python-genai |')).length, 1);
        assert.match(output, /references\/python-instrumentation.md/);
      }
      if (frequency === 'weekly') {
        assert.match(output, /Fixture feed outage/);
        assert.match(output, /CNCF/);
        assert.match(output, /OpenTelemetry blog/);
      }
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
