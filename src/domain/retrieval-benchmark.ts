import { createHash } from 'node:crypto';
import type { SourceRange } from './retrieval.js';

export interface BenchmarkCandidateRange {
  readonly startLine: number;
  readonly endLine: number;
  readonly startColumn?: number;
  readonly endColumn?: number;
}

export type RetrievalBenchmarkStage = 'dense' | 'sparse' | 'fused' | 'working_context' | 'reranked' | 'delivered';
export type RetrievalBenchmarkStageStatus = 'executed' | 'not_applicable' | 'unavailable';

export const retrievalBenchmarkStages: readonly RetrievalBenchmarkStage[] = [
  'dense',
  'sparse',
  'fused',
  'working_context',
  'reranked',
  'delivered',
];

export interface RetrievalBenchmarkCandidateIdentity {
  readonly runtimeCandidateId: string;
  readonly canonicalCandidateId?: string;
  readonly repoPath: string;
  readonly sourceDigest: string;
  readonly range: SourceRange;
}

export interface RetrievalBenchmarkTraceEvent {
  readonly requestId: string;
  readonly stage: RetrievalBenchmarkStage;
  readonly status?: RetrievalBenchmarkStageStatus;
  readonly candidates: readonly RetrievalBenchmarkCandidateIdentity[];
  readonly durationMs: number;
  readonly providerIdentities?: Readonly<Record<string, string>>;
  readonly sourceCommit?: string;
  readonly runnerVersion?: string;
}

export interface RetrievalBenchmarkTraceRequestReceipt {
  readonly requestId: string;
  readonly stages: Readonly<Record<RetrievalBenchmarkStage, RetrievalBenchmarkStageStatus>>;
  readonly complete: boolean;
}

export interface RetrievalBenchmarkTerminalReceipt {
  readonly schemaVersion: 1;
  readonly eventCount: number;
  readonly persistedEventCount: number;
  readonly requests: readonly RetrievalBenchmarkTraceRequestReceipt[];
  readonly traceDigest: string;
  readonly flushStatus: 'ok' | 'failed';
  readonly closeStatus: 'ok' | 'failed';
  readonly failureCode?: 'trace_persistence_failed';
  readonly sourceCommit?: string;
  readonly runnerVersion?: string;
}

export interface RetrievalBenchmarkTraceStatus {
  readonly state: 'open' | 'failed' | 'closed';
  readonly recordedEvents: number;
  readonly persistedEvents: number;
  readonly failureCode?: 'trace_persistence_failed';
}

export interface RetrievalBenchmarkTraceSink {
  readonly record: (event: RetrievalBenchmarkTraceEvent) => void;
  readonly flush: () => Promise<void>;
  readonly close: () => Promise<void>;
  readonly status: RetrievalBenchmarkTraceStatus;
}

export const noopRetrievalBenchmarkTrace: RetrievalBenchmarkTraceSink = {
  record: () => undefined,
  flush: async () => undefined,
  close: async () => undefined,
  status: { state: 'open', recordedEvents: 0, persistedEvents: 0 },
};

export interface RetrievalBenchmarkTraceCollector extends RetrievalBenchmarkTraceSink {
  readonly events: readonly RetrievalBenchmarkTraceEvent[];
  readonly stageRanksFor: (requestId: string) => {
    readonly dense: readonly string[];
    readonly sparse: readonly string[];
    readonly fused: readonly string[];
    readonly workingContext: readonly string[];
    readonly reranked: readonly string[];
    readonly delivered: readonly string[];
  };
}

export const createRetrievalBenchmarkTraceCollector = (
  repositoryId: string,
): RetrievalBenchmarkTraceCollector => {
  const recorded: RetrievalBenchmarkTraceEvent[] = [];
  const stageKey = (stage: RetrievalBenchmarkStage): keyof ReturnType<RetrievalBenchmarkTraceCollector['stageRanksFor']> => {
    if (stage === 'working_context') return 'workingContext';
    return stage;
  };
  return {
    record: (event) => { recorded.push({ status: 'executed', ...event }); },
    flush: async () => undefined,
    close: async () => undefined,
    get status() {
      return {
        state: 'open' as const,
        recordedEvents: recorded.length,
        persistedEvents: recorded.length,
      };
    },
    get events() { return recorded; },
    stageRanksFor: (requestId) => {
      const result = {
        dense: [] as string[],
        sparse: [] as string[],
        fused: [] as string[],
        workingContext: [] as string[],
        reranked: [] as string[],
        delivered: [] as string[],
      };
      for (const event of recorded.filter((item) => item.requestId === requestId)) {
        result[stageKey(event.stage)] = event.candidates.map((candidate) => candidate.canonicalCandidateId
          ?? canonicalBenchmarkCandidateId(repositoryId, candidate.repoPath, candidate.sourceDigest, candidate.range));
      }
      return result;
    },
  };
};

/**
 * Runtime candidate ids include workspace identity and therefore cannot be
 * used as labels across independent benchmark workspaces. This id binds only
 * immutable source identity and the exact structural range.
 */
/** SHA-256 v1: maintain existing candidate/trace hashes while replacing the
 * handwritten crypto implementation with Node's maintained primitive.
 */
export const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

export const canonicalBenchmarkCandidateId = (
  repositoryId: string,
  repoPath: string,
  sourceDigest: string,
  range: BenchmarkCandidateRange,
): string => sha256([
  repositoryId,
  repoPath,
  sourceDigest,
  String(range.startLine),
  String(range.startColumn ?? ''),
  String(range.endLine),
  String(range.endColumn ?? ''),
].join('\0'));

const traceEventKeys = new Set([
  'requestId',
  'stage',
  'status',
  'candidates',
  'durationMs',
  'providerIdentities',
  'sourceCommit',
  'runnerVersion',
]);

const traceSensitiveKeys = new Set([
  'query',
  'source',
  'token',
  'content',
  'content_utf8',
  'content_base64',
  'sourceBytes',
  'payload',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validStage = (value: unknown): value is RetrievalBenchmarkStage =>
  typeof value === 'string' && retrievalBenchmarkStages.includes(value as RetrievalBenchmarkStage);

const validStageStatus = (value: unknown): value is RetrievalBenchmarkStageStatus =>
  value === 'executed' || value === 'not_applicable' || value === 'unavailable';

const requestReceiptsFor = (
  events: readonly RetrievalBenchmarkTraceEvent[],
): readonly RetrievalBenchmarkTraceRequestReceipt[] => {
  const states = new Map<string, Map<RetrievalBenchmarkStage, RetrievalBenchmarkStageStatus>>();
  for (const event of events) {
    const stages = states.get(event.requestId) ?? new Map<RetrievalBenchmarkStage, RetrievalBenchmarkStageStatus>();
    stages.set(event.stage, event.status ?? 'executed');
    states.set(event.requestId, stages);
  }
  return [...states.entries()].map(([requestId, stages]) => {
    const complete = retrievalBenchmarkStages.every((stage) => stages.has(stage));
    return {
      requestId,
      stages: Object.fromEntries(retrievalBenchmarkStages.map((stage) => [
        stage,
        stages.get(stage) ?? 'unavailable',
      ])) as Readonly<Record<RetrievalBenchmarkStage, RetrievalBenchmarkStageStatus>>,
      complete,
    };
  });
};

export interface RetrievalBenchmarkTraceValidation {
  readonly valid: boolean;
  readonly failures: readonly string[];
}

/**
 * Validate the durable JSONL + terminal receipt boundary before scoring. This
 * intentionally accepts raw JSONL so a caller cannot validate a parsed object
 * while silently ignoring malformed lines or a digest mismatch.
 */
export const validateRetrievalBenchmarkTraceArtifact = (
  jsonl: string,
  receipt: unknown,
  expectedRequestIds: readonly string[] = [],
): RetrievalBenchmarkTraceValidation => {
  const failures: string[] = [];
  const parsed: RetrievalBenchmarkTraceEvent[] = [];
  for (const [index, line] of jsonl.split('\n').entries()) {
    if (line.trim().length === 0) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (!isRecord(value)) {
        failures.push(`event_${index}_not_object`);
        continue;
      }
      const keys = Object.keys(value);
      if (keys.some((key) => traceSensitiveKeys.has(key))) failures.push(`event_${index}_sensitive_key`);
      if (keys.some((key) => !traceEventKeys.has(key))) failures.push(`event_${index}_unknown_key`);
      if (typeof value.requestId !== 'string' || value.requestId.trim().length === 0
        || !validStage(value.stage)
        || (value.status !== undefined && !validStageStatus(value.status))
        || !Array.isArray(value.candidates)
        || typeof value.durationMs !== 'number'
        || !Number.isFinite(value.durationMs)
        || value.durationMs < 0) {
        failures.push(`event_${index}_invalid_shape`);
        continue;
      }
      // Non-executed stages must not claim elapsed time: an epoch-derived\n      // duration is not performance evidence and poisons aggregate latency.\n      if (value.status === 'unavailable' || value.status === 'not_applicable') {\n        if (value.durationMs !== 0) failures.push(`event_${index}_nonexecuted_latency`);\n      }\n      parsed.push(value as unknown as RetrievalBenchmarkTraceEvent);
    } catch {
      failures.push(`event_${index}_invalid_json`);
    }
  }
  if (!isRecord(receipt)) {
    failures.push('terminal_receipt_missing');
    return { valid: false, failures };
  }
  const terminal = receipt as Partial<RetrievalBenchmarkTerminalReceipt>;
  if (terminal.schemaVersion !== 1) failures.push('terminal_schema_version');
  if (terminal.flushStatus !== 'ok' || terminal.closeStatus !== 'ok') failures.push('terminal_persistence_failed');
  if (!Number.isSafeInteger(terminal.eventCount) || terminal.eventCount !== parsed.length) failures.push('terminal_event_count');
  if (!Number.isSafeInteger(terminal.persistedEventCount) || terminal.persistedEventCount !== parsed.length) {
    failures.push('terminal_persisted_event_count');
  }
  if (typeof terminal.traceDigest !== 'string' || terminal.traceDigest !== sha256(jsonl)) failures.push('terminal_trace_digest');
  const actualRequests = requestReceiptsFor(parsed);
  const receiptRequests = Array.isArray(terminal.requests) ? terminal.requests : [];
  if (receiptRequests.length !== actualRequests.length) failures.push('terminal_request_count');
  for (const request of actualRequests) {
    if (!request.complete) failures.push(`request_${request.requestId}_stage_completeness`);
    const declared = receiptRequests.find((item) => isRecord(item) && item.requestId === request.requestId) as
      | RetrievalBenchmarkTraceRequestReceipt
      | undefined;
    if (declared === undefined || declared.complete !== request.complete
      || retrievalBenchmarkStages.some((stage) => declared.stages?.[stage] !== request.stages[stage])) {
      failures.push(`request_${request.requestId}_stage_completeness`);
    }
  }
  for (const expected of expectedRequestIds) {
    if (!actualRequests.some((request) => request.requestId === expected)) failures.push(`request_${expected}_missing`);
  }
  return { valid: failures.length === 0, failures };
};
