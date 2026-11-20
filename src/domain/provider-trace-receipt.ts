import { domainError, type DomainError } from './errors.js';
import { err, ok, type Result } from './result.js';
import type { ContextSource, SourceCoverage } from './source-coverage.js';
import type { ProviderTraceEvent, ProviderTraceName } from './provider-trace.js';

export interface ProviderTraceBranchReceipt {
  readonly source: ContextSource;
  readonly coverageStatus: SourceCoverage['status'];
  readonly requiredProviders: readonly ProviderTraceName[];
  readonly observedProviders: readonly ProviderTraceName[];
  readonly missingProviders: readonly ProviderTraceName[];
  readonly failedProviders: readonly ProviderTraceName[];
  readonly complete: boolean;
}

export interface ProviderTraceReceipt {
  readonly receipt: 'provider-trace-complete' | 'provider-trace-incomplete';
  readonly requestId: string;
  readonly correlatedEventCount: number;
  readonly requiredSources: readonly ContextSource[];
  readonly branches: readonly ProviderTraceBranchReceipt[];
  readonly failures: readonly string[];
  readonly note: string;
}

const providerNames: readonly ProviderTraceName[] = [
  'embedding',
  'sparse_embedding',
  'reranker',
  'qdrant',
  'ast_grep',
  'lsp',
  'vertex_rag',
  'graphiti',
  'git_history',
  'source_verification',
];

const providerName = (value: unknown): value is ProviderTraceName =>
  typeof value === 'string' && providerNames.includes(value as ProviderTraceName);

const safeMetadata = (value: string): boolean =>
  value.trim().length > 0
  && !/(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|private[_-]?key)\s*[:=]\s*\S+/iu.test(value)
  && !/-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(value);

const allowedKeys = new Set([
  'timestampMs',
  'provider',
  'providerVersion',
  'operation',
  'status',
  'durationMs',
  'requestId',
  'collection',
  'generation',
  'vectorDimension',
  'errorCode',
]);

export const validateSafeProviderTraceEvent = (
  raw: unknown,
): Result<ProviderTraceEvent, DomainError> => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return err(domainError('INVALID_BENCHMARK', 'provider_trace', 'provider trace event must be an object'));
  }
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    return err(domainError(
      'INVALID_BENCHMARK',
      'provider_trace',
      'provider trace contains an unexpected field; raw query/source/token metadata is forbidden',
    ));
  }
  if (!Number.isSafeInteger(value.timestampMs) || (value.timestampMs as number) < 0
    || !providerName(value.provider)
    || typeof value.providerVersion !== 'string' || !safeMetadata(value.providerVersion)
    || typeof value.operation !== 'string' || !safeMetadata(value.operation)
    || (value.status !== 'success' && value.status !== 'failure')
    || typeof value.durationMs !== 'number' || !Number.isFinite(value.durationMs) || value.durationMs < 0
    || (value.requestId !== undefined && (typeof value.requestId !== 'string' || !safeMetadata(value.requestId)))
    || (value.collection !== undefined && (typeof value.collection !== 'string' || !safeMetadata(value.collection)))
    || (value.generation !== undefined && (!Number.isSafeInteger(value.generation) || (value.generation as number) < 0))
    || (value.vectorDimension !== undefined && (!Number.isSafeInteger(value.vectorDimension) || (value.vectorDimension as number) < 1))
    || (value.errorCode !== undefined && (typeof value.errorCode !== 'string' || !safeMetadata(value.errorCode)))) {
    return err(domainError('INVALID_BENCHMARK', 'provider_trace', 'provider trace safe metadata is invalid'));
  }
  return ok(value as unknown as ProviderTraceEvent);
};

const queryProvidersFor = (source: ContextSource): readonly ProviderTraceName[] => {
  switch (source) {
    case 'code':
      return ['embedding', 'qdrant', 'source_verification'];
    case 'structural':
      return ['ast_grep'];
    case 'lsp':
      return ['lsp'];
    case 'documentation':
      return ['vertex_rag'];
    case 'memory':
      return ['graphiti'];
    case 'history':
      return ['git_history'];
  }
};

export const evaluateProviderTraceReceipt = (
  requestId: string,
  sourceCoverage: readonly SourceCoverage[],
  rawEvents: readonly unknown[],
): Result<ProviderTraceReceipt, DomainError> => {
  if (!safeMetadata(requestId)) {
    return err(domainError('INVALID_BENCHMARK', 'request_id', 'provider trace receipt requires a safe request id'));
  }
  const sources = sourceCoverage.map((entry) => entry.source);
  if (sources.length !== new Set(sources).size) {
    return err(domainError('INVALID_BENCHMARK', 'source_coverage', 'source coverage contains duplicate sources'));
  }
  const required = sourceCoverage.filter((entry) => entry.requirement === 'required');
  if (required.length === 0) {
    return err(domainError('INVALID_BENCHMARK', 'source_coverage', 'provider trace receipt requires at least one required source'));
  }

  const events: ProviderTraceEvent[] = [];
  for (const raw of rawEvents) {
    const checked = validateSafeProviderTraceEvent(raw);
    if (checked._tag === 'Err') return checked;
    if (checked.value.requestId === requestId) events.push(checked.value);
  }

  const branches: ProviderTraceBranchReceipt[] = required.map((coverage) => {
    const requiredProviders = queryProvidersFor(coverage.source);
    const matching = events.filter((event) => requiredProviders.includes(event.provider));
    const observedProviders = [...new Set(matching.map((event) => event.provider))]
      .sort() as ProviderTraceName[];
    const missingProviders = requiredProviders.filter((provider) =>
      !matching.some((event) => event.provider === provider));
    const failedProviders = requiredProviders.filter((provider) =>
      matching.some((event) => event.provider === provider && event.status === 'failure'));
    const complete = coverage.status === 'satisfied'
      && missingProviders.length === 0
      && failedProviders.length === 0;
    return {
      source: coverage.source,
      coverageStatus: coverage.status,
      requiredProviders,
      observedProviders,
      missingProviders,
      failedProviders,
      complete,
    };
  });

  const failures: string[] = [];
  for (const branch of branches) {
    if (branch.coverageStatus !== 'satisfied') failures.push(`coverage_not_satisfied:${branch.source}:${branch.coverageStatus}`);
    for (const provider of branch.missingProviders) failures.push(`missing_trace:${branch.source}:${provider}`);
    for (const provider of branch.failedProviders) failures.push(`failed_trace:${branch.source}:${provider}`);
  }

  return ok({
    receipt: failures.length === 0 ? 'provider-trace-complete' : 'provider-trace-incomplete',
    requestId,
    correlatedEventCount: events.length,
    requiredSources: required.map((entry) => entry.source),
    branches,
    failures: [...new Set(failures)],
    note: 'ast-grep is startup/index evidence, not query-time request-correlated evidence; DBC-01 must retain its startup provider proof separately.',
  });
};

export interface NativeResponsesFinalWireEvidence {
  readonly schemaVersion: 1;
  readonly evidenceKind: 'mock' | 'real_provider';
  readonly sourceCommit: string;
  readonly bifrostCommit: string;
  readonly aceRuntimeSha256: string;
  readonly bifrostPluginSha256: string;
  readonly pluginOrderSha256: string;
  readonly requestId: string;
  readonly attemptId: string;
  readonly protocol: 'openai.responses';
  readonly provider: string;
  readonly model: string;
  readonly dataClass: 'public' | 'project_document' | 'private';
  readonly destinationSha256: string;
  readonly ingressBodySha256: string;
  readonly preparedBodySha256: string;
  readonly preparedBodySemanticSha256: string;
  readonly finalWireBodySha256: string;
  readonly finalWireBodySemanticSha256: string;
  readonly serializedRequestSha256: string;
  readonly capturePoint: 'contextTransport-before-tls-write' | 'mock-server-after-tls-decryption';
  readonly physicalSendAuthorized: boolean;
  readonly pluginOrderVerified: boolean;
  readonly storeFalseVerified: boolean;
  readonly nonStreamingVerified: boolean;
  readonly protectedItemsVerified: boolean;
  readonly providerAcknowledgement: Readonly<{
    kind: 'mock' | 'real_provider';
    statusCode: number;
    requestId: string;
    attemptId: string;
    providerRequestId: string;
  }>;
}

export type NativeResponsesFinalWireProof = Readonly<{
  // A signature on an operator-supplied manifest is NOT proof that a mock
  // server actually observed the asserted final wire. Only an independently
  // observed mock capture may use 'mock-capture'.
  kind: 'mock-capture' | 'signed-provider-capture' | 'signed-manifest-only';
  finalWireBodySha256: string;
  serializedRequestSha256: string;
  signerKeySha256?: string;
}>;

export interface NativeResponsesFinalWireReceipt {
  readonly status: 'MOCK_WIRE_VERIFIED' | 'REAL_PROVIDER_CANDIDATE' | 'NOT_CERTIFIED';
  readonly requestId: string;
  readonly attemptId: string;
  readonly sourceCommit: string;
  readonly bifrostCommit: string;
  readonly aceRuntimeSha256: string;
  readonly bifrostPluginSha256: string;
  readonly pluginOrderSha256: string;
  readonly protocol: 'openai.responses';
  readonly provider: string;
  readonly model: string;
  readonly dataClass: 'public' | 'project_document' | 'private';
  readonly destinationSha256: string;
  readonly ingressBodySha256: string;
  readonly preparedBodySha256: string;
  readonly preparedBodySemanticSha256: string;
  readonly finalWireBodySha256: string;
  readonly finalWireBodySemanticSha256: string;
  readonly serializedRequestSha256: string;
  readonly providerAcknowledgement: Readonly<{
    kind: 'mock' | 'real_provider';
    statusCode: number;
    requestId: string;
    attemptId: string;
    providerRequestId: string;
  }>;
  readonly reasonCodes: readonly string[];
}

const finalWireFields = new Set([
  'schemaVersion', 'evidenceKind', 'sourceCommit', 'bifrostCommit', 'aceRuntimeSha256',
  'bifrostPluginSha256', 'pluginOrderSha256', 'requestId', 'attemptId', 'protocol', 'provider',
  'model', 'dataClass', 'destinationSha256', 'ingressBodySha256',
  'preparedBodySha256', 'preparedBodySemanticSha256', 'finalWireBodySha256',
  'finalWireBodySemanticSha256', 'serializedRequestSha256', 'capturePoint',
  'physicalSendAuthorized', 'pluginOrderVerified', 'storeFalseVerified', 'nonStreamingVerified',
  'protectedItemsVerified', 'providerAcknowledgement',
]);
const finalWireAcknowledgementFields = new Set([
  'kind', 'statusCode', 'requestId', 'attemptId', 'providerRequestId',
]);
const sha256Hex = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const commitSha = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
const safeFinalWireRouteName = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 256 && safeMetadata(value);
const safeProviderRequestId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9._:-]{1,256}$/u.test(value);
const finalWireRejected = (path: string, message: string): Result<never, DomainError> =>
  err(domainError('INVALID_BENCHMARK', path, message));

export const evaluateNativeResponsesFinalWireEvidence = (
  raw: unknown,
  proof?: NativeResponsesFinalWireProof,
): Result<NativeResponsesFinalWireReceipt, DomainError> => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return finalWireRejected('final_wire', 'final-wire evidence must be an object');
  }
  const input = raw as Record<string, unknown>;
  if (Object.keys(input).some((key) => !finalWireFields.has(key))) {
    return finalWireRejected('final_wire', 'final-wire evidence contains an unrecognized field');
  }
  if (input.schemaVersion !== 1 || (input.evidenceKind !== 'mock' && input.evidenceKind !== 'real_provider')) {
    return finalWireRejected('final_wire.kind', 'final-wire evidence version or kind is unsupported');
  }
  if (!commitSha(input.sourceCommit) || !commitSha(input.bifrostCommit)
    || !sha256Hex(input.aceRuntimeSha256) || !sha256Hex(input.bifrostPluginSha256)
    || !sha256Hex(input.pluginOrderSha256) || !sha256Hex(input.destinationSha256)
    || !sha256Hex(input.ingressBodySha256) || !sha256Hex(input.preparedBodySha256)
    || !sha256Hex(input.preparedBodySemanticSha256) || !sha256Hex(input.finalWireBodySha256)
    || !sha256Hex(input.finalWireBodySemanticSha256) || !sha256Hex(input.serializedRequestSha256)) {
    return finalWireRejected('final_wire.digest', 'final-wire evidence requires pinned commits and SHA-256 digests');
  }
  if (typeof input.requestId !== 'string' || !/^ace-[a-f0-9]{32}$/u.test(input.requestId)
    || typeof input.attemptId !== 'string' || !/^bf-attempt-[a-f0-9]{32}$/u.test(input.attemptId)
    || input.protocol !== 'openai.responses'
    || (input.dataClass !== 'public' && input.dataClass !== 'project_document' && input.dataClass !== 'private')
    || !safeFinalWireRouteName(input.provider)
    || !safeFinalWireRouteName(input.model)) {
    return finalWireRejected('final_wire.identity', 'final-wire request, attempt, provider or model identity is invalid');
  }
  if ((input.capturePoint !== 'contextTransport-before-tls-write'
      && input.capturePoint !== 'mock-server-after-tls-decryption')
    || typeof input.physicalSendAuthorized !== 'boolean'
    || typeof input.pluginOrderVerified !== 'boolean'
    || typeof input.storeFalseVerified !== 'boolean'
    || typeof input.nonStreamingVerified !== 'boolean'
    || typeof input.protectedItemsVerified !== 'boolean') {
    return finalWireRejected('final_wire.capture', 'final-wire capture metadata is invalid');
  }
  if (typeof input.providerAcknowledgement !== 'object' || input.providerAcknowledgement === null
    || Array.isArray(input.providerAcknowledgement)) {
    return finalWireRejected('final_wire.acknowledgement', 'provider acknowledgement must be an object');
  }
  const acknowledgement = input.providerAcknowledgement as Record<string, unknown>;
  if (Object.keys(acknowledgement).some((key) => !finalWireAcknowledgementFields.has(key))
    || (acknowledgement.kind !== 'mock' && acknowledgement.kind !== 'real_provider')
    || !Number.isSafeInteger(acknowledgement.statusCode)
    || (acknowledgement.statusCode as number) < 100 || (acknowledgement.statusCode as number) > 599
    || typeof acknowledgement.requestId !== 'string' || !safeMetadata(acknowledgement.requestId)
    || typeof acknowledgement.attemptId !== 'string' || !safeMetadata(acknowledgement.attemptId)
    || !safeProviderRequestId(acknowledgement.providerRequestId)) {
    return finalWireRejected('final_wire.acknowledgement', 'provider acknowledgement metadata is invalid');
  }

  const reasons: string[] = [];
  if (!input.physicalSendAuthorized) reasons.push('PHYSICAL_SEND_NOT_AUTHORIZED');
  if (!input.pluginOrderVerified) reasons.push('PLUGIN_ORDER_UNVERIFIED');
  if (!input.storeFalseVerified) reasons.push('STORE_FALSE_UNVERIFIED');
  if (!input.nonStreamingVerified) reasons.push('NON_STREAMING_UNVERIFIED');
  if (!input.protectedItemsVerified) reasons.push('PROTECTED_ITEMS_UNVERIFIED');
  if (input.evidenceKind === 'real_provider' && input.capturePoint !== 'contextTransport-before-tls-write') {
    reasons.push('FINAL_CAPTURE_POINT_UNVERIFIED');
  }
  if (input.evidenceKind === 'real_provider' && input.dataClass !== 'public') reasons.push('PUBLIC_DATA_REQUIRED');
  if (input.evidenceKind === 'real_provider' && input.provider.toLowerCase() === 'mock') {
    reasons.push('MOCK_PROVIDER_CANNOT_BE_REAL');
  }
  if (input.preparedBodySemanticSha256 !== input.finalWireBodySemanticSha256) {
    reasons.push('FINAL_BODY_SEMANTIC_MISMATCH');
  }
  if (acknowledgement.requestId !== input.requestId || acknowledgement.attemptId !== input.attemptId) {
    reasons.push('ATTEMPT_ACK_MISMATCH');
  }
  if (acknowledgement.kind !== input.evidenceKind) reasons.push('ACK_KIND_MISMATCH');
  if ((acknowledgement.statusCode as number) < 200 || (acknowledgement.statusCode as number) >= 300) {
    reasons.push('PROVIDER_ACK_NOT_SUCCESSFUL');
  }
  if (proof === undefined) reasons.push('FINAL_WIRE_PROOF_MISSING');
  else {
    if (proof.finalWireBodySha256 !== input.finalWireBodySha256
      || proof.serializedRequestSha256 !== input.serializedRequestSha256) {
      reasons.push('PROOF_DIGEST_MISMATCH');
    }
    if (input.evidenceKind === 'mock' && proof.kind !== 'mock-capture') reasons.push('MOCK_CAPTURE_PROOF_REQUIRED');
    if (input.evidenceKind === 'real_provider'
      && (proof.kind !== 'signed-provider-capture' || !sha256Hex(proof.signerKeySha256))) {
      reasons.push('TRUSTED_PROVIDER_SIGNATURE_REQUIRED');
    }
  }

  const status = reasons.length > 0
    ? 'NOT_CERTIFIED'
    : input.evidenceKind === 'mock' ? 'MOCK_WIRE_VERIFIED' : 'REAL_PROVIDER_CANDIDATE';
  return ok({
    status,
    requestId: input.requestId,
    attemptId: input.attemptId,
    sourceCommit: input.sourceCommit,
    bifrostCommit: input.bifrostCommit,
    aceRuntimeSha256: input.aceRuntimeSha256,
    bifrostPluginSha256: input.bifrostPluginSha256,
    pluginOrderSha256: input.pluginOrderSha256,
    protocol: input.protocol,
    provider: input.provider,
    model: input.model,
    dataClass: input.dataClass,
    destinationSha256: input.destinationSha256,
    ingressBodySha256: input.ingressBodySha256,
    preparedBodySha256: input.preparedBodySha256,
    preparedBodySemanticSha256: input.preparedBodySemanticSha256,
    finalWireBodySha256: input.finalWireBodySha256,
    finalWireBodySemanticSha256: input.finalWireBodySemanticSha256,
    serializedRequestSha256: input.serializedRequestSha256,
    providerAcknowledgement: {
      kind: acknowledgement.kind,
      statusCode: acknowledgement.statusCode as number,
      requestId: acknowledgement.requestId,
      attemptId: acknowledgement.attemptId,
      providerRequestId: acknowledgement.providerRequestId,
    },
    reasonCodes: reasons,
  });
};

export const bindNativeResponsesFinalWireReceiptToContext = (
  receipt: NativeResponsesFinalWireReceipt,
  contextRequestId: string,
): NativeResponsesFinalWireReceipt => receipt.requestId === contextRequestId
  ? receipt
  : {
    ...receipt,
    status: 'NOT_CERTIFIED',
    reasonCodes: [...new Set([...receipt.reasonCodes, 'CONTEXT_REQUEST_ID_MISMATCH'])],
  };
