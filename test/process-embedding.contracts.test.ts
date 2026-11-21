import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect } from 'effect';
import {
  makeProcessEmbeddingPort,
  verifiedEmbeddingIdentityFingerprint,
  type EmbeddingWorkerIdentity,
  type ResolvedEmbeddingConfig,
} from '../src/adapters/process-embedding.js';

const digest = 'a'.repeat(64);
const expected: ResolvedEmbeddingConfig = {
  provider: 'fixture/provider',
  model: 'fixture/model',
  modelRevision: 'model-r1',
  artifactModel: 'fixture/artifact',
  artifactRevision: 'artifact-r1',
  artifactDigest: digest,
  dimension: 2,
  preprocessing: 'raw_text_v1',
  executionMode: 'pinned',
  pinned: true,
};

const workerScript = (model = expected.model): string => `
const readline = require('node:readline');
const identity = {
  provider: 'fixture/provider',
  model: ${JSON.stringify(model)},
  modelRevision: 'model-r1',
  artifactModel: 'fixture/artifact',
  artifactRevision: 'artifact-r1',
  artifactDigest: '${digest}',
  dimension: 2,
  preprocessing: 'raw_text_v1',
  executionMode: 'pinned',
  pinned: true,
  runtimeBuild: 'fixture-worker.js#${digest}',
  runtimeVersion: 'node/fixture-runtime-1',
};
process.stdout.write(JSON.stringify({ type: 'ready', identity }) + '\\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const request = JSON.parse(line);
  const vectors = request.texts.map(() => [0.25, 0.75]);
  process.stdout.write(JSON.stringify({ id: request.id, vectors }) + '\\n');
});
`;

test('embedding process requires and exposes a matching effective worker identity', async () => {
  const port = makeProcessEmbeddingPort({
    command: process.execPath,
    args: ['-e', workerScript()],
    dimension: 2,
    expectedIdentity: expected,
    timeoutMs: 5_000,
  });
  try {
    const probe = await Effect.runPromise(port.probe());
    assert.equal(probe._tag, 'Ok');
    assert.deepEqual(port.identity(), {
      ...expected,
      runtimeBuild: `fixture-worker.js#${digest}`,
      runtimeVersion: 'node/fixture-runtime-1',
    });
    const embedded = await Effect.runPromise(port.embedMany(['hello']));
    assert.equal(embedded._tag, 'Ok');
    if (embedded._tag === 'Ok') assert.deepEqual(embedded.value, [[0.25, 0.75]]);
  } finally {
    port.close();
  }
});



test('verified embedding namespace fingerprint changes with effective artifact or runtime identity', () => {
  const identity: EmbeddingWorkerIdentity = {
    ...expected,
    runtimeBuild: `fixture-worker.js#${digest}`,
    runtimeVersion: 'node/fixture-runtime-1',
  };
  const base = verifiedEmbeddingIdentityFingerprint(identity);
  assert.match(base, /^[a-f0-9]{64}$/u);
  assert.equal(verifiedEmbeddingIdentityFingerprint({ ...identity }), base);
  assert.notEqual(
    verifiedEmbeddingIdentityFingerprint({ ...identity, artifactDigest: 'b'.repeat(64) }),
    base,
  );
  assert.notEqual(
    verifiedEmbeddingIdentityFingerprint({ ...identity, runtimeVersion: 'node/fixture-runtime-2' }),
    base,
  );
});

test('embedding process rejects an inconsistent execution mode receipt', async () => {
  const port = makeProcessEmbeddingPort({
    command: process.execPath,
    args: ['-e', workerScript().replace('pinned: true', 'pinned: false')],
    dimension: 2,
    expectedIdentity: expected,
    timeoutMs: 5_000,
  });
  try {
    const probe = await Effect.runPromise(port.probe());
    assert.equal(probe._tag, 'Err');
    if (probe._tag === 'Err') assert.equal(probe.error.code, 'INVALID_EXTERNAL_RESPONSE');
  } finally {
    port.close();
  }
});

test('embedding process does not forward non-allowlisted environment variables', async () => {
  const script = `
if (process.env.ACE_EMBEDDING_SECRET_SENTINEL !== undefined || process.env.OPENAI_API_KEY !== undefined) process.exit(23);
${workerScript()}`;
  const port = makeProcessEmbeddingPort({
    command: process.execPath,
    args: ['-e', script],
    dimension: 2,
    expectedIdentity: expected,
    env: {
      ACE_EMBEDDING_SECRET_SENTINEL: 'must-not-cross-boundary',
      OPENAI_API_KEY: 'must-not-cross-boundary',
    },
    timeoutMs: 5_000,
  });
  try {
    const probe = await Effect.runPromise(port.probe());
    assert.equal(probe._tag, 'Ok');
  } finally {
    port.close();
  }
});

test('embedding process fails closed when worker receipt names a different model', async () => {
  const port = makeProcessEmbeddingPort({
    command: process.execPath,
    args: ['-e', workerScript('fixture/wrong-model')],
    dimension: 2,
    expectedIdentity: expected,
    timeoutMs: 5_000,
  });
  try {
    const probe = await Effect.runPromise(port.probe());
    assert.equal(probe._tag, 'Err');
    if (probe._tag === 'Err') assert.equal(probe.error.code, 'INVALID_EXTERNAL_RESPONSE');
  } finally {
    port.close();
  }
});


// The actual Python worker processes stdin serially: a timed-out inference still
// occupies the worker until it finishes unless the owning subprocess is retired.
test('AR09: timed-out serial work cannot block or poison the next request', async () => {
  const delayedScript = workerScript()
    .replace(
      'const vectors = request.texts.map(() => [0.25, 0.75]);',
      "if (request.texts.includes('slow')) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1200);\n  const vectors = request.texts.map((text) => text === 'healthy' ? [0.7, 0.3] : [0.25, 0.75]);",
    );
  const port = makeProcessEmbeddingPort({
    command: process.execPath,
    args: ['-e', delayedScript],
    dimension: 2,
    expectedIdentity: expected,
    timeoutMs: 350,
  });
  try {
    const slow = await Effect.runPromise(port.embedMany(['slow']));
    assert.equal(slow._tag, 'Err');
    if (slow._tag === 'Err') assert.equal(slow.error.code, 'EXTERNAL_UNAVAILABLE');

    const started = Date.now();
    const healthy = await Effect.runPromise(port.embedMany(['healthy']));
    assert.equal(healthy._tag, 'Ok');
    if (healthy._tag === 'Ok') assert.deepEqual(healthy.value, [[0.7, 0.3]]);
    assert.ok(Date.now() - started < 800, 'new request should not wait for the old Python-style serial backlog');
    assert.ok(port.identity() !== undefined, 'restarted worker must re-validate identity');
  } finally {
    port.close();
  }
});

test('AR09: timeout fails all queued requests without assigning a late frame to a new session', async () => {
  const delayedScript = workerScript()
    .replace(
      'const vectors = request.texts.map(() => [0.25, 0.75]);',
      "if (request.texts.includes('slow')) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);\n  const vectors = request.texts.map((text) => text === 'new' ? [0.9, 0.1] : [0.25, 0.75]);",
    );
  const port = makeProcessEmbeddingPort({
    command: process.execPath,
    args: ['-e', delayedScript],
    dimension: 2,
    expectedIdentity: expected,
    timeoutMs: 400,
  });
  try {
    const [slow, queued] = await Promise.all([
      Effect.runPromise(port.embedMany(['slow'])),
      Effect.runPromise(port.embedMany(['queued'])),
    ]);
    assert.equal(slow._tag, 'Err');
    assert.equal(queued._tag, 'Err');
    const recovered = await Effect.runPromise(port.embedMany(['new']));
    assert.equal(recovered._tag, 'Ok');
    if (recovered._tag === 'Ok') assert.deepEqual(recovered.value, [[0.9, 0.1]]);
  } finally {
    port.close();
  }
});

test('AR09: interrupted inference retires serial worker before another request', async () => {
  const delayedScript = workerScript().replace(
    'const vectors = request.texts.map(() => [0.25, 0.75]);',
    "if (request.texts.includes('slow')) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);\n  const vectors = request.texts.map(() => [0.25, 0.75]);",
  );
  const port = makeProcessEmbeddingPort({
    command: process.execPath,
    args: ['-e', delayedScript],
    dimension: 2,
    expectedIdentity: expected,
    timeoutMs: 600,
  });
  try {
    const controller = new AbortController();
    const interrupted = Effect.runPromise(port.embedMany(['slow']), { signal: controller.signal })
      .catch(() => undefined);
    await new Promise((resolve) => { setTimeout(resolve, 150); });
    controller.abort();
    await interrupted;
    const healthy = await Effect.runPromise(port.embedMany(['healthy']));
    assert.equal(healthy._tag, 'Ok');
  } finally {
    port.close();
  }
});
