/** Local task-runtime probe receipt. It cannot establish provider wire or agent acceptance. */
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
export const pinnedHermesCommit = '5b147ab036d6d19131bff8d20701b5001eab844a';
export const validateHermesTaskRuntimeReceipt = (stdout: string, expected: {
  readonly sourceCommit: string;
  readonly bundleSha256: string;
  readonly reference: string;
  readonly digest: string;
  readonly endpointSha256: string;
  readonly modelSha256: string;
}): boolean => {
  try {
    const raw = JSON.parse(stdout.trim().split(/\r?\n/u).at(-1) ?? '') as unknown;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false;
    const receipt = raw as Record<string, unknown>;
    return receipt.schemaVersion === 1 && receipt.status === 'READY'
      && receipt.hermesCommit === pinnedHermesCommit && receipt.hermesVersion === 'v0.22.3'
      && receipt.hermesSdkVersion === '2.24.0' && receipt.nativeResponsesObserved === true
      && receipt.providerWireCertified === false
      && digest(receipt.hermesExecutableSha256) && digest(receipt.hermesTransportSha256)
      && receipt.sourceCommit === expected.sourceCommit && receipt.bundleSha256 === expected.bundleSha256
      && receipt.imageReference === expected.reference && receipt.imageDigest === expected.digest
      && typeof receipt.localImageId === 'string' && /^sha256:[a-f0-9]{64}$/u.test(receipt.localImageId)
      && receipt.endpointSha256 === expected.endpointSha256 && receipt.modelSha256 === expected.modelSha256;
  } catch {
    return false;
  }
};
