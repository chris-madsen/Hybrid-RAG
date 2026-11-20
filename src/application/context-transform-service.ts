import { Effect } from 'effect';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, isErr, ok, type Result } from '../domain/result.js';
import type { WorkspaceStore, IdPort, ContextProvider } from './ports.js';
import { makeContextAssembler, type ContextAssembler } from './context-assembler.js';
import { projectContextForDelivery, resolveDeliveryIntent } from '../domain/context-delivery.js';
import { ingestRepoPath, makeWorkspaceId, type WorkingContextHints, type WorkspaceId } from '../domain/workspace.js';
import type { RetrievalEvidence } from '../domain/retrieval.js';
import { resolveExplicitSourceRequirements, sourceCoverageComplete } from '../domain/source-coverage.js';

export interface AceTransformRequest {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly sessionId: string;
  readonly turnId: string;
  readonly workspaceId: string;
  readonly query: string;
  readonly budgetTokens: number;
  readonly sourceObligations: {
    readonly required: readonly ['code'];
  };
  readonly intent?: string;
  readonly workingContext?: {
    readonly focusedPath?: string;
    readonly openPaths?: readonly string[];
    readonly focusedRange?: { readonly startLine: number; readonly endLine: number };
  };
  readonly knownBundleId?: string;
  readonly knownEvidenceIds?: readonly string[];
  /** Text actually visible in the current native Responses input, not opaque history. */
  readonly visibleNativeInputText?: readonly string[];
}

export interface AceTransformResult {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly sessionId: string;
  readonly turnId: string;
  readonly workspaceId: WorkspaceId;
  readonly status: 'ready' | 'partial' | 'not_ready' | 'blocked';
  readonly contextText: string;
  readonly evidence: readonly RetrievalEvidence[];
  readonly selectedEvidenceIds: readonly string[];
  readonly omittedEvidenceIds: readonly string[];
  readonly estimatedTokens: number;
  /** Explicitly distinguishes a model-matched count from the fallback estimate. */
  readonly tokenCountMode: 'host_counter' | 'character_estimate';
  readonly sourceCommit?: string;
  readonly sourceManifestSha256?: string;
  readonly providerIdentities: Readonly<Record<string, string>>;
  readonly receiptId: string;
  /** Original provider trace request identity, distinct from the caller's transform request ID. */
  readonly providerRequestId: string;
  readonly limitations: readonly string[];
}

export interface ContextTransformPorts {
  readonly ids: IdPort;
  readonly store: WorkspaceStore;
  readonly context: ContextProvider;
  /** Active provider identities are resolved at each request. A runtime
   * publication may replace the selected LSP server on an index refresh;
   * constructor-time names from environment variables are not attestation.
   */
  readonly providerIdentities?: Readonly<Record<string, string>>
    | (() => Readonly<Record<string, string>>);
  readonly assembler?: ContextAssembler;
  /** Optional exact host/provider token counter for the active model. */
  readonly countTokens?: (text: string) => number;
}

export interface ContextTransformService {
  readonly transform: (
    request: AceTransformRequest,
  ) => Effect.Effect<Result<AceTransformResult, DomainError>>;
}

const nonEmpty = (value: string, path: string): Result<string, DomainError> =>
  value.trim().length === 0
    ? err(domainError('INVALID_INPUT', path, `${path} must not be empty`))
    : ok(value.trim());

const sourceObligationsFor = (
  value: AceTransformRequest['sourceObligations'],
): Result<AceTransformRequest['sourceObligations'], DomainError> => {
  if (!Array.isArray(value.required) || value.required.length !== 1 || value.required[0] !== 'code') {
    return err(domainError('INVALID_INPUT', 'sourceObligations.required', 'the Harbor smoke currently requires exactly the code source class'));
  }
  return ok({ required: ['code'] });
};

const workingContextFor = (
  value: AceTransformRequest['workingContext'],
): Result<WorkingContextHints | undefined, DomainError> => {
  if (value === undefined) return ok(undefined);
  const focusedPath = value.focusedPath === undefined ? undefined : ingestRepoPath(value.focusedPath);
  if (focusedPath?._tag === 'Err') return focusedPath;
  const openPaths = [];
  for (const path of value.openPaths ?? []) {
    const parsed = ingestRepoPath(path);
    if (parsed._tag === 'Err') return parsed;
    openPaths.push(parsed.value);
  }
  if (openPaths.length > 100) {
    return err(domainError('INVALID_INPUT', 'working_context.open_paths', 'at most 100 open paths are allowed'));
  }
  const range = value.focusedRange;
  if (range !== undefined && (
    !Number.isSafeInteger(range.startLine)
    || !Number.isSafeInteger(range.endLine)
    || range.startLine < 1
    || range.endLine < range.startLine
  )) {
    return err(domainError('INVALID_INPUT', 'working_context.focused_range', 'focused range must be positive and ordered'));
  }
  return ok({
    ...(focusedPath?._tag === 'Ok' ? { focusedPath: focusedPath.value } : {}),
    ...(openPaths.length === 0 ? {} : { openPaths }),
    ...(range === undefined ? {} : { focusedRange: { startLine: range.startLine, endLine: range.endLine } }),
  });
};

const activeProviderIdentities = (ports: ContextTransformPorts): Readonly<Record<string, string>> => {
  const source = ports.providerIdentities;
  return typeof source === 'function' ? source() : source ?? {};
};

export const makeContextTransformService = (ports: ContextTransformPorts): ContextTransformService => ({
  transform: (request) => Effect.gen(function* () {
    const assembler = ports.assembler ?? makeContextAssembler(ports.countTokens);
    if (request.schemaVersion !== 1) return err(domainError('INVALID_INPUT', 'schemaVersion', 'unsupported transform schema version'));
    const requestId = nonEmpty(request.requestId, 'requestId');
    if (requestId._tag === 'Err') return requestId;
    const sessionId = nonEmpty(request.sessionId, 'sessionId');
    if (sessionId._tag === 'Err') return sessionId;
    const turnId = nonEmpty(request.turnId, 'turnId');
    if (turnId._tag === 'Err') return turnId;
    const query = nonEmpty(request.query, 'query');
    if (query._tag === 'Err') return query;
    if (!Number.isSafeInteger(request.budgetTokens) || request.budgetTokens <= 0) {
      return err(domainError('INVALID_INPUT', 'budgetTokens', 'budgetTokens must be a positive safe integer'));
    }
    const sourceObligations = sourceObligationsFor(request.sourceObligations);
    if (sourceObligations._tag === 'Err') return sourceObligations;
    // The native Gateway requests code ONLY. Do not fall back to the legacy
    // includeCode route, which also implicitly requests optional RepoMap.
    const sourcePlan = resolveExplicitSourceRequirements({ required: sourceObligations.value.required });
    if (sourcePlan._tag === 'Err') return sourcePlan;
    const workspaceId = makeWorkspaceId(request.workspaceId);
    if (workspaceId._tag === 'Err') return workspaceId;
    const workspace = yield* ports.store.get(workspaceId.value);
    if (isErr(workspace)) return workspace;
    const workingContext = workingContextFor(request.workingContext);
    if (workingContext._tag === 'Err') return workingContext;
    const searched = yield* ports.context.search({
      workspaceId: workspaceId.value,
      query: query.value,
      ...(request.intent === undefined ? {} : { intent: request.intent }),
      includeCode: true,
      includeDocs: false,
      includeMemory: false,
      includeHistory: false,
      sourceRequirements: sourcePlan.value,
      ...(workingContext.value === undefined ? {} : { workingContextHints: workingContext.value }),
    });
    if (isErr(searched)) return searched;
    // A provider which ignored the explicit code-only contract must not be
    // allowed to turn a legacy optional map into a successful model request.
    const returnedPlan = searched.value.sourcePlan;
    // An omitted plan is not proof of having honored the caller's code-only
    // restriction. Fail closed instead of silently accepting a legacy provider
    // that may have searched or certified a different set of sources.
    if (returnedPlan === undefined
      || Object.keys(returnedPlan).length !== Object.keys(sourcePlan.value).length
      || (Object.keys(sourcePlan.value) as Array<keyof typeof sourcePlan.value>).some((source) =>
        returnedPlan[source]?.requirement !== sourcePlan.value[source]?.requirement
        || returnedPlan[source]?.allowed !== sourcePlan.value[source]?.allowed)) {
      return err(domainError('NOT_READY', 'source_plan', 'retrieval provider ignored the code-only source plan'));
    }
    // Defense in depth at the model boundary: even if a provider accidentally
    // returns a structural item, do not allow it into receipt packing or the
    // Native Responses developer context. It is not an authorized source.
    const codeOnlyBundle = {
      ...searched.value,
      evidence: searched.value.evidence.filter((item) => item.source === 'code'),
    };
    const projected = projectContextForDelivery(
      codeOnlyBundle,
      resolveDeliveryIntent(request.intent),
      {
        ...(request.knownBundleId === undefined ? {} : { knownBundleId: request.knownBundleId }),
        ...(request.knownEvidenceIds === undefined ? {} : { knownEvidenceIds: request.knownEvidenceIds }),
        ...(request.visibleNativeInputText === undefined ? {}
          : { visibleNativeInputText: request.visibleNativeInputText }),
        receiptScope: String(workspaceId.value),
      },
    );
    // A completed, unambiguous search with zero relevant evidence is not a
    // provider outage. Surface that verified empty outcome separately so the
    // Gateway can preserve the original request without injecting filler.
    // Missing/partial/denied/stale required sources must still fail closed.
    if (projected.evidence.length === 0) {
      // A complete flag alone is not evidence that required code was actually
      // observed. Only the retrieval owner can certify an exact, current,
      // successful zero-hit code search; missing coverage fails closed.
      const codeCoverage = projected.sourceCoverage?.find((entry) =>
        entry.source === 'code' && entry.requirement === 'required');
      if (!projected.complete || projected.warnings.length > 0
        || projected.partialSources.length > 0
        || codeCoverage?.status !== 'satisfied'
        || (projected.indexCoverage?.failedPaths ?? 0) > 0
        || !sourceCoverageComplete(projected.sourceCoverage ?? [])) {
        return err(domainError('NOT_READY', 'context', 'ACE evidence is missing or incomplete'));
      }
      return ok({
        schemaVersion: 1,
        requestId: requestId.value, sessionId: sessionId.value, turnId: turnId.value,
        workspaceId: workspaceId.value, status: 'ready' as const,
        contextText: '', evidence: [], selectedEvidenceIds: [], omittedEvidenceIds: [],
        estimatedTokens: 0, tokenCountMode: 'character_estimate' as const,
        ...(workspace.value.lastObservation?.headRevision === undefined
          ? {} : { sourceCommit: workspace.value.lastObservation.headRevision }),
        ...(projected.indexCoverage?.sourceSnapshotDigest === undefined
          ? {} : { sourceManifestSha256: projected.indexCoverage.sourceSnapshotDigest }),
        providerIdentities: activeProviderIdentities(ports),
        receiptId: `ace-transform-${projected.bundleId ?? requestId.value}`,
        providerRequestId: String(searched.value.requestId), limitations: [],
      });
    }
    const assembled = yield* assembler.assemble({
      evidence: projected.evidence,
      budgetTokens: request.budgetTokens,
    });
    if (assembled._tag === 'Err') return assembled;
    if (assembled.value.selected.length === 0) {
      return err(domainError('NOT_READY', 'budgetTokens', 'ACE evidence cannot fit the requested context budget'));
    }
    const selectedIds = assembled.value.selected.map((item) => String(item.evidenceId));
    const omittedIds = projected.evidence
      .filter((item) => !selectedIds.includes(String(item.evidenceId)))
      .map((item) => String(item.evidenceId));
    const limitations = [
      ...projected.warnings,
      ...projected.partialSources.map((source) => `${source}: partial`),
      ...assembled.value.limitations,
      ...(assembled.value.tokenCountMode === 'host_counter'
        ? []
        : ['token budget is a character-based estimate; model-exact fit is unverified']),
    ];
    // A complete provider bundle can still become partial after budget packing.
    // Source completeness is independent of whether the provider exposes a
    // model-exact counter. Keep estimates labeled, never block the Gateway
    // merely because the only available token measurement is approximate.
    const status = projected.complete && !assembled.value.truncated
      ? 'ready' as const : 'partial' as const;
    const receiptId = `ace-transform-${projected.bundleId ?? requestId.value}`;
    return ok({
      schemaVersion: 1,
      requestId: requestId.value,
      sessionId: sessionId.value,
      turnId: turnId.value,
      workspaceId: workspaceId.value,
      status,
      contextText: assembled.value.text,
      evidence: assembled.value.selected,
      selectedEvidenceIds: selectedIds,
      omittedEvidenceIds: omittedIds,
      estimatedTokens: assembled.value.estimatedTokens,
      tokenCountMode: assembled.value.tokenCountMode,
      ...(workspace.value.lastObservation?.headRevision === undefined
        ? {}
        : { sourceCommit: workspace.value.lastObservation.headRevision }),
      ...(projected.indexCoverage?.sourceSnapshotDigest === undefined
        ? {}
        : { sourceManifestSha256: projected.indexCoverage.sourceSnapshotDigest }),
      providerIdentities: activeProviderIdentities(ports),
      receiptId,
      providerRequestId: String(searched.value.requestId),
      limitations,
    });
  }),
});
