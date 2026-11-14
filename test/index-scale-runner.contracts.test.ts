import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('retired agent-tool index-scale harness cannot be invoked as production evidence', async () => {
  await assert.rejects(readFile('scripts/index-scale-e2e.mjs', 'utf8'), { code: 'ENOENT' });
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
    readonly scripts?: Readonly<Record<string, string>>;
  };
  assert.equal(packageJson.scripts?.['test:real-index-scale'], undefined);
});

test('historical index-scale reports remain evidence only, not an active Gateway acceptance command', async () => {
  const runbook = await readFile('docs/operations/index-scale-real-provider-runbook.md', 'utf8');
  assert.match(runbook, /Archived design evidence|historical|retired/iu);
});
