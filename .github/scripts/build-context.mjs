#!/usr/bin/env node
// For every changed repo in context/poll.json, fetch the compare of old..new
// heads (file list + commit messages) and extract the CHANGELOG section for
// the new release when one exists.
//
// Output:
//   context/repos/<owner>__<name>.json    (per-repo payload)
//   context/changed-files.json             (flat list consumed by flag-skills.mjs)
//
// Requires env: GH_TOKEN or GITHUB_TOKEN.

import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const CONTEXT_DIR = path.join(REPO_ROOT, 'context');
const POLL_IN = path.join(CONTEXT_DIR, 'poll.json');
const REPOS_OUT = path.join(CONTEXT_DIR, 'repos');
const CHANGED_FILES_OUT = path.join(CONTEXT_DIR, 'changed-files.json');

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
if (!token) {
  console.error('missing GH_TOKEN / GITHUB_TOKEN');
  process.exit(1);
}

// Hard cap on file-list size per repo to avoid unbounded memory usage for huge
// refactors. The GitHub compare API already paginates at 300 files; we only
// track the first 2000 for skill-mapping purposes.
const MAX_FILES_PER_REPO = 2000;
const MAX_CHANGELOG_BYTES = 64 * 1024;

async function ghFetch(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'otel-upstream-watcher',
      ...extraHeaders,
    },
  });
  if (res.status === 304) return { status: 304 };
  if (res.status === 404) return { status: 404 };
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return { status: 200, body: await res.json(), headers: res.headers };
}

async function compareRefs(repo, base, head) {
  // Use the compare endpoint with pagination. The `files` array is capped at
  // 300 entries server-side; for bigger diffs we page via the commit API.
  const files = [];
  let page = 1;
  for (;;) {
    const url = `https://api.github.com/repos/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?per_page=100&page=${page}`;
    const res = await ghFetch(url);
    if (res.status !== 200) return { status: res.status, files };
    for (const f of res.body.files ?? []) {
      files.push({
        path: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      });
      if (files.length >= MAX_FILES_PER_REPO) return { status: 200, files, truncated: true };
    }
    const ahead = res.body.ahead_by ?? 0;
    if ((res.body.files ?? []).length < 100 || ahead <= 100 * page) break;
    page += 1;
    if (page > 10) break;
  }
  return { status: 200, files };
}

async function readChangelogSection(repo, tag) {
  if (!tag) return null;
  const url = `https://api.github.com/repos/${repo}/contents/CHANGELOG.md?ref=${encodeURIComponent(tag)}`;
  const res = await ghFetch(url, { Accept: 'application/vnd.github.raw' });
  if (res.status !== 200) return null;
  // The raw accept header returns the decoded file; if not, fall back to base64.
  let raw;
  if (typeof res.body === 'string') {
    raw = res.body;
  } else if (res.body?.content && res.body?.encoding === 'base64') {
    raw = Buffer.from(res.body.content, 'base64').toString('utf8');
  } else {
    return null;
  }

  const section = extractSectionForTag(raw, tag);
  return section ? section.slice(0, MAX_CHANGELOG_BYTES) : null;
}

function extractSectionForTag(changelog, tag) {
  // Match the first markdown heading that names the tag (with or without a leading v),
  // then capture everything up to the next same-or-higher-level heading.
  const bare = tag.replace(/^v/, '').replace(/[.+]/g, '[.+]');
  const headingRx = new RegExp(`^(#+)\\s*[\\[\\(]?v?${bare}\\b[^\\n]*$`, 'mi');
  const match = changelog.match(headingRx);
  if (!match) return null;
  const startIdx = match.index;
  const level = match[1].length;
  const tail = changelog.slice(startIdx + match[0].length);
  const nextRx = new RegExp(`^(#{1,${level}})\\s`, 'm');
  const nextMatch = tail.match(nextRx);
  return match[0] + '\n' + (nextMatch ? tail.slice(0, nextMatch.index) : tail);
}

async function readReleaseBody(repo, tag) {
  if (!tag) return null;
  const url = `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`;
  const res = await ghFetch(url);
  if (res.status !== 200) return null;
  return (res.body.body ?? '').slice(0, MAX_CHANGELOG_BYTES);
}

async function main() {
  const poll = JSON.parse(await fs.readFile(POLL_IN, 'utf8'));
  await fs.mkdir(REPOS_OUT, { recursive: true });

  const allChangedFiles = [];

  for (const [repo, row] of Object.entries(poll.repos)) {
    if (row.error) continue;
    if (row.first_poll) continue;
    if (!row.release_changed && !row.commit_changed) continue;

    const base = row.prior.last_commit_sha ?? row.prior.last_release;
    const head = row.current.last_commit_sha ?? row.current.last_release;
    const payload = {
      repo,
      release_changed: row.release_changed,
      commit_changed: row.commit_changed,
      prior_release: row.prior.last_release,
      new_release: row.current.last_release,
      new_release_url: row.current.last_release_url,
      new_release_published_at: row.current.last_release_published_at,
      prior_commit: row.prior.last_commit_sha,
      new_commit: row.current.last_commit_sha,
      base_ref_used: base,
      head_ref_used: head,
      files: [],
      compare_status: null,
      changelog_section: null,
      release_body: null,
    };

    if (base && head) {
      try {
        const cmp = await compareRefs(repo, base, head);
        payload.compare_status = cmp.status;
        payload.files = cmp.files;
        payload.compare_truncated = cmp.truncated === true;
        for (const f of cmp.files) allChangedFiles.push({ repo, ...f });
      } catch (err) {
        console.warn(`[context] compare failed for ${repo}: ${err.message}`);
        payload.compare_error = err.message;
      }
    }

    if (row.release_changed) {
      try {
        payload.changelog_section = await readChangelogSection(repo, row.current.last_release);
      } catch (err) {
        console.warn(`[context] changelog extract failed for ${repo}: ${err.message}`);
      }
      try {
        payload.release_body = await readReleaseBody(repo, row.current.last_release);
      } catch (err) {
        console.warn(`[context] release body failed for ${repo}: ${err.message}`);
      }
    }

    const filename = repo.replace('/', '__') + '.json';
    await fs.writeFile(path.join(REPOS_OUT, filename), JSON.stringify(payload, null, 2) + '\n');
    console.error(`[context] ${repo}: files=${payload.files.length} changelog=${payload.changelog_section ? 'yes' : 'no'}`);
  }

  await fs.writeFile(CHANGED_FILES_OUT, JSON.stringify(allChangedFiles, null, 2) + '\n');

  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      `has_changes=${allChangedFiles.length > 0 ? 'true' : 'false'}\n` +
        `files_touched=${allChangedFiles.length}\n`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
