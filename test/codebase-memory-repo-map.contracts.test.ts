import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Effect } from 'effect';
import { makeCodebaseMemoryRepoMap, parseCodebaseMemorySemanticRows } from '../src/adapters/codebase-memory-repo-map.js';
import type { CodeCandidate } from '../src/domain/retrieval.js';

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

test('installed Codebase Memory indexes ACE and returns source-bound candidates', {
  skip: process.env.ACE_TEST_REAL_CBM !== 'true',
  timeout: 180_000,
}, async () => {
  // Use an actual ACE file rather than a synthetic benchmark corpus. The
  // upstream binary does all parsing, graph construction and semantic search.
  const root = resolve(process.cwd());
  const path = 'src/application/ast-grep-parity.ts';
  const data = readFileSync(resolve(root, path), 'utf8');
  const lines = data.split('\n');
  const line = lines.findIndex((item) => item.startsWith('export const compareStructuralAnalyses'));
  assert.ok(line >= 0);
  const candidate: CodeCandidate = {
    candidateId: 'real-codebase-memory-contract' as CodeCandidate['candidateId'],
    workspaceId: 'ace-integration-smoke' as CodeCandidate['workspaceId'],
    repoPath: path as CodeCandidate['repoPath'],
    range: { startLine: line + 1, endLine: line + 1 },
    symbolName: 'compareStructuralAnalyses',
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
  const found = await Effect.runPromise(provider.search({ query: 'compareStructuralAnalyses function', limit: 100 }));
  assert.equal(found._tag, 'Ok', JSON.stringify(found));
  if (found._tag === 'Ok') {
    assert.ok(found.value.length > 0, 'native CBM must discover at least one matching ACE symbol');
    assert.ok(found.value.every((item) => item.candidate.candidateId === candidate.candidateId));
  }
});
