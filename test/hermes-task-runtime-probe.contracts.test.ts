import assert from 'node:assert/strict';
import test from 'node:test';
import { pinnedHermesCommit, validateHermesTaskRuntimeReceipt } from '../src/domain/hermes-task-runtime-probe.js';

test('local Hermes task probe is pinned to installed version, executable, endpoint, model and immutable task image', () => {
  const expected = { sourceCommit: 'a'.repeat(40), bundleSha256: 'b'.repeat(64), reference: 'task:1',
    digest: 'sha256:' + 'c'.repeat(64), endpointSha256: 'd'.repeat(64), modelSha256: 'e'.repeat(64) };
  const receipt = { schemaVersion: 1, status: 'READY', hermesCommit: pinnedHermesCommit,
    hermesVersion: 'v0.22.3', hermesSdkVersion: '2.24.0', nativeResponsesObserved: true,
    providerWireCertified: false, hermesExecutableSha256: 'f'.repeat(64), hermesTransportSha256: '1'.repeat(64),
    sourceCommit: expected.sourceCommit, bundleSha256: expected.bundleSha256,
    imageReference: expected.reference, imageDigest: expected.digest, localImageId: expected.digest,
    endpointSha256: expected.endpointSha256, modelSha256: expected.modelSha256 };
  const output = (value: unknown): string => 'fixture output\r\n' + JSON.stringify(value) + '\n';
  assert.equal(validateHermesTaskRuntimeReceipt(output(receipt), expected), true);
  for (const change of [
    { hermesCommit: 'a'.repeat(40) }, { hermesVersion: 'v0.22.2' }, { hermesSdkVersion: '2.23.0' },
    { hermesExecutableSha256: '' }, { hermesTransportSha256: 'unknown' }, { localImageId: 'task:mutable' },
    { sourceCommit: 'f'.repeat(40) }, { bundleSha256: 'f'.repeat(64) }, { imageReference: 'task:2' },
    { imageDigest: 'sha256:' + 'f'.repeat(64) }, { endpointSha256: 'f'.repeat(64) },
    { modelSha256: 'f'.repeat(64) }, { nativeResponsesObserved: false }, { providerWireCertified: true },
    { status: 'BLOCKED' }, { schemaVersion: 2 },
  ]) assert.equal(validateHermesTaskRuntimeReceipt(output({ ...receipt, ...change }), expected), false);
  assert.equal(validateHermesTaskRuntimeReceipt('not JSON', expected), false);
});
