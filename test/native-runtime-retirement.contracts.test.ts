import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('native runtime rejects historical failpoints and has no vector composition', async () => {
  const runtime = await readFile('src/bin/ace-runtime.ts', 'utf8');
  assert.match(runtime, /Retired vector runtime test failpoints are unsupported/u);
  assert.doesNotMatch(runtime, /QdrantClient|makeQdrantContextProvider|makeProcessEmbeddingPort|after_qdrant_verify_before_publish/u);
  const capture = await readFile('scripts/runtime-config-evidence.ts', 'utf8');
  assert.match(capture, /refuses environments with ACE test failpoints enabled/u);
});
