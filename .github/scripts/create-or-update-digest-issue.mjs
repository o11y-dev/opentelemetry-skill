#!/usr/bin/env node

import fs from 'node:fs/promises';

const [title, contentFilepath = './digest.md', labelsArg = ''] = process.argv.slice(2);

if (!title) {
  console.error('usage: node create-or-update-digest-issue.mjs <title> [content-filepath] [labels]');
  process.exit(1);
}

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;

if (!token) {
  console.error('missing GH_TOKEN / GITHUB_TOKEN');
  process.exit(1);
}

if (!repository || !repository.includes('/')) {
  console.error('missing GITHUB_REPOSITORY');
  process.exit(1);
}

const labels = labelsArg.split(',').map((label) => label.trim()).filter(Boolean);
const body = await fs.readFile(contentFilepath, 'utf8');

async function github(pathname, { method = 'GET', body: payload } = {}) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'otel-upstream-watcher',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[github] ${method} ${pathname} failed: ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 500)}` : ''}`);
  }

  return res.status === 204 ? null : res.json();
}

function labelNames(issue) {
  return (issue.labels ?? [])
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter(Boolean);
}

function hasAllLabels(issue, expectedLabels) {
  const current = new Set(labelNames(issue));
  return expectedLabels.every((label) => current.has(label));
}

function mergedLabels(issue, expectedLabels) {
  return [...new Set([...labelNames(issue), ...expectedLabels])];
}

async function findExistingIssue() {
  let page = 1;
  const allMatches = [];

  while (true) {
    const issues = await github(
      `/repos/${repository}/issues?state=open&per_page=100&sort=updated&direction=desc&page=${page}`,
    );

    if (!issues.length) break;

    const pageMatches = issues
      .filter((issue) => !issue.pull_request)
      .filter((issue) => issue.title === title)
      .filter((issue) => hasAllLabels(issue, labels));

    allMatches.push(...pageMatches);

    if (issues.length < 100) break;
    page++;
  }

  if (allMatches.length > 1) {
    console.warn(`[issue] found ${allMatches.length} open issues matching "${title}", updating #${allMatches[0].number}`);
  }

  return allMatches[0] ?? null;
}

async function createIssue() {
  const issue = await github(`/repos/${repository}/issues`, {
    method: 'POST',
    body: { title, body, labels },
  });
  console.error(`[issue] created #${issue.number}: ${issue.html_url}`);
}

async function updateIssue(issue) {
  const nextLabels = mergedLabels(issue, labels);
  const existingBody = issue.body ?? '';

  // Skip exact no-op updates for idempotent re-runs
  if (existingBody.trim() === body.trim() && hasAllLabels(issue, labels)) {
    console.error(`[issue] digest already current in #${issue.number}, skipping`);
    return;
  }

  const updated = await github(`/repos/${repository}/issues/${issue.number}`, {
    method: 'PATCH',
    body: {
      body,
      labels: nextLabels,
    },
  });
  console.error(`[issue] updated #${updated.number}: ${updated.html_url}`);
}

const existingIssue = await findExistingIssue();
if (existingIssue) {
  await updateIssue(existingIssue);
} else {
  await createIssue();
}
