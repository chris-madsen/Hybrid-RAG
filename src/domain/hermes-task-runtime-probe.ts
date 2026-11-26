/** Local task-runtime probe receipt. It cannot establish provider wire or agent acceptance. */
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
export const pinnedHermesCommit = '5b147ab036d6d19131bff8d20701b5001eab844a';
export interface HermesTaskRuntimeReceipt {
  readonly schemaVersion: 1;
  readonly status: 'READY';
  readonly hermesCommit: string;
  readonly hermesVersion: 'v0.22.3';
  readonly hermesSdkVersion: '2.24.0';
  readonly nativeResponsesObserved: true;
  readonly providerWireCertified: false;
  readonly hermesExecutableSha256: string;
  readonly hermesTransportSha256: string;
  readonly sourceCommit: string;
  readonly bundleSha256: string;
  readonly imageReference: string;
  readonly imageDigest: string;
  readonly localImageId: string;
  readonly endpointSha256: string;
  readonly modelSha256: string;
  readonly reasoningEffort: string;
}

export const readHermesTaskRuntimeReceipt = (stdout: string, expected: {
  readonly sourceCommit: string;
  readonly bundleSha256: string;
  readonly reference: string;
  readonly digest: string;
  readonly endpointSha256: string;
  readonly modelSha256: string;
  readonly reasoningEffort: string;
}): HermesTaskRuntimeReceipt | undefined => {
  try {
    const raw = JSON.parse(stdout.trim().split(/\r?\n/u).at(-1) ?? '') as unknown;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
    const receipt = raw as Record<string, unknown>;
    const valid = receipt.schemaVersion === 1 && receipt.status === 'READY'
      && receipt.hermesCommit === pinnedHermesCommit && receipt.hermesVersion === 'v0.22.3'
      && receipt.hermesSdkVersion === '2.24.0' && receipt.nativeResponsesObserved === true
      && receipt.providerWireCertified === false
      && digest(receipt.hermesExecutableSha256) && digest(receipt.hermesTransportSha256)
      && receipt.sourceCommit === expected.sourceCommit && receipt.bundleSha256 === expected.bundleSha256
      && receipt.imageReference === expected.reference && receipt.imageDigest === expected.digest
      && typeof receipt.localImageId === 'string' && /^sha256:[a-f0-9]{64}$/u.test(receipt.localImageId)
      && receipt.endpointSha256 === expected.endpointSha256 && receipt.modelSha256 === expected.modelSha256
      && receipt.reasoningEffort === expected.reasoningEffort;
    if (!valid) return undefined;
    // Persist only the validated, source-redacted evidence, never arbitrary process output.
    if (!digest(receipt.hermesExecutableSha256) || !digest(receipt.hermesTransportSha256)
      || typeof receipt.localImageId !== 'string') return undefined;
    return {
      schemaVersion: 1, status: 'READY', hermesCommit: pinnedHermesCommit,
      hermesVersion: 'v0.22.3', hermesSdkVersion: '2.24.0',
      nativeResponsesObserved: true, providerWireCertified: false,
      hermesExecutableSha256: receipt.hermesExecutableSha256, hermesTransportSha256: receipt.hermesTransportSha256,
      sourceCommit: expected.sourceCommit, bundleSha256: expected.bundleSha256,
      imageReference: expected.reference, imageDigest: expected.digest, localImageId: receipt.localImageId,
      endpointSha256: expected.endpointSha256, modelSha256: expected.modelSha256, reasoningEffort: expected.reasoningEffort,
    };
  } catch {
    return undefined;
  }
};

