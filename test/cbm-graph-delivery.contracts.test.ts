import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Effect } from 'effect';
import { makeQdrantContextProvider } from '../src/adapters/qdrant-context-provider.js';
import { resolveExplicitSourceRequirements } from '../src/domain/source-coverage.js';
import { ok } from '../src/domain/result.js';
import { makeCandidateId, makeCodeCandidate } from '../src/domain/retrieval.js';
import { makeWorkspaceId } from '../src/domain/workspace.js';
import type { CodeCandidatePort, SemanticAnalysisPort, WorkspaceFilePort } from '../src/application/ports.js';

const sourcePlan = () => {
  const plan = resolveExplicitSourceRequirements({ required: ['code'] });
  if (plan._tag === 'Err') throw Error(plan.error.message);
  return plan.value;
};

test('CBM discovery adds a file missing from Qdrant shortlist without bypassing source verification', async () => {
  const workspace = makeWorkspaceId('cbm-discovery-workspace');
  assert.equal(workspace._tag, 'Ok');
  if (workspace._tag === 'Err') return;
  const content = {
    'src/known.ts': 'export function known() { return 1; }\n',
    'src/related.ts': 'export function related() { return 2; }\n',
  } as const;
  const makeVerified = (file: keyof typeof content, name: string) => {
    const id = makeCandidateId(name + '-candidate');
    assert.equal(id._tag, 'Ok');
    if (id._tag === 'Err') throw Error(id.error.message);
    const bytes = content[file];
    const candidate = makeCodeCandidate({
      candidateId: id.value,
      workspaceId: workspace.value,
      repoPath: file as never,
      range: {
        startLine: 1, startColumn: 1,
        endLine: 1, endColumn: Buffer.byteLength(bytes.trimEnd()) + 1,
      },
      symbolName: name,
      structuralKind: 'function',
      text: bytes.trimEnd(),
      sourceDigest: createHash('sha256').update(bytes).digest('hex') as never,
      generation: 1 as never,
      indexedAtMs: 1,
    });
    assert.equal(candidate._tag, 'Ok');
    if (candidate._tag === 'Err') throw Error(candidate.error.message);
    return candidate.value;
  };
  const known = makeVerified('src/known.ts', 'known');
  const related = makeVerified('src/related.ts', 'related');
  const reads: string[] = [];
  const filePort: WorkspaceFilePort = {
    canonicalizeRoot: () => Effect.succeed(ok('/repo')),
    snapshot: () => { throw Error('unexpected workspace snapshot in source-only test'); },
    observeChanges: () => { throw Error('unexpected metadata observation in source-only test'); },
    readExact: (_root, path) => {
      reads.push(path);
      const bytes = content[path as keyof typeof content];
      assert.ok(bytes, 'ACE must only read authorized indexed source files');
      return Effect.succeed(ok({
        bytes: Buffer.from(bytes),
        digest: createHash('sha256').update(bytes).digest('hex') as never,
      }));
    },
  };
  const qdrant: CodeCandidatePort = {
    upsert: () => Effect.succeed(ok(undefined)),
    search: () => Effect.succeed(ok([{ candidate: known, score: 0.8, freshness: 'unknown' }])),
  };
  const semantics: SemanticAnalysisPort = {
    definition: () => Effect.succeed(ok([])),
    references: () => Effect.succeed(ok([])),
    typeInfo: () => Effect.succeed(ok(undefined)),
    diagnostics: () => Effect.succeed(ok([])),
  };
  const provider = makeQdrantContextProvider({
    workspaceId: workspace.value,
    rootPath: '/repo',
    files: filePort,
    qdrant,
    semantics,
    embeddings: { embedMany: () => Effect.succeed(ok([[0.2, 0.8]])) },
    codeGraph: {
      search: () => Effect.succeed(ok([{ candidate: related, score: 0.95, freshness: 'unknown' }])),
    },
    candidateLimit: 2,
    newRequestId: () => 'cbm-discovery-request',
  });
  const response = await Effect.runPromise(provider.search({
    workspaceId: workspace.value,
    query: 'follow related implementation',
    includeCode: true,
    includeDocs: false,
    includeMemory: false,
    sourceRequirements: sourcePlan(),
  }));
  assert.equal(response._tag, 'Ok');
  if (response._tag === 'Err') return;
  assert.deepEqual(new Set(reads), new Set(['src/known.ts', 'src/related.ts']));
  const direct = response.value.evidence.filter((evidence) => evidence.source === 'code');
  assert.deepEqual(new Set(direct.map((item) => item.citation)), new Set([
    'src/known.ts:1-1', 'src/related.ts:1-1',
  ]));
  assert.ok(direct.every((item) => item.proofClass === 'direct'));
  assert.ok(direct.some((item) => item.content.includes('function related')));
});

