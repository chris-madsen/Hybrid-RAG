import { nativeCodeRetrieval } from '../src/domain/retrieval.js';
import {
  evaluateRetrievalStrategy,
  evaluateRetrievalQualityPolicy,
  type RetrievalHoldout,
  type RetrievalStrategyRun,
  type RetrievalQualityPolicy,
} from '../src/domain/retrieval-quality-evaluation.js';
import {
  evaluateSemanticProviderSelection,
  type SemanticProviderReport,
  type SemanticSelectionPolicy,
} from '../src/domain/semantic-provider-selection.js';

export interface RetainedJsonEvidence {
  readonly path: string;
  readonly sha256: string;
  readonly value: unknown;
}

export type ReadRetainedJson = (path: string) => Promise<RetainedJsonEvidence>;

export interface SelectionSourceEvidence {
  readonly nativeRetrieval?: {
    readonly holdout: { readonly path: string; readonly sha256: string };
    readonly run: { readonly path: string; readonly sha256: string };
    readonly policy: { readonly path: string; readonly sha256: string };
  };
  readonly semantic?: {
    readonly policy: { readonly path: string; readonly sha256: string };
    readonly reports: readonly { readonly path: string; readonly sha256: string }[];
  };
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const validateNativeRetrievalSources = async (
  selection: Record<string, unknown>,
  readJson: ReadRetainedJson,
): Promise<SelectionSourceEvidence['nativeRetrieval'] | undefined> => {
  // Legacy or absent evidence cannot satisfy the v2 domain release gate.
  if (selection.schemaVersion !== 2) return undefined;
  if (!nonEmpty(selection.holdoutPath) || !nonEmpty(selection.runPath) || !nonEmpty(selection.policyPath)
    || !nonEmpty(selection.holdoutSha256) || !nonEmpty(selection.runSha256) || !nonEmpty(selection.policySha256)) {
    throw new Error('native retrieval source identity is incomplete');
  }
  const [holdout, run, policy] = await Promise.all([
    readJson(selection.holdoutPath), readJson(selection.runPath), readJson(selection.policyPath),
  ]);
  if (holdout.sha256 !== selection.holdoutSha256 || run.sha256 !== selection.runSha256
    || policy.sha256 !== selection.policySha256) {
    throw new Error('native retrieval source digest mismatch');
  }
  const source = run.value as RetrievalStrategyRun;
  const requirements = policy.value as RetrievalQualityPolicy;
  if (source.sourceCommit !== selection.sourceCommit || source.holdoutSha256 !== holdout.sha256
    || source.strategy !== nativeCodeRetrieval.strategy
    || source.providerIdentities?.code_graph !== nativeCodeRetrieval.providerIdentities.code_graph
    || source.providerIdentities?.structural !== nativeCodeRetrieval.providerIdentities.structural
    || Object.keys(source.providerIdentities ?? {}).length !== 2
    || !sameJson(source.providerIdentities, selection.providerIdentities)
    || requirements.nonInferiority !== undefined) {
    throw new Error('native retrieval run identity mismatch');
  }
  const metrics = evaluateRetrievalStrategy(holdout.value as RetrievalHoldout, source);
  if (metrics._tag === 'Err') throw new Error('native retrieval source evaluator rejected run');
  const verdict = evaluateRetrievalQualityPolicy(metrics.value, holdout.sha256, requirements);
  if (verdict._tag === 'Err' || !sameJson(verdict.value, selection.verdict)) {
    throw new Error('native retrieval verdict does not match retained source reports');
  }
  return {
    holdout: { path: holdout.path, sha256: holdout.sha256 },
    run: { path: run.path, sha256: run.sha256 },
    policy: { path: policy.path, sha256: policy.sha256 },
  };
};

const validateSemanticSources = async (
  selection: Record<string, unknown>,
  readJson: ReadRetainedJson,
): Promise<SelectionSourceEvidence['semantic'] | undefined> => {
  const hasPolicyPath = 'policyPath' in selection;
  const hasReports = 'reports' in selection;
  if (!hasPolicyPath && !hasReports) return undefined;
  if (!nonEmpty(selection.policyPath) || !nonEmpty(selection.policySha256)
    || !Array.isArray(selection.reports) || selection.reports.length < 2) {
    throw new Error('semantic selection source identity is incomplete');
  }
  const reportEntries = selection.reports.map((entry) => {
    const value = record(entry);
    if (value === undefined || !nonEmpty(value.path) || !nonEmpty(value.sha256)) {
      throw new Error('semantic selection report source identity is incomplete');
    }
    return { path: value.path, sha256: value.sha256 };
  });
  const policy = await readJson(selection.policyPath);
  if (policy.sha256 !== selection.policySha256) {
    throw new Error('semantic selection policy digest mismatch');
  }
  const reports = await Promise.all(reportEntries.map((entry) => readJson(entry.path)));
  if (reports.some((report, index) => report.sha256 !== reportEntries[index]?.sha256)) {
    throw new Error('semantic selection source digest mismatch');
  }
  const verdict = evaluateSemanticProviderSelection(
    reports.map((report) => report.value as SemanticProviderReport),
    policy.value as SemanticSelectionPolicy,
  );
  if (verdict._tag === 'Err') {
    throw new Error(`semantic selection source evaluator rejected evidence: ${verdict.error.message}`);
  }
  if (!sameJson(verdict.value, selection.verdict)) {
    throw new Error('semantic selection verdict does not match retained source reports');
  }
  return {
    policy: { path: policy.path, sha256: policy.sha256 },
    reports: reports.map((report) => ({ path: report.path, sha256: report.sha256 })),
  };
};

export const validateReleaseSelectionSources = async (
  retrievalQuality: unknown,
  semanticSelection: unknown,
  readJson: ReadRetainedJson,
): Promise<SelectionSourceEvidence> => {
  const retrieval = record(retrievalQuality);
  const semantic = record(semanticSelection);
  const retrievalSources = retrieval === undefined ? undefined : await validateNativeRetrievalSources(retrieval, readJson);
  const semanticSources = semantic === undefined ? undefined : await validateSemanticSources(semantic, readJson);
  return {
    ...(retrievalSources === undefined ? {} : { nativeRetrieval: retrievalSources }),
    ...(semanticSources === undefined ? {} : { semantic: semanticSources }),
  };
};
