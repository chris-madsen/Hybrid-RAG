import { execFile } from 'node:child_process';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { Effect } from 'effect';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import { makeRepoMapSymbol, type RepoMapRankedSymbol, type RepoMapRenderInput, type RepoMapResult } from '../domain/repo-map.js';
import type { CodeCandidate } from '../domain/retrieval.js';
import type { RepoPath } from '../domain/workspace.js';
import type { RepoMapService } from '../application/repo-map-service.js';

const exec = promisify(execFile);

/**
 * Thin adapter for the upstream Codebase Memory CLI, v0.12.1.
 *
 * CBM, not ACE, owns parsing, indexing, semantic retrieval and graph edges.
 * ACE consumes only file/symbol names returned by CBM. The evidence bytes and
 * digests still come from ACE's independently verified Qdrant source snapshot.
 * In particular, these hints are NEVER accepted as direct source evidence.
 *
 * https://github.com/DeusData/codebase-memory-mcp
 */
export interface CodebaseMemoryOptions {
  readonly rootPath: string;
  readonly command?: string;
  readonly timeoutMs?: number;
  /** Immutable, digest-verified ACE candidates from the last published index. */
  readonly candidates: () => readonly CodeCandidate[];
}

export interface CodebaseMemoryRepoMap extends Pick<RepoMapService, 'render'> {
  /** Must complete after source changes and before this graph can be exposed. */
  readonly reindex: () => Effect.Effect<Result<void, DomainError>>;
}

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

/** Public for provider-contract tests; this does not implement a graph/query algorithm. */
export const parseCodebaseMemorySemanticRows = semanticRows;

const matchesName = (qualifiedName: string, name: string): boolean =>
  qualifiedName === name || qualifiedName.endsWith('.' + name)
  || qualifiedName.endsWith('#' + name) || qualifiedName.endsWith('/' + name);

export const makeCodebaseMemoryRepoMap = (options: CodebaseMemoryOptions): CodebaseMemoryRepoMap => {
  const root = resolve(options.rootPath);
  const command = options.command?.trim() || 'codebase-memory-mcp';
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

  const render = (input: RepoMapRenderInput): Effect.Effect<Result<RepoMapResult, DomainError>> =>
    Effect.promise(async () => {
      if (!Number.isSafeInteger(input.tokenBudget) || input.tokenBudget <= 0) {
        return err(domainError('INVALID_INPUT', 'token_budget', 'Codebase Memory context budget must be positive'));
      }
      if (project === undefined || reindexing !== undefined) {
        return err(domainError('NOT_READY', 'codebase_memory', 'Codebase Memory index is not ready for the published source'));
      }
      const limit = Math.min(50, Math.max(5, Math.floor(input.tokenBudget / 24)));
      const result = await invoke('search_graph', {
        project,
        semantic_query: [input.query],
        semantic_limit: limit,
        limit: 1,
        format: 'json',
        max_output_tokens: 8192,
      });
      if (result._tag === 'Err') return result;
      const hits = semanticRows(root, result.value);
      if (hits === undefined) {
        return err(domainError('UNSUPPORTED_PROVIDER', 'codebase_memory', 'Codebase Memory did not return its documented semantic result table'));
      }
      const byFile = new Map<RepoPath, CodeCandidate[]>();
      for (const candidate of options.candidates()) {
        const listed = byFile.get(candidate.repoPath) ?? [];
        listed.push(candidate);
        byFile.set(candidate.repoPath, listed);
      }

      const ranked: RepoMapRankedSymbol[] = [];
      const seen = new Set<string>();
      for (const hit of hits) {
        const possible = byFile.get(hit.file) ?? [];
        if (possible.length === 0) continue;
        // An exact native symbol match is preferred. If CBM describes a file
        // instead, retain only a file-level hint; do not invent a call edge.
        const exact = possible.find((candidate) =>
          candidate.symbolName !== undefined && matchesName(hit.qn, candidate.symbolName));
        const source = exact ?? possible[0]!;
        const key = hit.file + '\0' + (exact?.candidateId ?? ':file');
        if (seen.has(key)) continue;
        seen.add(key);
        const symbol = makeRepoMapSymbol({
          repoPath: source.repoPath,
          sourceDigest: source.sourceDigest,
          name: exact?.symbolName ?? source.repoPath,
          kind: exact?.structuralKind ?? 'repo-map-file-anchor',
          range: exact?.range ?? { startLine: 1, endLine: 1 },
          text: '',
          references: [],
        });
        ranked.push({ symbol, score: hit.score });
        if (ranked.length >= limit) break;
      }
      const lines = ranked.map((hit) => hit.symbol.repoPath + ':' + hit.symbol.range.startLine
        + ' ' + hit.symbol.name);
      const maxCharacters = input.tokenBudget * 4;
      let usedCharacters = 0;
      const selected: typeof lines = [];
      for (const line of lines) {
        if (usedCharacters + line.length + 1 > maxCharacters) break;
        selected.push(line);
        usedCharacters += line.length + 1;
      }
      return ok({
        ranked: ranked.slice(0, selected.length),
        rendered: selected.join('\n'),
        estimatedTokens: Math.ceil(usedCharacters / 4),
        truncated: hits.length >= limit || selected.length !== ranked.length,
      });
    });

  return { reindex, render };
};
