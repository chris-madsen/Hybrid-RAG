import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessHarborFourArmFiveX,
  totalTokensPerAcceptedTaskRatio,
  validateHarborFourArmDesign,
  validateHarborFourArmReport,
} from '../src/domain/harbor-four-arm.js';

const taskPaths = [
  'benchmarks/ace/task-a',
  'benchmarks/ace/task-b',
  'benchmarks/ace/task-c',
  'external/task-a',
  'external/task-b',
  'external/task-c',
].flatMap((path) => [path, path, path, path, path]);

const job = (config?: string, extraInstructions: readonly string[] = []) => ({
  tasks: taskPaths.map((path) => ({ path })),
  agents: [{
    name: 'codex',
    model_name: 'gpt-5.6-luna',
    env: { CODEX_FORCE_AUTH_JSON: '1' },
    kwargs: { reasoning_effort: 'high', ...(config === undefined ? {} : { config }) },
  }],
  ...(extraInstructions.length === 0 ? {} : { extra_instructions: extraInstructions }),
});

const arm = (aceObservedCalls: number, reusedContextBytes = 0) => ({
  trials: taskPaths.length,
  successes: taskPaths.length,
  taskNames: taskPaths,
  rawInputTokens: 100,
  rawOutputTokens: 20,
  cachedInputTokens: 0,
  aceObservedCalls,
  nativeFileReads: 10,
  uniqueContextBytes: 1000,
  newContextBytes: 800,
  reusedContextBytes,
  duplicateContextAvoided: reusedContextBytes,
  latencyP95Ms: 100,
  failureCount: 0,
  timeoutCount: 0,
});

test('four-arm Harbor design pins one workload, model, reasoning and five serial repeats', () => {
  const result = validateHarborFourArmDesign(
    job(),
    job('four-arm-dense-codex-config.toml'),
    job('four-arm-hybrid-codex-config.toml'),
    job('four-arm-hybrid-delta-codex-config.toml'),
    { repositoryIds: ['ace', 'external'] },
  );
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Ok') {
    assert.equal(result.value.distinctTaskCount, 6);
    assert.deepEqual(result.value.tasksPerRepository, { ace: 15, external: 15 });
  }
});

test('four-arm design rejects forced ACE prompts and non-repeatable workloads', () => {
  const forced = validateHarborFourArmDesign(
    job(),
    job('four-arm-dense-codex-config.toml'),
    job('four-arm-hybrid-codex-config.toml'),
    job('four-arm-hybrid-delta-codex-config.toml', ['Before editing, must call ace_context.']),
    { repositoryIds: ['ace', 'external'] },
  );
  assert.equal(forced._tag, 'Err');

  const tooFew = validateHarborFourArmDesign(
    { ...job(), tasks: taskPaths.slice(0, -1).map((path) => ({ path })) },
    job('four-arm-dense-codex-config.toml'),
    job('four-arm-hybrid-codex-config.toml'),
    job('four-arm-hybrid-delta-codex-config.toml'),
    { repositoryIds: ['ace', 'external'] },
  );
  assert.equal(tooFew._tag, 'Err');
});

test('external four-arm design requires one task manifest and immutable revisions', () => {
  const options = { repositoryIds: ['ace', 'external'], requireExternalEvidence: true } as const;
  assert.equal(validateHarborFourArmDesign(
    job(),
    job('four-arm-dense-codex-config.toml'),
    job('four-arm-hybrid-codex-config.toml'),
    job('four-arm-hybrid-delta-codex-config.toml'),
    options,
  )._tag, 'Err');
  const evidence = {
    external_evidence: {
      schema_version: 1,
      task_manifest_path: 'fixtures/task-manifest.json',
      task_manifest_sha256: 'a'.repeat(64),
      task_bytes_sha256: 'b'.repeat(64),
      task_bindings: taskPaths.filter((path, index) => index % 5 === 0).map((path, index) => ({ id: `task-${index}`, repository_id: path.includes('/ace/') || path.startsWith('ace/') ? 'ace' : 'external', path, sha256: `${String(index + 1).repeat(64)}`.slice(0, 64) })),
      repository_revisions: { ace: '1'.repeat(40), external: '2'.repeat(40) },
      model_identity: 'openai/gpt-5.6-luna',
      provider_identity: 'codex-oauth|harbor=0.24.0',
      runtime_image_identity: 'image@sha256:' + '3'.repeat(64),
      codex_config: { path: null, bytes_sha256: null, effective_sha256: 'c'.repeat(64) },
    },
  };
  const result = validateHarborFourArmDesign(
    { ...job(), ...evidence },
    { ...job('four-arm-dense-codex-config.toml'), ...evidence, external_evidence: { ...evidence.external_evidence, codex_config: { path: 'four-arm-dense-codex-config.toml', bytes_sha256: 'd'.repeat(64), effective_sha256: 'e'.repeat(64) } } },
    { ...job('four-arm-hybrid-codex-config.toml'), ...evidence, external_evidence: { ...evidence.external_evidence, codex_config: { path: 'four-arm-hybrid-codex-config.toml', bytes_sha256: 'f'.repeat(64), effective_sha256: '1'.repeat(64) } } },
    { ...job('four-arm-hybrid-delta-codex-config.toml'), ...evidence, external_evidence: { ...evidence.external_evidence, codex_config: { path: 'four-arm-hybrid-delta-codex-config.toml', bytes_sha256: '2'.repeat(64), effective_sha256: '3'.repeat(64) } } },
    options,
  );
  assert.equal(result._tag, 'Ok');
});

test('Gateway-only four-arm reports permit zero legacy tool calls but cannot claim evidence-based savings', () => {
  const base = {
    schemaVersion: 1 as const,
    holdoutSha256: 'a'.repeat(64),
    qualityNonInferior: true,
    rawTracePaths: ['trace.jsonl'],
    usageEventPaths: ['usage.jsonl'],
    failedRunPaths: ['failed.jsonl'],
    costTelemetryComplete: true,
    arms: {
      native: arm(0),
      dense: arm(0),
      hybrid: arm(1),
      'hybrid-delta': arm(1, 100),
    },
  };
  const gatewayOnly = validateHarborFourArmReport(base);
  assert.equal(gatewayOnly._tag, 'Ok', 'zero model-invoked tool calls is normal for the Gateway-only route');
  assert.equal(assessHarborFourArmFiveX({
    qualityNonInferior: true, costTelemetryComplete: true, rawTrialEvidenceVerified: false,
    attemptUsageVerified: false, providerEgressVerified: false, totalTokensPerAcceptedTaskRatio: 0.1,
  }).allowed, false, 'a shaped report is not independent model delivery or usage evidence');
  assert.equal(validateHarborFourArmReport({
    ...base,
    arms: { ...base.arms, native: arm(1) },
  })._tag, 'Err', 'native baseline cannot declare ACE tool calls');
  const accepted = validateHarborFourArmReport({
    ...base,
    arms: {
      native: arm(0),
      dense: arm(1),
      hybrid: arm(1),
      'hybrid-delta': arm(1, 100),
    },
  });
  assert.equal(accepted._tag, 'Ok');
});

test('5x gate measures total tokens per accepted task, not merely input', () => {
  const native = { rawInputTokens: 1000, rawOutputTokens: 100, successes: 1 };
  const candidate = { rawInputTokens: 200, rawOutputTokens: 1100, successes: 1 };
  const ratio = totalTokensPerAcceptedTaskRatio(native, candidate);
  assert.ok(ratio !== null && ratio > 1, 'more total tokens despite 5x input reduction');
  assert.equal(assessHarborFourArmFiveX({
    qualityNonInferior: true, costTelemetryComplete: true,
    totalTokensPerAcceptedTaskRatio: ratio, rawTrialEvidenceVerified: true, attemptUsageVerified: true, providerEgressVerified: true,
  }).allowed, false);
  assert.equal(totalTokensPerAcceptedTaskRatio(
    { ...native, successes: 0 }, candidate,
  ), null, 'zero accepted tasks cannot justify a fivefold claim');
  assert.equal(totalTokensPerAcceptedTaskRatio(
    { ...native, rawOutputTokens: null }, candidate,
  ), null, 'unknown output usage is never treated as zero');
  assert.equal(totalTokensPerAcceptedTaskRatio(
    native, { rawInputTokens: 100, rawOutputTokens: 30, successes: 1 },
  ), 130 / 1100);
  assert.equal(assessHarborFourArmFiveX({
    qualityNonInferior: true, costTelemetryComplete: true,
    totalTokensPerAcceptedTaskRatio: 130 / 1100, rawTrialEvidenceVerified: true, attemptUsageVerified: true, providerEgressVerified: true,
  }).allowed, true);
});

test('five-X evidence gate rejects self-declared success when raw trials were only hashed', () => {
  const advertisedWin = {
    qualityNonInferior: true,
    costTelemetryComplete: true,
    totalTokensPerAcceptedTaskRatio: 0.1,
    rawTrialEvidenceVerified: false, attemptUsageVerified: true, providerEgressVerified: true,
  };
  assert.deepEqual(assessHarborFourArmFiveX(advertisedWin), {
    allowed: false,
    reason: 'raw_trial_evidence_not_independently_reconciled',
  });
  assert.equal(assessHarborFourArmFiveX({
    ...advertisedWin,
    rawTrialEvidenceVerified: true, attemptUsageVerified: true, providerEgressVerified: true,
    totalTokensPerAcceptedTaskRatio: 0.25,
  }).allowed, false);
  assert.equal(assessHarborFourArmFiveX({
    ...advertisedWin,
    rawTrialEvidenceVerified: true, attemptUsageVerified: true, providerEgressVerified: true,
    qualityNonInferior: false,
  }).allowed, false);
  assert.equal(assessHarborFourArmFiveX({
    ...advertisedWin,
    rawTrialEvidenceVerified: true, attemptUsageVerified: true, providerEgressVerified: true,
  }).allowed, true);
});


test('AR10: five-X cannot be claimed from hashes or self-declared quality when attempt usage is unverified', () => {
  assert.deepEqual(assessHarborFourArmFiveX({
    qualityNonInferior: true, costTelemetryComplete: true,
    totalTokensPerAcceptedTaskRatio: 0.1,
    rawTrialEvidenceVerified: true, attemptUsageVerified: false, providerEgressVerified: true,
  }), { allowed: false, reason: 'provider_attempt_usage_not_reconciled' });
  const inputOnly = totalTokensPerAcceptedTaskRatio(
    { rawInputTokens: 1000, rawOutputTokens: 100, successes: 1 },
    { rawInputTokens: 200, rawOutputTokens: 1100, successes: 1 },
  );
  assert.ok(inputOnly !== null && inputOnly > 1);
  assert.equal(assessHarborFourArmFiveX({
    qualityNonInferior: true, costTelemetryComplete: true,
    totalTokensPerAcceptedTaskRatio: inputOnly,
    rawTrialEvidenceVerified: true, attemptUsageVerified: true, providerEgressVerified: true,
  }).allowed, false);
});


test('AR10: internally matched usage does not authorize a real-provider five-X savings claim', () => {
  assert.deepEqual(assessHarborFourArmFiveX({
    qualityNonInferior: true, costTelemetryComplete: true,
    rawTrialEvidenceVerified: true, attemptUsageVerified: true,
    providerEgressVerified: false, totalTokensPerAcceptedTaskRatio: 0.1,
  }), { allowed: false, reason: 'independent_provider_egress_not_certified' });
});


test('AR10: total token ratio refuses an unsafe integer sum even if both counters are individually valid', () => {
  const native = { rawInputTokens: Number.MAX_SAFE_INTEGER, rawOutputTokens: 1, successes: 1 };
  const candidate = { rawInputTokens: 100, rawOutputTokens: 20, successes: 1 };
  assert.equal(totalTokensPerAcceptedTaskRatio(native, candidate), null);
  assert.equal(totalTokensPerAcceptedTaskRatio(candidate, native), null);
  assert.equal(assessHarborFourArmFiveX({
    qualityNonInferior: true,
    costTelemetryComplete: true,
    rawTrialEvidenceVerified: true,
    attemptUsageVerified: true,
    providerEgressVerified: true,
    totalTokensPerAcceptedTaskRatio: totalTokensPerAcceptedTaskRatio(native, candidate),
  }).allowed, false);
});


test('AR10: incomplete usage, zero reuse and unsuccessful quality remain observable UNKNOWN, not parse failures', () => {
  const partial = {
    schemaVersion: 1,
    holdoutSha256: 'a'.repeat(64),
    qualityNonInferior: false,
    rawTracePaths: [],
    usageEventPaths: [],
    failedRunPaths: [],
    costTelemetryComplete: false,
    arms: {
      native: arm(0),
      dense: arm(0),
      hybrid: arm(0),
      'hybrid-delta': arm(0, 0),
    },
  };
  const result = validateHarborFourArmReport(partial);
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Ok') {
    assert.equal(result.value.qualityNonInferior, false);
    assert.equal(result.value.costTelemetryComplete, false);
    assert.deepEqual(result.value.usageEventPaths, []);
    assert.equal(result.value.arms['hybrid-delta'].reusedContextBytes, 0);
    assert.equal(assessHarborFourArmFiveX({
      qualityNonInferior: result.value.qualityNonInferior,
      costTelemetryComplete: result.value.costTelemetryComplete,
      rawTrialEvidenceVerified: false, attemptUsageVerified: false, providerEgressVerified: false,
      totalTokensPerAcceptedTaskRatio: 0.01,
    }).allowed, false);
  }
  assert.equal(validateHarborFourArmReport({
    ...partial, qualityNonInferior: 'yes',
  })._tag, 'Err', 'invalid status is not UNKNOWN');
  assert.equal(validateHarborFourArmReport({
    ...partial, usageEventPaths: ['valid.jsonl', ''],
  })._tag, 'Err', 'invalid paths are never accepted');
});
