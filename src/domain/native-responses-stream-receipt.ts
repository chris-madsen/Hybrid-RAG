import { domainError, type DomainError } from './errors.js';
import { err, ok, type Result } from './result.js';

export interface NativeResponsesStreamEventSummary {
  readonly sequenceNumber: number;
  readonly type: string;
  readonly itemIdSha256?: string;
  readonly callIdSha256?: string;
}

export interface NativeResponsesStreamEvidence {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly attemptId: string;
  readonly sourceCommit: string;
  readonly bifrostCommit: string;
  readonly aceRuntimeSha256: string;
  readonly bifrostPluginSha256: string;
  readonly pluginOrderSha256: string;
  readonly provider: string;
  readonly model: string;
  readonly destinationSha256: string;
  readonly finalWireBodySha256: string;
  readonly serializedRequestSha256: string;
  readonly streamTrueVerified: boolean;
  readonly storeFalseVerified: boolean;
  readonly protectedItemsVerified: boolean;
  readonly events: readonly NativeResponsesStreamEventSummary[];
  readonly transportOutcome: 'terminal' | 'eof' | 'cancelled' | 'error';
  readonly usage?: Readonly<{
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  }>;
}

export type NativeResponsesStreamStatus =
  | 'completed'
  | 'failed'
  | 'incomplete'
  | 'cancelled'
  | 'truncated'
  | 'partial';

export type NativeResponsesStreamUsage =
  | Readonly<{
    status: 'observed';
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  }>
  | Readonly<{ status: 'unknown'; reason: 'usage_not_reported' }>;

export interface NativeResponsesStreamReceipt {
  readonly evidenceStatus: 'NOT_CERTIFIED';
  readonly streamStatus: NativeResponsesStreamStatus;
  readonly requestId: string;
  readonly attemptId: string;
  readonly sourceCommit: string;
  readonly bifrostCommit: string;
  readonly aceRuntimeSha256: string;
  readonly bifrostPluginSha256: string;
  readonly pluginOrderSha256: string;
  readonly provider: string;
  readonly model: string;
  readonly destinationSha256: string;
  readonly finalWireBodySha256: string;
  readonly serializedRequestSha256: string;
  readonly eventCount: number;
  readonly eventSequence: readonly NativeResponsesStreamEventSummary[];
  readonly usage: NativeResponsesStreamUsage;
  readonly reasonCodes: readonly string[];
  readonly trustLimitation: 'unsigned_local_summary';
}

const evidenceKeys = new Set([
  'schemaVersion', 'requestId', 'attemptId', 'sourceCommit', 'bifrostCommit',
  'aceRuntimeSha256', 'bifrostPluginSha256', 'pluginOrderSha256', 'provider', 'model',
  'destinationSha256', 'finalWireBodySha256', 'serializedRequestSha256', 'streamTrueVerified',
  'storeFalseVerified', 'protectedItemsVerified', 'events', 'transportOutcome', 'usage',
]);
const eventKeys = new Set(['sequenceNumber', 'type', 'itemIdSha256', 'callIdSha256']);
const usageKeys = new Set(['inputTokens', 'outputTokens', 'totalTokens']);
const terminalTypes = new Set(['response.completed', 'response.failed', 'response.incomplete', 'error']);
const sha256Hex = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const commitSha = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
const safeIdentity = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(value);
const rejected = (path: string, message: string): Result<never, DomainError> =>
  err(domainError('INVALID_BENCHMARK', path, message));

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

export const evaluateNativeResponsesStreamEvidence = (
  raw: unknown,
): Result<NativeResponsesStreamReceipt, DomainError> => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return rejected('stream_evidence', 'stream evidence must be an object');
  }
  const input = raw as Record<string, unknown>;
  if (Object.keys(input).some((key) => !evidenceKeys.has(key))) {
    return rejected('stream_evidence', 'stream evidence contains an unrecognized field or raw content');
  }
  if (input.schemaVersion !== 1 || input.streamTrueVerified !== true
    || (input.transportOutcome !== 'terminal' && input.transportOutcome !== 'eof'
      && input.transportOutcome !== 'cancelled' && input.transportOutcome !== 'error')) {
    return rejected('stream_evidence', 'stream evidence version, stream flag, or transport outcome is invalid');
  }
  if (!/^ace-[a-f0-9]{32}$/u.test(String(input.requestId))
    || !/^bf-attempt-[a-f0-9]{32}$/u.test(String(input.attemptId))
    || !commitSha(input.sourceCommit) || !commitSha(input.bifrostCommit)
    || !sha256Hex(input.aceRuntimeSha256) || !sha256Hex(input.bifrostPluginSha256)
    || !sha256Hex(input.pluginOrderSha256) || !sha256Hex(input.destinationSha256)
    || !sha256Hex(input.finalWireBodySha256) || !sha256Hex(input.serializedRequestSha256)
    || !safeIdentity(input.provider) || !safeIdentity(input.model)) {
    return rejected('stream_evidence.identity', 'stream evidence identities or digests are invalid');
  }
  if (typeof input.storeFalseVerified !== 'boolean' || typeof input.protectedItemsVerified !== 'boolean') {
    return rejected('stream_evidence.protected', 'stream protection claims must be booleans');
  }
  if (!Array.isArray(input.events) || input.events.length > 100_000) {
    return rejected('stream_evidence.events', 'stream event summary is missing or exceeds its bound');
  }

  const events: NativeResponsesStreamEventSummary[] = [];
  let priorSequence = -1;
  for (const rawEvent of input.events) {
    if (typeof rawEvent !== 'object' || rawEvent === null || Array.isArray(rawEvent)) {
      return rejected('stream_evidence.events', 'stream event summary must contain objects');
    }
    const event = rawEvent as Record<string, unknown>;
    if (Object.keys(event).some((key) => !eventKeys.has(key))) {
      return rejected('stream_evidence.events', 'stream event summary contains raw or unrecognized fields');
    }
    if (!isNonNegativeSafeInteger(event.sequenceNumber) || (event.sequenceNumber as number) <= priorSequence
      || typeof event.type !== 'string' || !/^(?:response(?:\.[a-z0-9_]+)+|error)$/u.test(event.type)
      || (event.itemIdSha256 !== undefined && !sha256Hex(event.itemIdSha256))
      || (event.callIdSha256 !== undefined && !sha256Hex(event.callIdSha256))) {
      return rejected('stream_evidence.events', 'stream event sequence, type, or hashed item identity is invalid');
    }
    // A terminal "completed" event does not prove lossless SSE when the
    // capture silently skipped a function-call/reasoning delta. Refuse
    // noncontiguous event summaries, rather than invent a complete run.
    if ((events.length === 0 && event.sequenceNumber !== 0 && event.sequenceNumber !== 1)
      || (events.length > 0 && event.sequenceNumber !== priorSequence + 1)) {
      return rejected('stream_evidence.events',
        'stream event sequence contains unobserved event numbers');
    }
    priorSequence = event.sequenceNumber as number;
    events.push({
      sequenceNumber: event.sequenceNumber as number,
      type: event.type,
      ...(event.itemIdSha256 === undefined ? {} : { itemIdSha256: event.itemIdSha256 as string }),
      ...(event.callIdSha256 === undefined ? {} : { callIdSha256: event.callIdSha256 as string }),
    });
  }

  let usage: NativeResponsesStreamUsage = { status: 'unknown', reason: 'usage_not_reported' };
  if (input.usage !== undefined) {
    if (typeof input.usage !== 'object' || input.usage === null || Array.isArray(input.usage)) {
      return rejected('stream_evidence.usage', 'stream usage must be an object when present');
    }
    const rawUsage = input.usage as Record<string, unknown>;
    if (Object.keys(rawUsage).some((key) => !usageKeys.has(key))) {
      return rejected('stream_evidence.usage', 'stream usage contains unsupported or raw fields');
    }
    for (const key of usageKeys) {
      if (rawUsage[key] !== undefined && !isNonNegativeSafeInteger(rawUsage[key])) {
        return rejected('stream_evidence.usage', 'observed usage fields must be non-negative safe integers');
      }
    }
    if (isNonNegativeSafeInteger(rawUsage.totalTokens)
      && isNonNegativeSafeInteger(rawUsage.inputTokens)
      && isNonNegativeSafeInteger(rawUsage.outputTokens)
      && rawUsage.totalTokens < rawUsage.inputTokens + rawUsage.outputTokens) {
      return rejected('stream_evidence.usage',
        'reported total tokens cannot be smaller than combined input and output usage');
    }
    if (Object.values(rawUsage).some((value) => value !== undefined)) {
      usage = {
        status: 'observed',
        inputTokens: isNonNegativeSafeInteger(rawUsage.inputTokens) ? rawUsage.inputTokens : null,
        outputTokens: isNonNegativeSafeInteger(rawUsage.outputTokens) ? rawUsage.outputTokens : null,
        totalTokens: isNonNegativeSafeInteger(rawUsage.totalTokens) ? rawUsage.totalTokens : null,
      };
    }
  }

  const terminalIndices = events.flatMap((event, index) => terminalTypes.has(event.type) ? [index] : []);
  if (terminalIndices.length > 1 || (terminalIndices.length === 1 && terminalIndices[0] !== events.length - 1)) {
    return rejected('stream_evidence.terminal', 'a terminal event must occur at most once and be the last observed event');
  }
  const terminal = terminalIndices.length === 0 ? undefined : events[terminalIndices[0] as number]?.type;
  if ((terminal === undefined && input.transportOutcome === 'terminal')
    || (terminal !== undefined && input.transportOutcome !== 'terminal')) {
    return rejected('stream_evidence.terminal', 'terminal event and transport outcome disagree');
  }

  let streamStatus: NativeResponsesStreamStatus;
  if (terminal === 'response.completed') streamStatus = 'completed';
  else if (terminal === 'response.incomplete') streamStatus = 'incomplete';
  else if (terminal === 'response.failed' || terminal === 'error') streamStatus = 'failed';
  else if (input.transportOutcome === 'cancelled') streamStatus = 'cancelled';
  else if (input.transportOutcome === 'eof') streamStatus = 'truncated';
  else streamStatus = events.length === 0 ? 'failed' : 'partial';

  const reasons: string[] = ['CAPTURE_TRUST_NOT_VERIFIED'];
  if (!input.storeFalseVerified) reasons.push('STORE_FALSE_UNVERIFIED');
  if (!input.protectedItemsVerified) reasons.push('PROTECTED_ITEMS_UNVERIFIED');
  if (usage.status === 'unknown') reasons.push('USAGE_UNKNOWN');
  if (streamStatus === 'incomplete') reasons.push('RESPONSE_INCOMPLETE');
  if (streamStatus === 'cancelled') reasons.push('STREAM_CANCELLED');
  if (streamStatus === 'truncated') reasons.push('TERMINAL_EVENT_MISSING');
  if (streamStatus === 'partial') reasons.push('STREAM_FAILED_AFTER_PARTIAL_OUTPUT');
  if (streamStatus === 'failed') reasons.push('STREAM_FAILED');

  return ok({
    evidenceStatus: 'NOT_CERTIFIED',
    streamStatus,
    requestId: input.requestId as string,
    attemptId: input.attemptId as string,
    sourceCommit: input.sourceCommit,
    bifrostCommit: input.bifrostCommit,
    aceRuntimeSha256: input.aceRuntimeSha256,
    bifrostPluginSha256: input.bifrostPluginSha256,
    pluginOrderSha256: input.pluginOrderSha256,
    provider: input.provider,
    model: input.model,
    destinationSha256: input.destinationSha256,
    finalWireBodySha256: input.finalWireBodySha256,
    serializedRequestSha256: input.serializedRequestSha256,
    eventCount: events.length,
    eventSequence: events,
    usage,
    reasonCodes: reasons,
    trustLimitation: 'unsigned_local_summary',
  });
};

const receiptKeys = new Set([
  'evidenceStatus', 'streamStatus', 'requestId', 'attemptId', 'sourceCommit', 'bifrostCommit',
  'aceRuntimeSha256', 'bifrostPluginSha256', 'pluginOrderSha256', 'provider', 'model',
  'destinationSha256', 'finalWireBodySha256', 'serializedRequestSha256', 'eventCount',
  'eventSequence', 'usage', 'reasonCodes', 'trustLimitation',
]);

/** Shape validation only; this preserves the unsigned receipt's NOT_CERTIFIED state. */
export const validateNativeResponsesStreamReceipt = (
  raw: unknown,
): Result<NativeResponsesStreamReceipt, DomainError> => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return rejected('stream_receipt', 'stream receipt must be an object');
  }
  const input = raw as Record<string, unknown>;
  const eventSequence = input.eventSequence;
  const usage = input.usage;
  const reasonCodes = input.reasonCodes;
  if (Object.keys(input).some((key) => !receiptKeys.has(key))
    || input.evidenceStatus !== 'NOT_CERTIFIED'
    || !['completed', 'failed', 'incomplete', 'cancelled', 'truncated', 'partial'].includes(String(input.streamStatus))
    || !/^ace-[a-f0-9]{32}$/u.test(String(input.requestId))
    || !/^bf-attempt-[a-f0-9]{32}$/u.test(String(input.attemptId))
    || !commitSha(input.sourceCommit) || !commitSha(input.bifrostCommit)
    || !sha256Hex(input.aceRuntimeSha256) || !sha256Hex(input.bifrostPluginSha256)
    || !sha256Hex(input.pluginOrderSha256) || !safeIdentity(input.provider) || !safeIdentity(input.model)
    || !sha256Hex(input.destinationSha256) || !sha256Hex(input.finalWireBodySha256)
    || !sha256Hex(input.serializedRequestSha256)
    || !isNonNegativeSafeInteger(input.eventCount) || !Array.isArray(eventSequence)
    || input.eventCount !== eventSequence.length || eventSequence.length > 100_000
    || !Array.isArray(reasonCodes)
    || !reasonCodes.every((reason) => typeof reason === 'string' && /^[A-Z0-9_]{1,128}$/u.test(reason))
    || new Set(reasonCodes).size !== reasonCodes.length
    || input.trustLimitation !== 'unsigned_local_summary') {
    return rejected('stream_receipt', 'stream receipt identity, status, count, or trust limitation is invalid');
  }

  const normalizedEvents: NativeResponsesStreamEventSummary[] = [];
  let previousSequence = -1;
  for (const [index, rawEvent] of eventSequence.entries()) {
    if (typeof rawEvent !== 'object' || rawEvent === null || Array.isArray(rawEvent)) {
      return rejected(`stream_receipt.eventSequence[${index}]`, 'stream receipt event must be an object');
    }
    const event = rawEvent as Record<string, unknown>;
    if (Object.keys(event).some((key) => !eventKeys.has(key))
      || !isNonNegativeSafeInteger(event.sequenceNumber)
      || (event.sequenceNumber as number) <= previousSequence
      || typeof event.type !== 'string' || !/^(?:response(?:\.[a-z0-9_]+)+|error)$/u.test(event.type)
      || (event.itemIdSha256 !== undefined && !sha256Hex(event.itemIdSha256))
      || (event.callIdSha256 !== undefined && !sha256Hex(event.callIdSha256))) {
      return rejected(`stream_receipt.eventSequence[${index}]`, 'stream receipt event summary is invalid');
    }
    if ((index === 0 && event.sequenceNumber !== 0 && event.sequenceNumber !== 1)
      || (index > 0 && event.sequenceNumber !== previousSequence + 1)) {
      return rejected(`stream_receipt.eventSequence[${index}]`, 'stream receipt event sequence is not contiguous');
    }
    previousSequence = event.sequenceNumber as number;
    normalizedEvents.push({
      sequenceNumber: event.sequenceNumber as number,
      type: event.type,
      ...(event.itemIdSha256 === undefined ? {} : { itemIdSha256: event.itemIdSha256 as string }),
      ...(event.callIdSha256 === undefined ? {} : { callIdSha256: event.callIdSha256 as string }),
    });
  }

  let normalizedUsage: NativeResponsesStreamUsage;
  if (typeof usage !== 'object' || usage === null || Array.isArray(usage)) {
    return rejected('stream_receipt.usage', 'stream receipt usage must be an object');
  }
  const rawUsage = usage as Record<string, unknown>;
  if (rawUsage.status === 'unknown') {
    if (Object.keys(rawUsage).some((key) => key !== 'status' && key !== 'reason')
      || rawUsage.reason !== 'usage_not_reported') {
      return rejected('stream_receipt.usage', 'unknown usage reason is invalid');
    }
    normalizedUsage = { status: 'unknown', reason: 'usage_not_reported' };
  } else if (rawUsage.status === 'observed') {
    if (Object.keys(rawUsage).some((key) => !['status', 'inputTokens', 'outputTokens', 'totalTokens'].includes(key))) {
      return rejected('stream_receipt.usage', 'observed usage contains an unsupported field');
    }
    for (const key of ['inputTokens', 'outputTokens', 'totalTokens'] as const) {
      if (!(rawUsage[key] === null || isNonNegativeSafeInteger(rawUsage[key]))) {
        return rejected('stream_receipt.usage', 'observed usage counters must be non-negative integers or unknown');
      }
    }
    if (typeof rawUsage.inputTokens === 'number' && typeof rawUsage.outputTokens === 'number'
      && typeof rawUsage.totalTokens === 'number'
      && rawUsage.totalTokens < rawUsage.inputTokens + rawUsage.outputTokens) {
      return rejected('stream_receipt.usage', 'total usage cannot be below input plus output');
    }
    normalizedUsage = {
      status: 'observed',
      inputTokens: rawUsage.inputTokens as number | null,
      outputTokens: rawUsage.outputTokens as number | null,
      totalTokens: rawUsage.totalTokens as number | null,
    };
  } else {
    return rejected('stream_receipt.usage', 'stream receipt usage status is invalid');
  }

  const streamStatus = input.streamStatus as NativeResponsesStreamStatus;
  const terminalType = normalizedEvents.at(-1)?.type;
  if ((streamStatus === 'completed' && terminalType !== 'response.completed')
    || (streamStatus === 'failed' && terminalType !== 'response.failed' && terminalType !== 'error')
    || (streamStatus === 'incomplete' && terminalType !== 'response.incomplete')
    || (streamStatus !== 'completed' && streamStatus !== 'failed' && streamStatus !== 'incomplete'
      && terminalTypes.has(String(terminalType)))) {
    return rejected('stream_receipt.streamStatus', 'stream receipt status contradicts its terminal event sequence');
  }
  return ok({
    evidenceStatus: 'NOT_CERTIFIED',
    streamStatus,
    requestId: input.requestId as string,
    attemptId: input.attemptId as string,
    sourceCommit: input.sourceCommit,
    bifrostCommit: input.bifrostCommit,
    aceRuntimeSha256: input.aceRuntimeSha256,
    bifrostPluginSha256: input.bifrostPluginSha256,
    pluginOrderSha256: input.pluginOrderSha256,
    provider: input.provider,
    model: input.model,
    destinationSha256: input.destinationSha256,
    finalWireBodySha256: input.finalWireBodySha256,
    serializedRequestSha256: input.serializedRequestSha256,
    eventCount: input.eventCount,
    eventSequence: normalizedEvents,
    usage: normalizedUsage,
    reasonCodes: [...reasonCodes] as string[],
    trustLimitation: 'unsigned_local_summary',
  });
};
