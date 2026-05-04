#!/usr/bin/env node
// Stateless upstream digest builder.
//
// Usage:
//   node build-digest.mjs <frequency>
//     frequency: daily | weekly | monthly (preferred) or tier1 | tier2 | tier3 (legacy)
//
// For every repo in the selected frequency this fetches:
//   - the latest release (via REST /repos/{repo}/releases/latest)
//   - recent issues (last 14 days, top 5, via /repos/{repo}/issues?since=...)
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

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const REPOS_FILE = path.join(REPO_ROOT, '.github', 'scripts', 'repos.json');
const MAP_FILE = path.join(REPO_ROOT, '.github', 'upstream-map.yaml');
const DIGEST_OUT = path.join(REPO_ROOT, 'digest.md');
const WORKFLOW_FILE_BY_FREQUENCY = {
  daily: '.github/workflows/upstream-tier1.yml',
  weekly: '.github/workflows/upstream-tier2.yml',
  monthly: '.github/workflows/upstream-tier3.yml',
  tier1: '.github/workflows/upstream-tier1.yml',
  tier2: '.github/workflows/upstream-tier2.yml',
  tier3: '.github/workflows/upstream-tier3.yml',
};
const DISPLAY_NAME_BY_FREQUENCY = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
};

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
if (!token) {
  console.error('missing GH_TOKEN / GITHUB_TOKEN');
  process.exit(1);
}

const RECENT_WINDOW_DAYS = 14;
const ISSUES_PER_REPO = 5;

async function gh(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'otel-upstream-watcher',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const detail = body ? `: ${body.slice(0, 500)}` : '';
    throw new Error(`[gh] ${res.status} ${res.statusText} ${url}${detail}`);
  }
  return res.json();
}

async function latestRelease(repo) {
  const data = await gh(`https://api.github.com/repos/${repo}/releases/latest`);
  if (!data) return null;
  return {
    name: data.name || data.tag_name,
    tag: data.tag_name,
    url: data.html_url,
    published_at: data.published_at,
  };
}

async function recentIssues(repo) {
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 86400 * 1000).toISOString();
  const url = `https://api.github.com/repos/${repo}/issues?state=all&sort=updated&direction=desc&since=${encodeURIComponent(since)}&per_page=30`;
  const data = await gh(url);
  if (!Array.isArray(data)) return [];
  // Exclude PRs (the issues endpoint returns both).
  return data.filter((i) => !i.pull_request).slice(0, ISSUES_PER_REPO).map((i) => ({
    title: i.title,
    url: i.html_url,
    updated_at: i.updated_at,
  }));
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
  
  // Handle both new frequency names and legacy tier names for backward compatibility
  let repos;
  if (reposCfg.frequencies && reposCfg.frequencies[frequency]) {
    repos = reposCfg.frequencies[frequency];
  } else if (reposCfg.legacy?.tiers?.[frequency]) {
    repos = reposCfg.legacy.tiers[frequency];
  } else if (reposCfg.tiers && reposCfg.tiers[frequency]) {
    // Legacy fallback
    repos = reposCfg.tiers[frequency];
  } else {
    console.error(`unknown frequency/tier: ${frequency}`);
    process.exit(1);
  }

  let mappings = [];
  try {
    const parsed = parseYaml(await fs.readFile(MAP_FILE, 'utf8'));
    mappings = parsed?.mappings ?? [];
  } catch (err) {
    console.warn(`[map] failed to load mapping: ${err.message}`);
  }

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
  const rows = await mapWithConcurrency(repos, repoConcurrency, async (repo) => {
    const [release, issues] = await Promise.all([latestRelease(repo), recentIssues(repo)]);
    const row = { repo, release, issues, skills: skillsByRepo.get(repo) ?? [] };
    console.error(`[digest] ${repo}: release=${release?.tag ?? 'n/a'} issues=${issues.length} skills=${skillsByRepo.get(repo)?.length ?? 0}`);
    return row;
  });

  const date = new Date().toISOString().slice(0, 10);
  const frequencyName = DISPLAY_NAME_BY_FREQUENCY[frequency] ?? (frequency.charAt(0).toUpperCase() + frequency.slice(1));
  const workflowRef = process.env.GITHUB_WORKFLOW_REF;
  const workflowFile = workflowRef
    ? (workflowRef.match(/\.github\/workflows\/[^@]+/)?.[0] ?? WORKFLOW_FILE_BY_FREQUENCY[frequency] ?? '.github/workflows/upstream-tier1.yml')
    : (WORKFLOW_FILE_BY_FREQUENCY[frequency] ?? '.github/workflows/upstream-tier1.yml');
  const lines = [];
  lines.push(`# OpenTelemetry upstream digest - ${frequencyName} - ${date}`);
  lines.push('');
  lines.push(`_Auto-generated by \`${workflowFile}\`. Review the releases and recent issues below; the "Skills watching this repo" column points at the skill files most likely to need edits._`);
  lines.push('');
  lines.push('## Latest releases');
  lines.push('');
  lines.push('| Repo | Latest release | Published | Skills watching this repo |');
  lines.push('|------|----------------|-----------|----------------------------|');
  for (const { repo, release, skills } of rows) {
    const rel = release ? `[${release.tag}](${release.url})` : '_no release found_';
    const pub = release?.published_at?.slice(0, 10) ?? '';
    const skillCells = skills.length === 0 ? '—' : skills.map((s) => `\`${s.skill}\`${s.priority === 'critical' ? ' ⚠️' : ''}`).join(', ');
    lines.push(`| ${repo} | ${rel} | ${pub} | ${skillCells} |`);
  }
  lines.push('');

  lines.push('## Recent upstream issues (last 14 days)');
  lines.push('');
  for (const { repo, issues } of rows) {
    if (issues.length === 0) continue;
    lines.push(`### ${repo}`);
    for (const i of issues) {
      lines.push(`- [${i.title}](${i.url}) — updated ${i.updated_at.slice(0, 10)}`);
    }
    lines.push('');
  }

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
