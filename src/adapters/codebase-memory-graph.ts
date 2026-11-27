import { isAbsolute, relative, resolve, sep } from 'node:path';
import { Effect } from 'effect';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import type { CodeCandidate, RankedCandidate } from '../domain/retrieval.js';
import type { CodeGraphCandidatePort, ProviderTraceSink } from '../application/ports.js';
import type { RepoPath } from '../domain/workspace.js';
import { makeCodebaseMemoryStdio } from './codebase-memory-stdio.js';

/**
 * Thin adapter for the upstream Codebase Memory stdio service, v0.12.1.
 *
 * CBM, not ACE, owns parsing, indexing, semantic retrieval and graph edges.
 * ACE consumes only file/symbol names returned by CBM. The evidence bytes and
 * digests still come from ACE's independently verified workspace snapshot.
 * In particular, these hints are NEVER accepted as direct source evidence.
 *
 * Upstream: DeusData / Codebase Memory, pinned native v0.12.1.
 */
export interface CodebaseMemoryOptions {
  readonly rootPath: string;
  readonly command?: string;
  /** Optional native-server arguments (for contract fixtures). */
  readonly args?: readonly string[];
  readonly timeoutMs?: number;
  readonly trace?: ProviderTraceSink;
  /** Immutable, digest-verified ACE candidates from the last published index. */
  readonly candidates: () => readonly CodeCandidate[];
}

export interface CodebaseMemoryGraph extends CodeGraphCandidatePort {
  /** Must complete after source changes and before this graph can be exposed. */
  readonly reindex: () => Effect.Effect<Result<void, DomainError>>;
  /** False after transport loss, during index mutation or after shutdown. */
  readonly isIndexed: () => boolean;
  /** Cancel native I/O; the caller owns the surrounding transaction fence. */
  readonly suspend: () => Promise<void>;
  readonly resume: () => void;
  /** Upstream file declaration inventory; parser stays entirely in native CBM. */
  readonly outline: (filePath: RepoPath) => Effect.Effect<Result<readonly NativeOutlineRow[], DomainError>>;
  readonly trace: (qualifiedName: string) => Effect.Effect<Result<unknown, DomainError>>;
  readonly queryGraph: (cypher: string) => Effect.Effect<Result<unknown, DomainError>>;
  readonly detectChanges: (since?: string) => Effect.Effect<Result<unknown, DomainError>>;
  /** Retire the internal provider session during Gateway shutdown. */
  readonly close: () => Promise<void>;
}

export interface NativeOutlineRow {
  readonly name: string;
  readonly label: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly qualifiedName: string;
}

export const parseCodebaseMemoryFileOutline = (
  file: RepoPath,
  value: unknown,
): readonly NativeOutlineRow[] | undefined => {
  const o = object(value);
  if (o === undefined || o.file_path !== file || !Array.isArray(o.cols)
    || !Array.isArray(o.rows) || typeof o.total !== 'number'
    || typeof o.has_more !== 'boolean' || o.has_more) return undefined;
  const ni = o.cols.indexOf('name'), li = o.cols.indexOf('label');
  const ri = o.cols.indexOf('lines'), qi = o.cols.indexOf('qn');
  if ([ni, li, ri, qi].some(i => i < 0)) return undefined;
  const rows: NativeOutlineRow[] = [];
  for (const row of o.rows) {
    if (!Array.isArray(row) || typeof row[ni] !== 'string'
      || typeof row[li] !== 'string' || typeof row[ri] !== 'string'
      || typeof row[qi] !== 'string') return undefined;
    const match = /^(\d+)-(\d+)$/u.exec(row[ri]);
    if (!match) continue; // Non-source graph nodes have no byte-addressable range.
    const startLine = Number(match[1]), endLine = Number(match[2]);
    if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine)
      || startLine < 1 || endLine < startLine) return undefined;
    rows.push({ name: row[ni], label: row[li], startLine, endLine, qualifiedName: row[qi] });
  }
  return rows;
};

interface NativeGraphRow {
  readonly qn: string;
  readonly file: RepoPath;
  readonly score: number;
}

const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;

const ownedPath = (root: string, value: string): RepoPath | undefined => {
  const path = isAbsolute(value) ? relative(root, resolve(value)) : value;
  // External provider paths are not an authorization boundary. Reject any
  // absolute escape, traversal, empty path, or platform-specific separator.
  const segments = path.split(/[\\/]/u);
  if (!path || path === '.' || segments.some((part) => part === '..' || part === '')
    || path.startsWith(sep) || /^[A-Za-z]:/u.test(path) || path.includes('\0')) return undefined;
  return path.replace(/\\/gu, '/') as RepoPath;
};

const semanticRows = (root: string, response: unknown): readonly NativeGraphRow[] | undefined => {
  const semantic = object(object(response)?.semantic);
  if (semantic === undefined || !Array.isArray(semantic.cols) || !Array.isArray(semantic.rows)) return undefined;
  const columns = semantic.cols;
  if (!columns.every((col) => typeof col === 'string')) return undefined;
  const qi = columns.indexOf('qn');
  const fi = columns.indexOf('file');
  const si = columns.indexOf('score');
  if (qi < 0 || fi < 0 || si < 0) return undefined;
  const rows: NativeGraphRow[] = [];
  for (const row of semantic.rows) {
    if (!Array.isArray(row) || typeof row[qi] !== 'string' || typeof row[fi] !== 'string'
      || typeof row[si] !== 'number' || !Number.isFinite(row[si])) return undefined;
    const file = ownedPath(root, row[fi]);
    if (file === undefined) continue;
    rows.push({ qn: row[qi], file, score: row[si] });
  }
  return rows;
};

/** Native CBM BM25 returns {cols:[qn,label,file,lines,rank],rows:[...]}.
 * Preserve its native ordering; negate SQLite's lower-is-better rank only for
 * the candidate score interface (the caller reassigns shortlist ranks).
 */
const lexicalRows = (root: string, response: unknown): readonly NativeGraphRow[] | undefined => {
  const obj = object(response);
  if (obj === undefined || !Array.isArray(obj.cols) || !Array.isArray(obj.rows)) return undefined;
  const qi = obj.cols.indexOf('qn');
  const fi = obj.cols.indexOf('file');
  const ri = obj.cols.indexOf('rank');
  if (qi < 0 || fi < 0 || ri < 0) return undefined;
  const rows: NativeGraphRow[] = [];
  for (const row of obj.rows) {
    if (!Array.isArray(row) || typeof row[qi] !== 'string' || typeof row[fi] !== 'string'
      || typeof row[ri] !== 'number' || !Number.isFinite(row[ri])) return undefined;
    const file = ownedPath(root, row[fi]);
    if (file !== undefined) rows.push({ qn: row[qi], file, score: -row[ri] });
  }
  return rows;
};

/** Public for provider-contract tests; this does not implement a graph/query algorithm. */
export const parseCodebaseMemorySemanticRows = semanticRows;
export const parseCodebaseMemoryLexicalRows = lexicalRows;

/** Native query_graph always reports columns/rows; file values need validation. */
interface NativeGraphTarget {
  readonly file: RepoPath;
  readonly qn?: string;
}

/** Decode only explicit graph-returned file and qualified-symbol identity. */
export const nativeQueryGraphTargets = (
  root: string,
  value: unknown,
): readonly NativeGraphTarget[] | undefined => {
  const o = object(value);
  if (o === undefined || !Array.isArray(o.columns) || !Array.isArray(o.rows)) return undefined;
  const index = o.columns.indexOf('file');
  const qnIndex = o.columns.indexOf('qn');
  if (index < 0) return undefined;
  const targets: NativeGraphTarget[] = [];
  for (const row of o.rows) {
    if (!Array.isArray(row) || typeof row[index] !== 'string') return undefined;
    const file = ownedPath(root, row[index]);
    if (file === undefined) continue;
    const qn = qnIndex < 0 ? undefined : row[qnIndex];
    targets.push({
      file, ...(typeof qn === 'string' && qn.length > 0 ? { qn } : {}),
    });
  }
  return targets;
};

/** File-only decoder retained for source-ownership and native contract tests. */
export const nativeQueryGraphFiles = (root: string, value: unknown): readonly RepoPath[] | undefined =>
  nativeQueryGraphTargets(root, value)?.map((node) => node.file);

/**
 * CBM graph nodes are identified by qualified name, not a short symbol name.
 * Match the upstream outline's exact line identity to a verified ACE chunk.
 * Unresolved/ambiguous symbols are deliberately not assigned to the first
 * same-named declaration in the file.
 */
export const nativeQualifiedSymbolCandidate = <T extends Pick<CodeCandidate, 'symbolName' | 'range'>>(
  candidates: readonly T[],
  qualifiedName: string,
  outline: readonly NativeOutlineRow[],
): T | undefined => {
  const definitions = outline.filter((entry) => entry.qualifiedName === qualifiedName);
  if (definitions.length !== 1) return undefined;
  const native = definitions[0]!;
  const matches = candidates.filter((candidate) => candidate.symbolName === native.name
    && candidate.range.startLine === native.startLine);
  return matches.length === 1 ? matches[0] : undefined;
};

const matchesName = (qualifiedName: string, name: string): boolean =>
  qualifiedName === name || qualifiedName.endsWith('.' + name)
  || qualifiedName.endsWith('#' + name) || qualifiedName.endsWith('/' + name);

export const makeCodebaseMemoryGraph = (options: CodebaseMemoryOptions): CodebaseMemoryGraph => {
  const root = resolve(options.rootPath);
  let project: string | undefined;
  let generation = 0;
  let closed = false;
  const invalidate = (): void => { project = undefined; generation += 1; };
  let reindexing: Promise<Result<void, DomainError>> | undefined;
  const transport = makeCodebaseMemoryStdio({
    rootPath: root,
    ...(options.command === undefined ? {} : { command: options.command }),
    ...(options.args === undefined ? {} : { args: options.args }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.trace === undefined ? {} : { trace: options.trace }),
    // A restarted transport must never serve graph hints from the prior
    // provider generation. Explicit reindex is required after reconnection.
    onLost: invalidate,
  });
  const invoke = transport.invoke;

  const reindex = (): Effect.Effect<Result<void, DomainError>> => Effect.promise(async () => {
    if (closed) return err(domainError('NOT_READY', 'codebase_memory', 'native graph is closed'));
    if (reindexing !== undefined) return reindexing;
    // Do not expose the previous project's graph while an updated ACE snapshot
    // is being published. CBM indexes locally and handles incremental changes.
    invalidate();
    const indexingGeneration = generation;
    reindexing = (async () => {
      const indexed = await invoke('index_repository', {
        repo_path: root,
        mode: 'full',
        persistence: false,
      });
      if (indexed._tag === 'Err') return indexed;
      const record = object(indexed.value);
      const name = record?.project;
      if (typeof name !== 'string' || name.length === 0 || record?.status !== 'indexed') {
        return err(domainError('NOT_READY', 'codebase_memory', 'Codebase Memory did not confirm a completed index'));
      }
      if (closed || generation !== indexingGeneration) {
        return err(domainError('NOT_READY', 'codebase_memory', 'native graph invalidated during indexing'));
      }
      project = name;
      return ok(undefined);
    })();
    try {
      return await reindexing;
    } finally {
      reindexing = undefined;
    }
  });

  const outline = (filePath: RepoPath): Effect.Effect<Result<readonly NativeOutlineRow[], DomainError>> =>
    Effect.promise(async () => {
      if (project === undefined || reindexing !== undefined) {
        return err(domainError('NOT_READY', 'codebase_memory', 'native graph must be indexed before extracting symbols'));
      }
      const rows: NativeOutlineRow[] = [];
      // Native API has stable pagination; no truncated file can silently be
      // considered fully indexed. The cap is an explicit coverage failure.
      for (let offset = 0; offset < 4000; offset += 200) {
        const output = await invoke('get_file_outline', {
          project, file_path: filePath, limit: 200, offset, format: 'json',
        });
        if (output._tag === 'Err') return output;
        const o = object(output.value);
        if (o === undefined || o.file_path !== filePath || !Array.isArray(o.cols)
          || !Array.isArray(o.rows) || typeof o.has_more !== 'boolean') {
          return err(domainError('INVALID_EXTERNAL_RESPONSE', 'codebase_memory.outline', 'invalid native file outline'));
        }
        // Per-page parse must not pretend an incomplete page is complete.
        const page = parseCodebaseMemoryFileOutline(filePath, { ...o, has_more: false });
        if (page === undefined) return err(domainError('INVALID_EXTERNAL_RESPONSE', 'codebase_memory.outline', 'invalid native outline table'));
        rows.push(...page);
        if (!o.has_more) return ok(rows);
        if (o.rows.length === 0) break;
      }
      return err(domainError('NOT_READY', 'codebase_memory.outline', 'native file outline exceeded bounded pagination'));
    });
  const trace: CodebaseMemoryGraph['trace'] = (qualifiedName) => Effect.promise(async () =>
    project === undefined
      ? err(domainError('NOT_READY', 'codebase_memory.trace', 'no published graph'))
      : invoke('trace_path', { project, function_name: qualifiedName, direction: 'both',
        depth: 2, limit: 24, format: 'json', max_output_tokens: 4096 }));
  const queryGraph: CodebaseMemoryGraph['queryGraph'] = (cypher) => Effect.promise(async () =>
    project === undefined
      ? err(domainError('NOT_READY', 'codebase_memory.graph', 'no published graph'))
      : invoke('query_graph', { project, query: cypher, max_rows: 50,
        format: 'json', max_output_tokens: 6000 }));
  const detectChanges: CodebaseMemoryGraph['detectChanges'] = (since) => Effect.promise(async () =>
    project === undefined
      ? err(domainError('NOT_READY', 'codebase_memory.impact', 'no published graph'))
      : invoke('detect_changes', { project, ...(since ? { since } : {}), scope: 'impact',
        direction: 'both', depth: 2, format: 'json' }));

  const searchRows = async (query: string, limit: number,
    resolveCandidate: (target: NativeGraphRow) => Promise<CodeCandidate | undefined>,
    expectedGeneration: number, requestId?: string): Promise<Result<readonly RankedCandidate[], DomainError>> => {
    if (project === undefined || reindexing !== undefined) {
      return err(domainError('NOT_READY', 'codebase_memory', 'Codebase Memory index is not ready for the published source'));
    }
    // CBM v0.12.1 query accepts an unmodified free-text string and owns
    // tokenization (including camelCase) and BM25 ranking. semantic_query
    // instead expects separately supplied keywords, not a full sentence.
    // ACE must not invent keywords or combine independent rank lists.
    const pageSize = 20;
    const maxNativeRows = 500;
    const combined: RankedCandidate[] = [];
    const seen = new Set<string>();
    // A native row that cannot be mapped to an exact, verified ACE source
    // candidate is not a delivered result. Continue through CBM's own ordered
    // BM25 pages so such rows do not hide later mappable candidates.
    let offset = 0;
    while (offset < maxNativeRows && combined.length < limit) {
      if (closed || project === undefined || reindexing !== undefined || generation !== expectedGeneration) {
        return err(domainError('NOT_READY', 'codebase_memory', 'native graph invalidated during paged retrieval'));
      }
      const pageLimit = Math.min(pageSize, maxNativeRows - offset);
      const response = await transport.invoke('search_graph', {
        project,
        query,
        limit: pageLimit,
        offset,
        format: 'json',
        max_output_tokens: 8192,
      }, requestId);
      if (response._tag === 'Err') return response;
      const page = object(response.value);
      const rows = page?.rows;
      const hits = lexicalRows(root, response.value);
      if (hits === undefined || !Array.isArray(rows) || rows.length > pageLimit) {
        return err(domainError('UNSUPPORTED_PROVIDER', 'codebase_memory', 'Codebase Memory did not return its documented BM25 result table'));
      }
      const hasMore = page?.has_more;
      const nextOffset = page?.next_offset;
      if (typeof hasMore !== 'boolean'
        || (hasMore && (!Number.isSafeInteger(nextOffset) || Number(nextOffset) <= offset
          || Number(nextOffset) !== offset + rows.length))) {
        return err(domainError('INVALID_EXTERNAL_RESPONSE', 'codebase_memory.search_graph', 'native BM25 pagination metadata is missing, malformed, or non-advancing'));
      }
      for (const hit of hits) {
        if (combined.length >= limit) break;
        const candidate = await resolveCandidate(hit);
        if (candidate === undefined || seen.has(candidate.candidateId)) continue;
        seen.add(candidate.candidateId);
        combined.push({ candidate, score: hit.score, freshness: 'unknown' });
      }
      if (!hasMore) break;
      offset = Number(nextOffset);
    }
    return ok(combined);
  };

  const search: CodeGraphCandidatePort['search'] = (input) => Effect.promise(async () => {
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
      return err(domainError('INVALID_INPUT', 'limit', 'Codebase Memory search limit must be between 1 and 100'));
    }
    const searchGeneration = generation;
    const candidatesByFile = new Map<RepoPath, CodeCandidate[]>();
    for (const candidate of options.candidates()) {
      const list = candidatesByFile.get(candidate.repoPath) ?? [];
      list.push(candidate);
      candidatesByFile.set(candidate.repoPath, list);
    }
    const outlineCache = new Map<RepoPath, readonly NativeOutlineRow[] | undefined>();
    const sourceCandidateFor = async (target: NativeGraphRow): Promise<CodeCandidate | undefined> => {
      const candidates = candidatesByFile.get(target.file) ?? [];
      if (candidates.length === 0) return undefined;
      // Resolve native search hits to the existing verified source inventory.
      // This is identity mapping, not query interpretation or ranking.
      if (candidates.length === 1) {
        const only = candidates[0]!;
        return only.symbolName !== undefined && matchesName(target.qn, only.symbolName)
          ? only : undefined;
      }
      let current = outlineCache.get(target.file);
      if (!outlineCache.has(target.file)) {
        const fetched = await Effect.runPromise(outline(target.file));
        current = fetched._tag === 'Ok' ? fetched.value : undefined;
        outlineCache.set(target.file, current);
      }
      const exact = current === undefined ? undefined
        : nativeQualifiedSymbolCandidate(candidates, target.qn, current);
      if (exact !== undefined) return exact;
      const matches = candidates.filter((candidate) =>
        candidate.symbolName !== undefined && matchesName(target.qn, candidate.symbolName));
      return matches.length === 1 ? matches[0] : undefined;
    };
    const native = await searchRows(input.query, input.limit, sourceCandidateFor, searchGeneration, input.requestId);
    if (native._tag === 'Err') return native;
    // Native ranking is the only ranking authority. Do not supplement it
    // with query-derived identifiers, graph expansion, dirty-path promotion,
    // fabricated scores or direct/linked quotas. An underfilled shortlist is
    // returned as observed, subject to the same publication fence.
    if (closed || project === undefined || generation !== searchGeneration) {
      return err(domainError('NOT_READY', 'codebase_memory', 'native graph invalidated during retrieval'));
    }
    return native;
  });

  return {
    reindex, search, outline, trace, queryGraph, detectChanges,
    isIndexed: () => !closed && project !== undefined && reindexing === undefined,
    suspend: async () => {
      invalidate();
      await transport.suspend();
    },
    resume: transport.resume,
    close: async () => {
      closed = true;
      invalidate();
      await transport.close();
    },
  };
};
