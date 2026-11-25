import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Effect } from 'effect';
import { makeNativeCbmContextProvider } from '../src/adapters/native-cbm-context-provider.js';
import { makeCandidateId, makeCodeCandidate } from '../src/domain/retrieval.js';
import { makeWorkspaceId } from '../src/domain/workspace.js';
import { err, ok, type Result } from '../src/domain/result.js';
import { domainError } from '../src/domain/errors.js';
import { exactUtf8ByteRange, exactUtf8Span, utf16ColumnAtUtf8Byte } from '../src/domain/utf8-range.js';
import { makeWorkspaceSync } from '../src/application/workspace-sync.js';
import { createRetrievalBenchmarkTraceCollector } from '../src/domain/retrieval-benchmark.js';
import { workspaceManifestFromSnapshot } from '../src/domain/workspace-manifest.js';
import type { ProviderTraceEvent } from '../src/domain/provider-trace.js';
import type {
  ArtifactStore,
  CodeGraphCandidatePort,
  DocumentationPort,
  MemorySearchPort,
  ProviderTraceSink,
  SemanticAnalysisPort,
  WorkspaceFilePort,
} from '../src/application/ports.js';

const mustOk = <T, E>(value: Result<T, E>): T => {
  assert.equal(value._tag, 'Ok');
  if (value._tag === 'Err') throw new Error(String(value.error));
  return value.value;
};


const workspaceId = mustOk(makeWorkspaceId('real-pipeline-fixture'));
const source = Buffer.from('export function reconnect(): string { return "ok"; }\n');
const digest = createHash('sha256').update(source).digest('hex');
const candidate = mustOk(makeCodeCandidate({
  candidateId: mustOk(makeCandidateId('function-reconnect')),
  workspaceId, repoPath: 'src/connection.ts' as never,
  range: { startLine: 1, endLine: 1, startColumn: 1, endColumn: 53 },
  symbolName: 'reconnect',
  semanticAnchor: { line: 1, byteColumn: 17, endLine: 1, endByteColumn: 26 },
  text: source.toString('utf8').trim(),
  sourceDigest: digest as never,
  generation: 1 as never,
  indexedAtMs: 1234,
  conflictKey: 'reconnect-policy',
  conflictValue: 'current code retries immediately',
}));

test('AR06+AR07 CBM emits exact verified content without artifacts and truthful delivery trace', async () => {
  const benchmark = createRetrievalBenchmarkTraceCollector('ar07-positive');
  let searches = 0;
  let definitions = 0;
  const codeGraph: CodeGraphCandidatePort = {
    search: () => {
      searches += 1;
      return Effect.succeed(ok([{ candidate, score: 0.96, freshness: 'unknown' as const }]));
    },
  };
  const files: WorkspaceFilePort = {
    canonicalizeRoot: () => Effect.succeed(ok('/repo')),
    observeChanges: () => Effect.succeed(ok({ headRevision: 'a'.repeat(40), changedPaths: [], addedPaths: [], deletedPaths: [], renamed: [] })),
    snapshot: () => Effect.succeed(ok({ headRevision: 'a'.repeat(40), files: [], removedPaths: [] })),
    readExact: () => Effect.succeed(ok({ bytes: source, digest: digest as never })),
  };
  let storedCopies = 0;
  const artifacts: ArtifactStore = {
    storeExact: () => {
      storedCopies += 1;
      return Effect.succeed(ok({ handle: 'full-file-handle', digest: digest as never, sizeBytes: source.length }));
    },
    readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not needed'))),
  };
  const semantics: SemanticAnalysisPort = {
    definition: () => {
      definitions += 1;
      return Effect.succeed(ok([{
        location: { repoPath: 'src/connection.ts', startLine: 1, startColumn: 17, endLine: 1, endColumn: 26 },
        name: 'reconnect', kind: 'function',
      }]));
    },
    references: () => Effect.succeed(ok([])),
    typeInfo: () => Effect.succeed(ok(undefined)),
    diagnostics: () => Effect.succeed(ok([])),
  };
  const workspaceManifest = workspaceManifestFromSnapshot({ headRevision: 'a'.repeat(40), files: [], removedPaths: [] }, 'scope-v1');
  const workspaceSync = makeWorkspaceSync({
    initial: {
      workspaceId,
      workspaceManifest,
      generation: 1,
      indexKey: 'index-v1',
      candidateIdsByPath: new Map(),
    },
    observeChanges: () => Effect.succeed(ok({ changed: false })),
    rebuild: () => Effect.succeed(err(domainError('NOT_READY', 'workspace_sync', 'not needed by the no-change fixture'))),
  });
  const provider = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId, rootPath: '/repo', files, codeGraph, artifacts, semantics, newRequestId: () => 'qdrant-request',
    workspaceManifest, workspaceSync,
    benchmarkTrace: benchmark,
  });
  const context = mustOk(await Effect.runPromise(provider.search({
    workspaceId, query: 'retry database connection', includeDocs: false, includeMemory: false,
  })));
  assert.equal(searches, 1);
  assert.equal(definitions, 1);
  assert.equal(context.complete, true);
  assert.equal(context.evidence[0]?.freshness, 'current');
  const delivered = benchmark.events.filter((item) => item.stage === 'delivered');
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0]?.status, 'executed');
  assert.deepEqual(delivered[0]?.candidates.map((item) => item.runtimeCandidateId),
    [candidate.candidateId], 'only post-reread verified code is delivered');
  assert.equal(context.evidence[0]?.expansionHandle, undefined);
  assert.equal(context.evidence[0]?.expansionCursor, undefined);
  assert.equal(context.evidence[0]?.expansionMaxBytes, undefined);
  assert.equal(storedCopies, 0, 'no unreachable full-file artifact may be written during retrieval');
  assert.equal(context.evidence[0]?.sourceDigest, digest);
  assert.equal(context.evidence[0]?.content, source.toString('utf8').trim(),
    'the verified AST symbol remains exact and self-contained');
});



test('synchronized provider catches up when another request already published a newer index key', async () => {
  let searchedAfterReconcile = false;
  let reconcileCalls = 0;
  const codeGraph: CodeGraphCandidatePort = {
    search: () => {
      searchedAfterReconcile = reconcileCalls === 1;
      return Effect.succeed(ok([{ candidate, score: 0.96, freshness: 'unknown' as const }]));
    },
  };
  const files: WorkspaceFilePort = {
    canonicalizeRoot: () => Effect.succeed(ok('/repo')),
    observeChanges: () => Effect.succeed(ok({
      headRevision: 'a'.repeat(40), changedPaths: [], addedPaths: [], deletedPaths: [], renamed: [],
    })),
    snapshot: () => Effect.succeed(ok({ headRevision: 'a'.repeat(40), files: [], removedPaths: [] })),
    readExact: () => Effect.succeed(ok({ bytes: source, digest: digest as never })),
  };
  const artifacts: ArtifactStore = {
    storeExact: () => Effect.succeed(ok({ handle: 'catch-up-file', digest: digest as never, sizeBytes: source.length })),
    readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not used'))),
  };
  const semantics: SemanticAnalysisPort = {
    definition: () => Effect.succeed(ok([{
      location: { repoPath: 'src/connection.ts', startLine: 1, startColumn: 17, endLine: 1, endColumn: 26 },
      name: 'reconnect', kind: 'function',
    }])),
    references: () => Effect.succeed(ok([])),
    typeInfo: () => Effect.succeed(ok(undefined)),
    diagnostics: () => Effect.succeed(ok([])),
  };
  const workspaceManifest = workspaceManifestFromSnapshot({
    headRevision: 'a'.repeat(40), files: [], removedPaths: [],
  }, 'scope-v1');
  const syncState = {
    workspaceId,
    workspaceManifest,
    generation: 2,
    indexKey: 'index-v2',
    candidateIdsByPath: new Map(),
  };
  const workspaceSync = {
    initialize: () => Effect.succeed(ok(syncState)),
    refresh: () => Effect.succeed(ok({
      state: syncState,
      delta: { changed: [], added: [], deleted: [], renamed: [], scopeChanged: false },
      refreshed: false,
    })),
  };
  let config: Parameters<typeof makeNativeCbmContextProvider>[0];
  const reconcile = () => {
    reconcileCalls += 1;
    return Effect.succeed(ok({ ...config, indexKey: 'index-v2' }));
  };
  config = {
    mode: 'cbm',
    workspaceId,
    rootPath: '/repo',
    files,
    codeGraph,
    artifacts,
    semantics,
    newRequestId: () => 'sync-catch-up',
    workspaceManifest,
    workspaceSync,
    indexKey: 'index-v1',
    reconcile,
  };
  const provider = makeNativeCbmContextProvider(config);
  const context = await Effect.runPromise(provider.search({
    workspaceId, query: 'retry database connection', includeDocs: false, includeMemory: false,
  }));
  assert.equal(context._tag, 'Ok');
  assert.equal(reconcileCalls, 1);
  assert.equal(searchedAfterReconcile, true);
});


test('explicitly required LSP disagreement keeps exact code direct while LSP coverage is partial', async () => {
  const codeGraph: CodeGraphCandidatePort = {
    search: () => Effect.succeed(ok([{ candidate, score: 0.95, freshness: 'unknown' as const }])),
  };
  const files: WorkspaceFilePort = {
    canonicalizeRoot: () => Effect.succeed(ok('/repo')),
    snapshot: () => { throw new Error('query must not snapshot repository'); },
    readExact: () => Effect.succeed(ok({ bytes: source, digest: digest as never })),
  };
  const artifacts: ArtifactStore = {
    storeExact: () => Effect.succeed(ok({ handle: 'exact-file', digest: digest as never, sizeBytes: source.length })),
    readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not used'))),
  };
  const semantics: SemanticAnalysisPort = {
    definition: () => Effect.succeed(ok([])),
    references: () => Effect.succeed(ok([])),
    typeInfo: () => Effect.succeed(ok(undefined)),
    diagnostics: () => Effect.succeed(ok([])),
  };
  const provider = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId, rootPath: '/repo', files, codeGraph, artifacts, semantics,
    newRequestId: () => 'lsp-disagreement',
  });
  const context = mustOk(await Effect.runPromise(provider.search({
    workspaceId,
    query: 'retry database connection',
    includeDocs: false,
    includeMemory: false,
    sourceRequirements: {
      code: { requirement: 'required', allowed: true },
      structural: { requirement: 'not_requested', allowed: true },
      lsp: { requirement: 'required', allowed: true },
      documentation: { requirement: 'not_requested', allowed: true },
      memory: { requirement: 'not_requested', allowed: true },
    },
  })));
  assert.equal(context.complete, false);
  assert.ok(context.partialSources.includes('lsp'));
  assert.equal(context.evidence[0]?.freshness, 'current');
  assert.equal(context.evidence[0]?.proofClass, 'direct');
  assert.equal(context.evidence[0]?.content, candidate.text);
});


test('multiple CBM symbols from one file cause one initial read plus one final revalidation', async () => {
  let exactReads = 0;
  let storedSources = 0;
  const codeGraph: CodeGraphCandidatePort = {
    search: () => Effect.succeed(ok([
      { candidate, score: 1, freshness: 'unknown' as const },
      { candidate: { ...candidate, candidateId: 'another-symbol' as never }, score: 0.8, freshness: 'unknown' as const },
    ])),
  };
  const files: WorkspaceFilePort = {
    canonicalizeRoot: () => Effect.succeed(ok('/repo')),
    snapshot: () => { throw new Error('no workspace-wide scan per retrieval'); },
    readExact: () => { exactReads += 1; return Effect.succeed(ok({ bytes: source, digest: digest as never })); },
  };
  const artifacts: ArtifactStore = {
    storeExact: () => { storedSources += 1; return Effect.succeed(ok({ handle: 'same-file-handle', digest: digest as never, sizeBytes: source.length })); },
    readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not used'))),
  };
  const semantics: SemanticAnalysisPort = {
    definition: () => Effect.succeed(ok([{
      location: { repoPath: 'src/connection.ts', startLine: 1, startColumn: 17, endLine: 1, endColumn: 26 },
      name: 'reconnect', kind: 'function',
    }])),
    references: () => Effect.succeed(ok([])),
    typeInfo: () => Effect.succeed(ok(undefined)),
    diagnostics: () => Effect.succeed(ok([])),
  };
  const provider = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId, rootPath: '/repo', files, codeGraph, artifacts, semantics,
    newRequestId: () => 'same-file-query',
  });
  const context = mustOk(await Effect.runPromise(provider.search({
    workspaceId, query: 'reconnect function', includeDocs: false, includeMemory: false,
  })));
  assert.equal(exactReads, 2, 'initial source read and end-of-request freshness revalidation only');
  assert.equal(storedSources, 0, 'AR06 keeps exact source in request-local memory; no private UUID blob is stored');
  assert.equal(context.evidence.length, 2, 'distinct evidence IDs remain visible under the merged core provenance contract');
  assert.ok(context.evidence.every((item) => item.freshness === 'current'));
});

test('DBC-14 documentation conflict preserves code and ADR provenance explicitly', async () => {
  const documentation: DocumentationPort = {
    search: () => Effect.succeed(ok([{
      evidenceId: 'documentation-evidence' as never,
      source: 'documentation',
      citation: 'docs/adr-reconnect.md#policy',
      content: 'ADR states reconnect waits for operator confirmation.',
      proofClass: 'derived',
      freshness: 'unknown',
      sourceRevision: 'adr-r1',
      sourceTimestampMs: 1000,
      conflictKey: 'reconnect-policy',
      conflictValue: 'ADR requires operator confirmation',
    }])),
  };
  const files: WorkspaceFilePort = {
    canonicalizeRoot: () => Effect.succeed(ok('/repo')),
    snapshot: () => { throw new Error('query must not snapshot repository'); },
    readExact: () => Effect.succeed(ok({ bytes: source, digest: digest as never })),
  };
  const artifacts: ArtifactStore = {
    storeExact: () => Effect.succeed(ok({ handle: 'conflict-file-handle', digest: digest as never, sizeBytes: source.length })),
    readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not needed'))),
  };
  const semantics: SemanticAnalysisPort = {
    definition: () => Effect.succeed(ok([{
      location: { repoPath: 'src/connection.ts', startLine: 1, startColumn: 17, endLine: 1, endColumn: 26 },
      name: 'reconnect', kind: 'function',
    }])),
    references: () => Effect.succeed(ok([])),
    typeInfo: () => Effect.succeed(ok(undefined)),
    diagnostics: () => Effect.succeed(ok([])),
  };
  const codeGraph: CodeGraphCandidatePort = {
    search: () => Effect.succeed(ok([{ candidate, score: 0.99, freshness: 'unknown' as const }])),
  };
  const provider = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId, rootPath: '/repo', files, codeGraph, artifacts, semantics, documentation,
    newRequestId: () => 'conflict-request',
  });
  const context = mustOk(await Effect.runPromise(provider.search({
    workspaceId, query: 'reconnect policy', includeDocs: true, includeMemory: false,
  })));
  assert.equal(context.complete, false);
  assert.equal(context.evidence.length, 2);
  assert.equal(context.evidence.find((item) => item.source === 'code')?.sourceRevision, digest);
  assert.equal(context.evidence.find((item) => item.source === 'documentation')?.sourceRevision, 'adr-r1');
  assert.equal(context.conflicts?.length, 1);
  assert.equal(context.conflicts?.[0]?.conflictKey, 'reconnect-policy');
  assert.ok(context.warnings.some((warning) => warning.includes('evidence sources disagree')));
});


test('native byte-range verification rejects cross-line columns and split UTF-8 sequences', () => {
  const bytes = Buffer.from('abc\nxyz\n');
  assert.deepEqual(exactUtf8ByteRange(bytes, { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4 }), { offset: 0, length: 3 });
  assert.equal(exactUtf8ByteRange(bytes, { startLine: 1, startColumn: 6, endLine: 2, endColumn: 2 }), undefined);
  assert.equal(exactUtf8ByteRange(bytes, { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 }), undefined);
  assert.equal(exactUtf8ByteRange(bytes, { startLine: 2, startColumn: 1, endLine: 1, endColumn: 4 }), undefined);
  const unicode = Buffer.from('éclair\n');
  assert.equal(exactUtf8ByteRange(unicode, { startLine: 1, startColumn: 2, endLine: 1, endColumn: 3 }), undefined);
});


test('shared UTF-8 ranges preserve Cyrillic, combining marks, emoji, CRLF and multiline spans', () => {
  const first = 'тест 😀 e\u0301';
  const second = 'вторая строка';
  const bytes = Buffer.from(`${first}\r\n${second}\r\n`, 'utf8');
  const emojiStart = Buffer.byteLength('тест ', 'utf8') + 1;
  const emojiEnd = emojiStart + Buffer.byteLength('😀', 'utf8');
  const combiningStart = Buffer.byteLength('тест 😀 ', 'utf8') + 1;
  const combiningEnd = combiningStart + Buffer.byteLength('e\u0301', 'utf8');

  assert.equal(exactUtf8Span(bytes, {
    startLine: 1,
    startColumn: emojiStart,
    endLine: 1,
    endColumn: emojiEnd,
  }), '😀');
  assert.equal(exactUtf8Span(bytes, {
    startLine: 1,
    startColumn: combiningStart,
    endLine: 1,
    endColumn: combiningEnd,
  }), 'e\u0301');
  assert.equal(exactUtf8Span(bytes, {
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: Buffer.byteLength(first, 'utf8') + 1,
  }), first);
  assert.equal(exactUtf8Span(bytes, {
    startLine: 1,
    startColumn: 1,
    endLine: 2,
    endColumn: Buffer.byteLength(second, 'utf8') + 1,
  }), `${first}\r\n${second}`);

  const emojiLine = Buffer.from('😀X', 'utf8');
  assert.equal(utf16ColumnAtUtf8Byte(emojiLine, 1, 1), 1);
  assert.equal(utf16ColumnAtUtf8Byte(emojiLine, 1, 5), 3);
  assert.equal(utf16ColumnAtUtf8Byte(emojiLine, 1, 6), 4);
});

// A slow optional provider must not open a post-verification edit window.

test('DBC-05 final worktree revalidation runs after documentation retrieval', async () => {
  const benchmark = createRetrievalBenchmarkTraceCollector('ar07-race');
  let edited = false;
  let reads = 0;
  const changed = Buffer.from('export function reconnect(): string { return "changed"; }\n');
  const changedDigest = createHash('sha256').update(changed).digest('hex');
  const files: WorkspaceFilePort = {
    canonicalizeRoot: () => Effect.succeed(ok('/repo')),
    snapshot: () => { throw new Error('not used'); },
    readExact: () => {
      reads += 1;
      return Effect.succeed(ok(edited
        ? { bytes: changed, digest: changedDigest as never }
        : { bytes: source, digest: digest as never }));
    },
  };
  const codeGraph: CodeGraphCandidatePort = {
    search: () => Effect.succeed(ok([{ candidate, score: 0.99, freshness: 'unknown' as const }])),
  };
  const artifacts: ArtifactStore = {
    storeExact: () => Effect.succeed(ok({ handle: 'docs-race', digest: digest as never, sizeBytes: source.length })),
    readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not needed'))),
  };
  const semantics: SemanticAnalysisPort = {
    definition: () => Effect.succeed(ok([{
      location: { repoPath: 'src/connection.ts', startLine: 1, startColumn: 17, endLine: 1, endColumn: 26 },
      name: 'reconnect', kind: 'function',
    }])),
    references: () => Effect.succeed(ok([])),
    typeInfo: () => Effect.succeed(ok(undefined)),
    diagnostics: () => Effect.succeed(ok([])),
  };
  const documentation: DocumentationPort = {
    search: () => {
      edited = true;
      return Effect.succeed(ok([{
        evidenceId: 'document-during-edit' as never,
        source: 'documentation',
        citation: 'docs/reconnect.md',
        content: 'Document remains available',
        proofClass: 'direct',
        freshness: 'current',
      }]));
    },
  };
  const provider = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId, rootPath: '/repo', files, codeGraph, artifacts, semantics, documentation,
    newRequestId: () => 'docs-race-request',
    benchmarkTrace: benchmark,
  });
  const result = mustOk(await Effect.runPromise(provider.search({
    workspaceId, query: 'reconnect', includeDocs: true, includeMemory: false,
  })));
  assert.equal(reads, 2);
  assert.equal(result.complete, false);
  assert.ok(result.partialSources.includes('code'));
  assert.equal(result.partialSources.includes('documentation'), false);
  assert.equal(result.evidence.find((item) => item.source === 'code')?.freshness, 'changed_during_request');
  assert.equal(result.evidence.find((item) => item.source === 'code')?.proofClass, 'uncertain');
  const delivered = benchmark.events.filter((item) => item.stage === 'delivered');
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0]?.status, 'unavailable');
  assert.deepEqual(delivered[0]?.candidates, [], 'stale ranked code must not be credited');
});



test('exact LSP confirmation rejects a different declaration on the same AST line', async () => {
  const sameLineSource = Buffer.from('export function alpha(){} export function beta(){}\n');
  const sameLineDigest = createHash('sha256').update(sameLineSource).digest('hex');
  const beta = mustOk(makeCodeCandidate({
    candidateId: mustOk(makeCandidateId('same-line-beta')),
    workspaceId,
    repoPath: 'src/same-line.ts' as never,
    range: { startLine: 1, startColumn: 27, endLine: 1, endColumn: 51 },
    symbolName: 'beta',
    semanticAnchor: { line: 1, byteColumn: 43, endLine: 1, endByteColumn: 47 },
    text: 'export function beta(){}',
    sourceDigest: sameLineDigest as never,
    generation: 1 as never,
    indexedAtMs: 1,
  }));
  const provider = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId,
    rootPath: '/repo',
    files: {
      canonicalizeRoot: () => Effect.succeed(ok('/repo')),
      snapshot: () => { throw new Error('not used'); },
      readExact: () => Effect.succeed(ok({ bytes: sameLineSource, digest: sameLineDigest as never })),
    },
    codeGraph: {
      search: () => Effect.succeed(ok([{ candidate: beta, score: 1, freshness: 'unknown' as const }])),
    },
    artifacts: {
      storeExact: () => Effect.succeed(ok({ handle: 'same-line', digest: sameLineDigest as never, sizeBytes: sameLineSource.length })),
      readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not used'))),
    },
    semantics: {
      definition: () => Effect.succeed(ok([{
        location: { repoPath: 'src/same-line.ts', startLine: 1, startColumn: 17, endLine: 1, endColumn: 22 },
        name: 'alpha',
      }])),
      references: () => Effect.succeed(ok([])),
      typeInfo: () => Effect.succeed(ok(undefined)),
      diagnostics: () => Effect.succeed(ok([])),
    },
    newRequestId: () => 'same-line-lsp',
  });
  const bundle = mustOk(await Effect.runPromise(provider.search({
    workspaceId,
    query: 'beta',
    includeDocs: false,
    includeMemory: false,
    sourceRequirements: {
      code: { requirement: 'required', allowed: true },
      structural: { requirement: 'not_requested', allowed: true },
      lsp: { requirement: 'required', allowed: true },
      documentation: { requirement: 'not_requested', allowed: true },
      memory: { requirement: 'not_requested', allowed: true },
    },
  })));
  assert.equal(bundle.complete, false);
  assert.ok(bundle.partialSources.includes('lsp'));
  assert.equal(bundle.evidence[0]?.proofClass, 'direct');
});


test('index coverage failures make an otherwise current result incomplete', async () => {
  const provider = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId,
    rootPath: '/repo',
    files: {
      canonicalizeRoot: () => Effect.succeed(ok('/repo')),
      snapshot: () => { throw new Error('not used'); },
      readExact: () => Effect.succeed(ok({ bytes: source, digest: digest as never })),
    },
    codeGraph: {
      search: () => Effect.succeed(ok([{ candidate, score: 1, freshness: 'unknown' as const }])),
    },
    artifacts: {
      storeExact: () => Effect.succeed(ok({ handle: 'coverage', digest: digest as never, sizeBytes: source.length })),
      readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not used'))),
    },
    semantics: {
      definition: () => Effect.succeed(ok([{
        location: { repoPath: 'src/connection.ts', startLine: 1, startColumn: 17, endLine: 1, endColumn: 26 },
        name: 'reconnect',
      }])),
      references: () => Effect.succeed(ok([])),
      typeInfo: () => Effect.succeed(ok(undefined)),
      diagnostics: () => Effect.succeed(ok([])),
    },
    coverage: {
      schemaVersion: 1,
      sourceSnapshotDigest: 'a'.repeat(64) as never,
      parserVersion: 'fixture/parser-v1',
      attemptedPaths: 2,
      indexedPaths: 1,
      policyExcludedPaths: 0,
      outOfScopePaths: 0,
      failedPaths: 1,
      failureCounts: {
        read_failed: 1,
        binary_source: 0,
        invalid_utf8: 0,
        digest_raced: 0,
        structural_failed: 0,
        digest_mismatch: 0,
        parser_partial: 0,
        unsupported_parser: 0,
      },
      failures: [{ repoPath: 'src/unreadable.ts' as never, kind: 'read_failed', code: 'FILE_NOT_FOUND' }],
    },
    newRequestId: () => 'coverage-request',
  });
  const bundle = mustOk(await Effect.runPromise(provider.search({
    workspaceId, query: 'reconnect', includeDocs: false, includeMemory: false,
  })));
  assert.equal(bundle.complete, false);
  assert.ok(bundle.partialSources.includes('code'));
  assert.equal(bundle.indexCoverage?.failedPaths, 1);
});



test('CBM context does not claim complete history from bounded Graphiti memory', async () => {
  const provider = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId,
    rootPath: '/repo',
    files: {
      canonicalizeRoot: () => Effect.succeed(ok('/repo')),
      snapshot: () => { throw new Error('not used'); },
      readExact: () => Effect.succeed(ok({ bytes: source, digest: digest as never })),
    },
    codeGraph: {
      search: () => Effect.succeed(ok([{ candidate, score: 1, freshness: 'unknown' as const }])),
    },
    artifacts: {
      storeExact: () => Effect.succeed(ok({ handle: 'memory-context', digest: digest as never, sizeBytes: source.length })),
      readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not used'))),
    },
    semantics: {
      definition: () => Effect.succeed(ok([{
        location: { repoPath: 'src/connection.ts', startLine: 1, startColumn: 17, endLine: 1, endColumn: 26 },
        name: 'reconnect',
      }])),
      references: () => Effect.succeed(ok([])),
      typeInfo: () => Effect.succeed(ok(undefined)),
      diagnostics: () => Effect.succeed(ok([])),
    },
    memory: {
      search: () => Effect.succeed(ok({
        hits: [{
          episode: {
            episodeId: 'episode-memory' as never,
            workspaceId,
            sessionId: 'session-memory',
            sourcePointer: 'codex://session-memory/1',
            occurredAtMs: 10,
            importedAtMs: 11,
            contentDigest: 'c'.repeat(64) as never,
            searchText: 'we selected local qdrant',
            tombstoned: false,
          },
          matchingExcerpt: 'Local Qdrant was selected for private code retrieval.',
        }],
        conflicts: [],
        evidenceCompleteness: 'provider_bounded_top_k',
      })),
    },
    newRequestId: () => 'memory-context-request',
  });
  const bundle = mustOk(await Effect.runPromise(provider.search({
    workspaceId, query: 'why local qdrant', includeDocs: false, includeMemory: true,
  })));
  assert.equal(bundle.complete, false);
  assert.deepEqual(bundle.partialSources, ['memory']);
  assert.equal(bundle.sourceCoverage?.find((item) => item.source === 'memory')?.status, 'partial');
  assert.equal(bundle.sourceCoverage?.find((item) => item.source === 'memory')?.reason, 'provider_bounded_top_k');
  assert.match(bundle.warnings.find((warning) => warning.startsWith('memory:')) ?? '', /not establish exhaustive history/u);
  const memoryEvidence = bundle.evidence.find((item) => item.source === 'memory');
  assert.equal(memoryEvidence?.citation, 'codex://session-memory/1');
  assert.equal(memoryEvidence?.proofClass, 'derived');
  assert.equal(memoryEvidence?.sourceDigest, 'c'.repeat(64));

  const emptyProvider = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId,
    rootPath: '/repo',
    files: {
      canonicalizeRoot: () => Effect.succeed(ok('/repo')),
      snapshot: () => { throw new Error('not used'); },
      readExact: () => Effect.succeed(ok({ bytes: source, digest: digest as never })),
    },
    codeGraph: {
      search: () => Effect.succeed(ok([{ candidate, score: 1, freshness: 'unknown' as const }])),
    },
    artifacts: {
      storeExact: () => Effect.succeed(ok({ handle: 'empty-memory', digest: digest as never, sizeBytes: source.length })),
      readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not used'))),
    },
    semantics: {
      definition: () => Effect.succeed(ok([{
        location: { repoPath: 'src/connection.ts', startLine: 1, startColumn: 17, endLine: 1, endColumn: 26 },
        name: 'reconnect',
      }])),
      references: () => Effect.succeed(ok([])),
      typeInfo: () => Effect.succeed(ok(undefined)),
      diagnostics: () => Effect.succeed(ok([])),
    },
    memory: { search: () => Effect.succeed(ok({ hits: [], conflicts: [] })) },
    newRequestId: () => 'empty-memory-context',
  });
  const empty = mustOk(await Effect.runPromise(emptyProvider.search({
    workspaceId, query: 'unknown historical thing', includeDocs: false, includeMemory: true,
  })));
  assert.equal(empty.complete, true);
  assert.equal(empty.partialSources.includes('memory'), false);
});



test('one ACE request id correlates docs, memory and final source verification without payload logging', async () => {
  const requestId = 'cross-provider-request';
  let docsRequestId: string | undefined;
  let memoryRequestId: string | undefined;
  const events: ProviderTraceEvent[] = [];
  const trace: ProviderTraceSink = { record: (event) => { events.push(event); } };
  const documentation: DocumentationPort = {
    search: (input) => {
      docsRequestId = input.requestId;
      return Effect.succeed(ok([]));
    },
  };
  const memory: MemorySearchPort = {
    search: (input) => {
      memoryRequestId = input.requestId;
      return Effect.succeed(ok({ hits: [], conflicts: [] }));
    },
  };
  const provider = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId,
    rootPath: '/repo',
    files: {
      canonicalizeRoot: () => Effect.succeed(ok('/repo')),
      snapshot: () => { throw new Error('not used'); },
      readExact: () => Effect.succeed(ok({ bytes: source, digest: digest as never })),
    },
    codeGraph: {
      search: () => Effect.succeed(ok([{ candidate, score: 1, freshness: 'unknown' as const }])),
    },
    artifacts: {
      storeExact: () => Effect.succeed(ok({ handle: 'trace-file', digest: digest as never, sizeBytes: source.length })),
      readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not used'))),
    },
    semantics: {
      definition: () => Effect.succeed(ok([{
        location: { repoPath: 'src/connection.ts', startLine: 1, startColumn: 17, endLine: 1, endColumn: 26 },
        name: 'reconnect',
      }])),
      references: () => Effect.succeed(ok([])),
      typeInfo: () => Effect.succeed(ok(undefined)),
      diagnostics: () => Effect.succeed(ok([])),
    },
    documentation,
    memory,
    trace,
    newRequestId: () => requestId,
  });
  const result = mustOk(await Effect.runPromise(provider.search({
    workspaceId,
    query: 'why reconnect architecture',
    includeDocs: true,
    includeMemory: true,
  })));
  assert.equal(result.requestId, requestId);
  assert.equal(docsRequestId, requestId);
  assert.equal(memoryRequestId, requestId);
  const verification = events.find((event) => event.provider === 'source_verification');
  assert.equal(verification?.requestId, requestId);
  assert.equal(verification?.status, 'success');
  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes('why reconnect architecture'), false);
  assert.equal(serialized.includes(candidate.text), false);
});



test('DBC-05 final worktree revalidation also runs after temporal memory retrieval', async () => {
  let edited = false;
  let reads = 0;
  const changed = Buffer.from('export function reconnect(): string { return "changed-by-memory"; }\n');
  const changedDigest = createHash('sha256').update(changed).digest('hex');
  const files: WorkspaceFilePort = {
    canonicalizeRoot: () => Effect.succeed(ok('/repo')),
    snapshot: () => { throw new Error('not used'); },
    readExact: () => {
      reads += 1;
      return Effect.succeed(ok(edited
        ? { bytes: changed, digest: changedDigest as never }
        : { bytes: source, digest: digest as never }));
    },
  };
  const codeGraph: CodeGraphCandidatePort = {
    search: () => Effect.succeed(ok([{ candidate, score: 0.99, freshness: 'unknown' as const }])),
  };
  const artifacts: ArtifactStore = {
    storeExact: () => Effect.succeed(ok({ handle: 'memory-race', digest: digest as never, sizeBytes: source.length })),
    readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not needed'))),
  };
  const semantics: SemanticAnalysisPort = {
    definition: () => Effect.succeed(ok([{
      location: { repoPath: 'src/connection.ts', startLine: 1, startColumn: 17, endLine: 1, endColumn: 26 },
      name: 'reconnect', kind: 'function',
    }])),
    references: () => Effect.succeed(ok([])),
    typeInfo: () => Effect.succeed(ok(undefined)),
    diagnostics: () => Effect.succeed(ok([])),
  };
  const memory: MemorySearchPort = {
    search: () => {
      edited = true;
      return Effect.succeed(ok({
        hits: [{
          episode: {
            episodeId: 'race-memory-episode' as never,
            workspaceId,
            sessionId: 'race-memory-session',
            sourcePointer: 'codex://race-memory-session/1',
            occurredAtMs: 100,
            importedAtMs: 101,
            contentDigest: 'f'.repeat(64) as never,
            searchText: 'we selected local qdrant',
            tombstoned: false,
          },
          matchingExcerpt: 'We selected local Qdrant for private code retrieval.',
        }],
        conflicts: [],
      }));
    },
  };
  const provider = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId, rootPath: '/repo', files, codeGraph, artifacts, semantics, memory,
    newRequestId: () => 'memory-race-request',
  });
  const result = mustOk(await Effect.runPromise(provider.search({
    workspaceId, query: 'why qdrant', includeDocs: false, includeMemory: true,
  })));

  assert.equal(reads, 2);
  assert.equal(result.complete, false);
  assert.ok(result.partialSources.includes('code'));
  assert.equal(result.partialSources.includes('memory'), false);
  const code = result.evidence.find((item) => item.source === 'code');
  const temporal = result.evidence.find((item) => item.source === 'memory');
  assert.equal(code?.freshness, 'changed_during_request');
  assert.equal(code?.proofClass, 'uncertain');
  assert.equal(temporal?.freshness, 'current');
  assert.equal(temporal?.proofClass, 'derived');
  assert.equal(temporal?.citation, 'codex://race-memory-session/1');
});



test('W10 docs-only route skips native graph, source reads and LSP entirely', async () => {
  let graphCalls = 0;
  let sourceReads = 0;
  let semanticCalls = 0;
  let documentationCalls = 0;
  const provider = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId,
    rootPath: '/repo',
    files: {
      canonicalizeRoot: () => Effect.succeed(ok('/repo')),
      snapshot: () => { throw new Error('not used'); },
      readExact: () => {
        sourceReads += 1;
        return Effect.succeed(ok({ bytes: source, digest: digest as never }));
      },
    },
    codeGraph: {
      search: () => {
        graphCalls += 1;
        return Effect.succeed(ok([{ candidate, score: 1, freshness: 'unknown' as const }]));
      },
    },
    artifacts: {
      storeExact: () => Effect.succeed(ok({ handle: 'not-used', digest: digest as never, sizeBytes: source.length })),
      readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not used'))),
    },
    semantics: {
      definition: () => {
        semanticCalls += 1;
        return Effect.succeed(ok([]));
      },
      references: () => {
        semanticCalls += 1;
        return Effect.succeed(ok([]));
      },
      typeInfo: () => {
        semanticCalls += 1;
        return Effect.succeed(ok(undefined));
      },
      diagnostics: () => {
        semanticCalls += 1;
        return Effect.succeed(ok([]));
      },
    },
    documentation: {
      search: () => {
        documentationCalls += 1;
        return Effect.succeed(ok([{
          evidenceId: 'docs-only-evidence' as never,
          source: 'documentation',
          citation: 'docs/decision.md',
          content: 'The historical architecture rationale.',
          proofClass: 'derived',
          freshness: 'current',
        }]));
      },
    },
    newRequestId: () => 'docs-only-route',
  });

  const result = mustOk(await Effect.runPromise(provider.search({
    workspaceId,
    query: 'architecture rationale',
    includeCode: false,
    includeDocs: true,
    includeMemory: false,
  })));

  assert.equal(graphCalls, 0);
  assert.equal(sourceReads, 0);
  assert.equal(semanticCalls, 0);
  assert.equal(documentationCalls, 1);
  assert.equal(result.complete, true);
  assert.deepEqual(result.evidence.map((item) => item.source), ['documentation']);
});



test('initial stale CBM hit triggers one bounded exact refresh and retries current evidence', async () => {
  const staleCandidate = {
    ...candidate,
    candidateId: mustOk(makeCandidateId('outdated-reconnect')),
    sourceDigest: 'f'.repeat(64) as never,
  };
  let searches = 0;
  let exactRefreshes = 0;
  let reconciles = 0;
  const codeGraph: CodeGraphCandidatePort = {
    search: () => {
      searches += 1;
      return Effect.succeed(ok([{
        candidate: searches === 1 ? staleCandidate : candidate,
        score: 0.97,
        freshness: 'unknown' as const,
      }]));
    },
  };
  const files: WorkspaceFilePort = {
    canonicalizeRoot: () => Effect.succeed(ok('/repo')),
    snapshot: () => Effect.succeed(ok({ headRevision: 'a'.repeat(40), files: [], removedPaths: [] })),
    observeChanges: () => { throw new Error('workspace sync owns the observation'); },
    readExact: () => Effect.succeed(ok({ bytes: source, digest: digest as never })),
  };
  const artifacts: ArtifactStore = {
    storeExact: () => Effect.succeed(ok({ handle: 'exact-current-file', digest: digest as never, sizeBytes: source.length })),
    readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not used'))),
  };
  const semantics: SemanticAnalysisPort = {
    definition: () => Effect.succeed(ok([])),
    references: () => Effect.succeed(ok([])),
    typeInfo: () => Effect.succeed(ok(undefined)),
    diagnostics: () => Effect.succeed(ok([])),
  };
  const workspaceManifest = workspaceManifestFromSnapshot({
    headRevision: 'a'.repeat(40), files: [], removedPaths: [],
  }, 'scope-v1');
  const state = {
    workspaceId,
    workspaceManifest,
    generation: 1,
    indexKey: 'stable-published',
    candidateIdsByPath: new Map(),
  };
  const delta = { changed: [], added: [], deleted: [], renamed: [], scopeChanged: false };
  const workspaceSync = {
    initialize: () => Effect.succeed(ok(state)),
    refresh: () => Effect.succeed(ok({ state, delta, refreshed: false })),
    refreshExact: (paths: readonly string[]) => {
      exactRefreshes += 1;
      assert.deepEqual(paths, [candidate.repoPath]);
      return Effect.succeed(ok({ state, delta, refreshed: false }));
    },
  };
  let config: Parameters<typeof makeNativeCbmContextProvider>[0];
  const reconcile = () => {
    reconciles += 1;
    return Effect.succeed(ok(config));
  };
  config = {
    mode: 'cbm',
    workspaceId, rootPath: '/repo', files, codeGraph,
    artifacts, semantics,
    workspaceManifest, workspaceSync, reconcile,
    newRequestId: () => 'initial-stale-retry',
  };
  const result = mustOk(await Effect.runPromise(makeNativeCbmContextProvider(config).search({
    workspaceId, query: 'reconnect', includeDocs: false, includeMemory: false,
  })));
  assert.equal(searches, 2, 'initial stale hit should cause exactly one retry');
  assert.equal(exactRefreshes, 1);
  assert.equal(reconciles, 1);
  assert.ok(result.evidence.some((item) => item.sourceDigest === candidate.sourceDigest
    && item.freshness === 'current'));
});
