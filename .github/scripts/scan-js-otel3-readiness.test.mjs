import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { renderReport, scanProject } from './scan-js-otel3-readiness.mjs';

test('finds old runtime declarations, removed dependencies, tracing imports, and custom instrumentation', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'otel-js3-scan-'));
  try {
    await mkdir(path.join(root, 'src'));
    await writeFile(path.join(root, 'package.json'), JSON.stringify({
      engines: { node: '^20.6.0' },
      dependencies: { '@opentelemetry/sdk-trace-node': '^2.0.0', '@opentelemetry/shim-opentracing': '^1.0.0' },
    }));
    await writeFile(path.join(root, '.nvmrc'), '22.15.0\n');
    const traceImport = ['import { NodeTracerProvider } from ', "'", '@opentelemetry/sdk-trace-node', "';"].join('');
    const instrumentationImport = ['import { InstrumentationBase } from ', "'", '@opentelemetry/instrumentation', "';"].join('');
    await writeFile(path.join(root, 'src/tracing.ts'), `${traceImport}\n${instrumentationImport}\n`);

    const result = await scanProject(root);
    assert.equal(result.nodeDeclarations.length, 2);
    assert(result.nodeDeclarations.some((entry) => entry.file === 'package.json' && entry.needsReview));
    assert(result.nodeDeclarations.some((entry) => entry.file === '.nvmrc' && !entry.needsReview));
    assert.deepEqual(result.removedPackages, [
      { file: 'package.json', package: '@opentelemetry/sdk-trace-node' },
      { file: 'package.json', package: '@opentelemetry/shim-opentracing' },
    ]);
    assert.deepEqual(result.legacyTracingImports, [
      { file: 'src/tracing.ts', package: '@opentelemetry/sdk-trace-node' },
    ]);
    assert.deepEqual(result.instrumentationReferences, ['src/tracing.ts']);
    assert.match(renderReport(result), /Custom instrumentation compatibility REVIEW/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reports missing runtime declarations and malformed package manifests', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'otel-js3-scan-'));
  try {
    await writeFile(path.join(root, 'package.json'), '{invalid');
    const result = await scanProject(root);
    assert.deepEqual(result.unreadablePackageFiles, ['package.json']);
    assert.match(renderReport(result), /No Node.js version declaration found/);
    assert.match(renderReport(result), /Could not parse package manifest/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
