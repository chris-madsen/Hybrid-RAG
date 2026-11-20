import type {
  NativeResponsesFinalWireProof,
  NativeResponsesFinalWireReceipt,
} from '../src/domain/provider-trace-receipt.js';

export type VerifiedFinalWireReceipt = NativeResponsesFinalWireReceipt;

export type HermesAgentLoopEvidenceStatus = 'NOT_RUN' | 'BLOCKED' | 'CANDIDATE';

export declare function summarizeHermesSessionExport(rawBytes: Uint8Array): Readonly<{
  schemaVersion: 1;
  evidenceKind: 'hermes-session-export-unattested';
  rawTraceSha256: string;
  rawTraceBytes: number;
  sessionIdSha256: string;
  messageCounts: Readonly<Record<'user' | 'assistant' | 'tool' | 'system' | 'other', number>>;
  reasoningMessages: number;
  toolCallCount: number;
  toolResultCount: number;
  matchedToolCallIdSha256: readonly string[];
  unmatchedToolCallIdSha256: readonly string[];
  unmatchedToolResultIdSha256: readonly string[];
  toolLoopStatus: 'complete' | 'incomplete';
  hiddenProviderState: 'present' | 'not_observable';
  hostTranscriptAttested: false;
  streamingTerminalObserved: false;
}>;

export declare function evaluateHermesAgentLoopEvidence(input: Readonly<{
  sessionSummary: unknown;
  gatewayRequests: readonly unknown[];
  signatureCheckedFinalWireReceipts: readonly unknown[];
  taskOutcome: 'pass' | 'fail' | 'unknown';
}>): Readonly<{
  schemaVersion: 1;
  status: HermesAgentLoopEvidenceStatus;
  sessionIdSha256?: string;
  rawTraceSha256?: string;
  sessionCorrelation?: 'not_observed' | 'caller_asserted_match';
  gatewayRequestIds?: readonly string[];
  gatewayRequestCount?: number;
  linkedFinalWireReceiptCount?: number;
  finalWireReceiptSummaries?: readonly Readonly<{
    requestId: string;
    attemptId: string;
    status: string;
    sourceCommit: string;
    bifrostCommit: string;
    bifrostPluginSha256: string;
    aceRuntimeSha256: string;
    pluginOrderSha256: string;
    protocol: string;
    provider: string;
    model: string;
    acknowledgementKind: string;
    acknowledgementStatusCode: number;
    providerRequestIdSha256: string;
  }>[];
  taskOutcomeObserved?: boolean;
  hostTranscriptAttested?: false;
  reasonCodes: readonly string[];
}>;

export declare function verifyFinalWireEvidenceEnvelope(
  raw: unknown,
  verificationPublicKeyPem: string,
  evaluateEvidence: (
    payload: unknown,
    proof: NativeResponsesFinalWireProof,
  ) => Readonly<{ _tag: 'Ok'; value: NativeResponsesFinalWireReceipt } | { _tag: 'Err'; error: unknown }>,
): Readonly<{
  payload: unknown;
  proof: NativeResponsesFinalWireProof;
  receipt: VerifiedFinalWireReceipt;
}>;
