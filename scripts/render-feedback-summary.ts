import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import {
  validateFeedbackArtifactHashes,
  validateFeedbackExperimentManifest,
  validateFeedbackReport,
  validateFeedbackTaskManifest,
} from '../src/domain/feedback-loop-experiment.js';
import { assessHarborAcceptance } from '../src/domain/harbor-evaluation-policy.js';

type JsonObject = Readonly<Record<string, unknown>>;
const object = (value: unknown): JsonObject | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonObject : undefined;
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const costLabel = (value: unknown): string => {
  const cost = object(value);
  return (cost?.status === 'measured' || cost?.status === 'estimated')
    && typeof cost.amountUsd === 'number' && Number.isFinite(cost.amountUsd) && cost.amountUsd >= 0
    ? `${cost.amountUsd} USD (${cost.status})`
    : 'UNKNOWN';
};
const markdownCell = (value: unknown): string => {
  const text = value === null || value === undefined ? 'UNKNOWN' : String(value);
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
};

const usage = (): never => {
  throw new Error('Usage: tsx scripts/render-feedback-summary.ts <feedback-run-directory> <benchmarks/reports/output.md>');
};

const main = async (): Promise<void> => {
  const [runDirectoryArg, outputArg, outputMode] = process.argv.slice(2);
  if (runDirectoryArg === undefined || outputArg === undefined) return usage();
  const runDirectory = resolve(runDirectoryArg);
  const outputPath = resolve(outputArg);
  const reportsRoot = resolve('benchmarks/reports');
  const outputRelative = relative(reportsRoot, outputPath);
  if (outputMode === '--external-output') {
    if (outputPath !== resolve(dirname(runDirectory), 'report.md')) {
      throw new Error('BLOCKED: external feedback report must be the sibling report.md of reconciled results');
    }
    const sourceRelation = relative(resolve('.'), outputPath);
    if (!isAbsolute(sourceRelation) && sourceRelation !== '..' && !sourceRelation.startsWith('../')) {
      throw new Error('BLOCKED: external feedback report must be outside the source checkout');
    }
  } else if (outputMode !== undefined || isAbsolute(outputRelative) || outputRelative === '..' || outputRelative.startsWith('../')) {
    throw new Error('BLOCKED: feedback summary must be written under benchmarks/reports');
  }
  const manifestBytes = await readFile(resolve(runDirectory, 'manifest.json'));
  const metricsBytes = await readFile(resolve(runDirectory, 'metrics.json'));
  const taskManifestBytes = await readFile(resolve(runDirectory, 'task-manifest.json'));
  const manifest = object(JSON.parse(manifestBytes.toString('utf8')) as unknown);
  const report = validateFeedbackReport(JSON.parse(metricsBytes.toString('utf8')) as unknown);
  const taskManifest = validateFeedbackTaskManifest(JSON.parse(taskManifestBytes.toString('utf8')) as unknown);
  if (manifest === undefined || report._tag === 'Err' || taskManifest._tag === 'Err') {
    const reason = report._tag === 'Err' ? report.error.message : taskManifest._tag === 'Err' ? taskManifest.error.message : '';
    throw new Error(`BLOCKED: feedback run manifest or metrics/task schema is invalid${reason.length === 0 ? '' : `: ${reason}`}`);
  }
  if (manifest.status === 'BLOCKED') throw new Error('BLOCKED: summaries cannot promote a blocked run');
  if (manifest.status !== report.value.status) throw new Error('BLOCKED: manifest status does not match reconciled metrics');
  if (manifest.metricsSha256 !== sha256(metricsBytes) || manifest.taskManifestSha256 !== sha256(taskManifestBytes)) {
    throw new Error('BLOCKED: feedback run hash links do not match raw metrics/task manifest bytes');
  }
  const experiment = validateFeedbackExperimentManifest(manifest.experiment);
  if (experiment._tag === 'Err') throw new Error(`BLOCKED: feedback experiment manifest is invalid: ${experiment.error.path}: ${experiment.error.message}`);
  const acceptanceMetadata = object(manifest.acceptance);
  const finalWireStatus = acceptanceMetadata?.finalWireEvidenceStatus;
  if (acceptanceMetadata !== undefined && finalWireStatus !== 'NOT_RUN' && finalWireStatus !== 'NOT_CERTIFIED'
    && finalWireStatus !== 'REAL_PROVIDER_CANDIDATE') {
    throw new Error('BLOCKED: acceptance manifest has an unsupported final-wire evidence status');
  }
  const finalWireEvidenceStatus = finalWireStatus === 'NOT_RUN' || finalWireStatus === 'NOT_CERTIFIED'
    || finalWireStatus === 'REAL_PROVIDER_CANDIDATE' ? finalWireStatus : 'NOT_RUN';
  const completedEvidenceStages = Array.isArray(acceptanceMetadata?.completedEvidenceStages)
    ? acceptanceMetadata.completedEvidenceStages as ('real-provider-tested' | 'agent-E2E-tested' | 'benchmark-evaluated' | 'owner-approved')[]
    : [];
  const externalCostTelemetry = acceptanceMetadata?.externalCostTelemetry === 'complete' ? 'complete' : 'unknown';
  const forcedToolUse = acceptanceMetadata?.forcedToolUse === 'not_forced' || acceptanceMetadata?.forcedToolUse === 'forced'
    ? acceptanceMetadata.forcedToolUse : 'unknown';
  const acceptanceStatus = assessHarborAcceptance({
    report: report.value,
    taskManifest: taskManifest.value,
    experimentManifest: experiment.value,
    taskManifestSha256: typeof manifest.taskManifestSha256 === 'string' ? manifest.taskManifestSha256 : '',
    finalWireEvidenceStatus,
    completedEvidenceStages,
    externalCostTelemetry,
    forcedToolUse,
  });
  const fiveXClaimAllowed = acceptanceStatus === 'measured-not-necessarily-5x'
    && report.value.tokenRatio !== null && report.value.tokenRatio >= 5;
  if (acceptanceMetadata?.status !== undefined && acceptanceMetadata.status !== acceptanceStatus) {
    throw new Error('BLOCKED: stored Harbor acceptance label does not match independently recomputed evidence');
  }
  if (acceptanceMetadata?.fiveXClaimAllowed !== undefined && acceptanceMetadata.fiveXClaimAllowed !== fiveXClaimAllowed) {
    throw new Error('BLOCKED: stored fivefold claim does not match independently recomputed evidence');
  }
  const artifacts = validateFeedbackArtifactHashes(manifest.rawArtifactHashes, 'manifest.rawArtifactHashes');
  if (artifacts._tag === 'Err') throw new Error(`BLOCKED: ${artifacts.error.path}: ${artifacts.error.message}`);
  for (const artifact of artifacts.value) {
    const artifactPath = resolve(runDirectory, artifact.path);
    const containment = relative(runDirectory, artifactPath);
    if (isAbsolute(containment) || containment === '..' || containment.startsWith('../')) throw new Error(`BLOCKED: raw artifact path escapes run directory: ${artifact.path}`);
    let bytes: Buffer;
    try {
      bytes = await readFile(artifactPath);
    } catch {
      throw new Error(`BLOCKED: raw artifact is missing: ${artifact.path}`);
    }
    if (sha256(bytes) !== artifact.sha256) throw new Error(`BLOCKED: raw artifact digest mismatch: ${artifact.path}`);
  }
  const nativeResponsesEvidence = object(manifest.nativeResponsesEvidence);
  const costTelemetry = object(manifest.costTelemetry);
  const nonModelCosts = object(costTelemetry?.nonModelExternalAndInfrastructure);
  const totalExternalCosts = object(costTelemetry?.totalExternal);
  const lines = [
    '# ACE Harbor feedback summary',
    '',
    `- Run status: ${report.value.status}`,
    `- DBC-12 acceptance: ${acceptanceStatus}`,
    `- Fivefold claim: ${fiveXClaimAllowed ? 'ALLOWED by validated evidence' : 'NOT_ALLOWED'}`,
    `- Final-wire evidence: ${finalWireEvidenceStatus}`,
    `- Final-wire receipt count: ${nativeResponsesEvidence?.finalWireReceiptCount ?? 'UNKNOWN'}`,
    `- Stream receipt count: ${nativeResponsesEvidence?.streamReceiptCount ?? 'UNKNOWN'}`,
    `- Stream receipts with unknown usage: ${nativeResponsesEvidence?.unknownUsageReceipts ?? 'UNKNOWN'}`,
    `- Harbor agent-reported model-cost fields (not total external cost): native=${report.value.nativeCostUsd ?? 'UNKNOWN'} USD; ACE=${report.value.aceCostUsd ?? 'UNKNOWN'} USD`,
    `- Non-model external/infrastructure cost: ${costLabel(nonModelCosts)}`,
    `- Total external cost: ${costLabel(totalExternalCosts)}`,
    `- Completed evidence stages: ${completedEvidenceStages.length === 0 ? 'NONE' : completedEvidenceStages.join(', ')}`,
    `- Raw manifest SHA-256: ${sha256(manifestBytes)}`,
    `- Metrics SHA-256: ${sha256(metricsBytes)}`,
    `- Task manifest SHA-256: ${sha256(taskManifestBytes)}`,
    `- Raw artifact count: ${artifacts.value.length}`,
    '',
    '| Task ID | Gold found@k | LSP proof | ACE called | Native total | Native cached subset | Native reasoning subset | ACE total | ACE cached subset | ACE reasoning subset | Quality Δ | Observed ratio | Status |',
    '|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---|',
    ...report.value.rows.map((row) => [
      row.taskId,
      'UNKNOWN',
      'UNKNOWN',
      row.aceCalled === null ? 'UNKNOWN' : row.aceCalled ? '1' : '0',
      row.nativeTotalTokens,
      row.nativeCachedInputTokens,
      row.nativeReasoningOutputTokens,
      row.aceTotalTokens,
      row.aceCachedInputTokens,
      row.aceReasoningOutputTokens,
      row.qualityDelta,
      row.tokenRatio,
      row.status,
    ].map(markdownCell).join(' | ')),
    '',
    'Token totals are provider input plus output; cached input and reasoning output are subsets and are not added again.',
    'Observed ratios are not causal savings unless DBC-12 acceptance is measured-not-necessarily-5x. The retrieval columns remain UNKNOWN; RepoBench retrieval evidence is reported separately.',
  ];
  await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ output: outputPath, status: report.value.status, rawArtifacts: artifacts.value.length })}\n`);
};

await main();
