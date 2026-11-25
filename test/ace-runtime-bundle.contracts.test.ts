import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { computeAceRuntimeBundleDigest, verifyAceRuntimeBundle, missingAceRuntimeBundlePaths } from '../src/application/ace-runtime-bundle.js';
import {
  requiredAceRuntimeBundlePaths,
  validateAceRuntimeBundleManifest,
} from '../src/domain/ace-runtime-bundle.js';

const validManifest = {
  schemaVersion: 2,
  runtimeId: 'ace-harbor-runtime-v1',
  retrieval: 'native_cbm',
  sourceCommit: 'a'.repeat(40),
  bundleSha256: 'b'.repeat(64),
  taskImages: [{ reference: 'example/task:1', digest: `sha256:${'c'.repeat(64)}` }],
  codebaseMemoryVersion: '0.12.1',
  nativeBinarySha256: createHash('sha256').update('original').digest('hex'),
};

test('validates a pinned native runtime bundle manifest', () => {
  assert.deepEqual(validateAceRuntimeBundleManifest(validManifest), []);
  assert.ok(validateAceRuntimeBundleManifest({ ...validManifest, schemaVersion: 1 }).includes('manifest_schema_invalid'));
});

test('rejects non-Git source commit identities in bundle manifests', () => {
  const failures = validateAceRuntimeBundleManifest({ ...validManifest, sourceCommit: 'not-a-git-commit' });
  assert.ok(failures.includes('source_commit_invalid'));
});

test('rejects a bundle manifest with missing image or provider pins', () => {
  const failures = validateAceRuntimeBundleManifest({
    ...validManifest,
    taskImages: [],
    retrieval: 'historical_vector',
    codebaseMemoryVersion: 'latest',
    nativeBinarySha256: 'unverified',
  });
  assert.ok(failures.includes('task_images_missing'));
  assert.ok(failures.includes('retrieval_mode_invalid'));
  assert.ok(failures.includes('codebase_memory_pin_invalid'));
  assert.ok(failures.includes('native_binary_digest_invalid'));
});

test('reports missing runtime bundle paths instead of treating an incomplete mount as ready', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-runtime-bundle-'));
  const missing = missingAceRuntimeBundlePaths(root);
  assert.deepEqual(missing, requiredAceRuntimeBundlePaths);
  await mkdir(join(root, 'dist/bin'), { recursive: true });
  await writeFile(join(root, 'dist/bin/ace-context-rpc.js'), '');
  assert.ok(missingAceRuntimeBundlePaths(root).includes('node_modules/effect/package.json'));
});


test('verifies bundle bytes rather than accepting an unverified manifest digest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-bundle-digest-'));
  for (const required of requiredAceRuntimeBundlePaths) {
    const target = join(root, required);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, 'original');
  }
  const binary = join(root, 'runtime/native/codebase-memory-mcp');
  await chmod(binary, 0o755);
  const bundleSha256 = await computeAceRuntimeBundleDigest(root);
  await writeFile(join(root, 'runtime-manifest.json'), JSON.stringify({ ...validManifest, bundleSha256 }));
  await writeFile(join(root, 'dist/runtime-provenance.json'), JSON.stringify({
    bundleManifestSha256: bundleSha256,
    sourceCommit: validManifest.sourceCommit,
  }));
  assert.equal((await verifyAceRuntimeBundle(root, bundleSha256)).status, 'ready');
  await writeFile(binary, 'tampered native executable');
  const wrongBinary = await verifyAceRuntimeBundle(root, bundleSha256);
  assert.equal(wrongBinary.status, 'not_ready');
  assert.match(wrongBinary.reason, /native binary digest/u);
  await writeFile(binary, 'original');
  if (process.platform !== 'win32') {
    const target = join(root, 'outside-native');
    await writeFile(target, 'original');
    await chmod(target, 0o755);
    await rm(binary);
    await symlink(target, binary);
    assert.equal((await verifyAceRuntimeBundle(root, bundleSha256)).status, 'not_ready');
    await rm(binary);
    await rm(target);
    await writeFile(binary, 'original');
    await chmod(binary, 0o755);
  }
  await mkdir(join(root, 'runtime/model-cache'), { recursive: true });
  assert.equal((await verifyAceRuntimeBundle(root, bundleSha256)).status, 'not_ready');
  await rm(join(root, 'runtime/model-cache'), { recursive: true });
  await writeFile(join(root, 'dist/bin/ace-runtime.js'), 'modified');
  const tampered = await verifyAceRuntimeBundle(root, bundleSha256);
  assert.equal(tampered.status, 'not_ready');
  assert.match(tampered.reason, /bytes do not match/u);
});

test('Docker runtime uses the pinned embedding versions from the Harbor bundle contract', async () => {
  const cpuEmbeddingRequirements = await readFile('requirements-embedding-st.txt', 'utf8');
  assert.match(cpuEmbeddingRequirements, /^torch==2\.15\.0\+cpu$/mu, 'CPU-only Sentence-Transformers environment must not resolve a CUDA torch wheel');
  const dockerfile = await readFile('Dockerfile.ace', 'utf8');
  assert.match(dockerfile, /sys\.version_info < \(3, 11\)/u);
  assert.ok(dockerfile.includes('pillow==13.0.0'));
  assert.ok(dockerfile.includes('fastembed==0.9.1'));
  assert.ok(dockerfile.includes('numpy==2.2.6'));
  assert.ok(dockerfile.includes('onnxruntime==1.23.2'));
  assert.ok(!dockerfile.includes('pillow==11.3.0'));
  assert.ok(!dockerfile.includes('fastembed==0.7.4'));
  assert.ok(!dockerfile.includes('numpy==2.5.4'));

  // Host Git owns source identity; Docker verifies exactly those source bytes
  // and the compiled binary instead of inventing a HEAD inside a .git-free image.
  const dockerignore = await readFile('.dockerignore', 'utf8');
  assert.ok(dockerfile.includes('COPY dist ./dist'));
  assert.ok(dockerfile.includes('verifyCompiledRuntimeProvenance'));
  assert.ok(!dockerfile.includes('RUN npm run build'));
  assert.ok(dockerignore.split('\n').includes('.git'));
  assert.ok(!dockerignore.split('\n').includes('dist'));

  const taskDockerfiles = [
    'benchmarks/harbor/ace-shared-archive-impact/environment/Dockerfile',
    'benchmarks/harbor/ace-retrieval-impact/environment/Dockerfile',
    'benchmarks/harbor/ace-cloud-policy-impact/environment/Dockerfile',
  ];
  for (const path of taskDockerfiles) {
    const taskDockerfile = await readFile(path, 'utf8');
    assert.match(taskDockerfile, /sys\.version_info < \(3, 11\)/u, `${path} must reject Python 3.10`);
    assert.match(taskDockerfile, /^FROM node:22\.23\.4-bookworm$/mu);
    assert.doesNotMatch(taskDockerfile, /fastembed|onnxruntime|sentence-transformers|pillow==|huggingface-hub|tree-sitter/u);
    assert.match(taskDockerfile, /python3-venv/u, 'retain agent Python installation support');
  }
});

test('bundle requires compiled Gateway and no optional native context plugin', () => {
  assert.ok(requiredAceRuntimeBundlePaths.includes('dist/bin/ace-context-rpc.js'));
  assert.ok(requiredAceRuntimeBundlePaths.every((path) => !path.startsWith('integrations/hermes/')));
});

test('Harbor bundle builder refuses to delete the source checkout or a symlinked parent', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'ace-harbor-builder-'));
  const checkout = join(parent, 'source');
  const alias = join(parent, 'source-alias');
  await mkdir(checkout);
  await writeFile(join(checkout, 'sentinel'), 'must survive');
  await symlink(checkout, alias, 'dir');
  try {
    for (const output of [checkout, parent, join(alias, 'bundle')]) {
      const result = spawnSync(process.execPath, [
        'scripts/build-harbor-ace-runtime.mjs',
        '--source-root', checkout,
        '--output', output,
        '--task-image', `example/task@sha256:${'a'.repeat(64)}`,
      ], { encoding: 'utf8' });
      assert.notEqual(result.status, 0, 'overlapping output must fail');
      assert.match(result.stderr, /BLOCKED: --output overlaps the source checkout/u);
      assert.equal(await readFile(join(checkout, 'sentinel'), 'utf8'), 'must survive');
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('pinned Harbor builder and Gateway container probe remain explicit', async () => {
  const builder = await readFile('scripts/build-harbor-ace-runtime.mjs', 'utf8');
  const probe = await readFile('scripts/ace-container-runtime-smoke.mjs', 'utf8');
  assert.match(builder, /const executionImage = \(image\)/u);
  assert.match(builder, /localId === image\.digest \? localId :/u);
  assert.match(builder, /computeAceRuntimeBundleDigest/u);
  assert.match(probe, /real-projection-e2e\.mjs/u);
  assert.match(probe, /gatewayHttpLiveness: true/u);
  assert.match(probe, /providerWireCertified: false/u);
});

test('Harbor runtime builder bootstraps missing source dependencies before TypeScript build', async () => {
  const builder = await readFile('scripts/build-harbor-ace-runtime.mjs', 'utf8');
  assert.match(builder, /node_modules\/\.bin\/tsc/u);
  assert.match(builder, /node_modules\/@types\/node/u);
  assert.match(builder, /npm', \['ci', '--ignore-scripts'\]/u);
  assert.match(builder, /chmod -R a\+rwX \/ace/u);
});

test('Harbor runtime builder installs pinned native binary and rejects retired runtime', async () => {
  const builder = await readFile('scripts/build-harbor-ace-runtime.mjs', 'utf8');
  assert.match(builder, /const CBM_VERSION = '0\.12\.1'/u);
  assert.match(builder, /codebase-memory-mcp@/u);
  assert.match(builder, /--bin-links=false/u);
  assert.match(builder, /--network', 'none'/u);
  assert.doesNotMatch(builder, /fastembed|onnxruntime|runtime\/model-cache/u);
});
