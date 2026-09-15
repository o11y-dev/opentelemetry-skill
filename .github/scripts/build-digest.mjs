#!/usr/bin/env node
// Stateless upstream digest builder.
//
// Usage:
//   node build-digest.mjs <frequency>
//     frequency: daily | weekly | monthly
//
// For every repo in the selected frequency this fetches:
//   - latest release, or recent individual package releases for monorepos
//   - relevant issues (14 days; 35 days for monthly), with bounded pagination
// For every feed in the selected frequency this fetches recent posts and
// applies any configured topic filter.
//
// It then loads .github/upstream-map.yaml and, for each repo, lists the skill
// reference files in this repository that watch it. The mapping is applied
// statically — we do not diff heads or track state. Humans review the digest
// issue and decide whether the surfaced releases imply a skill edit.
//
// Output:
//   digest.md (consumed by create-or-update-digest-issue.mjs)
//
// Requires env: GH_TOKEN or GITHUB_TOKEN.

import fs from 'node:fs/promises';
import path from 'node:path';

import { renderFeedDigest, selectRecentFeedPosts } from './feed-utils.mjs';
import { collectRepo, provenance, renderRepos, selectRepos } from './repo-digest.mjs';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const REPOS_FILE = path.join(REPO_ROOT, '.github', 'scripts', 'repos.json');
const MAP_FILE = path.join(REPO_ROOT, '.github', 'upstream-map.yaml');
const DIGEST_OUT = path.join(REPO_ROOT, 'digest.md');
const WORKFLOW_FILE_BY_FREQUENCY = {
  daily: '.github/workflows/upstream-tier1.yml',
  weekly: '.github/workflows/upstream-tier2.yml',
  monthly: '.github/workflows/upstream-tier3.yml',
};
const DISPLAY_NAME_BY_FREQUENCY = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
if (!token) {
  console.error('missing GH_TOKEN / GITHUB_TOKEN');
  process.exit(1);
}

const MAX_FEED_BYTES = 8 * 1024 * 1024;
const FEED_TIMEOUT_MS = 30_000;
const FEED_ATTEMPTS = 2;

async function gh(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'otel-upstream-watcher',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const error = new Error(`[gh] ${res.status} ${res.statusText} ${url}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

async function readTextLimited(response, maxBytes) {
  const advertisedBytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(advertisedBytes) && advertisedBytes > maxBytes) {
    throw new Error(`feed exceeds ${maxBytes} byte limit`);
  }
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error(`feed exceeds ${maxBytes} byte limit`);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  const textChunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      await reader.cancel();
      throw new Error(`feed exceeds ${maxBytes} byte limit`);
    }
    textChunks.push(decoder.decode(value, { stream: true }));
  }
  textChunks.push(decoder.decode());
  return textChunks.join('');
}

async function fetchFeed(source) {
  let lastError;
  for (let attempt = 1; attempt <= FEED_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(source.url, {
        headers: {
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9',
          'User-Agent': 'otel-upstream-watcher',
        },
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const xml = await readTextLimited(response, MAX_FEED_BYTES);
      return { source, posts: selectRecentFeedPosts(xml, source) };
    } catch (error) {
      lastError = error;
      if (attempt < FEED_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  return { source, posts: [], error: lastError?.message ?? 'unknown feed error' };
}

// Minimal YAML parser sufficient for the upstream-map.yaml schema.
// Supported subset: indentation-based maps/lists, blank lines and `#`
// comments, scalars (`null`/`~`, booleans, base-10 integers, quoted strings),
// and simple inline arrays like `[a, b]`.
// Limitations: this is not a full YAML implementation; advanced features such
// as anchors, tags, block scalars, and complex flow syntax are not supported.
function parseYaml(src) {
  const lines = src.split(/\r?\n/);
  let i = 0;
  const peek = () => {
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === '' || l.trim().startsWith('#')) { i++; continue; }
      return l;
    }
    return null;
  };
  const indent = (l) => l.match(/^( *)/)[1].length;
  const scalar = (t) => {
    t = t.trim();
    if (t === '' || t === 'null' || t === '~') return null;
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (/^-?\d+$/.test(t)) return parseInt(t, 10);
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
    if (t.startsWith('[') && t.endsWith(']')) {
      const inner = t.slice(1, -1).trim();
      return inner === '' ? [] : inner.split(',').map(scalar);
    }
    return t;
  };
  const block = (parent) => {
    const f = peek();
    if (f === null) return null;
    const my = indent(f);
    if (my <= parent) return null;
    return f.trim().startsWith('-') ? seq(my) : map(my);
  };
  const seq = (my) => {
    const out = [];
    while (true) {
      const l = peek();
      if (l === null || indent(l) !== my) break;
      const t = l.trim();
      if (!t.startsWith('-')) break;
      i++;
      const rest = t.slice(1).trim();
      if (rest === '') {
        out.push(block(my));
      } else if (rest.includes(':') && !rest.startsWith('"') && !rest.startsWith("'")) {
        const obj = {};
        const [k, ...v] = rest.split(':');
        const val = v.join(':').trim();
        obj[k.trim()] = val === '' ? block(my + 2) : scalar(val);
        const cont = my + 2;
        while (true) {
          const n = peek();
          if (n === null || indent(n) !== cont) break;
          const nt = n.trim();
          if (nt.startsWith('-')) break;
          i++;
          const [ck, ...cv] = nt.split(':');
          const cval = cv.join(':').trim();
          obj[ck.trim()] = cval === '' ? block(cont) : scalar(cval);
        }
        out.push(obj);
      } else {
        out.push(scalar(rest));
      }
    }
    return out;
  };
  const map = (my) => {
    const out = {};
    while (true) {
      const l = peek();
      if (l === null || indent(l) !== my) break;
      const t = l.trim();
      if (t.startsWith('-') || !t.includes(':')) break;
      i++;
      const [k, ...v] = t.split(':');
      const val = v.join(':').trim();
      out[k.trim()] = val === '' ? block(my) : scalar(val);
    }
    return out;
  };
  return block(-1);
}

async function main() {
  const frequency = process.argv[2] ?? 'daily';
  const reposCfg = JSON.parse(await fs.readFile(REPOS_FILE, 'utf8'));
  
  const feedSources = reposCfg.feeds?.[frequency] ?? [];
  // Mapping failures must not silently disable critical repository monitoring.
  const parsed = parseYaml(await fs.readFile(MAP_FILE, 'utf8'));
  if (!Array.isArray(parsed?.mappings) || !parsed.mappings.length) throw new Error('missing upstream mappings');
  const mappings = parsed.mappings;
  const repos = selectRepos(reposCfg, mappings, frequency);
  const now = new Date();

  // Invert the mapping: which skills watch each repo?
  const skillsByRepo = new Map();
  for (const m of mappings) {
    for (const w of m.watches ?? []) {
      if (!skillsByRepo.has(w.repo)) skillsByRepo.set(w.repo, []);
      skillsByRepo.get(w.repo).push({
        skill: m.skill,
        priority: m.priority ?? 'normal',
        paths: w.paths ?? [],
      });
    }
  }

  async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
      while (true) {
        const currentIndex = nextIndex++;
        if (currentIndex >= items.length) break;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }

    const workerCount = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
  }

  const repoConcurrency = 4;
  const [rows, feedResults] = await Promise.all([
    mapWithConcurrency(repos, repoConcurrency, async (repo) => {
      const row = await collectRepo(repo, reposCfg, frequency, gh, now);
      row.skills = skillsByRepo.get(repo) ?? [];
      console.error(`[digest] ${repo}: releases=${row.releases.length} issues=${row.issues.length}`);
      return row;
    }),
    mapWithConcurrency(feedSources, 2, async (source) => {
      const result = await fetchFeed(source);
      console.error(`[digest] ${source.name}: posts=${result.posts.length} error=${result.error ?? 'none'}`);
      return result;
    }),
  ]);

  const date = new Date().toISOString().slice(0, 10);
  const frequencyName = DISPLAY_NAME_BY_FREQUENCY[frequency] ?? (frequency.charAt(0).toUpperCase() + frequency.slice(1));
  const workflowRef = process.env.GITHUB_WORKFLOW_REF;
  const workflowFile = workflowRef
    ? (workflowRef.match(/\.github\/workflows\/[^@]+/)?.[0] ?? WORKFLOW_FILE_BY_FREQUENCY[frequency] ?? '.github/workflows/upstream-tier1.yml')
    : (WORKFLOW_FILE_BY_FREQUENCY[frequency] ?? '.github/workflows/upstream-tier1.yml');
  const lines = [];
  lines.push(`# OpenTelemetry upstream digest - ${frequencyName} - ${date}`);
  lines.push('');
  lines.push(`_Auto-generated by \`${workflowFile}\`. Review the releases, recent issues, and blog posts below; repository and feed mappings point at the skill files most likely to need edits._`);
  lines.push('');
  lines.push(...provenance(process.env, frequency));
  lines.push(...renderRepos(rows, frequency));

  lines.push(...renderFeedDigest(feedResults));

  const critical = rows.filter((r) => r.skills.some((s) => s.priority === 'critical'));
  if (critical.length > 0) {
    lines.push('## ⚠️ Critical-priority watches');
    lines.push('');
    lines.push('These repos feed skill references marked `priority: critical` in `.github/upstream-map.yaml`. A new release here should trigger an immediate review of the linked skill files.');
    lines.push('');
    for (const r of critical) {
      const critSkills = r.skills.filter((s) => s.priority === 'critical').map((s) => `\`${s.skill}\``).join(', ');
      lines.push(`- **${r.repo}** → ${critSkills}`);
    }
    lines.push('');
  }

  lines.push('## Maintainer checklist');
  lines.push('');
  lines.push('- [ ] For each new release in the table, skim its changelog for breaking changes.');
  lines.push('- [ ] For each ⚠️ critical-priority row, verify the linked skill files still match the current upstream state.');
  if (feedSources.length > 0) lines.push('- [ ] Route relevant blog posts into `references/playbooks.md` and update deeper references only when guidance changed.');
  lines.push('- [ ] Close this issue once the review is complete (or convert findings into follow-up issues/PRs).');

  const MAX = 60 * 1024;
  let body = lines.join('\n') + '\n';
  if (body.length > MAX) body = body.slice(0, MAX - 120) + '\n\n_…digest truncated to fit the issue body size limit._\n';
  await fs.writeFile(DIGEST_OUT, body);
  console.error(`[digest] wrote ${DIGEST_OUT} (${body.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
