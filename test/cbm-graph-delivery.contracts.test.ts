import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Effect } from 'effect';
import { makeNativeCbmContextProvider, makeQdrantContextProvider, type NativeCbmContextConfig } from '../src/adapters/qdrant-context-provider.js';
import { resolveExplicitSourceRequirements } from '../src/domain/source-coverage.js';
import { err, ok } from '../src/domain/result.js';
import { domainError } from '../src/domain/errors.js';
import { makeCandidateId, makeCodeCandidate } from '../src/domain/retrieval.js';
import { makeWorkspaceId, type WorkspaceSnapshot } from '../src/domain/workspace.js';
import { workspaceManifestFromSnapshot } from '../src/domain/workspace-manifest.js';
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
  // The new native path must not require any vector/embedding client.
  const native = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId: workspace.value, rootPath: '/repo', files: filePort, semantics,
    codeGraph: {
      search: () => Effect.succeed(ok([
        { candidate: related, score: 0.95, freshness: 'unknown' },
        { candidate: known, score: 0.8, freshness: 'unknown' },
      ])),
    },
    candidateLimit: 2,
    newRequestId: () => 'native-cbm-discovery-request',
  });
  reads.length = 0;
  const nativeInput = {
    workspaceId: workspace.value,
    query: 'follow related implementation',
    includeCode: true, includeDocs: false, includeMemory: false,
    sourceRequirements: sourcePlan(),
  };
  const nativeResult = await Effect.runPromise(native.search(nativeInput));
  assert.equal(nativeResult._tag, 'Ok');
  if (nativeResult._tag === 'Err') return;
  assert.equal(nativeResult.value.complete, true);
  assert.deepEqual(new Set(reads), new Set(['src/known.ts', 'src/related.ts']));
  assert.equal(nativeResult.value.evidence.filter((item) => item.source === 'code'
    && item.proofClass === 'direct').length, 2);

  // Native publication must be recovered even when the exact source manifest
  // is unchanged; an uncited changed file must invalidate the final shortlist.
  const snapshot: WorkspaceSnapshot = {
    headRevision: 'fixture-head', removedPaths: [], gitStatus: 'available',
    files: [known, related].map((candidate) => ({
      repoPath: candidate.repoPath, digest: candidate.sourceDigest,
      sizeBytes: Buffer.byteLength(content[candidate.repoPath as keyof typeof content]),
      state: 'tracked', observedAtMs: 1,
    })),
  };
  const manifest = workspaceManifestFromSnapshot(snapshot, 'fixture-scope');
  let published = false;
  let reconciliations = 0;
  let mutateUncitedOnSearch = false;
  let currentSnapshot = snapshot;
  const recoveryConfig: NativeCbmContextConfig = {
    mode: 'cbm', workspaceId: workspace.value, rootPath: '/repo', semantics,
    files: { ...filePort, snapshot: () => Effect.sync(() => ok(currentSnapshot)) },
    workspaceManifest: manifest, indexKey: 'fixture-index',
    isPublished: () => published,
    reconcile: (currentManifest) => Effect.sync(() => {
      assert.equal(currentManifest.contentIdentity, manifest.contentIdentity);
      reconciliations += 1;
      published = true;
      return ok(recoveryConfig);
    }),
    codeGraph: { search: () => Effect.sync(() => {
      if (mutateUncitedOnSearch) currentSnapshot = {
        ...snapshot,
        files: snapshot.files.map((file) => file.repoPath === related.repoPath
          ? { ...file, digest: createHash('sha256').update('changed uncited file').digest('hex') as never }
          : file),
      };
      return ok([{ candidate: known, score: 0.9, freshness: 'unknown' as const }]);
    }) },
    newRequestId: () => 'native-recovery-fence-request',
  };
  const recoveryProvider = makeNativeCbmContextProvider(recoveryConfig);
  const recovered = await Effect.runPromise(recoveryProvider.search(nativeInput));
  assert.equal(recovered._tag, 'Ok');
  if (recovered._tag === 'Ok') assert.equal(recovered.value.complete, true);
  assert.equal(reconciliations, 1, 'session loss on an unchanged manifest requires re-publication');
  mutateUncitedOnSearch = true;
  const raced = await Effect.runPromise(recoveryProvider.search(nativeInput));
  assert.equal(raced._tag, 'Err', 'a changed uncited file invalidates native shortlist freshness');
  if (raced._tag === 'Err') assert.equal(raced.error.code, 'WORKTREE_RACED');
  assert.equal(reconciliations, 1);

  const nativeFailure = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId: workspace.value, rootPath: '/repo', files: filePort, semantics,
    codeGraph: { search: () => Effect.succeed(err(domainError('NOT_READY', 'cbm', 'provider lost'))) },
    newRequestId: () => 'native-cbm-unavailable-request',
  });
  reads.length = 0;
  const blocked = await Effect.runPromise(nativeFailure.search(nativeInput));
  assert.equal(blocked._tag, 'Ok');
  if (blocked._tag === 'Err') return;
  assert.equal(blocked.value.complete, false);
  assert.equal(blocked.value.evidence.length, 0);
  assert.equal(reads.length, 0);

  const unmapped = makeNativeCbmContextProvider({
    mode: 'cbm',
    workspaceId: workspace.value, rootPath: '/repo', files: filePort, semantics,
    codeGraph: { search: () => Effect.succeed(ok([])) },
    newRequestId: () => 'native-cbm-no-hints-request',
  });
  const emptyResult = await Effect.runPromise(unmapped.search(nativeInput));
  assert.equal(emptyResult._tag, 'Ok');
  if (emptyResult._tag === 'Err') return;
  assert.equal(emptyResult.value.complete, false, 'unmapped top-k is not a verified empty result');

  const documentSymbolsLookups: string[] = [];
  const definitionsLookups: string[] = [];
  const semanticSelection: SemanticAnalysisPort = {
    ...semantics,
    documentSymbols: (input) => {
      documentSymbolsLookups.push(input.repoPath);
      return Effect.succeed(ok([{
        name: input.repoPath === 'src/known.ts' ? 'known' : 'related',
        location: { repoPath: input.repoPath, startLine: 1, startColumn: 17,
          endLine: 1, endColumn: input.repoPath === 'src/known.ts' ? 22 : 24 },
      }]));
    },
    definition: (input) => {
      definitionsLookups.push(input.repoPath);
      return Effect.succeed(ok([{
        location: { repoPath: input.repoPath, startLine: 1, startColumn: 17,
          endLine: 1, endColumn: input.repoPath === 'src/known.ts' ? 22 : 24 },
      }]));
    },
  };
  const lspProvider = makeQdrantContextProvider({
    workspaceId: workspace.value,
    rootPath: '/repo',
    files: filePort, qdrant,
    semantics: semanticSelection,
    embeddings: { embedMany: () => Effect.succeed(ok([[0.2, 0.8]])) },
    codeGraph: {
      search: () => Effect.succeed(ok([{ candidate: related, score: 0.95, freshness: 'unknown' }])),
    },
    candidateLimit: 2,
    newRequestId: () => 'cbm-native-lsp-anchor',
  });
  const required = resolveExplicitSourceRequirements({ required: ['code', 'lsp'] });
  assert.equal(required._tag, 'Ok');
  if (required._tag === 'Err') return;
  const verifiedWithLsp = await Effect.runPromise(lspProvider.search({
    workspaceId: workspace.value,
    query: 'follow related implementation',
    includeCode: true, includeDocs: false, includeMemory: false,
    sourceRequirements: required.value,
  }));
  assert.equal(verifiedWithLsp._tag, 'Ok');
  if (verifiedWithLsp._tag === 'Err') return;
  assert.deepEqual(new Set(documentSymbolsLookups), new Set(['src/known.ts', 'src/related.ts']));
  assert.deepEqual(new Set(definitionsLookups), new Set(['src/known.ts', 'src/related.ts']));
  assert.equal(verifiedWithLsp.value.sourceCoverage?.find((item) => item.source === 'lsp')?.status,
    'satisfied', 'CBM line-only outlines must not disable LSP coverage');
});

