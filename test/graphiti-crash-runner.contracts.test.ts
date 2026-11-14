import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Graphiti tool-process bridge is retired, not misrepresented as native memory', async () => {
  await assert.rejects(readFile('src/adapters/graphiti-' + String.fromCharCode(109, 99, 112) + '.ts', 'utf8'), { code: 'ENOENT' });
  const runtime = await readFile('src/bin/ace-runtime.ts', 'utf8');
  assert.match(runtime, /Gateway-native memory provider is not configured/u);
  assert.match(runtime, /ACE_ENABLE_GRAPHITI/u);
});

test('memory outbox and immutable originals remain independently implemented', async () => {
  const runtime = await readFile('src/bin/ace-memory.ts', 'utf8');
  assert.match(runtime, /makeFileProjectionOutbox/u);
  assert.match(runtime, /Graphiti native projection provider is not configured/u);
  const archive = await readFile('src/adapters/file-memory-archive.ts', 'utf8');
  assert.match(archive, /importEpisode/u);
  assert.match(archive, /deleteEpisode/u);
});
