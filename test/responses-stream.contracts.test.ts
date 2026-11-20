import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNativeResponsesStreamingRoutes } from '../src/application/gateway-security-contract.js';
import {
  evaluateNativeResponsesStreamEvidence,
  type NativeResponsesStreamEvidence,
} from '../src/domain/native-responses-stream-receipt.js';

const digest = (value: string): string => value.repeat(64);
const evidence = (overrides: Partial<NativeResponsesStreamEvidence> = {}): NativeResponsesStreamEvidence => ({
  schemaVersion: 1,
  requestId: `ace-${'1'.repeat(32)}`,
  attemptId: `bf-attempt-${'2'.repeat(32)}`,
  sourceCommit: 'a'.repeat(40),
  bifrostCommit: 'b'.repeat(40),
  aceRuntimeSha256: digest('1'),
  bifrostPluginSha256: digest('2'),
  pluginOrderSha256: digest('3'),
  provider: 'openai',
  model: 'gpt-test',
  destinationSha256: digest('4'),
  finalWireBodySha256: digest('5'),
  serializedRequestSha256: digest('6'),
  streamTrueVerified: true,
  storeFalseVerified: true,
  protectedItemsVerified: true,
  events: [
    { sequenceNumber: 1, type: 'response.created' },
    { sequenceNumber: 2, type: 'response.output_item.added', itemIdSha256: digest('7'), callIdSha256: digest('8') },
    { sequenceNumber: 3, type: 'response.function_call_arguments.delta', itemIdSha256: digest('7'), callIdSha256: digest('8') },
    { sequenceNumber: 4, type: 'response.reasoning_summary_text.delta' },
    { sequenceNumber: 5, type: 'response.completed' },
  ],
  transportOutcome: 'terminal',
  usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 },
  ...overrides,
});
const evidenceWithoutUsage = (overrides: Partial<NativeResponsesStreamEvidence> = {}): NativeResponsesStreamEvidence => {
  const { usage: omittedUsage, ...value } = evidence(overrides);
  void omittedUsage;
  return value;
};

const evaluate = (input: unknown) => {
  const result = evaluateNativeResponsesStreamEvidence(input);
  if (result._tag === 'Err') throw new Error(result.error.message);
  return result.value;
};

test('completed Responses stream preserves event order and reports only observed usage', () => {
  const receipt = evaluate(evidence());
  assert.equal(receipt.streamStatus, 'completed');
  assert.equal(receipt.evidenceStatus, 'NOT_CERTIFIED');
  assert.deepEqual(receipt.eventSequence.map((event) => event.sequenceNumber), [1, 2, 3, 4, 5]);
  assert.equal(receipt.eventSequence[1]?.callIdSha256, digest('8'));
  assert.equal(receipt.eventSequence[2]?.callIdSha256, receipt.eventSequence[1]?.callIdSha256);
  assert.deepEqual(receipt.usage, {
    status: 'observed', inputTokens: 11, outputTokens: 7, totalTokens: 18,
  });
  assert.equal(receipt.trustLimitation, 'unsigned_local_summary');
});

test('incomplete terminal event and absent usage stay incomplete and UNKNOWN, never clean success', () => {
  const receipt = evaluate(evidenceWithoutUsage({
    events: [
      { sequenceNumber: 1, type: 'response.created' },
      { sequenceNumber: 2, type: 'response.incomplete' },
    ],
  }));
  assert.equal(receipt.streamStatus, 'incomplete');
  assert.deepEqual(receipt.usage, { status: 'unknown', reason: 'usage_not_reported' });
  assert.ok(receipt.reasonCodes.includes('RESPONSE_INCOMPLETE'));
  assert.ok(receipt.reasonCodes.includes('USAGE_UNKNOWN'));
});

test('EOF without a terminal event is truncated; cancellation and transport error remain partial outcomes', () => {
  const truncated = evaluate(evidenceWithoutUsage({
    events: [{ sequenceNumber: 1, type: 'response.output_text.delta' }],
    transportOutcome: 'eof',
  }));
  assert.equal(truncated.streamStatus, 'truncated');
  assert.ok(truncated.reasonCodes.includes('TERMINAL_EVENT_MISSING'));

  const cancelled = evaluate(evidence({
    events: [{ sequenceNumber: 1, type: 'response.output_text.delta' }],
    transportOutcome: 'cancelled',
    usage: { inputTokens: 4 },
  }));
  assert.equal(cancelled.streamStatus, 'cancelled');
  assert.deepEqual(cancelled.usage, {
    status: 'observed', inputTokens: 4, outputTokens: null, totalTokens: null,
  });

  const partial = evaluate(evidenceWithoutUsage({
    events: [{ sequenceNumber: 1, type: 'response.output_text.delta' }],
    transportOutcome: 'error',
  }));
  assert.equal(partial.streamStatus, 'partial');
});

test('failed and provider error terminal events are failures, not successful completions', () => {
  for (const type of ['response.failed', 'error']) {
    const receipt = evaluate(evidence({
      events: [{ sequenceNumber: 1, type }],
      transportOutcome: 'terminal',
    }));
    assert.equal(receipt.streamStatus, 'failed', type);
  }
});

test('stream evidence rejects raw content, malformed event order, and mismatched terminal metadata', () => {
  const rawContent = { ...evidence(), rawBody: 'private prompt text' };
  assert.equal(evaluateNativeResponsesStreamEvidence(rawContent)._tag, 'Err');

  const duplicateSequence = evidence({
    events: [
      { sequenceNumber: 1, type: 'response.output_text.delta' },
      { sequenceNumber: 1, type: 'response.completed' },
    ],
  });
  assert.equal(evaluateNativeResponsesStreamEvidence(duplicateSequence)._tag, 'Err');

  const eventAfterTerminal = evidence({
    events: [
      { sequenceNumber: 1, type: 'response.completed' },
      { sequenceNumber: 2, type: 'response.output_text.delta' },
    ],
  });
  assert.equal(evaluateNativeResponsesStreamEvidence(eventAfterTerminal)._tag, 'Err');

  const falseStream = evidence({ streamTrueVerified: false });
  assert.equal(evaluateNativeResponsesStreamEvidence(falseStream)._tag, 'Err');
});

test('stream receipt never certifies unverified store:false or protected item claims', () => {
  const receipt = evaluate(evidence({ storeFalseVerified: false, protectedItemsVerified: false }));
  assert.equal(receipt.evidenceStatus, 'NOT_CERTIFIED');
  assert.ok(receipt.reasonCodes.includes('STORE_FALSE_UNVERIFIED'));
  assert.ok(receipt.reasonCodes.includes('PROTECTED_ITEMS_UNVERIFIED'));
});

test('stream route allowlist requires a unique canonical HTTPS Responses route', () => {
  assert.deepEqual(validateNativeResponsesStreamingRoutes([{
    provider: ' OpenAI ', model: 'gpt-test', destination: 'https://api.openai.com/v1/responses',
  }]), [{ provider: 'openai', model: 'gpt-test', destination: 'https://api.openai.com/v1/responses' }]);
  assert.throws(() => validateNativeResponsesStreamingRoutes([
    { provider: 'openai', model: 'gpt-test', destination: 'https://api.openai.com/v1/responses' },
    { provider: 'OpenAI', model: 'gpt-test', destination: 'https://api.openai.com/v1/responses' },
  ]), /duplicate route/u);
  assert.throws(() => validateNativeResponsesStreamingRoutes([{
    provider: 'openai', model: 'gpt-test', destination: 'http://api.openai.com/v1/responses',
  }]), /HTTPS Responses URL/u);
  assert.throws(() => validateNativeResponsesStreamingRoutes([{
    provider: 'openai', model: 'gpt-test', destination: 'https://api.openai.com/v1/responses', unexpectedField: 'unrecognized',
  }]), /only provider, model, and destination/u);
});
