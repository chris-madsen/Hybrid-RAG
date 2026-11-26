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

/** Decode native CBM grouped trace_path response, not traversal logic. */
export const nativeTraceQualifiedNames = (value: unknown): readonly string[] => {
  const root = object(value);
  const names: string[] = [];
  for (const side of ['callees', 'callers'] as const) {
    const trace = object(root?.[side]);
    if (!Array.isArray(trace?.groups)) continue;
    for (const groupValue of trace.groups) {
      const group = object(groupValue);
      if (typeof group?.qn_prefix !== 'string' || !Array.isArray(group.rows)) continue;
      for (const row of group.rows) {
        if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
        const qn = group.qn_prefix.length ? group.qn_prefix + '.' + row[0] : row[0];
        if (qn && names.length < 64) names.push(qn);
      }
    }
  }
  return names;
};

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

/** Impact results may contain nested source-path records; decode only explicit fields. */
const nativeImpactFiles = (root: string, result: unknown): readonly RepoPath[] => {
  const files: RepoPath[] = [];
  const collect = (value: unknown, depth: number): void => {
    if (depth > 10 || files.length >= 150) return;
    if (Array.isArray(value)) { for (const item of value) collect(item, depth + 1); return; }
    const o = object(value);
    if (o === undefined) return;
    for (const [key, item] of Object.entries(o)) {
      if (['file_path', 'repo_path', 'file'].includes(key) && typeof item === 'string') {
        const path = ownedPath(root, item);
        if (path !== undefined) files.push(path);
      } else if (typeof item === 'object' && item !== null) collect(item, depth + 1);
    }
  };
  collect(result, 0);
  return files;
};

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
    resolveCandidate: (target: NativeGraphTarget) => Promise<CodeCandidate | undefined>, requestId?: string): Promise<Result<readonly NativeGraphRow[], DomainError>> => {
    if (project === undefined || reindexing !== undefined) {
      return err(domainError('NOT_READY', 'codebase_memory', 'Codebase Memory index is not ready for the published source'));
    }
    const response = await transport.invoke('search_graph', {
      project,
      semantic_query: [query],
      semantic_limit: Math.min(100, limit),
      limit: 1,
      format: 'json',
      max_output_tokens: 8192,
    }, requestId);
    if (response._tag === 'Err') return response;
    const hits = semanticRows(root, response.value);
    if (hits === undefined) {
      return err(domainError('UNSUPPORTED_PROVIDER', 'codebase_memory', 'Codebase Memory did not return its documented semantic result table'));
    }
    // Count distinct source-bound candidates, not raw provider rows. A full
    // table may contain duplicates, unindexed paths or unmatched symbols.
    const combined: NativeGraphRow[] = [];
    const seen = new Set<string>();
    const append = async (rows: readonly NativeGraphRow[]): Promise<void> => {
      for (const hit of rows) {
        if (combined.length >= limit) break;
        const candidate = await resolveCandidate(hit);
        if (candidate === undefined || seen.has(candidate.candidateId)) continue;
        seen.add(candidate.candidateId);
        combined.push(hit);
      }
    };
    await append(hits);
    if (combined.length >= limit) return ok(combined);
    // Supplement only an underfilled shortlist using CBM's own BM25.
    // Preserve native order, semantic first; no ACE score fusion.
    const lexical = await transport.invoke('search_graph', {
      project,
      query,
      limit: Math.min(100, limit),
      format: 'json',
      max_output_tokens: 8192,
    }, requestId);
    if (lexical._tag === 'Err') return lexical;
    const fallback = lexicalRows(root, lexical.value);
    if (fallback === undefined) {
      return err(domainError('UNSUPPORTED_PROVIDER', 'codebase_memory', 'Codebase Memory did not return its documented BM25 result table'));
    }
    await append(fallback);
    return ok(combined);
  };

  /**
   * Ask CBM to traverse real outgoing and incoming edges, not just resolve
   * the seed symbol itself. Both sides are bounded and remain candidate hints
   * until ACE rereads the original file. Never infer an edge in this adapter.
   */
  const adjacentNativeFiles = async (files: readonly RepoPath[]): Promise<readonly NativeGraphTarget[]> => {
    const owned = [...new Set(files)].filter((file) => /^[\w./-]+$/u.test(file)).slice(0, 8);
    if (owned.length === 0) return [];
    // CBM also stores semantic similarity and historical co-change links.
    // Neither is a source dependency. Only named dependency-bearing edges
    // may expand the structural shortlist.
    const dependencyRelations = [
      'CALLS', 'IMPORTS', 'REFERENCES_FILE', 'EXTENDS', 'IMPLEMENTS',
      'OVERRIDES', 'DEPENDS_ON', 'TESTS', 'TESTS_FILE', 'CONFIGURES',
      'HTTP_CALLS', 'GRPC_CALLS', 'ASYNC_CALLS', 'HANDLES', 'SPAWNS',
      'EMITS', 'LISTENS_ON', 'READS', 'WRITES', 'USES_TYPE',
    ];
    // CBM 0.12.1 parses relationship alternation inside [:TYPE1|TYPE2].
    // Its WHERE parser intentionally rejects type(r), even though type(r)
    // is available as a RETURN expression. Never silently swallow that error
    // and call an unfiltered semantic edge a dependency.
    const relation = dependencyRelations.join('|');
    const predicate = owned.map((file) => "origin.file_path = '" + file + "'").join(' OR ');
    const queries = [
      'MATCH (origin)-[r:' + relation + ']->(other) WHERE (' + predicate + ')'
        + ' RETURN DISTINCT other.file_path AS file, other.qualified_name AS qn LIMIT 50',
      'MATCH (other)-[r:' + relation + ']->(origin) WHERE (' + predicate + ')'
        + ' RETURN DISTINCT other.file_path AS file, other.qualified_name AS qn LIMIT 50',
    ];
    const result: NativeGraphTarget[] = [];
    for (const query of queries) {
      const traversed = await Effect.runPromise(queryGraph(query));
      if (traversed._tag !== 'Ok') continue;
      result.push(...(nativeQueryGraphTargets(root, traversed.value) ?? []));
    }
    return result;
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
    const sourceCandidateFor = async (target: NativeGraphTarget): Promise<CodeCandidate | undefined> => {
      const candidates = candidatesByFile.get(target.file) ?? [];
      if (candidates.length === 0) return undefined;
      if (target.qn !== undefined) {
        // A single indexed candidate still must match the native symbol
        // identity; otherwise a cross-file edge can falsely implicate an
        // unrelated declaration from the same source file.
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
        // The native qualified name may reference a file-only node. A
        // unique short-name match is safe; same-name collisions fail closed.
        const matches = candidates.filter((candidate) =>
          candidate.symbolName !== undefined && matchesName(target.qn!, candidate.symbolName));
        return matches.length === 1 ? matches[0] : undefined;
      }
      // Impact results without a symbol do not claim a precise callee.
      return candidates.find((candidate) => candidate.structuralKind === 'module'
        && candidate.symbolName === target.file) ?? candidates[0];
    };
    const native = await searchRows(input.query, input.limit, sourceCandidateFor, input.requestId);
    if (native._tag === 'Err') return native;
    // A natural-language semantic vector alone can miss explicitly named
    // declarations. Ask the upstream graph for exact names, not an ACE
    // lexical index. Only bounded identifier-shaped literals enter Cypher.
    const identifiers = [...new Set(input.query.match(/[A-Za-z_][A-Za-z0-9_]{2,}/gu) ?? [])]
      .filter((name) => /[a-z][A-Z]|_|^[A-Z][A-Z0-9]+$/u.test(name)).slice(0, 8);
    const explicit: NativeGraphRow[] = [];
    if (identifiers.length > 0) {
      const predicate = identifiers.map((name) => "n.name = '" + name + "'").join(' OR ');
      const found = await Effect.runPromise(queryGraph('MATCH (n) WHERE ' + predicate
        + ' RETURN n.file_path AS file, n.qualified_name AS qn LIMIT 50'));
      if (found._tag === 'Ok') {
        for (const target of nativeQueryGraphTargets(root, found.value) ?? []) {
          if (target.qn !== undefined && candidatesByFile.has(target.file)) {
            explicit.push({ file: target.file, qn: target.qn, score: 1 });
          }
        }
      }
    }
    // Explicit file references disambiguate only graph-returned candidates.
    // Never treat a path mentioned in the prompt as authorized source proof.
    const explicitHits = [...explicit.filter((hit) => input.query.includes(hit.file)),
      ...explicit.filter((hit) => !input.query.includes(hit.file))];
    const nativeHits = [...explicitHits, ...native.value];
    const direct: RankedCandidate[] = [];
    const seen = new Set<string>();
    for (const hit of nativeHits) {
      const candidate = await sourceCandidateFor({ file: hit.file, qn: hit.qn });
      if (candidate === undefined || seen.has(candidate.candidateId)) continue;
      seen.add(candidate.candidateId);
      direct.push({ candidate, score: hit.score, freshness: 'unknown' });
      if (direct.length >= input.limit) break;
    }

    // All call graph traversal is delegated to CBM. ACE only decodes explicit
    // qualified names and requests their source locations from native Cypher.
    const seeds = [...new Map(nativeHits.filter((hit) => candidatesByFile.has(hit.file))
      .map((hit) => [hit.qn, hit])).values()].slice(0, 3);
    const relatedNames: string[] = [];
    for (const seed of seeds) {
      const traced = await Effect.runPromise(trace(seed.qn));
      if (traced._tag === 'Ok') relatedNames.push(...nativeTraceQualifiedNames(traced.value));
    }
    const qns = [...new Set([...seeds.map((hit) => hit.qn), ...relatedNames])]
      .filter((qn) => /^[\w./:$#-]+$/u.test(qn)).slice(0, 40);
    const linkedTargets: NativeGraphTarget[] = [
      ...(await adjacentNativeFiles(seeds.map((seed) => seed.file))),
    ];
    if (qns.length > 0) {
      const predicate = qns.map((qn) => "n.qualified_name = '" + qn + "'").join(' OR ');
      const query = 'MATCH (n) WHERE ' + predicate
        + ' RETURN n.file_path AS file, n.qualified_name AS qn LIMIT 50';
      const graph = await Effect.runPromise(queryGraph(query));
      if (graph._tag === 'Ok') {
        linkedTargets.push(...(nativeQueryGraphTargets(root, graph.value) ?? []));
      }
    }
    if ((input.changedPaths?.length ?? 0) > 0) {
      // Uncommitted edits are not in git's base...HEAD diff. For working
      // changes query CBM's OWN symbol graph by changed file and trace from
      // those definitions, rather than treating the previous commit as the
      // current working-tree change.
      const edited = [...new Set(input.changedPaths ?? [])].filter((file) =>
        candidatesByFile.has(file) && /^[\w./-]+$/u.test(file)).slice(0, 12);
      if (edited.length > 0) {
        // Dirty source files may themselves reference changed neighbors even
        // when CBM's CALLS trace cannot resolve dynamic or aliased symbols.
        linkedTargets.push(...await adjacentNativeFiles(edited));
        const byPath = edited.map((file) => "n.file_path = '" + file + "'").join(' OR ');
        const symbols = await Effect.runPromise(queryGraph(
          'MATCH (n) WHERE ' + byPath
          + ' RETURN n.qualified_name AS qn, n.file_path AS file LIMIT 36'));
        if (symbols._tag === 'Ok') {
          const shape = object(symbols.value);
          const i = Array.isArray(shape?.columns) ? shape.columns.indexOf('qn') : -1;
          if (i >= 0 && Array.isArray(shape?.rows)) {
            for (const row of shape.rows.slice(0, 3)) {
              if (!Array.isArray(row) || typeof row[i] !== 'string') continue;
              const walked = await Effect.runPromise(trace(row[i]));
              if (walked._tag !== 'Ok') continue;
              const names = nativeTraceQualifiedNames(walked.value)
                .filter((name) => /^[\w./:$#-]+$/u.test(name)).slice(0, 20);
              if (names.length === 0) continue;
              const predicate = names.map((name) =>
                "n.qualified_name = '" + name + "'").join(' OR ');
              const source = await Effect.runPromise(queryGraph(
                'MATCH (n) WHERE ' + predicate + ' RETURN n.file_path AS file, n.qualified_name AS qn LIMIT 30'));
              if (source._tag === 'Ok') linkedTargets.push(
                ...(nativeQueryGraphTargets(root, source.value) ?? []));
            }
          }
        }
      }
      // Native detect_changes is a COMMITTED branch/merge-base impact query,
      // not a current dirty-worktree diff. Only use the resulting blast-radius
      // when the provider explicitly reports one of the edited source paths.
      const impact = await Effect.runPromise(detectChanges());
      if (impact._tag === 'Ok') {
        const impactPaths = nativeImpactFiles(root, impact.value);
        if (impactPaths.some((file) => edited.includes(file))) linkedTargets.push(...impactPaths.map((file) => ({ file })));
      }
    }

    const linked: RankedCandidate[] = [];
    for (const target of linkedTargets) {
      const candidate = await sourceCandidateFor(target);
      if (candidate === undefined || seen.has(candidate.candidateId)) continue;
      seen.add(candidate.candidateId);
      linked.push({ candidate, score: 1, freshness: 'unknown' });
      if (linked.length >= input.limit) break;
    }
    if (closed || project === undefined || generation !== searchGeneration) {
      return err(domainError('NOT_READY', 'codebase_memory', 'native graph invalidated during retrieval'));
    }
    if (linked.length === 0) return ok(direct.slice(0, input.limit));
    const directSlots = Math.max(1, Math.ceil(input.limit * 0.6), input.limit - linked.length);
    return ok([...direct.slice(0, directSlots), ...linked].slice(0, input.limit));
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
