import assert from 'node:assert/strict';
import test from 'node:test';
import { assessTaskRuntimeProbe, pinnedHermesCommit, readHermesTaskRuntimeReceipt } from '../src/domain/hermes-task-runtime-probe.js';

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
