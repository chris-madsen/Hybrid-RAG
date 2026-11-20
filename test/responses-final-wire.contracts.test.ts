import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import type {
  NativeResponsesFinalWireEvidence,
  NativeResponsesFinalWireProof,
} from '../src/domain/provider-trace-receipt.js';
import {
  bindNativeResponsesFinalWireReceiptToContext,
  evaluateNativeResponsesFinalWireEvidence,
} from '../src/domain/provider-trace-receipt.js';
// eslint-disable-next-line import/extensions -- NodeNext pairs the .mjs runtime with .d.mts types.
import { verifyFinalWireEvidenceEnvelope } from '../scripts/real-provider-evidence.mjs';

const digest = (character: string): string => character.repeat(64);
const requestId = `ace-${'1'.repeat(32)}`;
const attemptId = `bf-attempt-${'2'.repeat(32)}`;

const manifest = (
  overrides: Partial<NativeResponsesFinalWireEvidence> = {},
): NativeResponsesFinalWireEvidence => ({
  schemaVersion: 1,
  evidenceKind: 'mock',
  sourceCommit: 'a'.repeat(40),
  bifrostCommit: 'b'.repeat(40),
  aceRuntimeSha256: digest('1'),
  bifrostPluginSha256: digest('2'),
  pluginOrderSha256: digest('c'),
  requestId,
  attemptId,
  protocol: 'openai.responses',
  provider: 'openai',
  model: 'gpt-5.6-sol',
  dataClass: 'public',
  destinationSha256: digest('d'),
  ingressBodySha256: digest('e'),
  preparedBodySha256: digest('f'),
  preparedBodySemanticSha256: digest('f'),
  finalWireBodySha256: digest('f'),
  finalWireBodySemanticSha256: digest('f'),
  serializedRequestSha256: digest('7'),
  capturePoint: 'mock-server-after-tls-decryption',
  physicalSendAuthorized: true,
  pluginOrderVerified: true,
  storeFalseVerified: true,
  nonStreamingVerified: true,
  protectedItemsVerified: true,
  providerAcknowledgement: {
    kind: 'mock',
    statusCode: 200,
    requestId,
    attemptId,
    providerRequestId: 'resp_mock_123',
  },
  ...overrides,
});

const mockProof = (value: NativeResponsesFinalWireEvidence): NativeResponsesFinalWireProof => ({
  kind: 'mock-capture',
  finalWireBodySha256: value.finalWireBodySha256,
  serializedRequestSha256: value.serializedRequestSha256,
});

test('a captured mock final wire is verified as mock evidence, never real provider evidence', () => {
  const evidence = manifest();
  const result = evaluateNativeResponsesFinalWireEvidence(evidence, mockProof(evidence));
  if (result._tag !== 'Ok') throw new Error(result.error.message);
  assert.equal(result.value.status, 'MOCK_WIRE_VERIFIED');
  assert.equal(result.value.requestId, requestId);
  assert.equal(result.value.attemptId, attemptId);
});

test('final-wire receipt must correlate to the context-bundle request identity', () => {
  const evidence = manifest();
  const result = evaluateNativeResponsesFinalWireEvidence(evidence, mockProof(evidence));
  if (result._tag !== 'Ok') throw new Error(result.error.message);
  const bound = bindNativeResponsesFinalWireReceiptToContext(result.value, `ace-${'4'.repeat(32)}`);
  assert.equal(bound.status, 'NOT_CERTIFIED');
  assert.ok(bound.reasonCodes.includes('CONTEXT_REQUEST_ID_MISMATCH'));
});

test('final-wire evidence rejects raw prompt or body fields', () => {
  const evidence = { ...manifest(), rawBody: 'private prompt and source text' };
  const result = evaluateNativeResponsesFinalWireEvidence(evidence, mockProof(manifest()));
  assert.equal(result._tag, 'Err');

  const rawAcknowledgement = manifest({
    providerAcknowledgement: {
      kind: 'mock',
      statusCode: 200,
      requestId,
      attemptId,
      providerRequestId: 'private source query text',
    },
  });
  assert.equal(evaluateNativeResponsesFinalWireEvidence(rawAcknowledgement, mockProof(rawAcknowledgement))._tag, 'Err');
});

test('a body changed after ACE preparation cannot be certified as final wire', () => {
  const evidence = manifest({ finalWireBodySemanticSha256: digest('8') });
  const result = evaluateNativeResponsesFinalWireEvidence(evidence, mockProof(evidence));
  if (result._tag !== 'Ok') throw new Error(result.error.message);
  assert.equal(result.value.status, 'NOT_CERTIFIED');
  assert.ok(result.value.reasonCodes.includes('FINAL_BODY_SEMANTIC_MISMATCH'));
});

test('Bifrost JSON serialization may change raw formatting but not final body semantics', () => {
  const evidence = manifest({ finalWireBodySha256: digest('8') });
  const result = evaluateNativeResponsesFinalWireEvidence(evidence, mockProof(evidence));
  if (result._tag !== 'Ok') throw new Error(result.error.message);
  assert.equal(result.value.status, 'MOCK_WIRE_VERIFIED');
  assert.equal(result.value.preparedBodySha256, digest('f'));
  assert.equal(result.value.finalWireBodySha256, digest('8'));
});

test('unobserved plugin order, missing guard or unsupported wire mode remains uncertified', () => {
  for (const evidence of [
    manifest({ pluginOrderVerified: false }),
    manifest({ physicalSendAuthorized: false }),
    manifest({ storeFalseVerified: false }),
    manifest({ nonStreamingVerified: false }),
    manifest({ protectedItemsVerified: false }),
  ]) {
    const result = evaluateNativeResponsesFinalWireEvidence(evidence, mockProof(evidence as ReturnType<typeof manifest>));
    if (result._tag !== 'Ok') throw new Error(result.error.message);
    assert.equal(result.value.status, 'NOT_CERTIFIED');
  }
});

test('a synthetic signed provider manifest remains a candidate without pinned signer/runtime identity', () => {
  const evidence = manifest({
    evidenceKind: 'real_provider',
    capturePoint: 'contextTransport-before-tls-write',
    providerAcknowledgement: {
      kind: 'real_provider',
      statusCode: 200,
      requestId,
      attemptId,
      providerRequestId: 'resp_live_123',
    },
  });
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const payloadBytes = Buffer.from(JSON.stringify(evidence), 'utf8');
  const envelope = {
    schemaVersion: 1,
    payloadBase64: payloadBytes.toString('base64'),
    signatureBase64: sign(null, payloadBytes, privateKey).toString('base64'),
  };
  const verificationPublicKey = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const verified = verifyFinalWireEvidenceEnvelope(
    envelope, verificationPublicKey, evaluateNativeResponsesFinalWireEvidence,
  );
  assert.equal(verified.receipt.status, 'REAL_PROVIDER_CANDIDATE');
  assert.ok(verified.receipt.reasonCodes.includes('SIGNER_IDENTITY_NOT_OPERATOR_PINNED'));
  assert.ok(verified.receipt.reasonCodes.includes('CURRENT_RUNTIME_IDENTITY_NOT_BOUND'));
});

test('tampered or unsigned final-wire manifests fail closed', () => {
  const evidence = manifest({
    evidenceKind: 'real_provider',
    capturePoint: 'contextTransport-before-tls-write',
    providerAcknowledgement: {
      kind: 'real_provider',
      statusCode: 200,
      requestId,
      attemptId,
      providerRequestId: 'resp_live_123',
    },
  });
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const signedBytes = Buffer.from(JSON.stringify(evidence), 'utf8');
  const signatureBase64 = sign(null, signedBytes, privateKey).toString('base64');
  const verificationPublicKey = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const tamperedBytes = Buffer.from(JSON.stringify({ ...evidence, pluginOrderVerified: false }), 'utf8');

  assert.throws(() => verifyFinalWireEvidenceEnvelope({
    schemaVersion: 1,
    payloadBase64: tamperedBytes.toString('base64'),
    signatureBase64,
  }, verificationPublicKey, evaluateNativeResponsesFinalWireEvidence), /signature/u);
  assert.throws(() => verifyFinalWireEvidenceEnvelope({
    schemaVersion: 1,
    payloadBase64: signedBytes.toString('base64'),
    signatureBase64: '',
  }, verificationPublicKey, evaluateNativeResponsesFinalWireEvidence), /signature/u);
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  assert.throws(() => verifyFinalWireEvidenceEnvelope({
    schemaVersion: 1,
    payloadBase64: signedBytes.toString('base64'),
    signatureBase64,
  }, privateKeyPem, evaluateNativeResponsesFinalWireEvidence), /envelope/u);
});

test('a real-provider claim without a cryptographically verified envelope stays a candidate', () => {
  const evidence = manifest({
    evidenceKind: 'real_provider',
    capturePoint: 'contextTransport-before-tls-write',
    providerAcknowledgement: {
      kind: 'real_provider',
      statusCode: 200,
      requestId,
      attemptId,
      providerRequestId: 'resp_live_123',
    },
  });
  const result = evaluateNativeResponsesFinalWireEvidence(evidence, {
    kind: 'signed-provider-capture',
    signerKeySha256: digest('9'),
    finalWireBodySha256: evidence.finalWireBodySha256,
    serializedRequestSha256: evidence.serializedRequestSha256,
  });
  if (result._tag !== 'Ok') throw new Error(result.error.message);
  assert.equal(result.value.status, 'REAL_PROVIDER_CANDIDATE');
});

test('private-data and mock-provider receipts cannot certify the public C05 route', () => {
  const privateEvidence = manifest({
    evidenceKind: 'real_provider',
    capturePoint: 'contextTransport-before-tls-write',
    dataClass: 'private',
    providerAcknowledgement: {
      kind: 'real_provider', statusCode: 200, requestId, attemptId, providerRequestId: 'resp_live_123',
    },
  });
  const privateResult = evaluateNativeResponsesFinalWireEvidence(privateEvidence, {
    kind: 'signed-provider-capture', signerKeySha256: digest('9'),
    finalWireBodySha256: privateEvidence.finalWireBodySha256,
    serializedRequestSha256: privateEvidence.serializedRequestSha256,
  });
  if (privateResult._tag !== 'Ok') throw new Error(privateResult.error.message);
  assert.ok(privateResult.value.reasonCodes.includes('PUBLIC_DATA_REQUIRED'));

  const mockProviderEvidence = manifest({
    evidenceKind: 'real_provider',
    capturePoint: 'contextTransport-before-tls-write',
    provider: 'mock',
    providerAcknowledgement: {
      kind: 'real_provider', statusCode: 200, requestId, attemptId, providerRequestId: 'resp_mock_123',
    },
  });
  const mockProviderResult = evaluateNativeResponsesFinalWireEvidence(mockProviderEvidence, {
    kind: 'signed-provider-capture', signerKeySha256: digest('9'),
    finalWireBodySha256: mockProviderEvidence.finalWireBodySha256,
    serializedRequestSha256: mockProviderEvidence.serializedRequestSha256,
  });
  if (mockProviderResult._tag !== 'Ok') throw new Error(mockProviderResult.error.message);
  assert.equal(mockProviderResult.value.status, 'NOT_CERTIFIED');
  assert.ok(mockProviderResult.value.reasonCodes.includes('MOCK_PROVIDER_CANNOT_BE_REAL'));
});

test('a provider acknowledgement from another attempt cannot certify this send', () => {
  const evidence = manifest({
    evidenceKind: 'real_provider',
    capturePoint: 'contextTransport-before-tls-write',
    providerAcknowledgement: {
      kind: 'real_provider',
      statusCode: 200,
      requestId,
      attemptId: `bf-attempt-${'3'.repeat(32)}`,
      providerRequestId: 'resp_live_123',
    },
  });
  const result = evaluateNativeResponsesFinalWireEvidence(evidence, {
    kind: 'signed-provider-capture',
    signerKeySha256: digest('9'),
    finalWireBodySha256: evidence.finalWireBodySha256,
    serializedRequestSha256: evidence.serializedRequestSha256,
  });
  if (result._tag !== 'Ok') throw new Error(result.error.message);
  assert.equal(result.value.status, 'NOT_CERTIFIED');
  assert.ok(result.value.reasonCodes.includes('ATTEMPT_ACK_MISMATCH'));
});


test('C05 a self-signed mock manifest is not independent evidence of a captured wire', () => {
  const evidence = manifest();
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const payloadBytes = Buffer.from(JSON.stringify(evidence), 'utf8');
  const verified = verifyFinalWireEvidenceEnvelope({
    schemaVersion: 1,
    payloadBase64: payloadBytes.toString('base64'),
    signatureBase64: sign(null, payloadBytes, privateKey).toString('base64'),
  }, publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  evaluateNativeResponsesFinalWireEvidence);
  assert.equal(verified.proof.kind, 'signed-manifest-only');
  assert.equal(verified.receipt.status, 'NOT_CERTIFIED');
  assert.ok(verified.receipt.reasonCodes.includes('MOCK_CAPTURE_PROOF_REQUIRED'));
  // A separately captured and verified mock wire remains a valid mock-only
  // signal, but cannot be inferred from a signed assertion.
  const observed = evaluateNativeResponsesFinalWireEvidence(evidence, mockProof(evidence));
  assert.equal(observed._tag, 'Ok');
  if (observed._tag === 'Ok') assert.equal(observed.value.status, 'MOCK_WIRE_VERIFIED');
});
