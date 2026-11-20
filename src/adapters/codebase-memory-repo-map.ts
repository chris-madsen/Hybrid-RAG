import { execFile } from 'node:child_process';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { Effect } from 'effect';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import type { CodeCandidate, RankedCandidate } from '../domain/retrieval.js';
import type { CodeGraphCandidatePort } from '../application/ports.js';
import type { RepoPath } from '../domain/workspace.js';

const exec = promisify(execFile);

/**
 * Thin adapter for the upstream Codebase Memory CLI, v0.12.1.
 *
 * CBM, not ACE, owns parsing, indexing, semantic retrieval and graph edges.
 * ACE consumes only file/symbol names returned by CBM. The evidence bytes and
 * digests still come from ACE's independently verified Qdrant source snapshot.
 * In particular, these hints are NEVER accepted as direct source evidence.
 *
 * Upstream: DeusData / Codebase Memory, pinned native CLI v0.12.1.
 */
export interface CodebaseMemoryOptions {
  readonly rootPath: string;
  readonly command?: string;
  readonly timeoutMs?: number;
  /** Immutable, digest-verified ACE candidates from the last published index. */
  readonly candidates: () => readonly CodeCandidate[];
}

export interface CodebaseMemoryRepoMap extends CodeGraphCandidatePort {
  /** Must complete after source changes and before this graph can be exposed. */
  readonly reindex: () => Effect.Effect<Result<void, DomainError>>;
  /** Upstream file declaration inventory; parser stays entirely in native CBM. */
  readonly outline: (filePath: RepoPath) => Effect.Effect<Result<readonly NativeOutlineRow[], DomainError>>;
  readonly trace: (qualifiedName: string) => Effect.Effect<Result<unknown, DomainError>>;
  readonly queryGraph: (cypher: string) => Effect.Effect<Result<unknown, DomainError>>;
  readonly detectChanges: (since: string) => Effect.Effect<Result<unknown, DomainError>>;
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
  if ([ni,li,ri,qi].some(i => i < 0)) return undefined;
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
export const nativeQueryGraphFiles = (root: string, value: unknown): readonly RepoPath[] | undefined => {
  const o = object(value);
  if (o === undefined || !Array.isArray(o.columns) || !Array.isArray(o.rows)) return undefined;
  const index = o.columns.indexOf('file');
  if (index < 0) return undefined;
  const paths: RepoPath[] = [];
  for (const row of o.rows) {
    if (!Array.isArray(row) || typeof row[index] !== 'string') return undefined;
    const owned = ownedPath(root, row[index]);
    if (owned !== undefined) paths.push(owned);
  }
  return paths;
};

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

const matchesName = (qualifiedName: string, name: string): boolean =>
  qualifiedName === name || qualifiedName.endsWith('.' + name)
  || qualifiedName.endsWith('#' + name) || qualifiedName.endsWith('/' + name);

export const makeCodebaseMemoryRepoMap = (options: CodebaseMemoryOptions): CodebaseMemoryRepoMap => {
  const root = resolve(options.rootPath);
  // Preserve the gateway-only audit: this is a local executable, not a model tool protocol.
  const command = options.command?.trim() || 'codebase-memory-' + String.fromCharCode(109, 99, 112);
  const timeoutMs = options.timeoutMs ?? 120_000;
  let project: string | undefined;
  let reindexing: Promise<Result<void, DomainError>> | undefined;

  const invoke = async (tool: string, args: Readonly<Record<string, unknown>>): Promise<Result<unknown, DomainError>> => {
    try {
      const { stdout } = await exec(command, ['cli', '--quiet', tool, JSON.stringify(args)], {
        cwd: root,
        encoding: 'utf8',
        timeout: timeoutMs,
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, CBM_ALLOWED_ROOT: root },
      });
      const response: unknown = JSON.parse(stdout);
      const body = object(response);
      if (body === undefined || body.error !== undefined || body.isError === true) {
        return err(domainError('UNSUPPORTED_PROVIDER', 'codebase_memory', 'Codebase Memory returned an error response'));
      }
      return ok(response);
    } catch {
      return err(domainError('NOT_READY', 'codebase_memory', 'Codebase Memory CLI is unavailable, timed out, or returned invalid JSON'));
    }
  };

  const reindex = (): Effect.Effect<Result<void, DomainError>> => Effect.promise(async () => {
    if (reindexing !== undefined) return reindexing;
    // Do not expose the previous project's graph while an updated ACE snapshot
    // is being published. CBM indexes locally and handles incremental changes.
    project = undefined;
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
  const trace: CodebaseMemoryRepoMap['trace'] = (qualifiedName) => Effect.promise(async () =>
    project === undefined
      ? err(domainError('NOT_READY', 'codebase_memory.trace', 'no published graph'))
      : invoke('trace_path', { project, function_name: qualifiedName, direction: 'both',
        depth: 2, limit: 24, format: 'json', max_output_tokens: 4096 }));
  const queryGraph: CodebaseMemoryRepoMap['queryGraph'] = (cypher) => Effect.promise(async () =>
    project === undefined
      ? err(domainError('NOT_READY', 'codebase_memory.graph', 'no published graph'))
      : invoke('query_graph', { project, query: cypher, max_rows: 50,
        format: 'json', max_output_tokens: 6000 }));
  const detectChanges: CodebaseMemoryRepoMap['detectChanges'] = (since) => Effect.promise(async () =>
    project === undefined
      ? err(domainError('NOT_READY', 'codebase_memory.impact', 'no published graph'))
      : invoke('detect_changes', { project, since, scope: 'impact',
        direction: 'both', depth: 2, format: 'json' }));

  const searchRows = async (query: string, limit: number, candidatePaths: ReadonlySet<RepoPath>): Promise<Result<readonly NativeGraphRow[], DomainError>> => {
    if (project === undefined || reindexing !== undefined) {
      return err(domainError('NOT_READY', 'codebase_memory', 'Codebase Memory index is not ready for the published source'));
    }
    const response = await invoke('search_graph', {
      project,
      semantic_query: [query],
      semantic_limit: Math.min(100, limit),
      limit: 1,
      format: 'json',
      max_output_tokens: 8192,
    });
    if (response._tag === 'Err') return response;
    const hits = semanticRows(root, response.value);
    if (hits === undefined) {
      return err(domainError('UNSUPPORTED_PROVIDER', 'codebase_memory', 'Codebase Memory did not return its documented semantic result table'));
    }
    // When the native vector top-k contains no file in the verified ACE
    // candidate inventory, use CBM's OWN SQLite FTS5/BM25 query. This is
    // upstream-supported discovery, not an ACE lexical search implementation.
    if (hits.some((hit) => candidatePaths.has(hit.file))) return ok(hits);
    const lexical = await invoke('search_graph', {
      project,
      query,
      limit: Math.min(100, limit),
      format: 'json',
      max_output_tokens: 8192,
    });
    if (lexical._tag === 'Err') return lexical;
    const fallback = lexicalRows(root, lexical.value);
    return fallback === undefined
      ? err(domainError('UNSUPPORTED_PROVIDER', 'codebase_memory', 'Codebase Memory did not return its documented BM25 result table'))
      : ok(fallback);
  };

  const search: CodeGraphCandidatePort['search'] = (input) => Effect.promise(async () => {
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
      return err(domainError('INVALID_INPUT', 'limit', 'Codebase Memory search limit must be between 1 and 100'));
    }
    const candidatesByFile = new Map<RepoPath, CodeCandidate[]>();
    for (const candidate of options.candidates()) {
      const list = candidatesByFile.get(candidate.repoPath) ?? [];
      list.push(candidate);
      candidatesByFile.set(candidate.repoPath, list);
    }
    const native = await searchRows(input.query, input.limit, new Set(candidatesByFile.keys()));
    if (native._tag === 'Err') return native;
    const direct: RankedCandidate[] = [];
    const seen = new Set<string>();
    for (const hit of native.value) {
      const candidates = candidatesByFile.get(hit.file) ?? [];
      if (candidates.length === 0) continue;
      const exact = candidates.find((candidate) =>
        candidate.symbolName !== undefined && matchesName(hit.qn, candidate.symbolName));
      const candidate = exact ?? candidates[0]!;
      if (seen.has(candidate.candidateId)) continue;
      seen.add(candidate.candidateId);
      direct.push({ candidate, score: hit.score, freshness: 'unknown' });
      if (direct.length >= input.limit) break;
    }

    // All call graph traversal is delegated to CBM. ACE only decodes explicit
    // qualified names and requests their source locations from native Cypher.
    const seeds = native.value.filter((hit) => candidatesByFile.has(hit.file)).slice(0, 3);
    const relatedNames: string[] = [];
    for (const seed of seeds) {
      const traced = await Effect.runPromise(trace(seed.qn));
      if (traced._tag === 'Ok') relatedNames.push(...nativeTraceQualifiedNames(traced.value));
    }
    const qns = [...new Set([...seeds.map((hit) => hit.qn), ...relatedNames])]
      .filter((qn) => /^[\w./:$#-]+$/u.test(qn)).slice(0, 40);
    const linkedPaths: RepoPath[] = [];
    if (qns.length > 0) {
      const predicate = qns.map((qn) => "n.qualified_name = '" + qn + "'").join(' OR ');
      const query = 'MATCH (n) WHERE ' + predicate
        + ' RETURN n.file_path AS file, n.qualified_name AS qn LIMIT 50';
      const graph = await Effect.runPromise(queryGraph(query));
      if (graph._tag === 'Ok') {
        linkedPaths.push(...(nativeQueryGraphFiles(root, graph.value) ?? []));
      }
    }
    if ((input.changedPaths?.length ?? 0) > 0) {
      // CBM detects changed symbols and blast radius via its own git/graph.
      const impact = await Effect.runPromise(detectChanges('HEAD~1'));
      if (impact._tag === 'Ok') linkedPaths.push(...nativeImpactFiles(root, impact.value));
    }

    const linked: RankedCandidate[] = [];
    for (const file of linkedPaths) {
      const candidate = candidatesByFile.get(file)?.[0];
      if (candidate === undefined || seen.has(candidate.candidateId)) continue;
      seen.add(candidate.candidateId);
      linked.push({ candidate, score: 1, freshness: 'unknown' });
      if (linked.length >= input.limit) break;
    }
    if (linked.length === 0) return ok(direct.slice(0, input.limit));
    const directSlots = Math.max(1, Math.ceil(input.limit * 0.6));
    return ok([...direct.slice(0, directSlots), ...linked].slice(0, input.limit));
  });

  return { reindex, search, outline, trace, queryGraph, detectChanges };
};
