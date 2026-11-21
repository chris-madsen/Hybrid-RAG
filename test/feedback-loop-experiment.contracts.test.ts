import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  reconcileFeedbackTrials,
  validateFeedbackExperimentManifest,
  validateFeedbackTaskManifest,
  validateFeedbackReport,
  type FeedbackTaskManifest,
  type FeedbackTrialObservation,
} from '../src/domain/feedback-loop-experiment.js';
import {
  dockerImageMatchesDigest,
  feedbackHermesAgentImportPath,
  feedbackHermesVersion,
  validateFeedbackHarborJob,
  validateMatchingFeedbackHarborJobs,
} from '../src/domain/feedback-harbor-config.js';

const revision = 'a'.repeat(40);
const digest = (character: string): string => character.repeat(64);
const finalWireCandidate = (requestId: string) => ({
  status: 'REAL_PROVIDER_CANDIDATE',
  requestId,
  attemptId: `bf-attempt-${'b'.repeat(32)}`,
} as const);

const manifest: FeedbackTaskManifest = {
  schemaVersion: 1,
  selection: 'smoke',
  dataset: { id: 'scale-ai/swe-atlas-qna', revision, rawSha256: digest('b') },
  tasks: [{ id: 'task-1', sourceRevision: revision, sourceDigest: digest('c'), taskDigest: digest('d') }],
  holdout: [],
};

const observation = (
  arm: FeedbackTrialObservation['arm'],
  overrides: Partial<FeedbackTrialObservation> = {},
): FeedbackTrialObservation => ({
  arm,
  taskId: 'task-1',
  trialId: `${arm}-trial-1`,
  sourceRevision: revision,
  sourceDigest: digest('c'),
  taskDigest: digest('d'),
  quality: 'pass',
  usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 20, costUsd: 0.01 },
  durationMs: 100,
  ...(arm === 'native' ? { nativeFileReads: 2 } : {}),
  observedAceCalls: arm === 'native' ? 0 : 1,
  observedAceRequestIds: arm === 'native' ? [] : ['request-1'],
  providerTraceRequestIds: arm === 'native' ? [] : ['request-1'],
  rawArtifactHashes: [{ path: `${arm}/result.json`, sha256: digest('e') }],
  ...overrides,
});

const reconcile = (native = observation('native'), ace = observation('ace_optional')) =>
  reconcileFeedbackTrials({ taskManifest: manifest, native: [native], ace: [ace] });

test('feedback loop retains paired usage but does not attribute it without final-wire evidence', () => {
  const result = reconcile(undefined, observation('ace_optional', {
    usage: { inputTokens: 40, cachedInputTokens: 10, outputTokens: 10, reasoningOutputTokens: 4, costUsd: 0.005 },
  }));
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') throw new Error(result.error.message);
  assert.equal(result.value.status, 'UNKNOWN');
  assert.equal(result.value.qualityGate, 'pass');
  assert.equal(result.value.nativeTotalTokens, 120);
  assert.equal(result.value.aceTotalTokens, 50);
  assert.equal(result.value.aceCachedInputTokens, 10);
  assert.equal(result.value.aceReasoningOutputTokens, 4);
  assert.equal(result.value.aceTotalTokens, 50, 'cached and reasoning subsets are not added to input/output totals');
  assert.equal(result.value.rows[0]?.aceCorrelation, 'UNKNOWN');
  assert.equal(result.value.tokenRatio, null);
});

test('optional ACE with no calls is ACE_NOT_USED and cannot claim token savings', () => {
  const result = reconcile(undefined, observation('ace_optional', {
    observedAceCalls: 0,
    observedAceRequestIds: [],
    providerTraceRequestIds: [],
  }));
  assert.equal(result._tag, 'Ok');
  assert.equal(result.value.status, 'ACE_NOT_USED');
  assert.equal(result.value.aceNotUsed, true);
  assert.equal(result.value.tokenRatio, null);
  assert.equal(result.value.rows[0]?.aceCorrelation, 'ACE_NOT_USED');
});

test('native arm with an ACE call is invalid instead of being treated as a clean baseline', () => {
  const result = reconcile(observation('native', {
    observedAceCalls: 1,
    observedAceRequestIds: ['native-request'],
    providerTraceRequestIds: ['native-request'],
  }));
  assert.equal(result._tag, 'Err');
  assert.match(result.error.message, /native arm/u);
});

test('observed ACE calls without provider correlation remain UNKNOWN', () => {
  const result = reconcile(undefined, observation('ace_optional', { providerTraceRequestIds: [] }));
  assert.equal(result._tag, 'Ok');
  assert.equal(result.value.status, 'UNKNOWN');
  assert.equal(result.value.tokenRatio, null);
  assert.equal(result.value.rows[0]?.aceCorrelation, 'UNKNOWN');
});

test('native pass and ACE fail is a per-task quality regression', () => {
  const result = reconcile(undefined, observation('ace_optional', { quality: 'fail' }));
  assert.equal(result._tag, 'Ok');
  assert.equal(result.value.status, 'QUALITY_REGRESSION');
  assert.deepEqual(result.value.qualityRegressionTaskIds, ['task-1']);
  assert.equal(result.value.tokenRatio, null);
});

test('failed trial evidence is retained and missing usage remains UNKNOWN', () => {
  const result = reconcile(observation('native', { quality: 'fail', usage: {} }));
  assert.equal(result._tag, 'Ok');
  assert.equal(result.value.status, 'UNKNOWN');
  assert.equal(result.value.rows[0]?.nativeQuality, 'fail');
  assert.equal(result.value.rows[0]?.nativeTotalTokens, null);
});

test('observed zero tokens are valid but missing tokens stay unknown, and subsets cannot exceed totals', () => {
  const result = reconcile(observation('native', { quality: 'fail', usage: { inputTokens: 0, outputTokens: 0 } }));
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.rows[0]?.nativeTotalTokens, 0);
  assert.equal(result.value.status, 'UNKNOWN');
  assert.equal(result.value.tokenRatio, null);
  const negative = reconcile(observation('native', { usage: { inputTokens: -1, outputTokens: 20 } }));
  assert.equal(negative._tag, 'Err');
  const invalidReasoningSubset = reconcile(undefined, observation('ace_optional', {
    usage: { inputTokens: 20, outputTokens: 10, reasoningOutputTokens: 11 },
  }));
  assert.equal(invalidReasoningSubset._tag, 'Err');
  if (invalidReasoningSubset._tag === 'Ok') return;
  assert.match(invalidReasoningSubset.error.message, /reasoning output tokens cannot exceed output tokens/u);
});

test('missing raw artifact hash is rejected', () => {
  const result = reconcile(observation('native', { rawArtifactHashes: [] }));
  assert.equal(result._tag, 'Err');
  assert.match(result.error.message, /raw artifact hash/u);
});

test('source/task digest mismatch blocks the paired result', () => {
  const result = reconcile(undefined, observation('ace_optional', { sourceDigest: digest('f') }));
  assert.equal(result._tag, 'Err');
  assert.equal(result.error.code, 'DIGEST_MISMATCH');
});

test('duplicate trial and request IDs are invalid', () => {
  const duplicateTrial = reconcile(observation('native', { trialId: 'same' }), observation('ace_optional', { trialId: 'same' }));
  assert.equal(duplicateTrial._tag, 'Err');
  const duplicateRequest = reconcile(undefined, observation('ace_optional', {
    observedAceRequestIds: ['request-1', 'request-1'],
    observedAceCalls: 2,
  }));
  assert.equal(duplicateRequest._tag, 'Err');
});


test('the same request ID may appear in several evidence channels of one trial, but not another trial', () => {
  const joined = reconcile(undefined, observation('ace_optional', {
    gatewayProjectionRequestIds: ['request-1'],
    contextTransformRequestIds: ['request-1'],
    observedAceContextCalls: 1,
    observedAceCalls: 2,
  }));
  assert.equal(joined._tag, 'Ok');
  if (joined._tag === 'Ok') {
    assert.equal(joined.value.rows[0]?.aceCorrelation, 'UNKNOWN',
      'cross-channel identity overlap is not signed proof of delivery');
  }
  const twoTasks = {
    ...manifest, tasks: [...manifest.tasks, {
      id: 'task-2', sourceRevision: revision, sourceDigest: digest('c'), taskDigest: digest('d'),
    }],
  };
  const repeated = reconcileFeedbackTrials({
    taskManifest: twoTasks,
    native: [observation('native'), observation('native', { taskId: 'task-2', trialId: 'native-trial-2' })],
    ace: [
      observation('ace_optional'),
      observation('ace_optional', { taskId: 'task-2', trialId: 'ace-trial-2',
        observedAceRequestIds: ['request-1'] }),
    ],
  });
  assert.equal(repeated._tag, 'Err', 'request identity replay across trials must fail closed');
});

test('multiple ACE calls remain uncorrelated without model-bound final-wire evidence', () => {
  const result = reconcile(undefined, observation('ace_optional', {
    observedAceCalls: 3,
    observedAceRequestIds: ['request-1', 'request-2', 'request-3'],
    providerTraceRequestIds: ['request-1', 'request-2', 'request-3'],
  }));
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.status, 'UNKNOWN');
  assert.equal(result.value.aceObservedCalls, 3);
  assert.equal(result.value.aceCorrelatedCalls, 0);
});

test('internal provider-trace overlap does not count as partial final-wire correlation', () => {
  const result = reconcile(undefined, observation('ace_optional', {
    observedAceCalls: 3,
    observedAceRequestIds: ['request-1', 'request-2', 'request-3'],
    providerTraceRequestIds: ['request-1', 'request-3'],
  }));
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.status, 'UNKNOWN');
  assert.equal(result.value.aceObservedCalls, 3);
  assert.equal(result.value.aceCorrelatedCalls, 0);
  assert.equal(result.value.tokenRatio, null);
});

test('ace_expand and ace_context calls do not imply model-bound provider delivery', () => {
  const result = reconcile(undefined, observation('ace_optional', {
    observedAceCalls: 2,
    observedAceRequestIds: ['request-1'],
    providerTraceRequestIds: ['request-1'],
    observedAceContextCalls: 1,
  } as Partial<FeedbackTrialObservation> & { readonly observedAceContextCalls: number }));
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.status, 'UNKNOWN');
  assert.equal(result.value.aceObservedCalls, 2);
  assert.equal(result.value.aceCorrelatedCalls, 0);
  assert.equal(result.value.rows[0]?.aceCorrelation, 'UNKNOWN');
});

test('Hermes retrieval trace cannot stand in for model-bound ContextEngine delivery', () => {
  const result = reconcile(undefined, observation('ace_optional', {
    observedAceCalls: 1,
    observedAceContextCalls: 0,
    observedAceRequestIds: [],
    contextTransformRequestIds: ['transform-1'],
    hermesContextEvidence: [{
      schemaVersion: 1,
      requestId: 'transform-1',
      sessionId: 'session-1',
      turnId: 'turn-1',
      status: 'ready',
      receiptId: 'receipt-1',
      providerRequestId: 'retrieval-1',
      selectedEvidenceIds: ['evidence-1'],
      omittedEvidenceIds: [],
      bridgeDigest: digest('a'),
      pluginDigest: digest('b'),
      estimatedTokens: 20,
      limitations: [],
    }],
    providerTraceRequestIds: ['retrieval-1'],
  }));
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.status, 'UNKNOWN');
  assert.equal(result.value.rows[0]?.aceCorrelation, 'UNKNOWN');
  assert.equal(result.value.rows[0]?.aceCalled, true);
  assert.equal(result.value.aceObservedCalls, 1);
  assert.equal(result.value.aceCorrelatedCalls, 0);
  assert.equal(result.value.tokenRatio, null);
});

test('automatic Gateway projections and unpinned provider candidates remain non-attributable', () => {
  const requestId = `ace-${'a'.repeat(32)}`;
  const result = reconcile(undefined, observation('ace_optional', {
    observedAceCalls: 0,
    observedAceContextCalls: 0,
    observedAceRequestIds: [],
    gatewayProjectionRequestIds: [requestId],
    providerTraceRequestIds: [requestId],
    finalWireAttemptBindings: [finalWireCandidate(requestId)],
  }));
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.status, 'UNKNOWN');
  assert.equal(result.value.rows[0]?.aceCalled, true);
  assert.equal(result.value.rows[0]?.aceCorrelation, 'UNKNOWN');
  assert.equal(result.value.aceObservedCalls, 0);
  assert.equal(result.value.aceCorrelatedCalls, 0);
  assert.equal(result.value.tokenRatio, null);
});

test('quality regression never presents token savings even in the per-task row', () => {
  const result = reconcile(undefined, observation('ace_optional', {
    quality: 'fail',
    usage: { inputTokens: 20, cachedInputTokens: 0, outputTokens: 10 },
  }));
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.status, 'QUALITY_REGRESSION');
  assert.equal(result.value.rows[0]?.tokenRatio, null);
  assert.equal(result.value.tokenRatio, null);
});


test('failed paired tasks cannot be counted as savings per accepted task', () => {
  const bothFailed = reconcile(observation('native', { quality: 'fail' }), observation('ace_optional', { quality: 'fail' }));
  assert.equal(bothFailed._tag, 'Ok');
  if (bothFailed._tag === 'Ok') {
    assert.equal(bothFailed.value.status, 'UNKNOWN');
    assert.equal(bothFailed.value.tokenRatio, null);
    assert.equal(bothFailed.value.rows[0]?.tokenRatio, null);
  }
  const improved = reconcile(observation('native', { quality: 'fail' }));
  assert.equal(improved._tag, 'Ok');
  if (improved._tag === 'Ok') {
    assert.equal(improved.value.status, 'UNKNOWN');
    assert.equal(improved.value.tokenRatio, null);
    assert.equal(improved.value.rows[0]?.qualityDelta, 'no_regression');
  }
});

test('main task manifest requires ten frozen tasks and ten untouched holdout tasks', () => {
  const result = validateFeedbackTaskManifest({
    ...manifest,
    selection: 'main',
  });
  assert.equal(result._tag, 'Err');
  assert.match(result.error.message, /exactly 10/u);
});

test('holdout selection requires ten tasks and no main set', () => {
  const result = validateFeedbackTaskManifest({
    ...manifest,
    selection: 'holdout',
    tasks: Array.from({ length: 10 }, (_, index) => ({
      ...manifest.tasks[0],
      id: `holdout-${index}`,
    })),
  });
  assert.equal(result._tag, 'Ok');
});

test('local deterministic feedback manifests preserve their own dataset identity', () => {
  const result = validateFeedbackTaskManifest({
    schemaVersion: 1,
    selection: 'smoke',
    dataset: { id: 'local/ace-suite', revision, rawSha256: digest('b') },
    tasks: [{
      id: 'ace/ace-local-smoke-paired',
      sourceRevision: revision,
      sourceDigest: digest('c'),
      taskDigest: digest('d'),
      taskPath: 'benchmarks/harbor/ace-local-smoke-paired',
    }],
    holdout: [],
  });
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Ok') assert.equal(result.value.dataset.id, 'local/ace-suite');
});

test('freeze CLI creates a provenance-bound one-task smoke manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-feedback-smoke-freeze-'));
  const tasksPath = join(root, 'task-identities.jsonl');
  const output = join(root, 'frozen');
  await writeFile(tasksPath, `${JSON.stringify({
    ...manifest.tasks[0],
    taskPath: 'tasks/task-1',
  })}\n`);
  const run = spawnSync(resolve('node_modules/.bin/tsx'), [
    'scripts/freeze-feedback-task-manifest.ts',
    '--tasks', tasksPath,
    '--dataset-revision', revision,
    '--dataset-sha256', digest('b'),
    '--output', output,
    '--smoke-id', 'task-1',
  ], { cwd: resolve('.'), encoding: 'utf8', timeout: 120_000 });
  assert.equal(run.status, 0, run.stderr);
  const frozen = JSON.parse(await readFile(join(output, 'task-manifest.json'), 'utf8')) as FeedbackTaskManifest;
  assert.equal(frozen.selection, 'smoke');
  assert.equal(frozen.tasks.length, 1);
  assert.equal(frozen.tasks[0]?.id, 'task-1');
  assert.deepEqual(frozen.holdout, []);
  const selection = JSON.parse(await readFile(join(output, 'selection.json'), 'utf8')) as Record<string, unknown>;
  assert.equal(selection.smokeId, 'task-1');
  assert.equal(validateFeedbackTaskManifest(frozen)._tag, 'Ok');
});

test('freeze CLI rejects mixed selection modes instead of silently ignoring extra IDs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-feedback-mixed-freeze-'));
  const tasksPath = join(root, 'task-identities.jsonl');
  const output = join(root, 'frozen');
  await writeFile(tasksPath, `${JSON.stringify({
    ...manifest.tasks[0],
    taskPath: 'tasks/task-1',
  })}\n`);
  const run = spawnSync(resolve('node_modules/.bin/tsx'), [
    'scripts/freeze-feedback-task-manifest.ts',
    '--tasks', tasksPath,
    '--dataset-revision', revision,
    '--dataset-sha256', digest('b'),
    '--output', output,
    '--smoke-id', 'task-1',
    '--main-id', 'task-1',
  ], { cwd: resolve('.'), encoding: 'utf8', timeout: 120_000 });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Usage:/u);
});

test('freeze CLI creates a provenance-bound holdout-only manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-feedback-holdout-freeze-'));
  const tasksPath = join(root, 'task-identities.jsonl');
  const output = join(root, 'frozen');
  const tasks = Array.from({ length: 10 }, (_, index) => ({
    ...manifest.tasks[0],
    id: `holdout-${index}`,
    taskPath: `tasks/holdout-${index}`,
  }));
  await writeFile(tasksPath, `${tasks.map((task) => JSON.stringify(task)).join('\n')}\n`);
  const args = tasks.flatMap((task) => ['--holdout-only-id', task.id]);
  const run = spawnSync(resolve('node_modules/.bin/tsx'), [
    'scripts/freeze-feedback-task-manifest.ts',
    '--tasks', tasksPath,
    '--dataset-revision', revision,
    '--dataset-sha256', digest('b'),
    '--output', output,
    ...args,
  ], { cwd: resolve('.'), encoding: 'utf8', timeout: 120_000 });
  assert.equal(run.status, 0, run.stderr);
  const frozen = JSON.parse(await readFile(join(output, 'task-manifest.json'), 'utf8')) as FeedbackTaskManifest;
  assert.equal(frozen.selection, 'holdout');
  assert.equal(frozen.tasks.length, 10);
  assert.deepEqual(frozen.holdout, []);
  assert.equal(validateFeedbackTaskManifest(frozen)._tag, 'Ok');
});

test('holdout mutation and duplicate IDs are rejected before trials are reconciled', () => {
  const mainTasks = Array.from({ length: 10 }, (_, index) => ({
    ...manifest.tasks[0],
    id: `main-${index}`,
  }));
  const holdoutTasks = Array.from({ length: 10 }, (_, index) => ({
    ...manifest.tasks[0],
    id: index === 0 ? 'main-0' : `holdout-${index}`,
  }));
  const result = validateFeedbackTaskManifest({
    ...manifest,
    selection: 'main',
    tasks: mainTasks,
    holdout: holdoutTasks,
  });
  assert.equal(result._tag, 'Err');
  assert.match(result.error.message, /unique/u);
});

test('feedback report validator rejects malformed rows and zero economic counters', () => {
  const reconciled = reconcile();
  assert.equal(reconciled._tag, 'Ok');
  if (reconciled._tag === 'Err') return;
  assert.equal(validateFeedbackReport(reconciled.value)._tag, 'Ok');
  assert.equal(validateFeedbackReport({ ...reconciled.value, rows: [] })._tag, 'Err');
  assert.equal(validateFeedbackReport({ ...reconciled.value, nativeTotalTokens: 0 })._tag, 'Err');
  assert.equal(validateFeedbackReport({ ...reconciled.value, qualityRegressionTaskIds: [7] })._tag, 'Err');
  assert.equal(validateFeedbackReport({ ...reconciled.value, nativeTotalTokens: (reconciled.value.nativeTotalTokens ?? 0) + 1 })._tag, 'Err');
});


test('Harbor agent preparation cannot silently restore retired direct ACE context injection', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['prepare:harbor-feedback'], undefined);
  const runtime = await readFile('src/bin/ace-runtime.ts', 'utf8');
  assert.match(runtime, /Direct agent context bridge mode is retired/u);
});

test('untrusted RepoBench pickle is rejected before Python can deserialize it', async (t) => {
  const python = spawnSync('python3', ['--version'], { encoding: 'utf8' });
  if (python.status !== 0) return t.skip('Python3 is unavailable in this test runtime');
  const root = await mkdtemp(join(tmpdir(), 'ace-untrusted-pickle-'));
  const input = join(root, 'records.raw');
  const output = join(root, 'records.jsonl');
  const bytes = Buffer.from('not a trusted pickle');
  await writeFile(input, bytes);
  const argumentsPrefix = [
    'scripts/repobench-r-pickle-to-json.py',
    '--input', input, '--config', 'python_cff', '--split', 'test_easy', '--output', output,
  ];
  const mismatched = spawnSync('python3', [
    ...argumentsPrefix, '--expected-sha256', 'a'.repeat(64), '--trust-pickle-source',
  ], { cwd: resolve('.'), encoding: 'utf8' });
  assert.equal(mismatched.status, 2);
  assert.match(mismatched.stderr, /digest does not match/u);
  const validDigest = createHash('sha256').update(bytes).digest('hex');
  const noOptIn = spawnSync('python3', [
    ...argumentsPrefix, '--expected-sha256', validDigest,
  ], { cwd: resolve('.'), encoding: 'utf8' });
  assert.equal(noOptIn.status, 2);
  assert.match(noOptIn.stderr, /trust-pickle-source/u);
});

test('RepoBench Parquet converter rejects an unpinned digest before importing a reader', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-repobench-parquet-'));
  const input = join(root, 'records.parquet');
  const output = join(root, 'records.jsonl');
  await writeFile(input, 'not parquet');
  const run = spawnSync('python3', [
    'scripts/repobench-r-parquet-to-json.py',
    '--input', input,
    '--config', 'python_cff',
    '--split', 'test_easy',
    '--output', output,
    '--expected-sha256', digest('a'),
  ], { cwd: resolve('.'), encoding: 'utf8', timeout: 120_000 });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /digest/u);
});

const hermesAgent = (withAce: boolean, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  import_path: feedbackHermesAgentImportPath,
  model_name: 'openai-codex/gpt-5.6-luna',
  kwargs: {
    version: feedbackHermesVersion,
    reasoning_effort: 'high',
    bifrost_endpoint_sha256: digest('a'),
    ace_context_enabled: withAce,
    ...(withAce
      ? { ace_context_bridge_sha256: digest('a'), context_plugin_sha256: digest('b') }
      : {}),
  },
  ...overrides,
});

const harborJob = (withAce = false, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  tasks: [{ path: '/frozen/task-a' }],
  agents: [hermesAgent(withAce)],
  n_concurrent_trials: 1,
  n_attempts: 1,
  ...overrides,
});

test('feedback Harbor identity rejects retired direct ACE injection and accepts a Gateway-routed pair', () => {
  const checked = validateMatchingFeedbackHarborJobs(harborJob(), harborJob());
  assert.equal(checked._tag, 'Ok');
  if (checked._tag === 'Ok') {
    assert.equal(checked.value.agent, 'hermes');
    assert.equal(checked.value.agentVersion, feedbackHermesVersion);
    assert.equal(checked.value.model, 'openai-codex/gpt-5.6-luna');
    assert.equal(checked.value.reasoningEffort, 'high');
    assert.equal(checked.value.hasAceContextEngine, false);
    assert.equal(checked.value.gatewayDelivery, 'bifrost-provider-endpoint');
  }
  assert.equal(validateFeedbackHarborJob(harborJob(true))._tag, 'Err');
  assert.equal(validateMatchingFeedbackHarborJobs(harborJob(), harborJob(true))._tag, 'Err');
});

test('preflight treats missing provider-native token telemetry as UNKNOWN, not an admission gate', async () => {
  const source = await readFile('scripts/feedback-loop-preflight.ts', 'utf8');
  assert.match(source, /providerTokenWindow: \\{[\\s\\S]*?status: 'unknown'/u);
  const required = /const required = \\[([\\s\\S]*?)\\];/u.exec(source)?.[1];
  assert.ok(required, 'preflight required-check declaration must exist');
  assert.doesNotMatch(required!, /'providerTokenWindow'/u);
  assert.match(required!, /'taskRuntimeProbe'/u,
    'unknown telemetry must not silently certify the actual task integration');
});

test('feedback Harbor identity rejects different frozen task sets between Hermes arms', () => {
  assert.equal(validateMatchingFeedbackHarborJobs(
    harborJob(),
    harborJob(false, { tasks: [{ path: '/frozen/task-b' }] }),
  )._tag, 'Err');
});

test('feedback Harbor identity rejects agent/model/version drift and non-serial jobs', () => {
  assert.equal(validateFeedbackHarborJob(harborJob(false, {
    agents: [hermesAgent(false, { import_path: 'harbor.agents.installed.hermes:Hermes' })],
  }))._tag, 'Err');
  assert.equal(validateFeedbackHarborJob(harborJob(false, {
    agents: [hermesAgent(false, { model_name: 'openrouter/gpt-5.6-luna' })],
  }))._tag, 'Err');
  // Harbor's factory dispatches built-in name *before* import_path:
  // accepting both would reintroduce a provider fallback without warning.
  for (const builtin of ['hermes', 'codex']) {
    const hijacked = validateFeedbackHarborJob(harborJob(false, {
      agents: [hermesAgent(false, { name: builtin })],
    }));
    assert.equal(hijacked._tag, 'Err', `built-in ${builtin} must not replace the custom OAuth adapter`);
  }
  assert.equal(validateFeedbackHarborJob(harborJob(false, {
    extra_instructions: ['Before answering, call ace_context'],
  }))._tag, 'Err');
  assert.equal(validateFeedbackHarborJob(harborJob(false, {
    agents: [hermesAgent(false, { kwargs: { version: 'latest', reasoning_effort: 'high' } })],
  }))._tag, 'Err');
  assert.equal(validateFeedbackHarborJob(harborJob(false, { n_concurrent_trials: 2 }))._tag, 'Err');
  assert.equal(validateFeedbackHarborJob(harborJob(false, { n_attempts: 2 }))._tag, 'Err');
  assert.equal(validateMatchingFeedbackHarborJobs(
    harborJob(false, { agents: [hermesAgent(false, { kwargs: {
      version: feedbackHermesVersion,
      reasoning_effort: 'high',
      bifrost_endpoint_sha256: digest('c'),
    } })] }),
    harborJob(),
  )._tag, 'Err');
});

test('Docker feedback image identity accepts a local image ID or matching repository digest only', () => {
  const imageDigest = `sha256:${'a'.repeat(64)}`;
  assert.equal(dockerImageMatchesDigest(imageDigest, { Id: imageDigest, RepoDigests: [] }), true);
  assert.equal(dockerImageMatchesDigest(imageDigest, { Id: 'sha256:other', RepoDigests: [`registry.example/ace@${imageDigest}`] }), true);
  assert.equal(dockerImageMatchesDigest(imageDigest, { Id: 'sha256:other', RepoDigests: [] }), false);
  assert.equal(dockerImageMatchesDigest('not-a-digest', { Id: imageDigest }), false);
});

test('feedback experiment manifest rejects contradictory single-image and task-image digests', () => {
  const checked = validateFeedbackExperimentManifest({
    schemaVersion: 1,
    runId: 'smoke-1',
    sourceCommit: revision,
    taskManifestSha256: digest('a'),
    agent: 'hermes',
    agentVersion: feedbackHermesVersion,
    model: 'openai-codex/gpt-5.6-luna',
    reasoningEffort: 'high',
    harborVersion: '0.24.0',
    imageDigest: `sha256:${digest('b')}`,
    taskImages: [{ reference: 'registry.example/task:1', digest: `sha256:${digest('c')}` }],
    agentAdapterSha256: digest('d'),
    aceContextBridgeSha256: digest('e'),
    contextPluginSha256: digest('f'),
    seed: 'unknown',
    mode: 'cold',
    nConcurrentTrials: 1,
    nAttempts: 1,
    authenticationRoute: 'Hermes openai-codex OAuth',
  });
  assert.equal(checked._tag, 'Err');
});

test('feedback experiment manifest accepts pinned per-task Docker images for multi-image datasets', () => {
  const checked = validateFeedbackExperimentManifest({
    schemaVersion: 1,
    runId: 'main-serial-1',
    sourceCommit: revision,
    taskManifestSha256: digest('a'),
    agent: 'hermes',
    agentVersion: feedbackHermesVersion,
    model: 'openai-codex/gpt-5.6-luna',
    reasoningEffort: 'high',
    harborVersion: '0.24.0',
    taskImages: [
      { reference: 'registry.example/calypso:1', digest: `sha256:${digest('b')}` },
      { reference: 'registry.example/simple-login:1', digest: `sha256:${digest('c')}` },
    ],
    agentAdapterSha256: digest('d'),
    aceContextBridgeSha256: digest('e'),
    contextPluginSha256: digest('f'),
    seed: 'unknown',
    mode: 'cold',
    nConcurrentTrials: 1,
    nAttempts: 1,
    authenticationRoute: 'Hermes openai-codex OAuth',
  });
  assert.equal(checked._tag, 'Ok');
  if (checked._tag === 'Ok') assert.equal(checked.value.taskImages.length, 2);
  assert.equal(validateFeedbackExperimentManifest({
    schemaVersion: 1,
    runId: 'main-serial-1',
    sourceCommit: revision,
    taskManifestSha256: digest('a'),
    agent: 'hermes',
    agentVersion: feedbackHermesVersion,
    model: 'openai-codex/gpt-5.6-luna',
    reasoningEffort: 'high',
    harborVersion: '0.24.0',
    taskImages: [{ reference: 'registry.example/calypso:1', digest: 'not-a-digest' }],
    agentAdapterSha256: digest('d'),
    aceContextBridgeSha256: digest('e'),
    contextPluginSha256: digest('f'),
    seed: 'unknown',
    mode: 'cold',
    nConcurrentTrials: 1,
    nAttempts: 1,
    authenticationRoute: 'Hermes openai-codex OAuth',
  })._tag, 'Err');
});
