import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// The old agent-invoked crash runner is retired. These source-level
// invariants stay enforced; real Gateway crash-recovery E2E remains pending.
test('Gateway runtime requires explicit double opt-in for destructive failpoints', async () => {
  const runtime = await readFile('src/bin/ace-runtime.ts', 'utf8');
  assert.ok(runtime.includes('ACE_TEST_FAILPOINT requires ACE_ENABLE_TEST_FAILPOINTS=true'));
  assert.ok(runtime.includes("process.kill(process.pid, 'SIGKILL')"));
  assert.ok(runtime.includes('after_qdrant_verify_before_publish'));
  const capture = await readFile('scripts/runtime-config-evidence.ts', 'utf8');
  assert.match(capture, /ACE_ENABLE_TEST_FAILPOINTS/u);
  assert.match(capture, /ACE_TEST_FAILPOINT/u);
  assert.match(capture, /refuses environments with ACE test failpoints enabled/u);
});

test('Gateway structural/LSP refresh stays after Qdrant preparation', async () => {
  const runtime = await readFile('src/bin/ace-runtime.ts', 'utf8');
  const prepare = runtime.indexOf('const indexed = await Effect.runPromise(');
  const refresh = runtime.indexOf('route.lease.session.refresh(sourceFiles.value, semanticIdentity)');
  const publish = runtime.indexOf('const qdrant = makeQdrantCodeCandidatePort({');
  assert.ok(prepare >= 0, 'Qdrant preparation must exist');
  assert.ok(refresh > prepare, 'semantic refresh must follow index preparation');
  assert.ok(publish > refresh, 'final Qdrant projection must follow semantic refresh');
});
