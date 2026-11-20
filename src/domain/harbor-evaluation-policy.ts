import {
  validateFeedbackExperimentManifest,
  validateFeedbackReport,
  validateFeedbackTaskManifest,
  type FeedbackStatus,
} from './feedback-loop-experiment.js';

/**
 * DBC-12 is derived from paired trial evidence and independently observed
 * provider/quality/cost gates, not caller-supplied success booleans.
 */
export type HarborEvidenceStage =
  | 'real-provider-tested'
  | 'agent-E2E-tested'
  | 'benchmark-evaluated'
  | 'owner-approved';

export interface HarborAcceptanceEvidence {
  readonly report: unknown;
  readonly taskManifest: unknown;
  readonly experimentManifest: unknown;
  readonly taskManifestSha256: string;
  readonly finalWireEvidenceStatus: 'NOT_RUN' | 'NOT_CERTIFIED' | 'REAL_PROVIDER_CANDIDATE';
  readonly completedEvidenceStages: readonly HarborEvidenceStage[];
  readonly externalCostTelemetry: 'complete' | 'unknown';
  readonly forcedToolUse: 'not_forced' | 'forced' | 'unknown';
}

export type HarborAcceptance = 'rejected' | 'diagnostic-only' | 'measured-not-necessarily-5x';

const feedbackStatus = (value: unknown): value is FeedbackStatus =>
  value === 'PASS' || value === 'UNKNOWN' || value === 'BLOCKED'
  || value === 'QUALITY_REGRESSION' || value === 'ACE_NOT_USED';

const sha256Hex = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);

export const assessHarborAcceptance = (evidence: HarborAcceptanceEvidence): HarborAcceptance => {
  const report = validateFeedbackReport(evidence.report);
  const taskManifest = validateFeedbackTaskManifest(evidence.taskManifest);
  const experiment = validateFeedbackExperimentManifest(evidence.experimentManifest);
  const knownStages: readonly HarborEvidenceStage[] = [
    'real-provider-tested', 'agent-E2E-tested', 'benchmark-evaluated', 'owner-approved',
  ];
  if (report._tag === 'Err' || taskManifest._tag === 'Err' || experiment._tag === 'Err'
    || !sha256Hex(evidence.taskManifestSha256)
    || experiment._tag === 'Ok' && experiment.value.taskManifestSha256 !== evidence.taskManifestSha256
    || !feedbackStatus(report._tag === 'Ok' ? report.value.status : undefined)
    || !['NOT_RUN', 'NOT_CERTIFIED', 'REAL_PROVIDER_CANDIDATE'].includes(evidence.finalWireEvidenceStatus)
    || !Array.isArray(evidence.completedEvidenceStages)
    || !evidence.completedEvidenceStages.every((stage) => knownStages.includes(stage))
    || new Set(evidence.completedEvidenceStages).size !== evidence.completedEvidenceStages.length
    || (evidence.externalCostTelemetry !== 'complete' && evidence.externalCostTelemetry !== 'unknown')
    || (evidence.forcedToolUse !== 'not_forced' && evidence.forcedToolUse !== 'forced'
      && evidence.forcedToolUse !== 'unknown')) return 'rejected';

  if (report.value.status === 'QUALITY_REGRESSION' || report.value.status === 'ACE_NOT_USED'
    || report.value.aceNotUsed || !report.value.rows.some((row) => row.aceCalled === true)) return 'rejected';

  const taskIds = taskManifest.value.tasks.map((task) => task.id);
  const rowIds = report.value.rows.map((row) => row.taskId);
  if (taskManifest.value.selection !== 'holdout'
    || taskIds.length !== rowIds.length
    || new Set(rowIds).size !== rowIds.length
    || taskIds.some((taskId) => !rowIds.includes(taskId))) return 'diagnostic-only';

  const qualityAccepted = report.value.qualityGate === 'pass'
    && report.value.rows.every((row) => row.nativeQuality === 'pass' && row.aceQuality === 'pass'
      && row.qualityDelta === 'no_regression');
  const requiredStagesComplete = knownStages.every((stage) => evidence.completedEvidenceStages.includes(stage));
  const providerEvidenceVerified = evidence.finalWireEvidenceStatus === 'REAL_PROVIDER_CANDIDATE'
    && evidence.completedEvidenceStages.includes('real-provider-tested')
    && evidence.completedEvidenceStages.includes('agent-E2E-tested')
    && report.value.aceCorrelatedCalls > 0
    && report.value.rows.every((row) => row.aceCorrelation === 'correlated');
  const usageComplete = report.value.rows.every((row) => row.nativeTotalTokens !== null && row.aceTotalTokens !== null)
    && report.value.tokenRatio !== null;
  if (!qualityAccepted || report.value.status !== 'PASS' || !providerEvidenceVerified || !usageComplete
    || evidence.externalCostTelemetry !== 'complete' || evidence.forcedToolUse !== 'not_forced'
    || !requiredStagesComplete) {
    return 'diagnostic-only';
  }

  return 'measured-not-necessarily-5x';
};
