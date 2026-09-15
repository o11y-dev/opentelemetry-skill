// Repository selection, bounded GitHub reads, and digest rendering.
const DAY_MS = 86_400_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const MAX_ISSUES = 5;
const MAX_RELEASES = 20;
const TELEMETRY = /\b(?:otel|opentelemetry|telemetry|tracing|observability|instrumentation|gen[_-]ai)\b/i;
const DASHBOARD = /\b(?:dependency|pull request|pr) dashboard\b/i;

export function lookbackDays(frequency) {
  return frequency === 'monthly' ? 35 : 14;
}

export function selectRepos(config, mappings, frequency) {
  const configured = config.frequencies?.[frequency];
  if (!Array.isArray(configured)) throw new Error(`unknown frequency: ${frequency}`);
  const critical = frequency === 'daily'
    ? mappings.filter((m) => m.priority === 'critical').flatMap((m) => (m.watches ?? []).map((w) => w.repo))
    : [];
  return [...new Set([...configured, ...critical])];
}

export function relevantIssue(issue, telemetryOnly) {
  if (issue.pull_request || DASHBOARD.test(issue.title)) return false;
  const labels = (issue.labels ?? []).map((label) => typeof label === 'string' ? label : label.name);
  return !telemetryOnly || TELEMETRY.test([issue.title, ...labels].join(' '));
}

async function pages(gh, endpoint, warnings, label) {
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await gh(`${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=${PAGE_SIZE}&page=${page}`);
    if (!Array.isArray(batch)) throw new Error(`${label}: expected a GitHub array`);
    items.push(...batch);
    if (batch.length < PAGE_SIZE) return items;
  }
  warnings.push(`${label}: retrieval capped at ${MAX_PAGES * PAGE_SIZE} items; coverage may be incomplete.`);
  return items;
}

export async function collectRepo(repo, config, frequency, gh, now = new Date()) {
  const since = new Date(now.getTime() - lookbackDays(frequency) * DAY_MS).toISOString();
  const packageMode = (config.package_release_repos ?? []).includes(repo);
  const telemetryOnly = (config.telemetry_issue_repos ?? []).includes(repo);
  const base = `https://api.github.com/repos/${repo}`;
  const warnings = [];
  const [releaseResult, issueResult] = await Promise.allSettled([
    (async () => {
      if (packageMode) {
        const all = await pages(gh, `${base}/releases`, warnings, 'Releases');
        const recent = all.filter((r) => !r.draft && r.published_at >= since && r.published_at <= now.toISOString())
          .sort((a, b) => b.published_at.localeCompare(a.published_at));
        if (recent.length > MAX_RELEASES) warnings.push(`Releases: showing ${MAX_RELEASES} of ${recent.length} recent releases retrieved.`);
        return recent.slice(0, MAX_RELEASES);
      }
      try {
        return [await gh(`${base}/releases/latest`)];
      } catch (error) {
        if (error.status !== 404) throw error;
        // A missing repository also returns 404. Confirm access before saying no release.
        await gh(base);
        return [];
      }
    })(),
    (async () => {
      const all = await pages(gh, `${base}/issues?state=all&sort=updated&direction=desc&since=${encodeURIComponent(since)}`, warnings, 'Issues');
      const selected = all.filter((i) => i.updated_at >= since && relevantIssue(i, telemetryOnly));
      selected.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      if (selected.length > MAX_ISSUES) warnings.push(`Issues: showing ${MAX_ISSUES} of ${selected.length} relevant issues retrieved.`);
      return selected.slice(0, MAX_ISSUES);
    })(),
  ]);
  return {
    repo, packageMode, warnings,
    releases: releaseResult.status === 'fulfilled' ? releaseResult.value : [],
    issues: issueResult.status === 'fulfilled' ? issueResult.value : [],
    releaseError: releaseResult.status === 'rejected' ? releaseResult.reason.message : null,
    issueError: issueResult.status === 'rejected' ? issueResult.reason.message : null,
  };
}

function escapeCell(text) {
  return String(text).replace(/[\r\n]+/g, ' ').replace(/([\\`*_[\]<>|])/g, '\\$1');
}

export function provenance(env, frequency) {
  const lines = [`Repository lookback: ${lookbackDays(frequency)} days. Issue state does not establish whether a fix has shipped.`];
  if (env.GITHUB_REPOSITORY && env.GITHUB_SHA) {
    lines.push(`Source commit: [${env.GITHUB_SHA.slice(0, 12)}](https://github.com/${env.GITHUB_REPOSITORY}/commit/${env.GITHUB_SHA}).`);
  } else lines.push('Source commit: unavailable (local generation).');
  if (env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID) {
    lines.push(`Workflow run: [${env.GITHUB_RUN_ID}](https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}).`);
  }
  return [...lines, ''];
}

export function renderRepos(rows, frequency) {
  const days = lookbackDays(frequency);
  const lines = ['## Releases', '', `Latest release per repository; package repositories show individual releases published in the last ${days} days (including beta/prerelease).`, '',
    '| Repo | Release | Published | Skills watching this repo |', '|------|---------|-----------|----------------------------|'];
  for (const row of rows) {
    const skills = (row.skills ?? []).map((s) => `\`${s.skill}\`${s.priority === 'critical' ? ' ⚠️' : ''}`).join(', ') || '—';
    if (!row.releases.length) {
      const status = row.releaseError ? '_retrieval failed; see coverage below_' : row.packageMode ? '_no package releases in lookback_' : '_no release found_';
      lines.push(`| ${row.repo} | ${status} | | ${skills} |`);
    }
    for (const release of row.releases) {
      const beta = release.prerelease || /\d(?:a|b|rc)\d|[.-](?:alpha|beta|rc|dev)/i.test(release.tag_name);
      lines.push(`| ${row.repo} | [${escapeCell(release.tag_name)}](<${release.html_url}>)${beta ? ' (beta/prerelease)' : ''} | ${release.published_at.slice(0, 10)} | ${skills} |`);
    }
  }
  lines.push('', `## Recent upstream issues (last ${days} days)`, '');
  for (const row of rows) {
    if (!row.issues.length) continue;
    lines.push(`### ${row.repo}`);
    for (const issue of row.issues) lines.push(`- [${escapeCell(issue.title)}](<${issue.html_url}>) — ${issue.state}; updated ${issue.updated_at.slice(0, 10)}`);
    lines.push('');
  }
  lines.push('## Retrieval coverage', '', 'Issues: up to 300 items inspected and five relevant issues shown per repository. Package releases: up to 300 inspected and 20 recent releases shown. Coding-agent issue filtering uses telemetry terms in titles/labels; it is not exhaustive.', '');
  let hasWarnings = false;
  for (const row of rows) {
    const messages = [...row.warnings];
    if (row.releaseError) messages.push(`Release retrieval failed: ${row.releaseError}`);
    if (row.issueError) messages.push(`Issue retrieval failed: ${row.issueError}`);
    for (const message of messages) {
      hasWarnings = true;
      lines.push(`- **${row.repo}**: ${escapeCell(message)}`);
    }
  }
  if (!hasWarnings) lines.push('No retrieval failures or per-repository truncation reported.');
  return [...lines, ''];
}
