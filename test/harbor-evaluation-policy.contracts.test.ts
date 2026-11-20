import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessHarborAcceptance,
  type HarborAcceptanceEvidence,
  type HarborEvidenceStage,
} from '../src/domain/harbor-evaluation-policy.js';
import type { FeedbackReport, FeedbackTaskManifest } from '../src/domain/feedback-loop-experiment.js';
import { feedbackHermesVersion } from '../src/domain/feedback-harbor-config.js';

const revision = 'a'.repeat(40);
const digest = (character: string): string => character.repeat(64);
const taskManifest: FeedbackTaskManifest = {
  schemaVersion: 1,
  selection: 'holdout',
  dataset: { id: 'scale-ai/swe-atlas-qna', revision, rawSha256: digest('b') },
  tasks: Array.from({ length: 10 }, (_, index) => ({
    id: `task-${index}`,
    sourceRevision: revision,
    sourceDigest: digest('c'),
    taskDigest: digest('d'),
  })),
  holdout: [],
};
const taskManifestSha256 = digest('e');
const experimentManifest = {
  schemaVersion: 1,
  runId: 'c08-policy-test',
  sourceCommit: revision,
  taskManifestSha256,
  agent: 'hermes',
  agentVersion: feedbackHermesVersion,
  model: 'openai-codex/gpt-5.6-luna',
  reasoningEffort: 'high',
  harborVersion: '0.24.0',
  taskImages: [{ reference: 'registry.example/task:1', digest: `sha256:${digest('f')}` }],
  agentAdapterSha256: digest('1'),
  aceContextBridgeSha256: digest('2'),
  contextPluginSha256: digest('3'),
  seed: 'fixed-seed',
  mode: 'cold',
  nConcurrentTrials: 1,
  nAttempts: 1,
  authenticationRoute: 'Hermes openai-codex OAuth',
} as const;
const report: FeedbackReport = {
  schemaVersion: 1,
  status: 'PASS',
  qualityGate: 'pass',
  qualityRegressionTaskIds: [],
  rows: taskManifest.tasks.map((task) => ({
    taskId: task.id,
    nativeQuality: 'pass',
    aceQuality: 'pass',
    aceCalled: true,
    aceCorrelation: 'correlated',
    nativeInputTokens: 100,
    nativeCachedInputTokens: 10,
    nativeOutputTokens: 10,
    nativeReasoningOutputTokens: 3,
    nativeTotalTokens: 110,
    aceInputTokens: 20,
    aceCachedInputTokens: 2,
    aceOutputTokens: 2,
    aceReasoningOutputTokens: 1,
    aceTotalTokens: 22,
    nativeCostUsd: 0.1,
    aceCostUsd: 0.02,
    qualityDelta: 'no_regression',
    tokenRatio: 5,
    durationNativeMs: 100,
    durationAceMs: 50,
    nativeFileReads: null,
    status: 'PASS',
  })),
  nativeInputTokens: 1000,
  aceInputTokens: 200,
  nativeCachedInputTokens: 100,
  aceCachedInputTokens: 20,
  nativeOutputTokens: 100,
  aceOutputTokens: 20,
  nativeReasoningOutputTokens: 30,
  aceReasoningOutputTokens: 10,
  nativeTotalTokens: 1100,
  aceTotalTokens: 220,
  tokenRatio: 5,
  nativeCostUsd: 1,
  aceCostUsd: 0.2,
  aceObservedCalls: 10,
  aceCorrelatedCalls: 10,
  aceNotUsed: false,
};
const allStages: readonly HarborEvidenceStage[] = [
  'real-provider-tested', 'agent-E2E-tested', 'benchmark-evaluated', 'owner-approved',
];
const evidence = (overrides: Partial<HarborAcceptanceEvidence> = {}): HarborAcceptanceEvidence => ({
  report,
  taskManifest,
  experimentManifest,
  taskManifestSha256,
  finalWireEvidenceStatus: 'REAL_PROVIDER_CANDIDATE',
  completedEvidenceStages: allStages,
  externalCostTelemetry: 'complete',
  forcedToolUse: 'not_forced',
  ...overrides,
});

test('DBC-12 rejects legacy caller-asserted success booleans', () => {
  const legacyFlags = {
    paired: true,
    qualityNonInferior: true,
    actualAceCallObserved: true,
    codeEvidenceObserved: true,
    providerOperationsObserved: true,
    forcedToolUse: false,
    providerRequestCorrelationVerified: true,
    completeCostTelemetry: true,
  };
  assert.equal(assessHarborAcceptance(legacyFlags as unknown as HarborAcceptanceEvidence), 'rejected');
});

test('DBC-12 quality regression or an ACE-unused arm is rejected', () => {
  assert.equal(assessHarborAcceptance(evidence({
    report: { ...report, status: 'QUALITY_REGRESSION', qualityGate: 'regression' },
  })), 'rejected');
  assert.equal(assessHarborAcceptance(evidence({
    report: { ...report, status: 'ACE_NOT_USED', aceNotUsed: true, aceObservedCalls: 0 },
  })), 'rejected');
});

test('DBC-12 incomplete wire, cost, holdout or owner evidence remains diagnostic', () => {
  assert.equal(assessHarborAcceptance(evidence({ finalWireEvidenceStatus: 'NOT_CERTIFIED' })), 'diagnostic-only');
  assert.equal(assessHarborAcceptance(evidence({ externalCostTelemetry: 'unknown' })), 'diagnostic-only');
  assert.equal(assessHarborAcceptance(evidence({ completedEvidenceStages: allStages.slice(0, 3) })), 'diagnostic-only');
  assert.equal(assessHarborAcceptance(evidence({
    taskManifest: {
      ...taskManifest,
      selection: 'main',
      holdout: taskManifest.tasks.map((task, index) => ({ ...task, id: `untouched-${index}` })),
    },
  })), 'diagnostic-only');
  assert.equal(assessHarborAcceptance(evidence({ forcedToolUse: 'forced' })), 'diagnostic-only');
  assert.equal(assessHarborAcceptance(evidence({ forcedToolUse: 'unknown' })), 'diagnostic-only');
});

test('automatic Gateway delivery is not rejected as ACE-unused when optional tool-call count is zero', () => {
  const gatewayOnlyReport: FeedbackReport = {
    ...report,
    status: 'UNKNOWN',
    aceObservedCalls: 0,
    aceCorrelatedCalls: 0,
    tokenRatio: null,
    rows: report.rows.map((row) => ({ ...row, aceCalled: true, aceCorrelation: 'UNKNOWN', tokenRatio: null, status: 'UNKNOWN' })),
  };
  assert.equal(assessHarborAcceptance(evidence({ report: gatewayOnlyReport })), 'diagnostic-only');
});

test('DBC-12 source identity mismatch is rejected before economics are evaluated', () => {
  assert.equal(assessHarborAcceptance(evidence({ taskManifestSha256: digest('9') })), 'rejected');
});

test('DBC-12 measurement status requires matched holdout, verified wire, complete costs and all evidence stages', () => {
  assert.equal(assessHarborAcceptance(evidence()), 'measured-not-necessarily-5x');
});
