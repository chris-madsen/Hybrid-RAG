import assert from 'node:assert/strict';
import test from 'node:test';
import type { HarborFourArmName, HarborFourArmReportArm } from '../src/domain/harbor-four-arm.js';
import { bindHarborTrialsToFrozenTasks, parseHarborFourArmAttemptLedgerEvent, reconcileHarborFourArmAttemptLedger, reconcileHarborFourArmTrials, type HarborFourArmAttemptLedgerEvent, type HarborFourArmTrialObservation } from '../src/domain/harbor-four-arm-evidence.js';

const taskNames = ['task-a', 'task-a', 'task-b'];
const armNames: readonly HarborFourArmName[] = ['native', 'dense', 'hybrid', 'hybrid-delta'];

const observation = (
  arm: HarborFourArmName,
  index: number,
  overrides: Partial<HarborFourArmTrialObservation> = {},
): HarborFourArmTrialObservation => ({
  arm,
  trialId: `${arm}-${index}`,
  taskName: taskNames[index] ?? 'task-a',
  success: true,
  timedOut: false,
  observedAceCalls: arm === 'native' ? 0 : 1,
  successfulAceCalls: arm === 'native' ? 0 : 1,
  rawInputTokens: 10,
  rawOutputTokens: 2,
  cachedInputTokens: 1,
  nativeFileReads: 2,
  uniqueContextBytes: 100,
  newContextBytes: 80,
  reusedContextBytes: index === 1 && arm === 'hybrid-delta' ? 20 : 0,
  duplicateContextAvoided: index === 1 && arm === 'hybrid-delta' ? 20 : 0,
  latencyMs: 10 + index,
  successfulRequestIds: arm === 'native' ? [] : [`${arm}-request-${index}`],
  evidenceReceiptIds: arm === 'native' ? [] : [`${arm}-receipt-${index}`],
  reusedReceiptIds: index === 1 && arm === 'hybrid-delta' ? ['hybrid-delta-receipt-0'] : [],
  ...overrides,
});

const expected = (arm: HarborFourArmName, overrides: Partial<HarborFourArmReportArm> = {}): HarborFourArmReportArm => {
  const items = taskNames.map((_, index) => observation(arm, index));
  return {
    trials: items.length,
    successes: items.length,
    taskNames,
    rawInputTokens: 30,
    rawOutputTokens: 6,
    cachedInputTokens: 3,
    aceObservedCalls: arm === 'native' ? 0 : 3,
    nativeFileReads: 6,
    uniqueContextBytes: 300,
    newContextBytes: 240,
    reusedContextBytes: arm === 'hybrid-delta' ? 20 : 0,
    duplicateContextAvoided: arm === 'hybrid-delta' ? 20 : 0,
    latencyP95Ms: 12,
    failureCount: 0,
    timeoutCount: 0,
    ...overrides,
  };
};

const allExpected = (): Readonly<Record<HarborFourArmName, HarborFourArmReportArm>> => ({
  native: expected('native'),
  dense: expected('dense'),
  hybrid: expected('hybrid'),
  'hybrid-delta': expected('hybrid-delta'),
});

const allObservations = (): readonly HarborFourArmTrialObservation[] => armNames.flatMap((arm) =>
  taskNames.map((_, index) => observation(arm, index)));

test('four-arm evidence reconciles raw trials instead of trusting aggregate counters', () => {
  const result = reconcileHarborFourArmTrials(allExpected(), allObservations());
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Ok') {
    assert.equal(result.value.status, 'verified');
    assert.equal(result.value.releaseEligible, true);
    assert.equal(result.value.arms.hybrid.successfulAceCalls, 3);
    assert.equal(result.value.arms['hybrid-delta'].reusedContextBytes, 20);
  }
});

test('forged aggregate success or token counters are rejected', () => {
  const forged = allExpected();
  const result = reconcileHarborFourArmTrials({
    ...forged,
    hybrid: expected('hybrid', { successes: 2 }),
  }, allObservations());
  assert.equal(result._tag, 'Err');

  const forgedTokens = reconcileHarborFourArmTrials({
    ...forged,
    dense: expected('dense', { rawInputTokens: 999 }),
  }, allObservations());
  assert.equal(forgedTokens._tag, 'Err');
});

test('missing per-trial telemetry stays unknown and cannot pass release eligibility', () => {
  const observations = allObservations().map((item) => item.arm === 'hybrid'
    ? { ...item, nativeFileReads: null, latencyMs: null }
    : item);
  const result = reconcileHarborFourArmTrials(allExpected(), observations);
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Ok') {
    assert.equal(result.value.status, 'unknown');
    assert.equal(result.value.releaseEligible, false);
    assert.ok(result.value.arms.hybrid.unknownFields.includes('nativeFileReads.trials'));
    assert.ok(result.value.arms.hybrid.unknownFields.includes('latencyP95Ms.trials'));
  }
});

test('receipt reuse must be backed by a prior raw receipt for the same task', () => {
  const observations = allObservations().map((item) => item.arm === 'hybrid-delta' && item.trialId.endsWith('-1')
    ? { ...item, reusedReceiptIds: ['not-present-in-prior-trial'] }
    : item);
  const result = reconcileHarborFourArmTrials(allExpected(), observations);
  assert.equal(result._tag, 'Err');
});

test('native baseline ACE calls are rejected even when aggregate quality is good', () => {
  const observations = allObservations().map((item) => item.arm === 'native'
    ? { ...item, observedAceCalls: 1, successfulAceCalls: 1, successfulRequestIds: ['native-forbidden-request'] }
    : item);
  const result = reconcileHarborFourArmTrials(allExpected(), observations);
  assert.equal(result._tag, 'Err');
});

test('raw Harbor trial task identities must match frozen job paths/ids in the exact order', () => {
  const jobTasks = ['repo/task-a', 'repo/task-a', 'repo/task-b'];
  const bindings = [{ id: 'task-a', path: 'repo/task-a' }, { id: 'task-b', path: 'repo/task-b' }];
  const observed = [
    observation('native', 0),
    observation('native', 1, { taskName: 'repo/task-a' }),
    observation('native', 2),
  ];
  const bound = bindHarborTrialsToFrozenTasks(jobTasks, bindings, observed);
  assert.equal(bound._tag, 'Ok');
  if (bound._tag === 'Ok') assert.deepEqual(bound.value.map((item) => item.taskName), jobTasks);

  const unrelated = bindHarborTrialsToFrozenTasks(jobTasks, bindings, [
    observation('native', 0, { taskName: 'unfrozen-task' }),
    ...observed.slice(1),
  ]);
  assert.equal(unrelated._tag, 'Err');
  const reordered = bindHarborTrialsToFrozenTasks(jobTasks, bindings, [
    observed[2] as HarborFourArmTrialObservation,
    observed[1] as HarborFourArmTrialObservation,
    observed[0] as HarborFourArmTrialObservation,
  ]);
  assert.equal(reordered._tag, 'Err');
});

test('duplicate successful Gateway request IDs cannot be replayed across trials or arms', () => {
  const events = allObservations().map((item) => item.arm === 'hybrid' && item.trialId.endsWith('-0')
    ? { ...item, successfulRequestIds: ['dense-request-0'] }
    : item);
  const result = reconcileHarborFourArmTrials(allExpected(), events);
  assert.equal(result._tag, 'Err');
  if (result._tag === 'Err') assert.equal(result.error.path, 'harbor_trial_evidence.successfulRequestIds');
});

test('a successful native trial followed by ACE failure cannot be called quality non-inferior', () => {
  const events = allObservations().map((item) => item.arm === 'hybrid' && item.trialId.endsWith('-0')
    ? { ...item, success: false }
    : item);
  const result = reconcileHarborFourArmTrials(allExpected(), events);
  assert.equal(result._tag, 'Err');
  if (result._tag === 'Err') assert.equal(result.error.path, 'harbor_trial_evidence.hybrid.paired_quality');
});


const ar10Identity = {
  modelIdentity: 'model/revision@pinned',
  providerIdentity: 'provider/route@pinned',
  runtimeImageIdentity: 'image@sha256:' + 'a'.repeat(64),
};
const ar10Event = (
  trial: HarborFourArmTrialObservation,
  kind: 'attempt' | 'usage' | 'failure',
  overrides: Readonly<Record<string, unknown>> = {},
): HarborFourArmAttemptLedgerEvent => {
  const raw = {
    schemaVersion: 'ace.harbor.attempt-ledger.v1',
    kind,
    arm: trial.arm,
    trialId: trial.trialId,
    taskName: trial.taskName,
    attemptId: trial.trialId + '-a1',
    ...ar10Identity,
    ...(kind === 'attempt' ? { outcome: 'completed' } : {}),
    ...(kind === 'usage' ? {
      inputTokens: 10, outputTokens: 2, cachedInputTokens: 1, reasoningOutputTokens: 0,
    } : {}),
    ...(kind === 'failure' ? { code: 'PROVIDER_TIMEOUT' } : {}),
    ...overrides,
  };
  const parsed = parseHarborFourArmAttemptLedgerEvent(raw, kind);
  assert.equal(parsed._tag, 'Ok');
  if (parsed._tag === 'Err') throw new Error(parsed.error.message);
  return parsed.value;
};
const completeAr10Events = (): HarborFourArmAttemptLedgerEvent[] => allObservations().flatMap((trial) => [
  ar10Event(trial, 'attempt'), ar10Event(trial, 'usage'),
]);

test('AR10 REM-021/022 binds every attempt and usage to frozen arm/task/trial/provider/model', () => {
  const result = reconcileHarborFourArmAttemptLedger(allObservations(), completeAr10Events(), ar10Identity);
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.status, 'verified');
  assert.equal(result.value.arms.native.attemptCount, 3);
  assert.equal(result.value.arms.native.inputTokens, 30);
  assert.equal(result.value.arms.native.outputTokens, 6);
  assert.equal(result.value.arms.native.cachedInputTokens, 3);
  assert.equal(result.value.arms.native.reasoningOutputTokens, 0);
  assert.equal(result.value.arms.native.acceptedTasks, 3);
});

test('AR10 rejects wrong task, arm, model, provider, runtime, duplicate attempt and orphan usage', () => {
  const events = completeAr10Events();
  const trial = allObservations()[0] as HarborFourArmTrialObservation;
  for (const changed of [
    { taskName: 'not-in-frozen-job' }, { arm: 'dense' },
    { modelIdentity: 'wrong-model' }, { providerIdentity: 'wrong-provider' },
    { runtimeImageIdentity: 'wrong-image' },
  ]) {
    const forged = { ...events[0], ...changed } as HarborFourArmAttemptLedgerEvent;
    assert.equal(reconcileHarborFourArmAttemptLedger(
      allObservations(), [forged, ...events.slice(1)], ar10Identity,
    )._tag, 'Err');
  }
  assert.equal(reconcileHarborFourArmAttemptLedger(
    allObservations(), [...events, events[0] as HarborFourArmAttemptLedgerEvent], ar10Identity,
  )._tag, 'Err');
  assert.equal(reconcileHarborFourArmAttemptLedger(
    allObservations(), [...events.filter((event) => !(event.kind === 'attempt' && event.trialId === trial.trialId))], ar10Identity,
  )._tag, 'Err');
});

test('AR10 missing retry usage and failed attempts stay UNKNOWN, not free tokens', () => {
  const observations = allObservations();
  const slow = observations[0] as HarborFourArmTrialObservation;
  const extra = ar10Event(slow, 'attempt', { attemptId: 'retry-timeout', outcome: 'timeout' });
  const events = [...completeAr10Events(), extra, ar10Event(slow, 'failure', {
    attemptId: 'retry-timeout', code: 'PROVIDER_TIMEOUT',
  })];
  const result = reconcileHarborFourArmAttemptLedger(observations, events, ar10Identity);
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.status, 'unknown');
  assert.equal(result.value.arms.native.inputTokens, null);
  assert.equal(result.value.arms.native.outputTokens, null);
  assert.ok(result.value.unknownFields.some((x) => x.includes('retry-timeout')));
});

test('AR10 rejects mismatched provider usage, impossible cache/reasoning subsets and missing input counter', () => {
  const observations = allObservations();
  const events = completeAr10Events();
  const replaceUsage = (updates: Readonly<Record<string, unknown>>): HarborFourArmAttemptLedgerEvent[] => [
    events[0] as HarborFourArmAttemptLedgerEvent,
    ar10Event(observations[0] as HarborFourArmTrialObservation, 'usage', updates),
    ...events.slice(2),
  ];
  assert.equal(reconcileHarborFourArmAttemptLedger(
    observations, replaceUsage({ inputTokens: 100 }), ar10Identity,
  )._tag, 'Err');
  for (const invalid of [
    { cachedInputTokens: 1000 },
    { reasoningOutputTokens: 200 },
    { inputTokens: -1 },
  ]) {
    const raw = { ...events[1], ...invalid };
    assert.equal(parseHarborFourArmAttemptLedgerEvent(raw, 'usage')._tag, 'Err');
  }
  const missing = reconcileHarborFourArmAttemptLedger(observations,
    replaceUsage({ inputTokens: null }), ar10Identity);
  assert.equal(missing._tag, 'Ok');
  if (missing._tag === 'Ok') {
    assert.equal(missing.value.status, 'unknown');
    assert.equal(missing.value.arms.native.inputTokens, null);
  }
});


test('AR10: an unobserved accepted trial is UNKNOWN instead of an error or zero-token success', () => {
  const trial = allObservations()[0] as HarborFourArmTrialObservation;
  const events = completeAr10Events().filter((event) =>
    !(event.arm === trial.arm && event.trialId === trial.trialId));
  const reconciled = reconcileHarborFourArmAttemptLedger(allObservations(), events, ar10Identity);
  assert.equal(reconciled._tag, 'Ok');
  if (reconciled._tag === 'Ok') {
    assert.equal(reconciled.value.status, 'unknown');
    assert.equal(reconciled.value.arms.native.inputTokens, null);
    assert.equal(reconciled.value.arms.native.outputTokens, null);
    assert.ok(reconciled.value.unknownFields.includes('native.' + trial.trialId + '.attempts'));
  }
});

test('AR10: safe individual usage counters cannot overflow cumulative trial or arm totals', () => {
  const trial = allObservations()[0] as HarborFourArmTrialObservation;
  const observations = allObservations().map((item) => item.arm === trial.arm && item.trialId === trial.trialId
    ? { ...item, rawInputTokens: null }
    : item);
  const massive = completeAr10Events().map((event) =>
    event.kind === 'usage' && event.trialId === trial.trialId && event.arm === trial.arm
      ? { ...event, inputTokens: Number.MAX_SAFE_INTEGER }
      : event);
  const events = [
    ...massive,
    ar10Event(trial, 'attempt', { attemptId: 'overflow-extra-attempt' }),
    ar10Event(trial, 'usage', {
      attemptId: 'overflow-extra-attempt', inputTokens: 1,
      outputTokens: 0, cachedInputTokens: 0, reasoningOutputTokens: 0,
    }),
  ];
  const reconciled = reconcileHarborFourArmAttemptLedger(observations, events, ar10Identity);
  assert.equal(reconciled._tag, 'Err');
  if (reconciled._tag === 'Err') {
    assert.equal(reconciled.error.path, 'harbor_attempt_ledger.usage');
  }

  const second = allObservations()[1] as HarborFourArmTrialObservation;
  const armObservations = allObservations().map((item) =>
    item.arm === 'native' ? { ...item, rawInputTokens: null } : item);
  const armEvents = completeAr10Events().map((event) => event.kind === 'usage' && event.arm === 'native'
    && event.trialId === trial.trialId
    ? { ...event, inputTokens: Number.MAX_SAFE_INTEGER }
    : event.kind === 'usage' && event.arm === 'native' && event.trialId === second.trialId
      ? { ...event, inputTokens: 1 }
      : event);
  const armReconciled = reconcileHarborFourArmAttemptLedger(armObservations, armEvents, ar10Identity);
  assert.equal(armReconciled._tag, 'Err');
  if (armReconciled._tag === 'Err') {
    assert.equal(armReconciled.error.path, 'harbor_attempt_ledger.usage');
  }
});


test('Gateway-only four-arm trial data remains UNKNOWN without model delivery, rather than rejecting zero tool calls', () => {
  const gatewayOnly = allObservations().map((trial) => trial.arm === 'native'
    ? trial
    : {
      ...trial,
      observedAceCalls: 0,
      successfulAceCalls: 0,
      successfulRequestIds: [],
      evidenceReceiptIds: [],
      reusedReceiptIds: [],
      gatewayProjectionRequestIds: [trial.trialId + '-projection'],
    });
  const report = allExpected();
  const expectedGatewayOnly = {
    ...report,
    dense: expected('dense', { aceObservedCalls: 0 }),
    hybrid: expected('hybrid', { aceObservedCalls: 0 }),
    'hybrid-delta': expected('hybrid-delta', { aceObservedCalls: 0 }),
  };
  const result = reconcileHarborFourArmTrials(expectedGatewayOnly, gatewayOnly);
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Ok') {
    assert.equal(result.value.status, 'unknown');
    assert.equal(result.value.releaseEligible, false);
    assert.equal(result.value.arms.dense.observedAceCalls, 0);
    assert.equal(result.value.arms.hybrid.successfulAceCalls, 0);
  }
});

test('AR10: duplicate or native-contaminating Gateway projection IDs are not independent trial evidence', () => {
  const observations = allObservations().map((trial) => ({
    ...trial,
    gatewayProjectionRequestIds: trial.arm === 'native' ? [] : [trial.trialId + '-projection'],
  }));
  const duplicated = observations.map((trial) => trial.arm === 'hybrid' && trial.trialId.endsWith('-0')
    ? { ...trial, gatewayProjectionRequestIds: ['dense-0-projection'] }
    : trial);
  const sameTrialDuplicate = observations.map((trial) => trial.arm === 'hybrid' && trial.trialId.endsWith('-0')
    ? { ...trial, gatewayProjectionRequestIds: ['x', 'x'] }
    : trial);
  const contaminated = observations.map((trial) => trial.arm === 'native' && trial.trialId.endsWith('-0')
    ? { ...trial, gatewayProjectionRequestIds: ['unexpected-projection'] }
    : trial);
  for (const altered of [duplicated, sameTrialDuplicate, contaminated]) {
    const result = reconcileHarborFourArmTrials(allExpected(), altered);
    assert.equal(result._tag, 'Err');
    if (result._tag === 'Err') assert.equal(result.error.path, 'harbor_trial_evidence.gatewayProjectionRequestIds');
  }
});
