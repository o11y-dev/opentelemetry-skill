import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REMOVED_PACKAGES = [
  '@opentelemetry/propagator-jaeger',
  '@opentelemetry/exporter-jaeger',
  '@opentelemetry/shim-opentracing',
  '@opentelemetry/shim-opencensus',
  '@opentelemetry/api-logs',
  '@opentelemetry/instrumentation-restify',
  '@opentelemetry/sdk-trace-base',
  '@opentelemetry/sdk-trace-node',
  '@opentelemetry/sdk-trace-web',
];

const TRACE_SDK_PACKAGES = [
  '@opentelemetry/sdk-trace-base',
  '@opentelemetry/sdk-trace-node',
  '@opentelemetry/sdk-trace-web',
];

const SOURCE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx']);
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);

async function walk(root) {
  const files = [];
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name)) pending.push(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    }
  }
  return files;
}

function nodeDeclarationNeedsReview(value) {
  const normalized = String(value).trim().replace(/^v/, '');
  const branches = normalized.split('||').map((branch) => branch.trim());
  return branches.some((branch) => {
    const match = branch.match(/^(?:\^|~|>=?|=)?\s*v?(\d+)(?:\.(\d+|x|\*))?/i);
    if (!match || match[2] === 'x' || match[2] === '*') return true;
    const major = Number(match[1]);
    const minor = Number(match[2] ?? 0);
    return major < 22 || (major === 22 && minor < 15);
  });
}

export async function scanProject(root) {
  const files = await walk(root);
  const result = {
    nodeDeclarations: [],
    removedPackages: [],
    legacyTracingImports: [],
    instrumentationReferences: [],
    unreadablePackageFiles: [],
  };

  for (const file of files) {
    const relative = path.relative(root, file) || '.';
    if (path.basename(file) === 'package.json') {
      let manifest;
      try {
        manifest = JSON.parse(await readFile(file, 'utf8'));
      } catch {
        result.unreadablePackageFiles.push(relative);
        continue;
      }

      const nodeVersion = manifest.engines?.node ?? manifest.volta?.node;
      if (nodeVersion) {
        result.nodeDeclarations.push({ file: relative, version: String(nodeVersion), needsReview: nodeDeclarationNeedsReview(nodeVersion) });
      }
      const dependencies = {
        ...manifest.dependencies,
        ...manifest.devDependencies,
        ...manifest.peerDependencies,
        ...manifest.optionalDependencies,
      };
      for (const name of REMOVED_PACKAGES) {
        if (Object.hasOwn(dependencies, name)) result.removedPackages.push({ file: relative, package: name });
      }
    }

    if (['.nvmrc', '.node-version'].includes(path.basename(file))) {
      const version = (await readFile(file, 'utf8')).trim();
      if (version) result.nodeDeclarations.push({ file: relative, version, needsReview: nodeDeclarationNeedsReview(version) });
    }

    if (path.basename(file) === '.tool-versions') {
      const contents = await readFile(file, 'utf8');
      for (const match of contents.matchAll(/^nodejs\s+(\S+)/gm)) {
        result.nodeDeclarations.push({ file: relative, version: match[1], needsReview: nodeDeclarationNeedsReview(match[1]) });
      }
    }

    if (['.yml', '.yaml'].includes(path.extname(file))) {
      const contents = await readFile(file, 'utf8');
      for (const match of contents.matchAll(/^\s*node-version:\s*['"]?([^'"#\s]+)['"]?/gm)) {
        result.nodeDeclarations.push({ file: relative, version: match[1], needsReview: nodeDeclarationNeedsReview(match[1]) });
      }
    }

    if (/^Dockerfile(?:\..*)?$/i.test(path.basename(file))) {
      const contents = await readFile(file, 'utf8');
      for (const match of contents.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(?:[\w.-]+\/)?node:(\d+(?:\.\d+)?(?:\.\d+)?)/gim)) {
        result.nodeDeclarations.push({ file: relative, version: match[1], needsReview: nodeDeclarationNeedsReview(match[1]) });
      }
    }

    if (SOURCE_EXTENSIONS.has(path.extname(file))) {
      const source = await readFile(file, 'utf8');
      for (const name of TRACE_SDK_PACKAGES) {
        if (new RegExp(`(?:from\\s*|import\\s*\\(|require\\s*\\()\\s*['"]${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(source)) {
          result.legacyTracingImports.push({ file: relative, package: name });
        }
      }
      if (/(?:from\s*|import\s*\(|require\s*\()\s*['"]@opentelemetry\/instrumentation(?:-[^'"]+)?['"]/.test(source)) {
        result.instrumentationReferences.push(relative);
      }
    }
  }

  result.nodeDeclarations.sort((a, b) => `${a.file}:${a.version}`.localeCompare(`${b.file}:${b.version}`));
  result.removedPackages.sort((a, b) => `${a.file}:${a.package}`.localeCompare(`${b.file}:${b.package}`));
  result.legacyTracingImports.sort((a, b) => `${a.file}:${a.package}`.localeCompare(`${b.file}:${b.package}`));
  result.instrumentationReferences.sort();
  result.unreadablePackageFiles.sort();
  return result;
}

export function renderReport(result) {
  const lines = ['OpenTelemetry JS 3.0 readiness scan (static checks only):'];
  if (result.nodeDeclarations.length === 0) lines.push('- No Node.js version declaration found; declare and validate a runtime floor.');
  for (const declaration of result.nodeDeclarations) {
    lines.push(`- Node version ${declaration.needsReview ? 'REVIEW' : 'OK'}: ${declaration.file} (${declaration.version})`);
  }
  for (const item of result.removedPackages) lines.push(`- Removed package REVIEW: ${item.file} depends on ${item.package}`);
  for (const item of result.legacyTracingImports) lines.push(`- Legacy tracing SDK import REVIEW: ${item.file} imports ${item.package}`);
  for (const file of result.instrumentationReferences) lines.push(`- Custom instrumentation compatibility REVIEW: inspect ${file} against the final 3.x API`);
  for (const file of result.unreadablePackageFiles) lines.push(`- Could not parse package manifest: ${file}`);
  if (result.removedPackages.length + result.legacyTracingImports.length + result.instrumentationReferences.length + result.unreadablePackageFiles.length === 0) {
    lines.push('- No removed-package or tracing-SDK import matches found; this does not prove compatibility.');
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? process.cwd());
  const report = await scanProject(root);
  process.stdout.write(renderReport(report));
}
