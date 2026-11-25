import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Effect } from 'effect';
import { makeCodebaseMemoryGraph, nativeTraceQualifiedNames, nativeQueryGraphFiles, nativeQueryGraphTargets, nativeQualifiedSymbolCandidate, parseCodebaseMemoryLexicalRows, parseCodebaseMemorySemanticRows } from '../src/adapters/codebase-memory-graph.js';
import type { CodeCandidate } from '../src/domain/retrieval.js';
import { buildLocalCodeIndex } from '../src/adapters/local-code-index.js';
import { makeNodeWorkspacePort } from '../src/adapters/node-workspace-port.js';
import { makeCodebaseMemoryStructuralPort } from '../src/adapters/codebase-memory-structural.js';
import { makeNativeCbmContextProvider } from '../src/adapters/native-cbm-context-provider.js';
import { makeRoutedLspSession } from '../src/application/lsp/routed-semantic.js';
import { resolveExplicitSourceRequirements } from '../src/domain/source-coverage.js';

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
    rows: [['ace.makeNativeCbmContextProvider', 'Function', 'src/adapters/native-cbm-context-provider.ts', '800-870', -7.5]],
  }), [{ qn: 'ace.makeNativeCbmContextProvider', file: 'src/adapters/native-cbm-context-provider.ts', score: 7.5 }]);
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

test('CBM qualified names resolve distinct same-named source declarations and reject ambiguity', () => {
  const candidates = [
    { symbolName: 'save', range: { startLine: 2, endLine: 2 }, candidateId: 'user' },
    { symbolName: 'save', range: { startLine: 5, endLine: 5 }, candidateId: 'audit' },
  ];
  const outline = [
    { name: 'save', label: 'Method', startLine: 2, endLine: 2,
      qualifiedName: 'project.UserRepository.save' },
    { name: 'save', label: 'Method', startLine: 5, endLine: 5,
      qualifiedName: 'project.AuditRepository.save' },
  ];
  assert.equal(nativeQualifiedSymbolCandidate(candidates,
    'project.UserRepository.save', outline)?.candidateId, 'user');
  assert.equal(nativeQualifiedSymbolCandidate(candidates,
    'project.AuditRepository.save', outline)?.candidateId, 'audit');
  assert.equal(nativeQualifiedSymbolCandidate(candidates,
    'project.Unknown.save', outline), undefined);
  assert.deepEqual(nativeQueryGraphTargets(resolve(process.cwd()), {
    columns: ['file', 'qn'], rows: [
      ['src/handlers.ts', 'project.UserRepository.save'],
      ['../outside.ts', 'escaped'],
    ],
  }), [{ file: 'src/handlers.ts', qn: 'project.UserRepository.save' }]);
});

test('installed Codebase Memory indexes ACE and returns source-bound candidates', {
  skip: process.env.ACE_TEST_REAL_CBM !== 'true',
  timeout: 600_000,
}, async () => {
  // Use an actual ACE file rather than a synthetic benchmark corpus. The
  // upstream binary does all parsing, graph construction and semantic search.
  const root = resolve(process.cwd());
  const path = 'src/adapters/native-cbm-context-provider.ts';
  const data = readFileSync(resolve(root, path), 'utf8');
  const lines = data.split('\n');
  const line = lines.findIndex((item) => item.startsWith('export const makeNativeCbmContextProvider'));
  assert.ok(line >= 0);
  const candidate: CodeCandidate = {
    candidateId: 'real-codebase-memory-contract' as CodeCandidate['candidateId'],
    workspaceId: 'ace-integration-smoke' as CodeCandidate['workspaceId'],
    repoPath: path as CodeCandidate['repoPath'],
    range: { startLine: line + 1, startColumn: 1, endLine: line + 1, endColumn: Buffer.byteLength(lines[line]!) + 1 },
    symbolName: 'makeNativeCbmContextProvider',
    structuralKind: 'function',
    text: lines[line]!,
    sourceDigest: createHash('sha256').update(data).digest('hex') as CodeCandidate['sourceDigest'],
    generation: 1 as CodeCandidate['generation'],
    indexedAtMs: Date.now(),
    invalidated: false,
  };
  const provider = makeCodebaseMemoryGraph({
    rootPath: root,
    candidates: () => [candidate],
    timeoutMs: 165_000,
  });
  try {
    const indexed = await Effect.runPromise(provider.reindex());
    assert.equal(indexed._tag, 'Ok', JSON.stringify(indexed));
    // ACE may republish the same revision after a restart or a no-op sync.
    // Native CBM's second index must remain usable without an index rebuild.
    const second = await Effect.runPromise(provider.reindex());
    assert.equal(second._tag, 'Ok', JSON.stringify(second));
    const found = await Effect.runPromise(provider.search({ query: 'makeNativeCbmContextProvider', limit: 100 }));
    assert.equal(found._tag, 'Ok', JSON.stringify(found));
    if (found._tag === 'Ok') {
      assert.ok(found.value.length > 0, 'native CBM must discover at least one matching ACE symbol');
      assert.ok(found.value.every((item) => item.candidate.candidateId === candidate.candidateId));
    }
    const outline = await Effect.runPromise(provider.outline(path as never));
    assert.equal(outline._tag, 'Ok', JSON.stringify(outline));
    if (outline._tag === 'Ok') {
      assert.ok(outline.value.some((item) => item.name.includes('makeNativeCbmContextProvider')),
        'native CBM must extract source declarations');
    }
    const graph = await Effect.runPromise(provider.queryGraph(
      'MATCH (n:Function) RETURN n.name AS name LIMIT 5'));
    assert.equal(graph._tag, 'Ok', JSON.stringify(graph));
    // Do not mistake a successful Cypher invocation for a dependency edge:
    // exercise native cross-file relations from actual ACE TypeScript code.
    const realEdges = await Effect.runPromise(provider.queryGraph(
      'MATCH (origin)-[r:CALLS|IMPORTS|REFERENCES_FILE]->(other) '
      + 'WHERE origin.file_path = \'src/bin/ace-runtime.ts\' '
      + 'RETURN DISTINCT other.file_path AS file, other.qualified_name AS qn LIMIT 50'));
    assert.equal(realEdges._tag, 'Ok', JSON.stringify(realEdges));
    if (realEdges._tag === 'Ok') {
      const files = nativeQueryGraphFiles(root, realEdges.value);
      assert.ok(files, 'native edge result must expose source-qualified file columns');
      assert.ok(files?.some((file) => file !== 'src/bin/ace-runtime.ts'),
        'real ACE runtime must have a CBM-discovered cross-file dependency; '
        + 'a seed-only node lookup is not dependency discovery');
    }
    const exactGraphSymbol = outline._tag === 'Ok'
      ? outline.value.find((item) => item.name === 'makeNativeCbmContextProvider')?.qualifiedName
      : undefined;
    assert.ok(exactGraphSymbol, 'real CBM must return the declaration qualified name');
    const trace = await Effect.runPromise(provider.trace(exactGraphSymbol!));
    assert.equal(trace._tag, 'Ok', JSON.stringify(trace));
    const impact = await Effect.runPromise(provider.detectChanges('HEAD~1'));
    assert.equal(impact._tag, 'Ok', JSON.stringify(impact));
    // This is the actual ACE indexing pipeline on its real checkout, not a
    // synthetic fixture: native CBM -> source-checked symbol spans -> Qdrant
    // candidate inventory (vectors are tested by the existing Qdrant suite).
    const files = makeNodeWorkspacePort({ allowedRoots: [root] });
    const observed = await Effect.runPromise(files.snapshot(root, Date.now()));
    assert.equal(observed._tag, 'Ok', JSON.stringify(observed._tag === 'Err' ? observed.error : 'ok'));
    if (observed._tag === 'Err') return;
    // The native path uses the same actual CBM session, with no Qdrant or
    // embedding port at all. It still reopens the exact source via ACE.
    const native = makeNativeCbmContextProvider({
      mode: 'cbm',
      workspaceId: candidate.workspaceId,
      rootPath: root,
      files,
      semantics: makeRoutedLspSession([]),
      codeGraph: provider,
      newRequestId: () => 'native-cbm-real-source',
      candidateLimit: 100,
    });
    const plan = resolveExplicitSourceRequirements({ required: ['code'] });
    assert.equal(plan._tag, 'Ok');
    if (plan._tag === 'Err') return;
    const nativeResult = await Effect.runPromise(native.search({
      workspaceId: candidate.workspaceId,
      query: 'makeNativeCbmContextProvider',
      includeCode: true, includeDocs: false, includeMemory: false,
      sourceRequirements: plan.value,
    }));
    assert.equal(nativeResult._tag, 'Ok', JSON.stringify(nativeResult));
    if (nativeResult._tag === 'Ok') {
      assert.equal(nativeResult.value.complete, true);
      assert.ok(nativeResult.value.evidence.some((item) =>
        item.source === 'code' && item.proofClass === 'direct'
        && item.citation.startsWith(path + ':')));
    }
    // CBM indexed the FULL REAL ACE repository above. The candidate-extraction
    // smoke reads a bounded, pinned subset of real source files, avoiding
    // hundreds of per-file native CLI invocations in a short PR CI job.
    const included = observed.value.files.filter((file) =>
      file.repoPath.startsWith('src/') && file.repoPath.endsWith('.ts'));
    const selected = [
      ...included.filter((file) => file.repoPath === 'src/adapters/native-cbm-context-provider.ts'),
      ...included.filter((file) => file.repoPath !== 'src/adapters/native-cbm-context-provider.ts').slice(0, 17),
    ];
    const built = await Effect.runPromise(buildLocalCodeIndex(
      files, 'cbm-actual-source-smoke' as never, root,
      { generation: 1, structural: makeCodebaseMemoryStructuralPort(provider),
        parserVersion: 'codebase-memory/0.12.1', extensions: ['.ts'],
        snapshot: { ...observed.value, files: selected } },
    ));
    assert.equal(built._tag, 'Ok', JSON.stringify(built._tag === 'Err' ? built.error : 'ok'));
    if (built._tag === 'Ok') {
      // Full candidate inventory in the selected subset: the exact-name
      // path must find the declaration even when unrelated candidates exist.
      const actual = makeCodebaseMemoryGraph({ rootPath: root, candidates: () => built.value.index.candidates, timeoutMs: 165_000 });
      try {
        assert.equal((await Effect.runPromise(actual.reindex()))._tag, 'Ok');
        const named = await Effect.runPromise(actual.search({ query: 'Find makeNativeCbmContextProvider in src/adapters/native-cbm-context-provider.ts.', limit: 6 }));
        assert.equal(named._tag, 'Ok');
        if (named._tag === 'Ok') assert.ok(named.value.some((item) => item.candidate.repoPath === path
          && item.candidate.symbolName === 'makeNativeCbmContextProvider'));
      } finally { await actual.close(); }
      assert.ok(built.value.index.candidates.length > 30,
        'native CBM must supply useful real ACE code candidates');
      assert.ok(built.value.index.candidates.some((item) =>
        item.repoPath === 'src/adapters/native-cbm-context-provider.ts'));
    }
  } finally {
    await provider.close();
  }
});
