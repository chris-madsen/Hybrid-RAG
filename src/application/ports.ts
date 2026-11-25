import type { Effect } from 'effect';
import type { DomainError } from '../domain/errors.js';
import type { SafeAuditRecord } from '../domain/policy.js';
import type {
  ContentDigest,
  FileObservation,
  RepoPath,
  WorkingContextHints,
  WorkspaceId,
  WorkspaceRecord,
  WorkspaceSnapshot,
} from '../domain/workspace.js';
import type { Result } from '../domain/result.js';
import type { CodeRetrievalStrategy, ContextBundle, CodeCandidate, RankedCandidate } from '../domain/retrieval.js';
import type { DecisionRecord, EpisodeId, MemorySearchResult, ProjectionKey, ProjectionReceipt, SessionEpisode } from '../domain/memory.js';
import type {
  SemanticDefinition,
  SemanticDiagnostic,
  SemanticReference,
  SemanticTypeInfo,
  StructuralAnalysis,
} from '../domain/semantic.js';
import type { ProviderTraceEvent } from '../domain/provider-trace.js';
import type { SourceRequirements } from '../domain/source-coverage.js';

export interface HttpRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Readonly<Record<string, unknown>>;
  readonly timeoutMs?: number;
}

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export interface HttpPort {
  readonly request: (request: HttpRequest) => Effect.Effect<Result<HttpResponse, DomainError>>;
}

/**
 * Embedding provider boundary. The concrete provider is intentionally not
 * selected here; provider choice requires an approved, measured spike.
 */
export interface VectorEmbeddingPort {
  readonly embedMany: (input: readonly string[], requestId?: string) => Effect.Effect<Result<readonly (readonly number[])[], DomainError>>;
}

export interface SparseVector {
  readonly indices: readonly number[];
  readonly values: readonly number[];
}

export interface SparseEmbeddingPort {
  readonly embedDocuments: (
    input: readonly string[],
    requestId?: string,
  ) => Effect.Effect<Result<readonly SparseVector[], DomainError>>;
  readonly embedQueries: (
    input: readonly string[],
    requestId?: string,
  ) => Effect.Effect<Result<readonly SparseVector[], DomainError>>;
}

export interface RerankScore {
  readonly index: number;
  readonly score: number;
}

export interface RerankerPort {
  readonly rerank: (input: {
    readonly query: string;
    readonly documents: readonly string[];
    readonly requestId?: string;
  }) => Effect.Effect<Result<readonly RerankScore[], DomainError>>;
}

export interface ProviderTraceSink {
  readonly record: (event: ProviderTraceEvent) => void;
}

export interface CodePoint {
  readonly candidate: CodeCandidate;
  readonly vector: readonly number[];
  /** Client-side maintained sparse embedding for self-hosted Qdrant. */
  readonly sparseVector?: SparseVector;
  /** Opaque source-snapshot key used to isolate equal observation epochs. */
  readonly indexKey?: string;
  /** Content-addressed embedding identity, independent from source citation identity. */
  readonly embeddingKey?: string;
}

/** External code-graph discovery. Graph nodes are hints, never verified source
 * evidence; consumers must read/hash the original workspace before delivery. */
export interface CodeGraphCandidatePort {
  readonly search: (input: {
    readonly query: string;
    readonly limit: number;
    /** Correlates native graph retrieval with one ACE ContextBundle. */
    readonly requestId?: string;
    /** Dirty/changed paths trigger native detect_changes impact assessment. */
    readonly changedPaths?: readonly RepoPath[];
  }) => Effect.Effect<Result<readonly RankedCandidate[], DomainError>>;
}

export interface CodeCandidatePort {
  readonly search: (input: {
    readonly workspaceId: WorkspaceId;
    /** Dense query vector; required by dense/hybrid strategies and intentionally absent for sparse-only ablations. */
    readonly vector?: readonly number[];
    /** Original query text retained for trace/benchmark correlation. */
    readonly queryText?: string;
    /** Client-side sparse query vector; required by sparse/hybrid strategies. */
    readonly sparseVector?: SparseVector;
    /** Explicit strategy keeps benchmark arms on the same production adapter. */
    readonly strategy?: CodeRetrievalStrategy;
    readonly limit: number;
    /** Per-branch candidate depth before fusion; defaults to a bounded multiple of limit. */
    readonly prefetchLimit?: number;
    /** Current build epoch, preventing deleted/renamed sources from reappearing. */
    readonly generation?: number;
    /** Current source snapshot key, preventing equal epochs from mixing. */
    readonly indexKey?: string;
    /** Correlates query-time provider work to one ACE ContextBundle. */
    readonly requestId?: string;
  }) => Effect.Effect<Result<readonly RankedCandidate[], DomainError>>;
  readonly upsert: (points: readonly CodePoint[]) => Effect.Effect<Result<void, DomainError>>;
  /**
   * Delete points for supplied workspace paths. When exceptIndexKey is set,
   * only older path versions are removed, leaving the just-published version.
   */
  readonly deletePaths?: (input: {
    readonly workspaceId: WorkspaceId;
    readonly repoPaths: readonly RepoPath[];
    readonly exceptIndexKey?: string;
  }) => Effect.Effect<Result<void, DomainError>>;
  /**
   * Startup/restart reconciliation: remove every older workspace version only
   * after the complete current snapshot has been successfully upserted.
   */
  readonly deleteWorkspaceVersions?: (input: {
    readonly workspaceId: WorkspaceId;
    readonly exceptIndexKey: string;
    /**
     * Stable-collection fencing: when set, delete only versions older than
     * this observation generation. Newer concurrent writers are never matched.
     */
    readonly beforeGeneration?: number;
  }) => Effect.Effect<Result<void, DomainError>>;
}

export interface DocumentationPort {
  readonly search: (input: {
    readonly workspaceId: WorkspaceId;
    readonly query: string;
    readonly topK: number;
    readonly requestId?: string;
  }) => Effect.Effect<Result<readonly ContextBundle['evidence'][number][], DomainError>>;
}

export interface StructuralAnalysisPort {
  readonly extract: (input: {
    readonly repoPath: string;
    readonly source: Uint8Array;
  }) => Effect.Effect<Result<StructuralAnalysis, DomainError>>;
  /** Optional batch path: results correspond to inputs, including per-file failures. */
  readonly extractMany?: (inputs: readonly {
    readonly repoPath: string;
    readonly source: Uint8Array;
  }[]) => Effect.Effect<readonly Result<StructuralAnalysis, DomainError>[]>;
}

export interface SemanticAnalysisPort {
  /**
   * Native LSP documentSymbol selection ranges allow exact identifier
   * verification when CBM file outlines expose only inclusive line spans.
   * Optional for language servers that cannot enumerate document symbols.
   */
  readonly documentSymbols?: (input: {
    readonly repoPath: string;
    readonly requestId?: string;
    readonly snapshotIdentity?: string;
  }) => Effect.Effect<Result<readonly SemanticDefinition[], DomainError>>;
  readonly definition: (input: SemanticQuery) => Effect.Effect<Result<readonly SemanticDefinition[], DomainError>>;
  readonly references: (input: SemanticQuery) => Effect.Effect<Result<readonly SemanticReference[], DomainError>>;
  readonly typeInfo: (input: SemanticQuery) => Effect.Effect<Result<SemanticTypeInfo | undefined, DomainError>>;
  readonly diagnostics: (input: { readonly repoPath: string }) => Effect.Effect<Result<readonly SemanticDiagnostic[], DomainError>>;
}

export interface SemanticQuery {
  readonly repoPath: string;
  readonly line: number;
  readonly column: number;
  /** Correlates semantic provider work to one ACE ContextBundle. */
  readonly requestId?: string;
  /** Identity of the source/configuration generation the caller verified. */
  readonly snapshotIdentity?: string;
}

export interface GitHistoryPort {
  readonly search: (input: {
    readonly rootPath: string;
    readonly query: string;
    readonly limit: number;
    readonly requestId?: string;
  }) => Effect.Effect<Result<readonly ContextBundle['evidence'][number][], DomainError>>;
}

/** Runtime-neutral context retrieval capability shared by all delivery planes. */
export interface ContextProvider {
  readonly search: (input: {
    readonly workspaceId: WorkspaceId;
    readonly query: string;
    readonly intent?: string;
    readonly includeCode?: boolean;
    readonly includeDocs: boolean;
    readonly includeMemory: boolean;
    readonly includeHistory?: boolean;
    readonly sourceRequirements?: SourceRequirements;
    readonly workingContextHints?: WorkingContextHints;
  }) => Effect.Effect<Result<ContextBundle, DomainError>>;
}

export interface MemorySearchPort {
  readonly search: (input: {
    readonly workspaceId: WorkspaceId;
    readonly query: string;
    readonly asOfMs?: number;
    readonly includeOriginal: boolean;
    readonly requestId?: string;
  }) => Effect.Effect<Result<MemorySearchResult, DomainError>>;
}

export interface DecisionHistoryPort {
  readonly list: (workspaceId: WorkspaceId) => Effect.Effect<Result<readonly DecisionRecord[], DomainError>>;
}

export interface ProjectionOutboxPort {
  readonly begin: (episodeId: EpisodeId, extractorVersion: string) => Promise<Result<ProjectionReceipt, DomainError>>;
  readonly put: (receipt: ProjectionReceipt) => Promise<Result<void, DomainError>>;
  /** Reserve one durable, exclusive per-episode Graphiti dispatch before sending. */
  readonly startAttempt: (episodeId: EpisodeId, extractorVersion: string) => Promise<Result<ProjectionReceipt, DomainError>>;
  readonly get: (key: ProjectionKey) => Promise<Result<ProjectionReceipt | undefined, DomainError>>;
  readonly list: () => Promise<Result<readonly ProjectionReceipt[], DomainError>>;
  /** Write-ahead never-projected proof for a newly admitted source, before archive commit. */
  readonly markArchiveOnly?: (episodeId: EpisodeId) => Promise<Result<void, DomainError>>;
  readonly isArchiveOnly?: (episodeId: EpisodeId) => Promise<Result<boolean, DomainError>>;
  readonly beginDeletion: (episodeId: EpisodeId) => Promise<Result<void, DomainError>>;
  readonly finalizeDeletion: (episodeId: EpisodeId) => Promise<Result<void, DomainError>>;
  readonly isDeletionBlocked: (episodeId: EpisodeId) => Promise<Result<boolean, DomainError>>;
}

export interface GraphProjectionStatePort {
  /** True only when the derived Graphiti episode still exists. */
  readonly isPresent: (episodeId: EpisodeId) => Effect.Effect<Result<boolean, DomainError>>;
}

export interface GraphProjectionPort {
  readonly project: (input: {
    readonly episodeId: EpisodeId;
    /** Original event time; required for Graphiti bi-temporal reference_time. */
    readonly occurredAtMs: number;
    readonly extractorVersion: string;
    readonly claims: readonly Readonly<Record<string, string>>[];
  }) => Effect.Effect<Result<ProjectionReceipt, DomainError>>;
  readonly purge: (episodeId: EpisodeId) => Effect.Effect<Result<void, DomainError>>;
}

export interface MemoryArchivePort {
  readonly importEpisode: (episode: SessionEpisode) => Promise<Result<{ readonly created: boolean; readonly episode: SessionEpisode }, DomainError>>;
  readonly readEpisode: (episodeId: EpisodeId) => Promise<Result<SessionEpisode, DomainError>>;
  readonly deleteEpisode: (episodeId: EpisodeId) => Promise<Result<void, DomainError>>;
}

/** Application-owned listing capability for the immutable archive. */
export interface AsyncMemoryArchivePort extends MemoryArchivePort {
  readonly listEpisodes: () => Promise<Result<readonly SessionEpisode[], DomainError>>;
}

export interface ExactRead {
  readonly bytes: Uint8Array;
  readonly digest: ContentDigest;
  /** Metadata from the same race-checked read, used by non-Git reconciliation. */
  readonly sizeBytes?: number;
  readonly mtimeMs?: number;
}

export interface WorkspaceChangeObservation {
  readonly headRevision: string;
  readonly changedPaths: readonly RepoPath[];
  readonly addedPaths: readonly RepoPath[];
  readonly deletedPaths: readonly RepoPath[];
  readonly renamed: readonly { readonly from: RepoPath; readonly to: RepoPath }[];
  /** Current untracked paths, used to classify newly materialized file state. */
  readonly untrackedPaths?: readonly RepoPath[];
  readonly stagedPaths?: readonly RepoPath[];
  readonly unstagedPaths?: readonly RepoPath[];
  readonly branch?: string;
}

export interface WorkspaceChangeBaseline {
  readonly headRevision: string;
  readonly files: readonly {
    readonly repoPath: RepoPath;
    readonly sizeBytes: number;
    readonly mtimeMs?: number;
    /** Exact digest of the indexed bytes; missing legacy digests require reconciliation. */
    readonly sourceDigest?: ContentDigest;
  }[];
}

export interface WorkspaceFilePort {
  readonly canonicalizeRoot: (candidate: string) => Effect.Effect<Result<string, DomainError>>;
  readonly snapshot: (rootPath: string, observedAtMs: number) => Effect.Effect<Result<WorkspaceSnapshot, DomainError>>;
  readonly observeChanges: (
    rootPath: string,
    previous?: string | WorkspaceChangeBaseline,
    /** Scope applied before non-Git exact reads: do not hash excluded private paths. */
    includePath?: (repoPath: RepoPath) => boolean,
  ) => Effect.Effect<Result<WorkspaceChangeObservation, DomainError>>;
  readonly readExact: (rootPath: string, repoPath: RepoPath) => Effect.Effect<Result<ExactRead, DomainError>>;
}

export interface WorkspaceStore {
  readonly get: (workspaceId: WorkspaceId) => Effect.Effect<Result<WorkspaceRecord, DomainError>>;
  readonly findByRoot: (rootPath: string) => Effect.Effect<Result<WorkspaceRecord | undefined, DomainError>>;
  readonly save: (record: WorkspaceRecord) => Effect.Effect<Result<void, DomainError>>;
}

export interface ClockPort {
  readonly nowMs: () => number;
}

export interface IdPort {
  readonly newWorkspaceId: () => string;
  readonly newRequestId: () => string;
}

export interface AuditSink {
  readonly append: (record: SafeAuditRecord) => Effect.Effect<Result<void, DomainError>>;
}

export interface ArtifactReference {
  readonly handle: string;
  readonly digest: ContentDigest;
  readonly sizeBytes: number;
}

export interface ArtifactRange {
  readonly bytes: Uint8Array;
  readonly digest: ContentDigest;
  readonly offset: number;
  readonly totalBytes: number;
  readonly nextCursor?: string;
}

export interface ArtifactStore {
  readonly storeExact: (bytes: Uint8Array) => Effect.Effect<Result<ArtifactReference, DomainError>>;
  readonly readRange: (
    handle: string,
    cursor: string | undefined,
    maxBytes: number | undefined,
  ) => Effect.Effect<Result<ArtifactRange, DomainError>>;
}

export const fileCount = (files: readonly FileObservation[]): number => files.length;
