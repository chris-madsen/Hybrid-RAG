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



export type TaskRuntimeProbeStageStatus = 'ready' | 'not_ready' | 'not_run';

export interface TaskRuntimeProbeStages {
  readonly taskImages: TaskRuntimeProbeStageStatus;
  readonly aceBundle: TaskRuntimeProbeStageStatus;
  readonly nativeProjection: TaskRuntimeProbeStageStatus;
  readonly hermesRuntime: TaskRuntimeProbeStageStatus;
  readonly bifrostSourceAndPlugin: 'not_run';
  readonly localNoEgressChain: 'not_run';
  readonly providerWire: 'not_run';
  readonly c07TaskOutcome: 'not_run';
}

export interface TaskRuntimeProbeAssessment {
  readonly status: 'not_ready';
  readonly reason: string;
  readonly stages: TaskRuntimeProbeStages;
}

export interface TaskRuntimeProbeAssessmentInput {
  readonly sourceCommit: string;
  readonly bundleSha256: string | undefined;
  readonly endpointSha256: string | undefined;
  readonly modelSha256: string | undefined;
  readonly reasoningEffort: string | undefined;
  readonly taskImages: readonly { readonly reference: string; readonly digest: string }[] | undefined;
  readonly taskImageStatus: 'ready' | 'not_ready' | 'unknown' | 'not_required';
  readonly aceBundleStatus: 'ready' | 'not_ready' | 'unknown' | 'not_required';
  readonly nativeProjectionStatus: 'ready' | 'not_ready' | 'unknown' | 'not_required';
  readonly hermesRuntimeStatus: 'ready' | 'not_ready' | 'unknown' | 'not_required';
  readonly hermesRuntimeReceipts: readonly HermesTaskRuntimeReceipt[];
}

export const assessTaskRuntimeProbe = (input: TaskRuntimeProbeAssessmentInput): TaskRuntimeProbeAssessment => {
  const images = Array.isArray(input.taskImages) ? input.taskImages : [];
  const imagesValid = /^[a-f0-9]{40}$/u.test(input.sourceCommit)
    && Array.isArray(input.taskImages)
    && images.length > 0
    && images.every((image) => typeof image === 'object' && image !== null
      && typeof image.reference === 'string' && image.reference.length > 0
      && typeof image.digest === 'string' && /^sha256:[a-f0-9]{64}$/u.test(image.digest))
    && new Set(images.map((image) => image.reference + '@' + image.digest)).size === images.length;
  const taskImages: TaskRuntimeProbeStageStatus = input.taskImageStatus === 'ready' && imagesValid ? 'ready' : 'not_ready';
  const aceBundle: TaskRuntimeProbeStageStatus = input.aceBundleStatus === 'ready'
    && input.bundleSha256 !== undefined && digest(input.bundleSha256) ? 'ready' : 'not_ready';
  const nativeProjection: TaskRuntimeProbeStageStatus = input.nativeProjectionStatus === 'ready'
    && taskImages === 'ready' && aceBundle === 'ready' ? 'ready' : 'not_ready';

  const expectedReceipts = images.map((image) => input.hermesRuntimeReceipts.find((receipt) =>
    receipt.imageReference === image.reference && receipt.imageDigest === image.digest));
  const receiptsBound = input.hermesRuntimeStatus === 'ready' && imagesValid
    && input.endpointSha256 !== undefined && digest(input.endpointSha256)
    && input.modelSha256 !== undefined && digest(input.modelSha256)
    && input.reasoningEffort !== undefined
    && expectedReceipts.length === input.hermesRuntimeReceipts.length
    && expectedReceipts.every((receipt) => receipt !== undefined
      && receipt.sourceCommit === input.sourceCommit
      && receipt.bundleSha256 === input.bundleSha256
      && receipt.endpointSha256 === input.endpointSha256
      && receipt.modelSha256 === input.modelSha256
      && receipt.reasoningEffort === input.reasoningEffort
      && receipt.nativeResponsesObserved === true
      && receipt.providerWireCertified === false);
  const hermesRuntime: TaskRuntimeProbeStageStatus = receiptsBound ? 'ready' : 'not_ready';
  const stages: TaskRuntimeProbeStages = {
    taskImages, aceBundle, nativeProjection, hermesRuntime,
    bifrostSourceAndPlugin: 'not_run', localNoEgressChain: 'not_run',
    providerWire: 'not_run', c07TaskOutcome: 'not_run',
  };
  const localStagesReady = taskImages === 'ready' && aceBundle === 'ready'
    && nativeProjection === 'ready' && hermesRuntime === 'ready';
  return {
    status: 'not_ready',
    reason: localStagesReady
      ? 'a real, provenance-bound Hermes/Bifröst/ACE task-container probe is still required; pinned task-image, ACE bundle/projection, and Hermes runtime receipts are bound, while provider wire and an independently accepted C07 task outcome remain unverified'
      : 'a real, provenance-bound Hermes/Bifröst/ACE task-container probe is still required; one or more local task-image, ACE bundle/projection, or Hermes runtime receipts are missing, stale, or not bound, and provider wire and an independently accepted C07 task outcome remain unverified',
    stages,
  };
};
