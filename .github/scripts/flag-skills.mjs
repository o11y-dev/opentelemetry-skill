#!/usr/bin/env node
// Load the skill-to-upstream mapping and match it against context/changed-files.json.
//
// Reads:
//   context/changed-files.json    (from build-context.mjs)
//   .github/upstream-map.yaml     (human-authored mapping)
//
// Writes:
//   context/flagged-skills.json   (per-skill flag manifest)
//   context/upstream-map.json     (normalized mapping JSON, useful for debugging)
//
// No npm dependencies: includes a small YAML parser sufficient for the
// upstream-map schema (block mappings, block sequences, inline flow sequences,
// and quoted strings). If the mapping grows more complex, swap this for the
// `yaml` package.

import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const MAP_FILE = path.join(REPO_ROOT, '.github', 'upstream-map.yaml');
const CHANGED_IN = path.join(REPO_ROOT, 'context', 'changed-files.json');
const FLAGGED_OUT = path.join(REPO_ROOT, 'context', 'flagged-skills.json');
const MAP_JSON_OUT = path.join(REPO_ROOT, 'context', 'upstream-map.json');

/* ---------- tiny YAML subset parser ---------- */

function parseYaml(src) {
  const lines = src.split(/\r?\n/);
  let i = 0;

  function peekLine() {
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === '' || l.trim().startsWith('#')) { i += 1; continue; }
      return l;
    }
    return null;
  }

  function indent(line) {
    const m = line.match(/^( *)/);
    return m[1].length;
  }

  function parseScalar(raw) {
    const t = raw.trim();
    if (t === '' || t === 'null' || t === '~') return null;
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (/^-?\d+$/.test(t)) return Number.parseInt(t, 10);
    if (/^-?\d+\.\d+$/.test(t)) return Number.parseFloat(t);
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    if (t.startsWith('[') && t.endsWith(']')) {
      const inner = t.slice(1, -1).trim();
      if (inner === '') return [];
      return inner.split(',').map((s) => parseScalar(s));
    }
    return t;
  }

  function parseBlock(parentIndent) {
    const first = peekLine();
    if (first === null) return null;
    const myIndent = indent(first);
    if (myIndent <= parentIndent) return null;
    if (first.trim().startsWith('- ') || first.trim() === '-') {
      return parseSequence(myIndent);
    }
    return parseMapping(myIndent);
  }

  function parseSequence(myIndent) {
    const out = [];
    while (true) {
      const line = peekLine();
      if (line === null) break;
      if (indent(line) < myIndent) break;
      if (indent(line) > myIndent) break;
      const t = line.trim();
      if (!t.startsWith('-')) break;
      // Consume the "- " marker.
      i += 1;
      const rest = t.slice(1).trim();
      if (rest === '') {
        // Item body is nested block below.
        out.push(parseBlock(myIndent));
      } else if (rest.includes(':') && !rest.startsWith('"') && !rest.startsWith("'")) {
        // Inline mapping on the same line, followed by possible continuation.
        const itemObj = {};
        const [k, ...vparts] = rest.split(':');
        const v = vparts.join(':').trim();
        if (v === '') {
          itemObj[k.trim()] = parseBlock(myIndent + 2);
        } else {
          itemObj[k.trim()] = parseScalar(v);
        }
        // Parse any sibling keys at the item-continuation indent.
        const contIndent = myIndent + 2;
        while (true) {
          const nxt = peekLine();
          if (nxt === null) break;
          if (indent(nxt) !== contIndent) break;
          const nt = nxt.trim();
          if (nt.startsWith('-')) break;
          i += 1;
          const [ck, ...cvparts] = nt.split(':');
          const cv = cvparts.join(':').trim();
          if (cv === '') {
            itemObj[ck.trim()] = parseBlock(contIndent);
          } else {
            itemObj[ck.trim()] = parseScalar(cv);
          }
        }
        out.push(itemObj);
      } else {
        out.push(parseScalar(rest));
      }
    }
    return out;
  }

  function parseMapping(myIndent) {
    const out = {};
    while (true) {
      const line = peekLine();
      if (line === null) break;
      if (indent(line) < myIndent) break;
      if (indent(line) > myIndent) break;
      const t = line.trim();
      if (t.startsWith('-')) break;
      if (!t.includes(':')) break;
      i += 1;
      const [k, ...vparts] = t.split(':');
      const v = vparts.join(':').trim();
      if (v === '') {
        out[k.trim()] = parseBlock(myIndent);
      } else {
        out[k.trim()] = parseScalar(v);
      }
    }
    return out;
  }

  return parseBlock(-1);
}

/* ---------- glob matcher (subset of minimatch) ---------- */

function globToRegex(glob) {
  // Supports: **, *, ?, character classes, and literal path segments. Anchors
  // to the full string. We treat ** as "zero or more path segments".
  let re = '^';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // Handle **/, /** and bare ** in the middle of a path.
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 3;
        } else if (i + 2 === glob.length) {
          re += '.*';
          i += 2;
        } else {
          re += '.*';
          i += 2;
        }
      } else {
        re += '[^/]*';
        i += 1;
      }
    } else if (c === '?') {
      re += '[^/]';
      i += 1;
    } else if ('.+^$|()'.includes(c)) {
      re += '\\' + c;
      i += 1;
    } else if (c === '[') {
      const end = glob.indexOf(']', i);
      if (end === -1) { re += '\\['; i += 1; }
      else { re += glob.slice(i, end + 1); i = end + 1; }
    } else {
      re += c;
      i += 1;
    }
  }
  re += '$';
  return new RegExp(re);
}

function matches(pattern, filepath) {
  const rx = globToRegex(pattern);
  if (rx.test(filepath)) return true;
  // Apply matchBase: a pattern without a slash should match any basename.
  if (!pattern.includes('/')) {
    const base = filepath.split('/').pop();
    return rx.test(base);
  }
  return false;
}

/* ---------- main ---------- */

async function main() {
  const mapSrc = await fs.readFile(MAP_FILE, 'utf8');
  const map = parseYaml(mapSrc);
  await fs.writeFile(MAP_JSON_OUT, JSON.stringify(map, null, 2) + '\n');

  let changed;
  try {
    changed = JSON.parse(await fs.readFile(CHANGED_IN, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') changed = [];
    else throw err;
  }

  const byRepo = new Map();
  for (const entry of changed) {
    if (!byRepo.has(entry.repo)) byRepo.set(entry.repo, []);
    byRepo.get(entry.repo).push(entry.path);
  }

  const flagged = [];
  for (const mapping of map.mappings ?? []) {
    const matchedFiles = [];
    for (const watch of mapping.watches ?? []) {
      const files = byRepo.get(watch.repo) ?? [];
      if (files.length === 0) continue;
      for (const filepath of files) {
        for (const pattern of watch.paths ?? []) {
          if (matches(pattern, filepath)) {
            matchedFiles.push({ repo: watch.repo, path: filepath, matched_pattern: pattern });
            break;
          }
        }
      }
    }
    if (matchedFiles.length > 0) {
      flagged.push({
        skill: mapping.skill,
        priority: mapping.priority ?? 'normal',
        topics: mapping.topics ?? [],
        match_count: matchedFiles.length,
        matched_files: matchedFiles.slice(0, 50),
        matched_files_truncated: matchedFiles.length > 50,
      });
    }
  }

  await fs.writeFile(FLAGGED_OUT, JSON.stringify({ flagged }, null, 2) + '\n');

  console.error(`[flag] skills_flagged=${flagged.length}`);
  for (const f of flagged) {
    console.error(`  ${f.skill} (${f.priority}): ${f.match_count} files`);
  }

  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      `skills_flagged=${flagged.length}\n` +
        `has_critical=${flagged.some((f) => f.priority === 'critical') ? 'true' : 'false'}\n`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
