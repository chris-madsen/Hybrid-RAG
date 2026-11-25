import { createHash } from 'node:crypto';
import { Effect } from 'effect';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import {
  evidenceFromCandidate,
  makeEvidenceId,
  makeRequestId,
  mergeEvidence,
  type ContextBundle,
  type IndexCoverageSummary,
  type RankedCandidate,
  type RetrievalEvidence,
} from '../domain/retrieval.js';
import type {
  CodeGraphCandidatePort,
  DocumentationPort,
  GitHistoryPort,
  MemorySearchPort,
  ProviderTraceSink,
  SemanticAnalysisPort,
  WorkspaceFilePort,
} from '../application/ports.js';
import type { WorkspaceSync } from '../application/workspace-sync.js';
import {
  canonicalBenchmarkCandidateId,
  type RetrievalBenchmarkStageStatus,
  type RetrievalBenchmarkTraceSink,
} from '../domain/retrieval-benchmark.js';
import type { SemanticDefinition } from '../domain/semantic.js';
import {
  workingContextFromSnapshot,
  type RepoPath,
  type WorkingContext,
  type WorkingContextHints,
  type WorkspaceId,
} from '../domain/workspace.js';
import {
  initialSourceCoverage,
  legacySourceRequirements,
  requiredIncompleteSources,
  setSourceCoverage,
  sourceCoverageComplete,
  sourceIsRequested,
  type SourceRequirements,
} from '../domain/source-coverage.js';
import { noopProviderTrace, providerTraceEvent } from './provider-trace.js';
import {
  diffWorkspaceManifests,
  workspaceManifestFromSnapshot,
  workspaceManifestEqual,
  type WorkspaceManifest,
  type WorkspaceManifestDelta,
} from '../domain/workspace-manifest.js';
import {
  exactUtf8ByteRange,
  utf16ColumnAtUtf8Byte,
} from '../domain/utf8-range.js';

export interface NativeCbmContextConfig {
  readonly mode: 'cbm';
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly files: WorkspaceFilePort;
  readonly semantics: SemanticAnalysisPort;
  readonly newRequestId: () => string;
  readonly generation?: number;
  readonly indexKey?: string;
  readonly documentation?: DocumentationPort;
  readonly memory?: MemorySearchPort;
  readonly history?: GitHistoryPort;
  readonly candidateLimit?: number;
  readonly coverage?: IndexCoverageSummary;
  /** If set, every request must reconcile the authoritative working tree. */
  readonly workspaceManifest?: WorkspaceManifest;
  /**
   * Optional runtime-owned catch-up. The callback must publish and return a
   * complete provider configuration for exactly `currentManifest`; returning
   * another manifest is treated as a race and remains NOT_READY.
   */
  readonly reconcile?: (
    currentManifest: WorkspaceManifest,
    delta: WorkspaceManifestDelta,
  ) => Effect.Effect<Result<NativeCbmContextConfig, DomainError>>;
  readonly scopeFingerprint?: string;
  readonly semanticSnapshotIdentity?: string;
  readonly trace?: ProviderTraceSink;
  /** Internal benchmark boundary; never exposed as an Gateway tool or payload field. */
  readonly benchmarkTrace?: RetrievalBenchmarkTraceSink;
  readonly benchmarkRepositoryId?: string;
  readonly benchmarkProviderIdentities?: Readonly<Record<string, string>>;
  /** Request-local synchronization owner; avoids a full snapshot on no-change requests. */
  readonly workspaceSync?: WorkspaceSync;
  readonly codeGraph: CodeGraphCandidatePort;
  /** Runtime-owned publication fence, including native session identity loss. */
  readonly isPublished?: () => boolean;
}

const recordBenchmarkStage = (
  trace: RetrievalBenchmarkTraceSink | undefined,
  providerIdentities: Readonly<Record<string, string>> | undefined,
  requestId: string,
  stage: 'dense' | 'sparse' | 'fused' | 'working_context' | 'reranked' | 'delivered',
  candidates: readonly RankedCandidate[],
  startedAtMs: number,
  repositoryId?: string,
  status: RetrievalBenchmarkStageStatus = 'executed',
): void => {
  trace?.record({
    requestId,
    stage,
    status,
    candidates: candidates.map(({ candidate }) => ({
      runtimeCandidateId: candidate.candidateId,
      ...(repositoryId === undefined ? {} : {
        canonicalCandidateId: canonicalBenchmarkCandidateId(
          repositoryId,
          candidate.repoPath,
          candidate.sourceDigest,
          candidate.range,
        ),
      }),
      repoPath: candidate.repoPath,
      sourceDigest: candidate.sourceDigest,
      range: candidate.range,
    })),
    // Non-executed placeholders have NO elapsed time. startedAtMs=0 is a
    // sentinel, not Unix epoch zero; never contaminate latency aggregates.
    durationMs: status === 'executed' ? Math.max(0, Date.now() - startedAtMs) : 0,
    ...(providerIdentities === undefined ? {} : { providerIdentities }),
  });
};

export const makeNativeCbmContextProvider = (config: NativeCbmContextConfig) => {
  let activeConfig = config;
  /* eslint-disable @stylistic/indent -- the generator body retains the existing Effect indentation. */
  const search = (
    input: {
      readonly workspaceId: WorkspaceId;
      readonly query: string;
      readonly includeCode?: boolean;
      readonly includeDocs: boolean;
      readonly includeMemory: boolean;
      readonly includeHistory?: boolean;
      readonly sourceRequirements?: SourceRequirements;
      readonly workingContextHints?: WorkingContextHints;
    },
    retryBudget = 0,
  ): Effect.Effect<Result<ContextBundle, DomainError>> => Effect.gen(function* () {
      if (input.workspaceId !== activeConfig.workspaceId) {
        return err(domainError('POLICY_DENIED', 'workspace_id', 'context provider belongs to another workspace'));
      }
      let requestWorkingContext: WorkingContext | undefined;
      if (activeConfig.workspaceManifest !== undefined) {
        if (activeConfig.workspaceSync !== undefined) {
          const refreshed = yield* activeConfig.workspaceSync.refresh();
          if (refreshed._tag === 'Err') return refreshed;
          requestWorkingContext = refreshed.value.workingContext;
          const configBehindSync = activeConfig.indexKey !== undefined
            && refreshed.value.state.indexKey !== activeConfig.indexKey;
          if (refreshed.value.refreshed || configBehindSync) {
            if (activeConfig.reconcile === undefined) {
              return err(domainError(
                'NOT_READY',
                'workspace_manifest',
                'workspace synchronization is ahead of the active provider config; reconciliation is required before delivery',
              ));
            }
            const reconciled = yield* activeConfig.reconcile(
              refreshed.value.state.workspaceManifest,
              refreshed.value.delta,
            );
            if (reconciled._tag === 'Err') return reconciled;
            if (reconciled.value.workspaceManifest === undefined
            || !workspaceManifestEqual(reconciled.value.workspaceManifest, refreshed.value.state.workspaceManifest)) {
              return err(domainError(
                'NOT_READY',
                'workspace_manifest',
                'workspace changed again while reconciliation was publishing; refusing stale semantic context',
              ));
            }
            activeConfig = reconciled.value;
          }
        } else {
          const currentSnapshot = yield* activeConfig.files.snapshot(activeConfig.rootPath, Date.now());
          if (currentSnapshot._tag === 'Err') return currentSnapshot;
          requestWorkingContext = workingContextFromSnapshot(currentSnapshot.value);
          const currentManifest = workspaceManifestFromSnapshot(
            currentSnapshot.value,
            activeConfig.scopeFingerprint ?? activeConfig.workspaceManifest.scopeFingerprint,
          );
          if (!workspaceManifestEqual(activeConfig.workspaceManifest, currentManifest)
            || activeConfig.isPublished?.() === false) {
            const delta = diffWorkspaceManifests(activeConfig.workspaceManifest, currentManifest);
            if (activeConfig.reconcile === undefined) {
              return err(domainError(
                'NOT_READY',
                'workspace_manifest',
                'authoritative workspace manifest changed; indexed context requires reconciliation before complete delivery',
                {
                  changed: delta.changed.length,
                  added: delta.added.length,
                  deleted: delta.deleted.length,
                  renamed: delta.renamed.length,
                  scopeChanged: delta.scopeChanged,
                },
              ));
            }
            const reconciled = yield* activeConfig.reconcile(currentManifest, delta);
            if (reconciled._tag === 'Err') return reconciled;
            if (reconciled.value.workspaceManifest === undefined
            || !workspaceManifestEqual(reconciled.value.workspaceManifest, currentManifest)) {
              return err(domainError(
                'NOT_READY',
                'workspace_manifest',
                'workspace changed again while reconciliation was publishing; refusing stale semantic context',
              ));
            }
            activeConfig = reconciled.value;
          }
        }
      }
      // Remember the source/index generation that this search actually used.
      // A concurrent writer must not promote a newer generation while this
      // request still certifies an empty result against the older index.
      const sourceAtSearchStart = activeConfig.workspaceManifest;
      const indexKeyAtSearchStart = activeConfig.indexKey;
      const requestId = makeRequestId(activeConfig.newRequestId());
      if (requestId._tag === 'Err') return requestId;
      const includeCode = input.includeCode ?? true;
      const requirements = input.sourceRequirements ?? legacySourceRequirements({
        includeCode,
        includeDocs: input.includeDocs,
        includeMemory: input.includeMemory,
      });
      const lspRequirement = requirements.lsp ?? { requirement: 'not_requested' as const, allowed: true };
      const useLsp = sourceIsRequested(lspRequirement);
      // includeCode grants access to verified code candidates, NOT permission
      // to compute or publish native graph metadata. The caller's source
      // plan independently authorizes the optional structural provider.
      let sourceCoverage = initialSourceCoverage(requirements);
      const evidence: RetrievalEvidence[] = [];
      const warnings: string[] = [];
      const failed: string[] = [];
      let codeProviderError: DomainError | undefined;
      let rankedResults: readonly RankedCandidate[] = [];
      // A shortlist is not delivered until the final source revalidation.
      const candidateEvidenceIds = new Map<string, string>();
      let deliveryTraceStartedAtMs: number | undefined;
      let codeGraphError: DomainError | undefined;
      let codeGraphHitCount = 0;
      let lspConfirmedCount = 0;
      if (includeCode) {
        const limit = activeConfig.candidateLimit ?? 6;
        const startedAt = Date.now();
        const result = yield* activeConfig.codeGraph.search({
          query: input.query,
          limit,
          requestId: requestId.value,
          changedPaths: [
            ...(requestWorkingContext?.stagedPaths ?? []),
            ...(requestWorkingContext?.unstagedPaths ?? []),
            ...(requestWorkingContext?.untrackedPaths ?? []),
          ],
        });
        if (result._tag === 'Err') {
          codeProviderError = result.error;
          codeGraphError = result.error;
        } else if (result.value.some((item) => item.candidate.workspaceId !== input.workspaceId)) {
          codeProviderError = domainError('POLICY_DENIED', 'workspace_id', 'native CBM returned a foreign workspace candidate');
        } else if (result.value.length === 0) {
          // A native top-k query with no mapped candidate is not proof of
          // absence across all authorized source. Never certify a false empty.
          codeProviderError = domainError('NOT_READY', 'codebase_memory', 'native CBM returned no verified candidate hints');
        } else {
          // Preserve upstream order; no additional vector search, fusion,
          // score boosting or cross-encoder is involved on this path.
          rankedResults = result.value.slice(0, limit);
          codeGraphHitCount = rankedResults.length;
          deliveryTraceStartedAtMs = startedAt;
        }
        for (const stage of ['dense', 'sparse', 'fused', 'working_context', 'reranked'] as const) {
          recordBenchmarkStage(
            activeConfig.benchmarkTrace, activeConfig.benchmarkProviderIdentities,
            requestId.value, stage, [], 0, activeConfig.benchmarkRepositoryId,
            'not_applicable',
          );
        }
        if (codeProviderError !== undefined) {
          if (input.sourceRequirements === undefined) return err(codeProviderError);
          warnings.push('native code retrieval unavailable: ' + codeProviderError.code);
          failed.push('code', 'lsp');
        }
      }

      const lspDocumentSymbolsByPath = new Map<RepoPath, Result<readonly SemanticDefinition[], DomainError>>();
      const fullSources = new Map<RepoPath, {
        readonly bytes: Uint8Array;
        readonly digest: string;
      }>();
      const stalePaths: RepoPath[] = [];

      const initialFailures = new Map<RepoPath, string>();
      for (const ranked of rankedResults) {
        const candidate = ranked.candidate;
        // One authoritative exact workspace read per path, not per symbol.
        // Stop duplicating private full-file bytes into UUID artifacts with
        // no model-reachable Native Responses expansion consumer. Revalidate
        // the exact source again at the final request boundary.
        let full = fullSources.get(candidate.repoPath);
        if (full === undefined) {
          const priorError = initialFailures.get(candidate.repoPath);
          if (priorError !== undefined) {
            failed.push('code');
            continue;
          }
          const read = yield* activeConfig.files.readExact(activeConfig.rootPath, candidate.repoPath);
          if (read._tag === 'Err') {
            initialFailures.set(candidate.repoPath, read.error.code);
            // A path may disappear between the cheap workspace observation and
            // the first native candidate. Give the bounded exact-refresh path a chance
            // to reconcile the deletion rather than returning only stale hits.
            stalePaths.push(candidate.repoPath);
            warnings.push(candidate.repoPath + ': ' + read.error.code);
            failed.push('code');
            continue;
          }
          full = { bytes: read.value.bytes, digest: read.value.digest };
          fullSources.set(candidate.repoPath, full);
        }
        // Both the digest AND the byte-exact AST slice must match. Never deliver
        // unverified candidate payload as if it were the workspace's current source.
        const current = full.digest === candidate.sourceDigest;
        const exactSpan = exactUtf8ByteRange(full.bytes, candidate.range);
        const verifiedText = exactSpan === undefined ? undefined
          : Buffer.from(full.bytes).subarray(exactSpan.offset, exactSpan.offset + exactSpan.length).toString('utf8');
        const verified = current && verifiedText !== undefined && verifiedText === candidate.text;
        const freshness = current ? (verified ? 'current' : 'unknown') : 'stale';
        if (!verified) {
          // Stable collections can still contain crash leftovers from a prior
          // source generation. Initial verification must trigger the same
          // bounded repair as a race at the final exact-source boundary.
          stalePaths.push(candidate.repoPath);
          warnings.push(candidate.repoPath + ': stale index or AST slice disagrees with current original bytes');
          failed.push('code');
        }
        const evidenceId = makeEvidenceId('code-' + createHash('sha256')
          .update([
            candidate.workspaceId,
            candidate.candidateId,
            candidate.repoPath,
            candidate.sourceDigest,
            candidate.symbolName ?? '',
            String(candidate.range.startLine),
            String(candidate.range.startColumn ?? ''),
            String(candidate.range.endLine),
            String(candidate.range.endColumn ?? ''),
          ].join('\0'), 'utf8')
          .digest('hex'));
        if (evidenceId._tag === 'Err') return evidenceId;
        // Even a partial response must never present an unverified indexed snippet as direct evidence.
        if (!verified || verifiedText === undefined) continue;
        // CBM's get_file_outline is source-authoritative for declarations,
        // but its wire format reports inclusive LINES rather than identifier
        // columns. Obtain exact selection ranges from the existing, independent
        // native LSP documentSymbol API; do not add an ACE identifier parser.
        let nativeSelection: SemanticDefinition | undefined;
        if (useLsp && candidate.semanticAnchor === undefined
          && candidate.symbolName !== undefined
          && activeConfig.semantics.documentSymbols !== undefined) {
          let documentSymbols = lspDocumentSymbolsByPath.get(candidate.repoPath);
          if (documentSymbols === undefined) {
            documentSymbols = yield* activeConfig.semantics.documentSymbols({
              repoPath: candidate.repoPath, requestId: requestId.value,
              ...(activeConfig.semanticSnapshotIdentity === undefined
                ? {} : { snapshotIdentity: activeConfig.semanticSnapshotIdentity }),
            });
            lspDocumentSymbolsByPath.set(candidate.repoPath, documentSymbols);
          }
          if (documentSymbols._tag === 'Ok') {
            const matches = documentSymbols.value.filter((item) =>
              item.name === candidate.symbolName
              && item.location.repoPath === candidate.repoPath
              && item.location.startLine >= candidate.range.startLine
              && item.location.startLine <= candidate.range.endLine
              && item.location.endLine <= candidate.range.endLine);
            if (matches.length === 1) nativeSelection = matches[0];
          } else {
            warnings.push(candidate.repoPath + ': native LSP document symbols unavailable ('
              + documentSymbols.error.code + ')');
          }
        }
        const semanticLine = candidate.semanticAnchor?.line ?? nativeSelection?.location.startLine;
        const semanticEndLine = candidate.semanticAnchor?.endLine ?? nativeSelection?.location.endLine;
        const semanticColumn = candidate.semanticAnchor === undefined
          ? nativeSelection?.location.startColumn
          : utf16ColumnAtUtf8Byte(full.bytes, candidate.semanticAnchor.line, candidate.semanticAnchor.byteColumn);
        const semanticEndColumn = candidate.semanticAnchor === undefined
          ? nativeSelection?.location.endColumn
          : utf16ColumnAtUtf8Byte(full.bytes, candidate.semanticAnchor.endLine, candidate.semanticAnchor.endByteColumn);
        if (useLsp) {
          if (semanticLine === undefined || semanticEndLine === undefined
            || semanticColumn === undefined || semanticEndColumn === undefined) {
            warnings.push(candidate.repoPath + ': no unique source-bound identifier selection from CBM/LSP');
            failed.push('lsp');
          } else {
            const definitions = yield* activeConfig.semantics.definition({
              repoPath: candidate.repoPath,
              line: semanticLine,
              column: semanticColumn,
              requestId: requestId.value,
              ...(activeConfig.semanticSnapshotIdentity === undefined
                ? {} : { snapshotIdentity: activeConfig.semanticSnapshotIdentity }),
            });
            if (definitions._tag === 'Err') {
              warnings.push(candidate.repoPath + ': language service unavailable (' + definitions.error.code + ')');
              failed.push('lsp');
            } else {
              const lspConfirmed = definitions.value.some((entry) =>
                entry.location.repoPath === candidate.repoPath
                && entry.location.startLine === semanticLine
                && entry.location.startColumn === semanticColumn
                && entry.location.endLine === semanticEndLine
                && entry.location.endColumn === semanticEndColumn
                && (candidate.symbolName === undefined || entry.name === undefined
                  || entry.name === candidate.symbolName));
              if (!lspConfirmed) {
                warnings.push(candidate.repoPath + ': LSP definition does not agree with the selected structural node');
                failed.push('lsp');
              } else {
                lspConfirmedCount += 1;
              }
            }
          }
        }
        const baseEvidence = evidenceFromCandidate({ ...ranked, freshness }, evidenceId.value);
        candidateEvidenceIds.set(String(candidate.candidateId), String(evidenceId.value));
        evidence.push({
          ...baseEvidence,
          // Source identity remains the canonical path + verified digest,
          // never a UUID handle from an unreachable model-invoked tool.
          content: verifiedText,
        });
      }

      if (input.includeDocs) {
        if (activeConfig.documentation === undefined) {
          warnings.push('documentation provider not configured');
          failed.push('documentation');
          if (sourceIsRequested(requirements.documentation)) {
            sourceCoverage = setSourceCoverage(sourceCoverage, 'documentation', 'unavailable', 'provider_not_configured');
          }
        } else {
          const documents = yield* activeConfig.documentation.search({
            workspaceId: input.workspaceId,
            query: input.query,
            topK: 5,
            requestId: requestId.value,
          });
          if (documents._tag === 'Err') {
            warnings.push('Vertex documentation unavailable: ' + documents.error.code);
            failed.push('documentation');
            if (sourceIsRequested(requirements.documentation)) {
              sourceCoverage = setSourceCoverage(
                sourceCoverage,
                'documentation',
                documents.error.code === 'POLICY_DENIED' ? 'denied' : 'unavailable',
                documents.error.code,
              );
            }
          } else {
            evidence.push(...documents.value);
            if (documents.value.length === 0) {
              warnings.push('Vertex documentation corpus returned no contexts');
              failed.push('documentation');
              if (sourceIsRequested(requirements.documentation)) {
                sourceCoverage = setSourceCoverage(sourceCoverage, 'documentation', 'empty', 'no_contexts');
              }
            } else if (documents.value.some((item) => item.freshness !== 'current')) {
              failed.push('documentation');
              if (sourceIsRequested(requirements.documentation)) {
                sourceCoverage = setSourceCoverage(sourceCoverage, 'documentation', 'partial', 'freshness_not_current');
              }
            } else if (sourceIsRequested(requirements.documentation)) {
              sourceCoverage = setSourceCoverage(sourceCoverage, 'documentation', 'satisfied');
            }
          }
        }
      }
      if (input.includeHistory === true) {
        const historyRequirement = requirements.history
          ?? { requirement: 'not_requested' as const, allowed: true };
        if (activeConfig.history === undefined) {
          warnings.push('Git history provider not configured');
          failed.push('history');
          if (sourceIsRequested(historyRequirement)) {
            sourceCoverage = setSourceCoverage(sourceCoverage, 'history', 'unavailable', 'provider_not_configured');
          }
        } else {
          const history = yield* activeConfig.history.search({
            rootPath: activeConfig.rootPath,
            query: input.query,
            limit: 5,
            requestId: requestId.value,
          });
          if (history._tag === 'Err') {
            warnings.push('Git history unavailable: ' + history.error.code);
            failed.push('history');
            if (sourceIsRequested(historyRequirement)) {
              sourceCoverage = setSourceCoverage(sourceCoverage, 'history', 'unavailable', history.error.code);
            }
          } else {
            evidence.push(...history.value);
            if (sourceIsRequested(historyRequirement)) {
              sourceCoverage = setSourceCoverage(
                sourceCoverage,
                'history',
                history.value.length === 0 ? 'empty' : 'satisfied',
                history.value.length === 0 ? 'no_matching_commits' : undefined,
              );
            }
            if (history.value.length === 0) failed.push('history');
          }
        }
      }

      if (input.includeMemory) {
        if (activeConfig.memory === undefined) {
          warnings.push('memory provider not configured');
          failed.push('memory');
          if (sourceIsRequested(requirements.memory)) {
            sourceCoverage = setSourceCoverage(sourceCoverage, 'memory', 'unavailable', 'provider_not_configured');
          }
        } else {
          const memories = yield* activeConfig.memory.search({
            workspaceId: input.workspaceId,
            query: input.query,
            includeOriginal: false,
            requestId: requestId.value,
          });
          if (memories._tag === 'Err') {
            warnings.push('temporal memory unavailable: ' + memories.error.code);
            failed.push('memory');
            if (sourceIsRequested(requirements.memory)) {
              sourceCoverage = setSourceCoverage(
                sourceCoverage,
                'memory',
                memories.error.code === 'POLICY_DENIED' ? 'denied' : 'unavailable',
                memories.error.code,
              );
            }
          } else {
            const boundedMemoryEvidence = memories.value.evidenceCompleteness === 'provider_bounded_top_k';
            if (boundedMemoryEvidence) {
              warnings.push('memory: provider_bounded_top_k does not establish exhaustive history');
              failed.push('memory');
            }
            if (sourceIsRequested(requirements.memory)) {
              sourceCoverage = setSourceCoverage(
                sourceCoverage,
                'memory',
                boundedMemoryEvidence ? 'partial' : 'satisfied',
                boundedMemoryEvidence ? 'provider_bounded_top_k' : undefined,
              );
            }
            for (const hit of memories.value.hits) {
              const evidenceId = makeEvidenceId('memory-' + createHash('sha256')
                .update([
                  hit.episode.episodeId,
                  hit.episode.contentDigest,
                  hit.episode.sourcePointer,
                  hit.matchingExcerpt,
                ].join('\0'), 'utf8')
                .digest('hex'));
              if (evidenceId._tag === 'Err') return evidenceId;
              evidence.push({
                evidenceId: evidenceId.value,
                source: 'memory',
                citation: hit.episode.sourcePointer,
                content: hit.matchingExcerpt,
                sourceDigest: hit.episode.contentDigest,
                proofClass: 'derived',
                // "current" here means the Graphiti edge was linked back to
                // byte-verified immutable archive provenance, not current source code.
                freshness: 'current',
                sourceRevision: hit.episode.contentDigest,
                sourceTimestampMs: hit.episode.occurredAtMs,
              });
            }
          }
        }
      }
      // A native graph lookup can describe paths outside the verified native
      // shortlist. Its aggregate source provenance is not certified by the
      // per-candidate exact rereads, so it must NEVER enter model-visible
      // evidence. It can only provide digest-matched internal ranking hints.
      // Requested structural coverage stays partial until the rendered map
      // itself has trustworthy per-path freshness proof (future phase).
      if (includeCode && (activeConfig.coverage?.failedPaths ?? 0) > 0) {
        warnings.push(`index coverage degraded: ${activeConfig.coverage?.failedPaths ?? 0} in-scope path(s) were not fully indexed`);
        failed.push('code');
      }
      // Revalidate as the LAST I/O step, after even slow Vertex/document calls.
      for (const [path, original] of fullSources) {
        const verificationStartedAtMs = Date.now();
        const current = yield* activeConfig.files.readExact(activeConfig.rootPath, path);
        const verifiedCurrent = current._tag === 'Ok' && current.value.digest === original.digest;
        providerTraceEvent(activeConfig.trace ?? noopProviderTrace, {
          provider: 'source_verification',
          providerVersion: 'workspace-file/v1',
          operation: 'read_exact_final',
          status: verifiedCurrent ? 'success' : 'failure',
          durationMs: Math.max(0, Date.now() - verificationStartedAtMs),
          requestId: requestId.value,
          ...(!verifiedCurrent ? {
            errorCode: current._tag === 'Err' ? current.error.code : 'DIGEST_MISMATCH',
          } : {}),
        });
        if (!verifiedCurrent) {
          warnings.push(path + ': source changed during retrieval');
          // Semantic confirmation was computed from the same pre-race source
          // generation, so a final digest race invalidates both direct code
          // freshness and LSP coverage.
          failed.push('code', 'lsp');
          stalePaths.push(path);
          for (let i = 0; i < evidence.length; i += 1) {
            if (evidence[i]?.citation.startsWith(path + ':')) {
              const existing = evidence[i];
              if (existing !== undefined) evidence[i] = { ...existing, freshness: 'changed_during_request', proofClass: 'uncertain' };
            }
          }
        }
      }
      if (stalePaths.length > 0 && retryBudget === 0
        && activeConfig.workspaceSync !== undefined
        && activeConfig.reconcile !== undefined) {
        const refreshed = yield* activeConfig.workspaceSync.refreshExact(stalePaths);
        if (refreshed._tag === 'Ok') {
          const reconciled = yield* activeConfig.reconcile(
            refreshed.value.state.workspaceManifest,
            refreshed.value.delta,
          );
          if (reconciled._tag === 'Ok') {
            activeConfig = reconciled.value;
            return yield* search(input, 1);
          }
        }
      }
      // Native ranking depends on the whole graph, not only the returned files.
      // Re-observe even nonempty results: an uncited changed/deleted/new path can
      // invalidate the shortlist. This fence does not certify an ABA-free snapshot.
      if (includeCode && sourceAtSearchStart !== undefined) {
        const finalSnapshot = yield* activeConfig.files.snapshot(activeConfig.rootPath, Date.now());
        if (finalSnapshot._tag === 'Err') return finalSnapshot;
        const finalManifest = workspaceManifestFromSnapshot(
          finalSnapshot.value, activeConfig.scopeFingerprint ?? sourceAtSearchStart.scopeFingerprint,
        );
        if (activeConfig.isPublished?.() === false || activeConfig.indexKey !== indexKeyAtSearchStart
          || !workspaceManifestEqual(finalManifest, sourceAtSearchStart)) {
          return err(domainError('WORKTREE_RACED', 'workspace_manifest',
            'native graph publication or authoritative source changed during retrieval'));
        }
      }
      const merged = mergeEvidence(requestId.value, input.query, evidence, warnings, failed);
      // Unlike cited results, an empty result has no selected file to exact-
      // re-read at the end of a slow query. Re-observe the authoritative
      // workspace now; an unchanged index from request start is necessary
      // before we can certify that source evidence was truly absent.
      if (includeCode && requirements.code.requirement === 'required'
        && requirements.code.allowed && merged.evidence.length === 0
        && codeProviderError === undefined && !failed.includes('code')) {
        if (sourceAtSearchStart === undefined) {
          return err(domainError('NOT_READY', 'workspace_manifest',
            'empty code retrieval lacks an authoritative source snapshot'));
        }
        if (activeConfig.indexKey !== indexKeyAtSearchStart
          || activeConfig.workspaceManifest === undefined
          || !workspaceManifestEqual(activeConfig.workspaceManifest, sourceAtSearchStart)) {
          return err(domainError('NOT_READY', 'workspace_manifest',
            'code index generation changed during empty retrieval'));
        }
        if (activeConfig.workspaceSync !== undefined) {
          const finalObservation = yield* activeConfig.workspaceSync.refresh();
          if (finalObservation._tag === 'Err') return finalObservation;
          if (finalObservation.value.refreshed
            || (indexKeyAtSearchStart !== undefined
              && finalObservation.value.state.indexKey !== indexKeyAtSearchStart)
            || !workspaceManifestEqual(finalObservation.value.state.workspaceManifest, sourceAtSearchStart)) {
            return err(domainError('NOT_READY', 'workspace_manifest',
              'source changed during empty code retrieval'));
          }
        } else {
          const finalSnapshot = yield* activeConfig.files.snapshot(activeConfig.rootPath, Date.now());
          if (finalSnapshot._tag === 'Err') return finalSnapshot;
          const finalManifest = workspaceManifestFromSnapshot(
            finalSnapshot.value, activeConfig.scopeFingerprint ?? sourceAtSearchStart.scopeFingerprint,
          );
          if (!workspaceManifestEqual(finalManifest, sourceAtSearchStart)) {
            return err(domainError('NOT_READY', 'workspace_manifest',
              'source changed during empty code retrieval'));
          }
        }
      }
      if (requirements.code.requirement !== 'not_requested' && requirements.code.allowed) {
        sourceCoverage = setSourceCoverage(
          sourceCoverage,
          'code',
          !includeCode || codeProviderError !== undefined ? 'unavailable' : failed.includes('code') ? 'partial' : 'satisfied',
          !includeCode ? 'not_executed' : codeProviderError?.code,
        );
      }
      if (requirements.structural.requirement !== 'not_requested' && requirements.structural.allowed) {
        // Native CBM graph is a discovery signal. The referenced original
        // code is read/digest-verified in the code branch, but graph topology
        // is never upgraded to an exact-source citation.
        const structuralStatus = !includeCode || codeProviderError !== undefined
          || codeGraphError !== undefined
          ? 'unavailable'
          : codeGraphHitCount === 0 ? 'empty' : 'partial';
        sourceCoverage = setSourceCoverage(
          sourceCoverage, 'structural', structuralStatus,
          !includeCode ? 'not_executed'
            : codeProviderError?.code ?? codeGraphError?.code
              ?? (codeGraphHitCount === 0 ? undefined : 'native_graph_not_exact_reread'),
        );
      }
      if (lspRequirement.requirement !== 'not_requested' && lspRequirement.allowed) {
        sourceCoverage = setSourceCoverage(
          sourceCoverage,
          'lsp',
          !includeCode || codeProviderError !== undefined
            ? 'unavailable'
            : rankedResults.length === 0
              ? 'empty'
              : failed.includes('lsp') || lspConfirmedCount < rankedResults.length ? 'partial' : 'satisfied',
          !includeCode ? 'not_executed' : codeProviderError?.code,
        );
      }
      const incomplete = requiredIncompleteSources(sourceCoverage);
      const covered = {
        ...merged,
        sourceCoverage,
        sourcePlan: requirements,
        partialSources: incomplete,
        complete: sourceCoverageComplete(sourceCoverage),
        ...(activeConfig.coverage === undefined ? {} : { indexCoverage: activeConfig.coverage }),
      };
      if (includeCode && codeProviderError === undefined && deliveryTraceStartedAtMs !== undefined) {
        const finalVerifiedIds = new Set(covered.evidence
          .filter((item) => item.source === 'code'
            && item.freshness === 'current' && item.proofClass === 'direct')
          .map((item) => String(item.evidenceId)));
        const verifiedRanks = rankedResults.filter((ranked) => {
          const evidenceId = candidateEvidenceIds.get(String(ranked.candidate.candidateId));
          return evidenceId !== undefined && finalVerifiedIds.has(evidenceId);
        });
        // A final exact-source-verified retrieval observation, not a physical
        // Bifröst/model send. Zero hits from an executed search score as misses.
        const incompleteVerification = failed.includes('code') || stalePaths.length > 0;
        recordBenchmarkStage(
          activeConfig.benchmarkTrace,
          activeConfig.benchmarkProviderIdentities,
          requestId.value,
          'delivered',
          incompleteVerification ? [] : verifiedRanks,
          deliveryTraceStartedAtMs,
          activeConfig.benchmarkRepositoryId,
          incompleteVerification ? 'unavailable' : 'executed',
        );
      }
      return ok(covered);
    }) as Effect.Effect<Result<ContextBundle, DomainError>>;
  /* eslint-enable @stylistic/indent */
  return { search };
};

