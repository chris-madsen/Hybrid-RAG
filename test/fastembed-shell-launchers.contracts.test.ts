import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

test('native context runtime does not configure historical sparse workers', async () => {
  const runtime = await readFile(resolve('src/bin/ace-runtime.ts'), 'utf8');
  assert.doesNotMatch(runtime, /ACE_SPARSE_EMBEDDING_LD_LIBRARY_PATH|makeProcessSparseEmbeddingPort|fastembed-sparse-worker/u);
  assert.match(runtime, /Only native CBM code retrieval is supported/u);
});


test('native feedback preflight requires the verified bundle instead of historical vector providers', async () => {
  const preflight = await readFile('scripts/feedback-loop-preflight.ts', 'utf8');
  assert.match(preflight, /verifyAceRuntimeBundle/u);
  assert.match(preflight, /'aceRuntimeBundle', 'nativeTaskProjection', 'taskRuntimeProbe'/u);
  assert.doesNotMatch(preflight, /fastembed-sparse-worker|sparseEmbedding|qdrantUrl|embeddingCache/u);
  assert.match(preflight, /assessTaskRuntimeProbe/u);
});
