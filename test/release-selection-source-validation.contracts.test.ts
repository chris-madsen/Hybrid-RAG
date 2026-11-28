import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { makeProjectionReceiptClaims, signProjectionReceipt } from '../src/application/projection-receipt.js';
import { addVerifiedContextToResponses } from '../src/domain/responses-projection.js';
import { canonicalBenchmarkCandidateId, retrievalBenchmarkStages, sha256, type RetrievalBenchmarkTraceEvent } from '../src/domain/retrieval-benchmark.js';
import { assertNativeDevelopmentHoldout, assertNativeReleaseHoldout, deriveNativeProjectionObservations, nativeProjectionRunnerVersion, validateNativeProjectionRunEvidence, type NativeProjectionEvidence } from '../scripts/native-projection-evidence.js';
import { nativeCodeRetrieval } from '../src/domain/retrieval.js';
import { evaluateRetrievalStrategy, evaluateRetrievalQualityPolicy, validateNativeRetrievalRunIdentity, type RetrievalHoldout, type RetrievalStrategyRun, type RetrievalQualityPolicy } from '../src/domain/retrieval-quality-evaluation.js';
import {
  evaluateSemanticProviderSelection,
  type SemanticProviderReport,
  type SemanticSelectionPolicy,
} from '../src/domain/semantic-provider-selection.js';
import { validateReleaseSelectionSources, type RetainedJsonEvidence } from '../scripts/release-selection-source-validation.js';

const digest = 'a'.repeat(64);
const revision = 'b'.repeat(40);

const retained = (path: string, value: unknown): RetainedJsonEvidence => {
  const bytes = Buffer.from(JSON.stringify(value), 'utf8');
  return {
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    value,
  };
};

const text = 'export const answer = 1;';
const repoPath = 'src/example.ts';
const range = { startLine: 1, endLine: 1, startColumn: 1, endColumn: text.length + 1 };
const sourceDigest = sha256(text);
const ids = ['a', 'b'];
const manifestFor = (id: string): Buffer => Buffer.from(JSON.stringify({
  schemaVersion: 1, repositoryId: id, revision,
  entries: [{ path: repoPath, sizeBytes: Buffer.byteLength(text), sha256: sourceDigest }],
}));
const kinds = ['behavior_without_name', 'exact_symbol_or_config', 'rare_literal', 'same_name_distractor',
  'multilingual', 'working_context', 'compactness', 'partial_coverage'] as const;
const holdout: RetrievalHoldout = {
  schemaVersion: 1,
  status: 'frozen_multi_repository_holdout',
  repositories: ids.map((id) => ({ id, revision, sourceManifestSha256: sha256(manifestFor(id)) })),
  cases: ids.flatMap((repositoryId) => Array.from({ length: 12 }, (_, index) => ({
    id: repositoryId + '-' + index, repositoryId, query: 'fixture query ' + index,
    relevantCandidateIds: [canonicalBenchmarkCandidateId(repositoryId, repoPath, sourceDigest, range)],
    ...(index === 0 ? { relevantSourceIdentities: [{ repoPath, sourceDigest }] } : {}),
    critical: index < 2, kind: kinds[index % kinds.length]!,
  }))),
};
const holdoutFile = retained('holdout.json', holdout);
const fixtureCase = (repositoryId: string, item: RetrievalHoldout['cases'][number]) => {
  const id = item.id;
  const body = { model: 'test-model', store: false, input: item.query };
  const raw = Buffer.from(JSON.stringify(body), 'utf8');
  const request = {
    schemaVersion: 'ace.context.v3', protocol: 'openai.responses', requestId: 'request-' + id,
    attemptGroupId: 'turn-' + id, agentSessionId: 'session-' + id, workspaceId: 'workspace-' + repositoryId,
    dataClass: 'private', provider: 'mock', model: 'test-model',
    bodyBase64: raw.toString('base64'), bodySha256: sha256(raw), query: item.query,
    projectionMode: 'bifrost_hook', deadlineEpochMs: 2_000_000_000_000,
    attestation: {
      hostBuildDigest: digest, sessionId: 'session-' + id, activeEngineId: 'bifrost-visible-request-only',
      effectiveCompressionControlsDigest: digest, durableActiveTranscriptRevision: 'rev1',
      durableActiveTranscriptDigest: digest, hostCompactionEpoch: 'unknown', attestorId: 'fixture',
      providerManagedHistoryCapability: 'visible', hostTranscriptAttested: false, compactionEnabled: false,
    },
  };
  const contextText = '[code] ' + repoPath + ':1-1\n' + text;
  const projected = addVerifiedContextToResponses(body, contextText);
  assert.equal(projected._tag, 'Ok');
  const projectedBodySha256 = sha256(Buffer.from(projected.value, 'base64'));
  const selectedEvidenceIds = ['code-' + id];
  const receipt = signProjectionReceipt(makeProjectionReceiptClaims({
    requestId: request.requestId, attemptGroupId: request.attemptGroupId,
    agentSessionId: request.agentSessionId, workspaceId: request.workspaceId,
    dataClass: 'private_source', provider: request.provider, model: request.model,
    baseBodySha256: request.bodySha256, projectedBodySha256, selectedEvidenceIds, contextText,
    policyVersion: 1, deadlineEpochMs: request.deadlineEpochMs,
  }), 'fixture-only-signing-key');
  const providerRequestId = 'provider-' + id;
  const candidate = {
    runtimeCandidateId: 'runtime-' + id, canonicalCandidateId: canonicalBenchmarkCandidateId(repositoryId, repoPath, sourceDigest, range),
    repoPath, sourceDigest, range, evidenceId: selectedEvidenceIds[0]!,
    sourceTextSha256: sha256(text), sourceTextCharacters: text.length,
  };
  const events: RetrievalBenchmarkTraceEvent[] = retrievalBenchmarkStages.map((stage) => ({
    stage, requestId: providerRequestId, status: stage === 'delivered' ? 'executed' : 'not_applicable',
    candidates: stage === 'delivered' ? [candidate] : [], durationMs: stage === 'delivered' ? 1 : 0,
    sourceCommit: revision, runnerVersion: nativeProjectionRunnerVersion, providerIdentities: nativeCodeRetrieval.providerIdentities,
  }));
  return {
    events,
    binding: { requestId: request.requestId, providerRequestId,
      receiptSha256: sha256(receipt), projectedBodySha256, selectedEvidenceIds },
    capture: {
      caseId: id, request, latencyMs: 1,
      decision: {
        kind: 'PREPARED', reasonCode: 'VERIFIED_CONTEXT_ADDED', baseBodySha256: request.bodySha256,
        bodyBase64: projected.value, projectedBodySha256, projectionReceipt: receipt,
      },
    },
  };
};
const fixtureEvidence = (id: string): NativeProjectionEvidence => {
  const cases = holdout.cases.filter((item) => item.repositoryId === id).map((item) => fixtureCase(id, item));
  const events = cases.flatMap((item) => item.events);
  const trace = events.map((event) => JSON.stringify(event) + '\n').join('');
  return {
    schemaVersion: 1, holdoutSha256: holdoutFile.sha256, sourceCommit: revision,
    runnerVersion: nativeProjectionRunnerVersion, repositoryId: id, manifestBase64: manifestFor(id).toString('base64'),
    trace, terminal: {
      schemaVersion: 1, sourceCommit: revision, runnerVersion: nativeProjectionRunnerVersion,
      eventCount: events.length, persistedEventCount: events.length, traceDigest: sha256(trace),
      flushStatus: 'ok', closeStatus: 'ok',
      requests: cases.map((item) => ({ requestId: item.binding.providerRequestId, complete: true, stages: {
        dense: 'not_applicable', sparse: 'not_applicable', fused: 'not_applicable',
        working_context: 'not_applicable', reranked: 'not_applicable', delivered: 'executed',
      } })),
      projections: cases.map((item) => item.binding),
    },
    captures: cases.map((item) => item.capture),
  };
};
const captures = ids.map((id) => retained('projection-' + id + '.json', fixtureEvidence(id)));
const run: RetrievalStrategyRun = {
  strategy: nativeCodeRetrieval.strategy,
  sourceCommit: revision,
  runnerVersion: nativeProjectionRunnerVersion,
  holdoutSha256: holdoutFile.sha256,
  providerIdentities: nativeCodeRetrieval.providerIdentities,
  observations: captures.flatMap((capture) => deriveNativeProjectionObservations(
    holdout, capture.value as NativeProjectionEvidence, holdoutFile.sha256, revision,
  )),
  projectionEvidence: captures.map((capture) => ({ path: capture.path, sha256: capture.sha256 })),
};
const policy: RetrievalQualityPolicy = {
  selectedStrategy: nativeCodeRetrieval.strategy,
  requiredHoldoutSha256: holdoutFile.sha256,
  requiredHoldoutStatus: 'frozen_multi_repository_holdout',
  minRepositoryCount: 2,
  minRecallAt1: 1, minRecallAt3: 1, minRecallAt5: 1, minCriticalRecallAt5: 1, minMrr: 1, minNdcgAt5: 1,
};

const semanticReports: readonly SemanticProviderReport[] = [
  'typescript-language-service',
  'serena',
].map((provider) => ({
  provider,
  providerVersion: 'test-v1',
  fixtureSha256: digest,
  oracleSha256: digest,
  caseResults: [{ caseId: 'same-name', status: 'pass' }],
  coldStartMs: 1,
  warmQueryP95Ms: 1,
  maxRssBytes: 1,
  runtime: { node: 'test' },
}));

const semanticPolicy: SemanticSelectionPolicy = {
  selectedProvider: 'typescript-language-service',
  requiredFixtureSha256: digest,
  requiredOracleSha256: digest,
  requiredCaseIds: ['same-name'],
  licenses: {
    'typescript-language-service': { spdxId: 'Apache-2.0', evidence: 'test', verified: true },
  },
  ownerApproval: { status: 'approved', provider: 'typescript-language-service' },
};

test('release source validation re-evaluates selection verdicts against retained bytes', async () => {
  const metrics = evaluateRetrievalStrategy(holdout, run);
  if (metrics._tag === 'Err') throw new Error('fixture metrics rejected');
  const sourceMetrics = metrics.value as typeof metrics.value & {
    readonly sourceLabelledCases?: number; readonly sourceRecallAt5?: number | null;
  };
  assert.equal(sourceMetrics.sourceLabelledCases, 2);
  assert.equal(sourceMetrics.sourceRecallAt5, 1);
  const retrievalVerdict = evaluateRetrievalQualityPolicy(metrics.value, holdoutFile.sha256, policy);
  const semanticVerdict = evaluateSemanticProviderSelection(semanticReports, semanticPolicy);
  assert.equal(retrievalVerdict._tag, 'Ok');
  assert.equal(semanticVerdict._tag, 'Ok');
  if (retrievalVerdict._tag === 'Err' || semanticVerdict._tag === 'Err') return;

  const files = new Map<string, RetainedJsonEvidence>([
    ['holdout.json', holdoutFile],
    ['run.json', retained('run.json', run)],
    ['policy.json', retained('policy.json', policy)],
    ...captures.map((capture) => [capture.path, capture] as const),
    ['semantic-policy.json', retained('semantic-policy.json', semanticPolicy)],
    ...semanticReports.map((report, index) => {
      const path = `semantic-report-${index}.json`;
      return [path, retained(path, report)] as const;
    }),
  ]);
  const retrievalSelection = {
    schemaVersion: 2,
    sourceCommit: revision,
    providerIdentities: nativeCodeRetrieval.providerIdentities,
    holdoutPath: 'holdout.json',
    runPath: 'run.json',
    policyPath: 'policy.json',
    holdoutSha256: holdoutFile.sha256,
    runSha256: files.get('run.json')!.sha256,
    policySha256: files.get('policy.json')!.sha256,
    verdict: retrievalVerdict.value,
  };
  const semanticSelection = {
    policyPath: 'semantic-policy.json',
    policySha256: files.get('semantic-policy.json')!.sha256,
    reports: semanticReports.map((_, index) => {
      const path = `semantic-report-${index}.json`;
      return { path, sha256: files.get(path)!.sha256 };
    }),
    verdict: semanticVerdict.value,
  };
  const readJson = async (path: string): Promise<RetainedJsonEvidence> => {
    const evidence = files.get(path);
    if (evidence === undefined) throw new Error(`missing test evidence: ${path}`);
    return evidence;
  };

  const validated = await validateReleaseSelectionSources(retrievalSelection, semanticSelection, readJson);
  assert.equal(validated.nativeRetrieval?.run.sha256, retrievalSelection.runSha256);
  await assert.rejects(validateReleaseSelectionSources({ ...retrievalSelection, runSha256: digest }, semanticSelection, readJson), /source digest mismatch/u);
  await assert.rejects(validateReleaseSelectionSources({ ...retrievalSelection, verdict: { ...retrievalSelection.verdict, measurementAccepted: false } }, semanticSelection, readJson), /does not match retained source reports/u);
  assert.equal(validated.semantic?.reports.length, 2);

  await assert.rejects(
    validateReleaseSelectionSources(
      retrievalSelection,
      { ...semanticSelection, verdict: { ...semanticSelection.verdict, selectedProvider: 'forged/provider' } },
      readJson,
    ),
    /does not match retained source reports/u,
  );
});

test('native release evidence rejects retired stages, foreign provider and missing runner identity', () => {
  assert.equal(validateNativeRetrievalRunIdentity(holdout, run, revision)._tag, 'Ok');
  assert.equal(validateNativeRetrievalRunIdentity(holdout, { ...run, strategy: 'hybrid_rrf' }, revision)._tag, 'Err');
  const { runnerVersion: removedRunnerVersion, ...withoutRunner } = run;
  assert.equal(removedRunnerVersion, nativeProjectionRunnerVersion);
  assert.equal(validateNativeRetrievalRunIdentity(holdout, withoutRunner, revision)._tag, 'Err');
  assert.equal(evaluateRetrievalStrategy(holdout, withoutRunner)._tag, 'Err');
  assert.equal(validateNativeRetrievalRunIdentity(holdout, {
    ...run,
    providerIdentities: { ...nativeCodeRetrieval.providerIdentities, embedding: 'retired' },
  }, revision)._tag, 'Err');
  assert.equal(validateNativeRetrievalRunIdentity(holdout, {
    ...run,
    observations: run.observations.map((item) => ({
      ...item, stageStatuses: { ...item.stageStatuses!, dense: 'executed' },
    })),
  }, revision)._tag, 'Err');
});

test('native development corpus requires exact labels and stays outside release admission', () => {
  const repository = holdout.repositories![0]!;
  const cases = holdout.cases.filter((item) => item.repositoryId === repository.id).slice(0, 4).map((item) => ({
    ...item,
    relevantSourceIdentities: [{ repoPath, sourceDigest }],
  }));
  const development: RetrievalHoldout = {
    schemaVersion: 1, status: 'development_source_bound', repositories: [repository], cases,
  };
  assert.doesNotThrow(() => assertNativeDevelopmentHoldout(development));
  assert.throws(() => assertNativeReleaseHoldout(development), /native release holdout requires/u);
  assert.throws(() => assertNativeDevelopmentHoldout({
    ...development,
    cases: development.cases.map((item, index) => index === 0
      ? { ...item, relevantSourceIdentities: undefined }
      : item),
  }), /development cases require/u);
});

test('AR08 native projection refuses a source-recall label outside the bound manifest', () => {
  const invalidHoldout: RetrievalHoldout = {
    ...holdout,
    cases: holdout.cases.map((item) => item.id === 'a-0' ? {
      ...item,
      relevantSourceIdentities: [{ repoPath: 'src/missing.ts', sourceDigest }],
    } : item),
  };
  const invalidSha = sha256(JSON.stringify(invalidHoldout));
  const evidence = fixtureEvidence('a');
  assert.throws(() => deriveNativeProjectionObservations(invalidHoldout, {
    ...evidence, holdoutSha256: invalidSha,
  }, invalidSha, revision), /source-recall label is outside or stale for the pinned manifest/u);
});

test('native projection evidence rejects a tuned candidate limit on frozen release holdout', () => {
  const evidence = fixtureEvidence('a');
  assert.throws(() => deriveNativeProjectionObservations(holdout, {
    ...evidence, candidateLimit: 10,
  }, holdoutFile.sha256, revision), /default candidate limit/u);
});

test('native gate rejects fabricated ranks and a missing capture even with a valid identity', async () => {
  const reader = async (path: string): Promise<RetainedJsonEvidence> => {
    const capture = captures.find((item) => item.path === path);
    assert.ok(capture);
    return capture;
  };
  await validateNativeProjectionRunEvidence(holdout, run, reader);
  await assert.rejects(validateNativeProjectionRunEvidence({ ...holdout, cases: holdout.cases.slice(0, 2) }, run, reader), /24 cases/u);
  await assert.rejects(validateNativeProjectionRunEvidence(holdout, {
    ...run, observations: run.observations.map((item) => ({ ...item, retrievedCandidateIds: ['forged-rank'] })),
  }, reader), /do not match actual projection evidence/u);
  await assert.rejects(validateNativeProjectionRunEvidence(holdout, {
    ...run, observations: run.observations.map((item, index) => index === 0 ? {
      ...item, retrievedSourceIdentities: [{ repoPath: 'src/forged.ts', sourceDigest }],
    } : item),
  }, reader), /do not match actual projection evidence/u);
  const { projectionEvidence: removed, ...withoutCapture } = run;
  assert.equal(removed?.length, 2);
  await assert.rejects(validateNativeProjectionRunEvidence(holdout, withoutCapture, reader), /captures required/u);
});

test('actual prepared body and runtime receipt binding cannot be substituted', () => {
  const evidence = fixtureEvidence('a');
  const capture = evidence.captures[0]!;
  const decision = capture.decision as Record<string, unknown>;
  assert.throws(() => deriveNativeProjectionObservations(holdout, {
    ...evidence, captures: [{ ...capture, decision: { ...decision, bodyBase64: Buffer.from('tampered').toString('base64') } }, ...evidence.captures.slice(1)],
  }, holdoutFile.sha256, revision), /projected body digest mismatch/u);
  assert.throws(() => deriveNativeProjectionObservations(holdout, {
    ...evidence, terminal: { ...evidence.terminal, projections: [] },
  }, holdoutFile.sha256, revision), /missing actual prepared receipt binding/u);
  const block = {
    kind: 'BLOCK', reasonCode: 'SECRET_DETECTED', baseBodySha256: decision.baseBodySha256,
  };
  const blocked = deriveNativeProjectionObservations(holdout, {
    ...evidence, terminal: { ...evidence.terminal, projections: evidence.terminal.projections!.slice(1) },
    captures: [{ ...capture, decision: block }, ...evidence.captures.slice(1)],
  }, holdoutFile.sha256, revision);
  assert.deepEqual(blocked[0]?.retrievedCandidateIds, []);
  assert.equal(blocked[0]?.stageStatuses?.delivered, 'unavailable');
});
