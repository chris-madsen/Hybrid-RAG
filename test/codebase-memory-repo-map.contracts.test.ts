import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Effect } from 'effect';
import { makeCodebaseMemoryRepoMap, nativeTraceQualifiedNames, nativeQueryGraphFiles, parseCodebaseMemoryLexicalRows, parseCodebaseMemorySemanticRows } from '../src/adapters/codebase-memory-repo-map.js';
import type { CodeCandidate } from '../src/domain/retrieval.js';
import { buildLocalCodeIndex } from '../src/adapters/local-code-index.js';
import { makeNodeWorkspacePort } from '../src/adapters/node-workspace-port.js';
import { makeCodebaseMemoryStructuralPort } from '../src/adapters/codebase-memory-structural.js';

test('native semantic result table retains source path and rejects escapes', () => {
  const root = resolve(process.cwd());
  const doc = {
    semantic: {
      cols: ['qn', 'label', 'file', 'score'],
      rows: [
        ['app.src.function', 'Function', 'src/app.ts', 0.9],
        ['bad', 'Function', '../outside.ts', 0.8],
        ['bad', 'Function', '/etc/passwd', 0.7],
      ],
    },
  };
  assert.deepEqual(parseCodebaseMemorySemanticRows(root, doc), [
    { qn: 'app.src.function', file: 'src/app.ts', score: 0.9 },
  ]);
  assert.equal(parseCodebaseMemorySemanticRows(root, { semantic: { cols: [], rows: [] } }), undefined);
  assert.equal(parseCodebaseMemorySemanticRows(root, { error: 'not ready' }), undefined);
});

test('native CBM BM25 rows use documented columns without inventing a search rank', () => {
  assert.deepEqual(parseCodebaseMemoryLexicalRows(resolve(process.cwd()), {
    cols: ['qn', 'label', 'file', 'lines', 'rank'],
    rows: [['ace.makeQdrantContextProvider', 'Function', 'src/adapters/qdrant-context-provider.ts', '800-870', -7.5]],
  }), [{ qn: 'ace.makeQdrantContextProvider', file: 'src/adapters/qdrant-context-provider.ts', score: 7.5 }]);
});

test('native graph traversal and Cypher are decoded from upstream wire shape', () => {
  assert.deepEqual(nativeTraceQualifiedNames({
    callees: { cols: ['name', 'hop'], groups: [
      { qn_prefix: 'ace.src.handlers', rows: [['dispatch', 1], ['validate', 2]] },
    ] },
  }), ['ace.src.handlers.dispatch', 'ace.src.handlers.validate']);
  assert.deepEqual(nativeQueryGraphFiles(resolve(process.cwd()), {
    columns: ['file', 'qn'], rows: [
      ['src/application/ports.ts', 'ace.ports'],
      ['../../unsafe.ts', 'bad'],
    ],
  }), ['src/application/ports.ts']);
});

test('installed Codebase Memory indexes ACE and returns source-bound candidates', {
  skip: process.env.ACE_TEST_REAL_CBM !== 'true',
  timeout: 180_000,
}, async () => {
  // Use an actual ACE file rather than a synthetic benchmark corpus. The
  // upstream binary does all parsing, graph construction and semantic search.
  const root = resolve(process.cwd());
  const path = 'src/adapters/qdrant-context-provider.ts';
  const data = readFileSync(resolve(root, path), 'utf8');
  const lines = data.split('\n');
  const line = lines.findIndex((item) => item.startsWith('export const makeQdrantContextProvider'));
  assert.ok(line >= 0);
  const candidate: CodeCandidate = {
    candidateId: 'real-codebase-memory-contract' as CodeCandidate['candidateId'],
    workspaceId: 'ace-integration-smoke' as CodeCandidate['workspaceId'],
    repoPath: path as CodeCandidate['repoPath'],
    range: { startLine: line + 1, endLine: line + 1 },
    symbolName: 'makeQdrantContextProvider',
    structuralKind: 'function',
    text: lines[line]!,
    sourceDigest: createHash('sha256').update(data).digest('hex') as CodeCandidate['sourceDigest'],
    generation: 1 as CodeCandidate['generation'],
    indexedAtMs: Date.now(),
    invalidated: false,
  };
  const provider = makeCodebaseMemoryRepoMap({
    rootPath: root,
    candidates: () => [candidate],
    timeoutMs: 165_000,
  });
  const indexed = await Effect.runPromise(provider.reindex());
  assert.equal(indexed._tag, 'Ok', JSON.stringify(indexed));
  // ACE may republish the same revision after a restart or a no-op sync.
  // Native CBM's second index must remain usable without an index rebuild.
  const second = await Effect.runPromise(provider.reindex());
  assert.equal(second._tag, 'Ok', JSON.stringify(second));
  const found = await Effect.runPromise(provider.search({ query: 'makeQdrantContextProvider', limit: 100 }));
  assert.equal(found._tag, 'Ok', JSON.stringify(found));
  if (found._tag === 'Ok') {
    assert.ok(found.value.length > 0, 'native CBM must discover at least one matching ACE symbol');
    assert.ok(found.value.every((item) => item.candidate.candidateId === candidate.candidateId));
  }
  const outline = await Effect.runPromise(provider.outline(path as never));
  assert.equal(outline._tag, 'Ok', JSON.stringify(outline));
  if (outline._tag === 'Ok') {
    assert.ok(outline.value.some((item) => item.name.includes('makeQdrantContextProvider')),
      'native CBM must extract source declarations');
  }
  const graph = await Effect.runPromise(provider.queryGraph(
    'MATCH (n:Function) RETURN n.name AS name LIMIT 5'));
  assert.equal(graph._tag, 'Ok', JSON.stringify(graph));
  const trace = await Effect.runPromise(provider.trace('makeQdrantContextProvider'));
  assert.equal(trace._tag, 'Ok', JSON.stringify(trace));
  const impact = await Effect.runPromise(provider.detectChanges('HEAD~1'));
  assert.equal(impact._tag, 'Ok', JSON.stringify(impact));
  // This is the actual ACE indexing pipeline on its real checkout, not a
  // synthetic fixture: native CBM -> source-checked symbol spans -> Qdrant
  // candidate inventory (vectors are tested by the existing Qdrant suite).
  const files = makeNodeWorkspacePort({ allowedRoots: [root] });
  const built = await Effect.runPromise(buildLocalCodeIndex(
    files, 'cbm-actual-source-smoke' as never, root,
    { generation: 1, structural: makeCodebaseMemoryStructuralPort(provider),
      parserVersion: 'codebase-memory/0.12.1', extensions: ['.ts'] },
  ));
  assert.equal(built._tag, 'Ok', JSON.stringify(built._tag === 'Err' ? built.error : 'ok'));
  if (built._tag === 'Ok') {
    assert.ok(built.value.index.candidates.length > 30,
      'native CBM must supply useful real ACE code candidates');
    assert.ok(built.value.index.candidates.some((item) =>
      item.repoPath === 'src/adapters/qdrant-context-provider.ts'));
  }
});
