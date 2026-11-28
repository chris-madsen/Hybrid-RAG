import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { assessTaskRuntimeProbe, pinnedHermesCommit, readHermesTaskRuntimeReceipt, type HermesTaskRuntimeReceipt } from '../src/domain/hermes-task-runtime-probe.js';

test('packaged Hermes provenance uses its install stamp without requiring Git metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'ace-hermes-install-stamp-'));
  const script = resolve(import.meta.dirname, '../scripts/hermes-task-runtime-probe.py');
  const checkStamp = (directory: string) => spawnSync('python3', ['-c', [
    'import importlib.util, pathlib, sys',
    'spec = importlib.util.spec_from_file_location("hermes_probe", sys.argv[1])',
    'module = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(module)',
    'print(module.read_install_stamp(pathlib.Path(sys.argv[2]))["commit"])',
  ].join('\n'), script, directory], {
    encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  const stamp = {
    schemaVersion: 2,
    commit: pinnedHermesCommit,
    branch: 'v0.22.3',
    dirty: false,
    source: 'ci',
    distribution: 'docker',
    updateMechanism: 'external',
    baseVersion: '0.22.3',
    displayVersion: '0.22.3',
    distance: 0,
  };

  try {
    writeFileSync(join(root, 'install-stamp.json'), JSON.stringify(stamp));
    const valid = checkStamp(root);
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(valid.stdout.trim(), pinnedHermesCommit);

    const invalidStamps: ReadonlyArray<{ readonly change: Record<string, unknown>; readonly reason: RegExp }> = [
      { change: { commit: 'f'.repeat(40) }, reason: /HERMES_INSTALL_STAMP_COMMIT_MISMATCH/u },
      { change: { dirty: true }, reason: /HERMES_INSTALL_STAMP_DIRTY/u },
      { change: { distance: false }, reason: /HERMES_INSTALL_STAMP_VERSION_MISMATCH/u },
    ];
    for (const { change, reason } of invalidStamps) {
      writeFileSync(join(root, 'install-stamp.json'), JSON.stringify({ ...stamp, ...change }));
      const invalid = checkStamp(root);
      assert.equal(invalid.status, 1);
      assert.match(invalid.stderr, reason);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Git-installed Hermes provenance binds the exact clean source checkout without a package stamp', () => {
  const root = mkdtempSync(join(tmpdir(), 'ace-hermes-git-install-'));
  const script = resolve(import.meta.dirname, '../scripts/hermes-task-runtime-probe.py');
  const python = [
    'import importlib.util, pathlib, sys',
    'spec = importlib.util.spec_from_file_location("hermes_probe", sys.argv[1])',
    'module = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(module)',
    'print(module.read_install_provenance(pathlib.Path(sys.argv[2]), sys.argv[3])["commit"])',
  ].join('\n');
  const run = (expectedCommit: string) => spawnSync('python3', ['-c', python, script, root, expectedCommit], {
    encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', PYTHONDONTWRITEBYTECODE: '1' },
  });
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { stdio: 'ignore' });

  try {
    git('init', '--quiet');
    git('config', 'user.name', 'ACE test');
    git('config', 'user.email', 'ace-test@example.invalid');
    writeFileSync(join(root, 'transport.py'), 'verified source fixture\n');
    git('add', 'transport.py');
    git('commit', '--quiet', '-m', 'fixture');
    const commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

    const verified = run(commit);
    assert.equal(verified.status, 0, verified.stderr);
    assert.equal(verified.stdout.trim(), commit);

    const mismatched = run('f'.repeat(40));
    assert.notEqual(mismatched.status, 0);
    assert.match(mismatched.stderr, /HERMES_SOURCE_COMMIT_MISMATCH/u);

    writeFileSync(join(root, 'untracked.py'), 'dirty fixture\n');
    const dirty = run(commit);
    assert.notEqual(dirty.status, 0);
    assert.match(dirty.stderr, /HERMES_SOURCE_DIRTY/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Hermes version output binds both Git-source labels to the pinned commit', () => {
  const script = resolve(import.meta.dirname, '../scripts/hermes-task-runtime-probe.py');
  const python = [
    'import importlib.util, sys',
    'spec = importlib.util.spec_from_file_location("hermes_probe", sys.argv[1])',
    'module = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(module)',
    'print(module.pinned_version_matches(sys.argv[2], sys.argv[3]))',
  ].join('\n');
  const matches = (version: string) => spawnSync('python3', ['-c', python, script, version, pinnedHermesCommit], {
    encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  const shortCommit = pinnedHermesCommit.slice(0, 8);
  for (const sourceLabel of ['local', 'upstream']) {
    const verified = matches(`Hermes Agent v0.22.3 (build) · stable · ${sourceLabel} ${shortCommit}`);
    assert.equal(verified.status, 0, verified.stderr);
    assert.equal(verified.stdout.trim(), 'True');
  }
  assert.equal(matches(`Hermes Agent v0.22.3 (build) · stable · local ${'f'.repeat(8)}`).stdout.trim(), 'False');
  assert.equal(matches(`Hermes Agent v0.22.2 (build) · stable · local ${shortCommit}`).stdout.trim(), 'False');
});

test('tagless Hermes Git version output is accepted only with the pinned source commit', () => {
  const script = resolve(import.meta.dirname, '../scripts/hermes-task-runtime-probe.py');
  const result = spawnSync('python3', ['-c', [
    'import importlib.util, sys',
    'spec = importlib.util.spec_from_file_location("hermes_probe", sys.argv[1])',
    'module = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(module)',
    'version = sys.argv[2]',
    'print(module.pinned_version_matches(version, sys.argv[3], allow_git_version=True))',
    'print(module.pinned_version_matches(version.replace("local " + sys.argv[3][:8], "local ffffffff"), sys.argv[3], allow_git_version=True))',
    'print(module.pinned_version_matches(version, sys.argv[3]))',
  ].join('\n'), script, 'Hermes Agent vgit.5b147ab (build) stable local 5b147ab036d6', pinnedHermesCommit], {
    encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split('\n'), ['True', 'False', 'False']);
});

test('local Hermes task probe is pinned to installed version, executable, endpoint, model and immutable task image', () => {
  const expected = { sourceCommit: 'a'.repeat(40), bundleSha256: 'b'.repeat(64), reference: 'task:1',
    digest: 'sha256:' + 'c'.repeat(64), endpointSha256: 'd'.repeat(64), modelSha256: 'e'.repeat(64), reasoningEffort: 'high' };
  const receipt = { schemaVersion: 1, status: 'READY', hermesCommit: pinnedHermesCommit,
    hermesVersion: 'v0.22.3', hermesSdkVersion: '2.24.0', nativeResponsesObserved: true,
    providerWireCertified: false, hermesExecutableSha256: 'f'.repeat(64), hermesTransportSha256: '1'.repeat(64),
    sourceCommit: expected.sourceCommit, bundleSha256: expected.bundleSha256,
    imageReference: expected.reference, imageDigest: expected.digest, localImageId: expected.digest,
    endpointSha256: expected.endpointSha256, modelSha256: expected.modelSha256, reasoningEffort: expected.reasoningEffort };
  const output = (value: unknown): string => 'fixture output\r\n' + JSON.stringify(value) + '\n';
  assert.deepEqual(readHermesTaskRuntimeReceipt(output(receipt), expected), receipt);
  assert.deepEqual(readHermesTaskRuntimeReceipt(output({ ...receipt, arbitraryProcessOutput: 'not evidence' }), expected), receipt);
  for (const change of [
    { hermesCommit: 'a'.repeat(40) }, { hermesVersion: 'v0.22.2' }, { hermesSdkVersion: '2.23.0' },
    { hermesExecutableSha256: '' }, { hermesTransportSha256: 'unknown' }, { localImageId: 'task:mutable' },
    { sourceCommit: 'f'.repeat(40) }, { bundleSha256: 'f'.repeat(64) }, { imageReference: 'task:2' },
    { imageDigest: 'sha256:' + 'f'.repeat(64) }, { endpointSha256: 'f'.repeat(64) },
    { modelSha256: 'f'.repeat(64) }, { reasoningEffort: 'low' }, { nativeResponsesObserved: false }, { providerWireCertified: true },
    { status: 'BLOCKED' }, { schemaVersion: 2 },
  ]) assert.equal(readHermesTaskRuntimeReceipt(output({ ...receipt, ...change }), expected), undefined);
  assert.equal(readHermesTaskRuntimeReceipt('not JSON', expected), undefined);
});


test('C07 preflight reports local receipts separately and keeps provider wire and accepted task blocked', () => {
  const expected = { sourceCommit: 'a'.repeat(40), bundleSha256: 'b'.repeat(64), endpointSha256: 'c'.repeat(64),
    modelSha256: 'd'.repeat(64), reasoningEffort: 'high' };
  const taskImages = [{ reference: 'hermes-task:0.22.3', digest: 'sha256:' + 'e'.repeat(64) }];
  const receipt = { schemaVersion: 1 as const, status: 'READY' as const, hermesCommit: pinnedHermesCommit,
    hermesVersion: 'v0.22.3' as const, hermesSdkVersion: '2.24.0' as const, nativeResponsesObserved: true as const,
    providerWireCertified: false as const, hermesExecutableSha256: 'f'.repeat(64), hermesTransportSha256: '1'.repeat(64),
    sourceCommit: expected.sourceCommit, bundleSha256: expected.bundleSha256, imageReference: taskImages[0]!.reference,
    imageDigest: taskImages[0]!.digest, localImageId: taskImages[0]!.digest, endpointSha256: expected.endpointSha256,
    modelSha256: expected.modelSha256, reasoningEffort: expected.reasoningEffort };
  const result = assessTaskRuntimeProbe({ ...expected, taskImages, taskImageStatus: 'ready',
    aceBundleStatus: 'ready', nativeProjectionStatus: 'ready', hermesRuntimeStatus: 'ready',
    hermesRuntimeReceipts: [receipt] });

  assert.equal(result.status, 'not_ready');
  assert.deepEqual(result.stages, {
    taskImages: 'ready', aceBundle: 'ready', nativeProjection: 'ready', hermesRuntime: 'ready',
    bifrostSourceAndPlugin: 'not_run', localNoEgressChain: 'not_run', providerWire: 'not_run', c07TaskOutcome: 'not_run',
  });
  assert.match(result.reason, /provider wire and an independently accepted C07 task outcome remain unverified/u);
});

test('C07 preflight rejects a stale Hermes receipt even when upstream checks report ready', () => {
  const expected = { sourceCommit: 'a'.repeat(40), bundleSha256: 'b'.repeat(64), endpointSha256: 'c'.repeat(64),
    modelSha256: 'd'.repeat(64), reasoningEffort: 'high' };
  const taskImages = [{ reference: 'hermes-task:0.22.3', digest: 'sha256:' + 'e'.repeat(64) }];
  const receipt = { schemaVersion: 1 as const, status: 'READY' as const, hermesCommit: pinnedHermesCommit,
    hermesVersion: 'v0.22.3' as const, hermesSdkVersion: '2.24.0' as const, nativeResponsesObserved: true as const,
    providerWireCertified: false as const, hermesExecutableSha256: 'f'.repeat(64), hermesTransportSha256: '1'.repeat(64),
    sourceCommit: '9'.repeat(40), bundleSha256: expected.bundleSha256, imageReference: taskImages[0]!.reference,
    imageDigest: taskImages[0]!.digest, localImageId: taskImages[0]!.digest, endpointSha256: expected.endpointSha256,
    modelSha256: expected.modelSha256, reasoningEffort: expected.reasoningEffort };

  const result = assessTaskRuntimeProbe({ ...expected, taskImages, taskImageStatus: 'ready',
    aceBundleStatus: 'ready', nativeProjectionStatus: 'ready', hermesRuntimeStatus: 'ready',
    hermesRuntimeReceipts: [receipt] });

  assert.equal(result.status, 'not_ready');
  assert.equal(result.stages.hermesRuntime, 'not_ready');
  assert.equal(result.stages.providerWire, 'not_run');
});


test('C07 preflight treats malformed task-image identity as blocked evidence', () => {
  const result = assessTaskRuntimeProbe({ sourceCommit: 'a'.repeat(40), bundleSha256: 'b'.repeat(64),
    endpointSha256: 'c'.repeat(64), modelSha256: 'd'.repeat(64), reasoningEffort: 'high',
    taskImages: [{ reference: undefined as unknown as string, digest: 'sha256:' + 'e'.repeat(64) }],
    taskImageStatus: 'ready', aceBundleStatus: 'ready', nativeProjectionStatus: 'ready',
    hermesRuntimeStatus: 'ready', hermesRuntimeReceipts: [] });

  assert.equal(result.status, 'not_ready');
  assert.equal(result.stages.taskImages, 'not_ready');
  assert.equal(result.stages.hermesRuntime, 'not_ready');
});


test('C07 preflight rejects a null task-image entry without throwing', () => {
  const result = assessTaskRuntimeProbe({ sourceCommit: 'a'.repeat(40), bundleSha256: 'b'.repeat(64),
    endpointSha256: 'c'.repeat(64), modelSha256: 'd'.repeat(64), reasoningEffort: 'high',
    taskImages: [null as unknown as { readonly reference: string; readonly digest: string }],
    taskImageStatus: 'ready', aceBundleStatus: 'ready', nativeProjectionStatus: 'ready',
    hermesRuntimeStatus: 'ready', hermesRuntimeReceipts: [{} as HermesTaskRuntimeReceipt] });

  assert.equal(result.status, 'not_ready');
  assert.equal(result.stages.taskImages, 'not_ready');
  assert.equal(result.stages.hermesRuntime, 'not_ready');
});

test('C07 preflight accepts a bound 64-character source commit identity', () => {
  const expected = { sourceCommit: 'a'.repeat(64), bundleSha256: 'b'.repeat(64), endpointSha256: 'c'.repeat(64),
    modelSha256: 'd'.repeat(64), reasoningEffort: 'high' };
  const taskImages = [{ reference: 'hermes-task:0.22.3', digest: 'sha256:' + 'e'.repeat(64) }];
  const receipt = { schemaVersion: 1 as const, status: 'READY' as const, hermesCommit: pinnedHermesCommit,
    hermesVersion: 'v0.22.3' as const, hermesSdkVersion: '2.24.0' as const, nativeResponsesObserved: true as const,
    providerWireCertified: false as const, hermesExecutableSha256: 'f'.repeat(64), hermesTransportSha256: '1'.repeat(64),
    sourceCommit: expected.sourceCommit, bundleSha256: expected.bundleSha256, imageReference: taskImages[0]!.reference,
    imageDigest: taskImages[0]!.digest, localImageId: taskImages[0]!.digest, endpointSha256: expected.endpointSha256,
    modelSha256: expected.modelSha256, reasoningEffort: expected.reasoningEffort };
  const result = assessTaskRuntimeProbe({ ...expected, taskImages, taskImageStatus: 'ready',
    aceBundleStatus: 'ready', nativeProjectionStatus: 'ready', hermesRuntimeStatus: 'ready',
    hermesRuntimeReceipts: [receipt] });

  assert.equal(result.stages.taskImages, 'ready');
  assert.equal(result.stages.hermesRuntime, 'ready');
  assert.equal(result.status, 'not_ready');
});

test('C07 preflight reports the verified local Bifrost denial chain separately from provider wire and task outcome', () => {
  const expected = { sourceCommit: 'a'.repeat(40), bundleSha256: 'b'.repeat(64), endpointSha256: 'c'.repeat(64),
    modelSha256: 'd'.repeat(64), reasoningEffort: 'high' };
  const runtimeSha256 = '4'.repeat(64);
  const evidence = {
    schemaVersion: 1, status: 'local-native-chain-denied', sourceCommit: expected.sourceCommit,
    bifrostCommit: '039f8964b3b8312170fbeb01d6fcbf7a556cdccd',
    bifrostCatalogClean: true,
    bifrostBinarySha256: '2'.repeat(64), bifrostPluginSha256: '3'.repeat(64),
    bifrostConfigSha256: '1'.repeat(64),
    aceRuntimeSha256: runtimeSha256, runtimeProvenanceSha256: '5'.repeat(64), aceEntrypointSha256: runtimeSha256,
    plugin: { name: 'ace-bifrost-context', placement: 'post_builtin', order: 0, invoked: true },
    networkIsolation: 'loopback_only', physicalAttemptCount: 1, projectionCount: 1, deliveredEventCount: 1,
    nativeCbmSearchObserved: true, fixtureSourceDigest: '6'.repeat(64),
    hermes: { schemaVersion: 1, status: 'READY', hermesCommit: pinnedHermesCommit, hermesVersion: 'v0.22.3',
      hermesSdkVersion: '2.24.0', hermesExecutableSha256: '7'.repeat(64), hermesTransportSha256: '8'.repeat(64),
      endpointSha256: expected.endpointSha256, modelSha256: expected.modelSha256, reasoningEffort: expected.reasoningEffort,
      nativeResponsesObserved: true, providerWireCertified: false, localChainObserved: true,
      physicalDenialObserved: true, ingressBodySha256: '9'.repeat(64) },
    requestId: 'ace-' + 'a'.repeat(32), attemptId: 'bf-attempt-' + 'b'.repeat(32),
    baseBodySha256: '9'.repeat(64), preparedBodySha256: 'c'.repeat(64), finalBodySha256: 'c'.repeat(64),
    projectionReceiptSha256: 'd'.repeat(64), retrievalTraceSha256: 'e'.repeat(64),
    terminalReceiptSha256: 'f'.repeat(64), policyAuditSha256: '0'.repeat(64),
    reasonCode: 'DESTINATION_NOT_ALLOWED', providerWireCertified: false,
  };
  const input = { ...expected, taskImages: [], taskImageStatus: 'not_ready' as const,
    aceBundleStatus: 'not_ready' as const, nativeProjectionStatus: 'not_ready' as const,
    hermesRuntimeStatus: 'not_ready' as const, hermesRuntimeReceipts: [],
    localChainEvidenceStatus: 'loaded', localChainEvidence: evidence, expectedRuntimeSha256: runtimeSha256,
  } as unknown as Parameters<typeof assessTaskRuntimeProbe>[0];
  const result = assessTaskRuntimeProbe(input);

  assert.equal(result.status, 'not_ready');
  assert.equal(result.stages.bifrostSourceAndPlugin, 'ready');
  assert.equal(result.stages.localNoEgressChain, 'ready');
  assert.equal(result.stages.providerWire, 'not_run');
  assert.equal(result.stages.c07TaskOutcome, 'not_run');

  const alteredDelivery = assessTaskRuntimeProbe({ ...input,
    localChainEvidence: { ...evidence, finalBodySha256: 'f'.repeat(64) } });
  assert.equal(alteredDelivery.stages.bifrostSourceAndPlugin, 'ready');
  assert.equal(alteredDelivery.stages.localNoEgressChain, 'not_ready');
});

test('C07 preflight rejects a caller-supplied ready flag without the local chain bindings', () => {
  const result = assessTaskRuntimeProbe({ sourceCommit: 'a'.repeat(40), bundleSha256: 'b'.repeat(64),
    endpointSha256: 'c'.repeat(64), modelSha256: 'd'.repeat(64), reasoningEffort: 'high',
    taskImages: [], taskImageStatus: 'not_ready', aceBundleStatus: 'not_ready', nativeProjectionStatus: 'not_ready',
    hermesRuntimeStatus: 'not_ready', hermesRuntimeReceipts: [], localChainEvidenceStatus: 'loaded',
    localChainEvidence: { status: 'ready' }, expectedRuntimeSha256: '4'.repeat(64),
  } as unknown as Parameters<typeof assessTaskRuntimeProbe>[0]);

  assert.equal(result.stages.bifrostSourceAndPlugin, 'not_ready');
  assert.equal(result.stages.localNoEgressChain, 'not_ready');
});

test('C07 preflight rejects altered, stale, or provider-certified local chain evidence', () => {
  const expected = { sourceCommit: 'a'.repeat(40), bundleSha256: 'b'.repeat(64), endpointSha256: 'c'.repeat(64),
    modelSha256: 'd'.repeat(64), reasoningEffort: 'high' };
  const runtimeSha256 = '4'.repeat(64);
  const base = {
    schemaVersion: 1, status: 'local-native-chain-denied', sourceCommit: expected.sourceCommit,
    bifrostCommit: '039f8964b3b8312170fbeb01d6fcbf7a556cdccd', bifrostCatalogClean: true,
    bifrostBinarySha256: '2'.repeat(64), bifrostPluginSha256: '3'.repeat(64), aceRuntimeSha256: runtimeSha256,
    bifrostConfigSha256: '1'.repeat(64),
    runtimeProvenanceSha256: '5'.repeat(64), aceEntrypointSha256: runtimeSha256,
    plugin: { name: 'ace-bifrost-context', placement: 'post_builtin', order: 0, invoked: true },
    networkIsolation: 'loopback_only', physicalAttemptCount: 1, projectionCount: 1, deliveredEventCount: 1,
    nativeCbmSearchObserved: true, fixtureSourceDigest: '6'.repeat(64),
    hermes: { schemaVersion: 1, status: 'READY', hermesCommit: pinnedHermesCommit, hermesVersion: 'v0.22.3',
      hermesSdkVersion: '2.24.0', hermesExecutableSha256: '7'.repeat(64), hermesTransportSha256: '8'.repeat(64),
      endpointSha256: expected.endpointSha256, modelSha256: expected.modelSha256, reasoningEffort: expected.reasoningEffort,
      nativeResponsesObserved: true, providerWireCertified: false, localChainObserved: true,
      physicalDenialObserved: true, ingressBodySha256: '9'.repeat(64) },
    requestId: 'ace-' + 'a'.repeat(32), attemptId: 'bf-attempt-' + 'b'.repeat(32),
    baseBodySha256: '9'.repeat(64), preparedBodySha256: 'c'.repeat(64), finalBodySha256: 'c'.repeat(64),
    projectionReceiptSha256: 'd'.repeat(64), retrievalTraceSha256: 'e'.repeat(64),
    terminalReceiptSha256: 'f'.repeat(64), policyAuditSha256: '0'.repeat(64),
    reasonCode: 'DESTINATION_NOT_ALLOWED', providerWireCertified: false,
  };
  for (const { evidence, bifrostStatus } of [
    { evidence: { ...base, sourceCommit: 'f'.repeat(40) }, bifrostStatus: 'not_ready' },
    { evidence: { ...base, bifrostCommit: 'f'.repeat(40) }, bifrostStatus: 'not_ready' },
    { evidence: { ...base, plugin: { ...base.plugin, invoked: false } }, bifrostStatus: 'not_ready' },
    { evidence: { ...base, aceEntrypointSha256: 'f'.repeat(64) }, bifrostStatus: 'ready' },
    { evidence: { ...base, finalBodySha256: 'f'.repeat(64) }, bifrostStatus: 'ready' },
    { evidence: { ...base, reasonCode: 'OTHER_DENIAL' }, bifrostStatus: 'ready' },
    { evidence: { ...base, providerWireCertified: true }, bifrostStatus: 'ready' },
    { evidence: { ...base, networkIsolation: 'host_network' }, bifrostStatus: 'ready' },
  ]) {
    const result = assessTaskRuntimeProbe({ ...expected, taskImages: [], taskImageStatus: 'not_ready',
      aceBundleStatus: 'not_ready', nativeProjectionStatus: 'not_ready', hermesRuntimeStatus: 'not_ready',
      hermesRuntimeReceipts: [], localChainEvidenceStatus: 'loaded', localChainEvidence: evidence,
      expectedRuntimeSha256: runtimeSha256 });
    assert.equal(result.stages.bifrostSourceAndPlugin, bifrostStatus);
    assert.equal(result.stages.localNoEgressChain, 'not_ready');
    assert.equal(result.stages.providerWire, 'not_run');
    assert.equal(result.stages.c07TaskOutcome, 'not_run');
  }
});
