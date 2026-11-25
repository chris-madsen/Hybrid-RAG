import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { nativeCodeRetrieval } from '../src/domain/retrieval.js';
import { evaluateRetrievalStrategy, evaluateRetrievalQualityPolicy, type RetrievalHoldout, type RetrievalStrategyRun, type RetrievalQualityPolicy } from '../src/domain/retrieval-quality-evaluation.js';
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

const holdout: RetrievalHoldout = {
  schemaVersion: 1,
  status: 'frozen_multi_repository_holdout',
  repositories: ['a', 'b'].map((id) => ({ id, revision, sourceManifestSha256: digest })),
  cases: ['a', 'b'].map((id) => ({ id, repositoryId: id, query: 'fixture query', relevantCandidateIds: [id], critical: true })),
};
const holdoutFile = retained('holdout.json', holdout);
const run: RetrievalStrategyRun = {
  strategy: nativeCodeRetrieval.strategy,
  sourceCommit: revision,
  runnerVersion: 'fixture/v1',
  holdoutSha256: holdoutFile.sha256,
  providerIdentities: nativeCodeRetrieval.providerIdentities,
  observations: ['a', 'b'].map((id) => ({
    caseId: id, retrievedCandidateIds: [id], payloadCharacters: 10, duplicateSourceHits: 0,
    expansionCalls: 0, nativeReadDuplicates: 0, latencyMs: 1,
    stageRanks: { dense: [], sparse: [], fused: [], workingContext: [], reranked: [], delivered: [id] },
    stageStatuses: { dense: 'not_applicable', sparse: 'not_applicable', fused: 'not_applicable', working_context: 'not_applicable', reranked: 'not_applicable', delivered: 'executed' },
  })),
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
  const retrievalVerdict = evaluateRetrievalQualityPolicy(metrics.value, holdoutFile.sha256, policy);
  const semanticVerdict = evaluateSemanticProviderSelection(semanticReports, semanticPolicy);
  assert.equal(retrievalVerdict._tag, 'Ok');
  assert.equal(semanticVerdict._tag, 'Ok');
  if (retrievalVerdict._tag === 'Err' || semanticVerdict._tag === 'Err') return;

  const files = new Map<string, RetainedJsonEvidence>([
    ['holdout.json', holdoutFile],
    ['run.json', retained('run.json', run)],
    ['policy.json', retained('policy.json', policy)],
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
