/** Local task-runtime probe receipt. It cannot establish provider wire or agent acceptance. */
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
export const pinnedHermesCommit = '5b147ab036d6d19131bff8d20701b5001eab844a';
export const pinnedBifrostCommit = '039f8964b3b8312170fbeb01d6fcbf7a556cdccd';
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
  readonly bifrostSourceAndPlugin: TaskRuntimeProbeStageStatus;
  readonly localNoEgressChain: TaskRuntimeProbeStageStatus;
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
  readonly localChainEvidenceStatus?: 'not_run' | 'loaded' | 'unavailable';
  readonly localChainEvidence?: unknown;
  readonly expectedRuntimeSha256?: string;
}

interface LocalChainExpectation {
  readonly sourceCommit: string;
  readonly endpointSha256: string | undefined;
  readonly modelSha256: string | undefined;
  readonly reasoningEffort: string | undefined;
  readonly runtimeSha256: string | undefined;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validBifrostSourceAndPluginEvidence = (value: unknown, expected: LocalChainExpectation): boolean => {
  if (!record(value) || !record(value.plugin)) return false;
  const plugin = value.plugin;
  const sourceCommitValid = /^[a-f0-9]{40,64}$/u.test(expected.sourceCommit);
  return sourceCommitValid && value.schemaVersion === 1 && value.status === 'local-native-chain-denied'
    && value.sourceCommit === expected.sourceCommit
    && value.bifrostCommit === pinnedBifrostCommit && value.bifrostCatalogClean === true
    && digest(value.bifrostBinarySha256) && digest(value.bifrostPluginSha256) && digest(value.bifrostConfigSha256)
    && plugin.name === 'ace-bifrost-context' && plugin.placement === 'post_builtin'
    && plugin.order === 0 && plugin.invoked === true;
};

const validLocalNoEgressEvidence = (value: unknown, expected: LocalChainExpectation): boolean => {
  if (!validBifrostSourceAndPluginEvidence(value, expected) || !record(value) || !record(value.hermes)) return false;
  const hermes = value.hermes;
  return expected.runtimeSha256 !== undefined && digest(expected.runtimeSha256)
    && value.aceRuntimeSha256 === expected.runtimeSha256
    && value.aceEntrypointSha256 === expected.runtimeSha256 && digest(value.runtimeProvenanceSha256)
    && value.networkIsolation === 'loopback_only'
    && value.physicalAttemptCount === 1 && value.projectionCount === 1 && value.deliveredEventCount === 1
    && value.nativeCbmSearchObserved === true && digest(value.fixtureSourceDigest)
    && hermes.schemaVersion === 1 && hermes.status === 'READY'
    && hermes.hermesCommit === pinnedHermesCommit && hermes.hermesVersion === 'v0.22.3'
    && hermes.hermesSdkVersion === '2.24.0'
    && digest(hermes.hermesExecutableSha256) && digest(hermes.hermesTransportSha256)
    && hermes.endpointSha256 === expected.endpointSha256 && digest(expected.endpointSha256)
    && hermes.modelSha256 === expected.modelSha256 && digest(expected.modelSha256)
    && hermes.reasoningEffort === expected.reasoningEffort
    && hermes.nativeResponsesObserved === true && hermes.providerWireCertified === false
    && hermes.localChainObserved === true && hermes.physicalDenialObserved === true
    && digest(hermes.ingressBodySha256)
    && typeof value.requestId === 'string' && /^ace-[a-f0-9]{32}$/u.test(value.requestId)
    && typeof value.attemptId === 'string' && /^bf-attempt-[a-f0-9]{32}$/u.test(value.attemptId)
    && value.reasonCode === 'DESTINATION_NOT_ALLOWED' && value.providerWireCertified === false
    && digest(value.baseBodySha256) && value.baseBodySha256 === hermes.ingressBodySha256
    && digest(value.preparedBodySha256) && digest(value.finalBodySha256)
    && value.preparedBodySha256 === value.finalBodySha256
    && value.baseBodySha256 !== value.preparedBodySha256
    && digest(value.projectionReceiptSha256) && digest(value.retrievalTraceSha256)
    && digest(value.terminalReceiptSha256) && digest(value.policyAuditSha256);
};

export const assessTaskRuntimeProbe = (input: TaskRuntimeProbeAssessmentInput): TaskRuntimeProbeAssessment => {
  const images = Array.isArray(input.taskImages) ? input.taskImages : [];
  const imagesValid = /^[a-f0-9]{40,64}$/u.test(input.sourceCommit)
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

  const expectedReceipts = imagesValid ? images.map((image) => input.hermesRuntimeReceipts.find((receipt) =>
    receipt.imageReference === image.reference && receipt.imageDigest === image.digest)) : [];
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
  const chainEvidenceStatus = input.localChainEvidenceStatus ?? 'not_run';
  const chainExpectation: LocalChainExpectation = {
    sourceCommit: input.sourceCommit,
    endpointSha256: input.endpointSha256,
    modelSha256: input.modelSha256,
    reasoningEffort: input.reasoningEffort,
    runtimeSha256: input.expectedRuntimeSha256,
  };
  const bifrostEvidenceValid = chainEvidenceStatus === 'loaded'
    && validBifrostSourceAndPluginEvidence(input.localChainEvidence, chainExpectation);
  const chainEvidenceValid = chainEvidenceStatus === 'loaded'
    && validLocalNoEgressEvidence(input.localChainEvidence, chainExpectation);
  const bifrostSourceAndPlugin: TaskRuntimeProbeStageStatus = bifrostEvidenceValid ? 'ready'
    : chainEvidenceStatus === 'not_run' ? 'not_run' : 'not_ready';
  const localNoEgressChain: TaskRuntimeProbeStageStatus = chainEvidenceValid ? 'ready'
    : chainEvidenceStatus === 'not_run' ? 'not_run' : 'not_ready';
  const stages: TaskRuntimeProbeStages = {
    taskImages, aceBundle, nativeProjection, hermesRuntime,
    bifrostSourceAndPlugin, localNoEgressChain,
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
