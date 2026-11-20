import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const finalWireEnvelopeFields = new Set(['schemaVersion', 'payloadBase64', 'signatureBase64']);
const canonicalBase64 = (value) => typeof value === 'string'
  && /^[A-Za-z0-9+/]+={0,2}$/u.test(value)
  && Buffer.from(value, 'base64').toString('base64') === value;

// The verification key is supplied separately; signature integrity alone is not provider trust.
export const verifyFinalWireEvidenceEnvelope = (raw, verificationPublicKeyPem, evaluateEvidence) => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)
    || Object.keys(raw).some((key) => !finalWireEnvelopeFields.has(key))
    || raw.schemaVersion !== 1
    || !canonicalBase64(raw.payloadBase64)
    || typeof verificationPublicKeyPem !== 'string'
    || !verificationPublicKeyPem.includes('-----BEGIN PUBLIC KEY-----')
    || verificationPublicKeyPem.includes('PRIVATE KEY')
    || typeof evaluateEvidence !== 'function') {
    throw new Error('final-wire evidence envelope is invalid');
  }
  if (!canonicalBase64(raw.signatureBase64)) {
    throw new Error('final-wire evidence signature encoding is invalid');
  }
  const payloadBytes = Buffer.from(raw.payloadBase64, 'base64');
  const signature = Buffer.from(raw.signatureBase64, 'base64');
  if (payloadBytes.length === 0 || payloadBytes.length > 64 * 1024 || signature.length !== 64) {
    throw new Error('final-wire evidence envelope exceeds its bound or has an invalid signature');
  }
  let publicKey;
  try {
    publicKey = createPublicKey(verificationPublicKeyPem);
  } catch {
    throw new Error('final-wire verification public key is invalid');
  }
  if (publicKey.asymmetricKeyType !== 'ed25519' || !verifySignature(null, payloadBytes, publicKey, signature)) {
    throw new Error('final-wire evidence signature verification failed');
  }
  let payload;
  try {
    const payloadText = payloadBytes.toString('utf8');
    if (!Buffer.from(payloadText, 'utf8').equals(payloadBytes)) {
      throw new Error('invalid UTF-8');
    }
    payload = JSON.parse(payloadText);
  } catch {
    throw new Error('signed final-wire evidence payload is invalid JSON');
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('signed final-wire evidence payload must be an object');
  }
  const signerKeySha256 = createHash('sha256')
    .update(publicKey.export({ type: 'spki', format: 'der' }))
    .digest('hex');
  const proof = payload.evidenceKind === 'mock'
    ? { kind: 'mock-capture', finalWireBodySha256: payload.finalWireBodySha256,
      serializedRequestSha256: payload.serializedRequestSha256 }
    : { kind: 'signed-provider-capture', signerKeySha256,
      finalWireBodySha256: payload.finalWireBodySha256,
      serializedRequestSha256: payload.serializedRequestSha256 };
  const evaluated = evaluateEvidence(payload, proof);
  if (typeof evaluated !== 'object' || evaluated === null || evaluated._tag !== 'Ok'
    || typeof evaluated.value !== 'object' || evaluated.value === null) {
    throw new Error('signed final-wire evidence does not satisfy its contract');
  }
  const receipt = evaluated.value.status === 'REAL_PROVIDER_CANDIDATE'
    && proof.kind === 'signed-provider-capture'
    ? {
      ...evaluated.value,
      reasonCodes: [...new Set([
        ...evaluated.value.reasonCodes,
        'SIGNER_IDENTITY_NOT_OPERATOR_PINNED',
        'CURRENT_RUNTIME_IDENTITY_NOT_BOUND',
      ])],
    }
    : evaluated.value;
  return { payload, proof, receipt };
};

export const stopAndRetainProviderTraces = async (providers, outputDirectory) => {
  await Promise.all(providers.map(async (provider) => provider.stop?.()));
  if (outputDirectory !== undefined) await mkdir(outputDirectory, { recursive: true });

  const digests = {};
  for (const provider of providers) {
    if (!/^[a-z0-9-]+$/u.test(provider.label)) {
      throw new Error(`invalid provider trace label: ${provider.label}`);
    }
    try {
      const bytes = await readFile(provider.traceFile);
      digests[provider.label] = createHash('sha256').update(bytes).digest('hex');
      if (outputDirectory !== undefined) {
        await copyFile(provider.traceFile, join(outputDirectory, `${provider.label}-provider-trace.jsonl`));
      }
    } catch (cause) {
      if (cause?.code !== 'ENOENT') throw cause;
      digests[provider.label] = undefined;
    }
  }
  return digests;
};
