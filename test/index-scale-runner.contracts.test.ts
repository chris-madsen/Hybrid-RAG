import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// The previous index-scale process runner exercised a retired model-invoked
// transport and cannot be claimed as a Gateway E2E acceptance test.
test('retired index-scale process entrypoint cannot run as ACE acceptance', async () => {
  await assert.rejects(readFile('scripts/index-scale-e2e.mjs', 'utf8'), { code: 'ENOENT' });
  const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['test:real-index-scale'], undefined);
});

test('Gateway runtime preserves Qdrant snapshot and change-only primitives', async () => {
  const runtime = await readFile('src/bin/ace-runtime.ts', 'utf8');
  assert.match(runtime, /reuseOrPopulateQdrantSnapshot/u);
  assert.match(runtime, /mutateQdrantChangedPaths/u);
  assert.match(runtime, /observeWorkspaceManifest/u);
  assert.match(runtime, /runGatewayProjectionHttp/u);
});

test('scale and crash provider E2E remain explicitly unverified after transport retirement', async () => {
  const readme = await readFile('README.md', 'utf8');
  assert.match(readme, /index-scale/u);
  assert.match(readme, /NOT-RUN/u);
  const g02 = await readFile('docs/plans/2026-11-14-gateway-only-retirement-g02.md', 'utf8');
  assert.match(g02, /provider/u);
});
