import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect } from 'effect';
import { makeQdrantContextProvider } from '../src/adapters/qdrant-context-provider.js';
import { domainError } from '../src/domain/errors.js';
import { ok, type Result } from '../src/domain/result.js';
import { makeWorkspaceId } from '../src/domain/workspace.js';
import type {
  ArtifactStore,
  CodeCandidatePort,
  SemanticAnalysisPort,
  SparseEmbeddingPort,
  VectorEmbeddingPort,
  WorkspaceFilePort,
} from '../src/application/ports.js';
import type { CodeRetrievalStrategy } from '../src/domain/retrieval.js';
import { workspaceManifestFromFiles } from '../src/domain/workspace-manifest.js';
import type { WorkspaceSync, WorkspaceSyncState } from '../src/application/workspace-sync.js';

const mustOk = <T, E>(value: Result<T, E>): T => {
  assert.equal(value._tag, 'Ok');
  if (value._tag === 'Err') throw new Error(String(value.error));
  return value.value;
};

const workspaceId = mustOk(makeWorkspaceId('retrieval-strategy-ablation'));

const files: WorkspaceFilePort = {
  canonicalizeRoot: () => Effect.succeed(ok('/repo')),
  snapshot: () => { throw new Error('snapshot is not required without workspaceManifest'); },
  readExact: () => Effect.succeed(err(domainError('FILE_NOT_FOUND', 'unused', 'no candidates expected'))),
};

const artifacts: ArtifactStore = {
  storeExact: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'unused', 'no candidates expected'))),
  readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'unused', 'not used'))),
};

const semantics: SemanticAnalysisPort = {
  definition: () => Effect.succeed(ok([])),
  references: () => Effect.succeed(ok([])),
  typeInfo: () => Effect.succeed(ok(undefined)),
  diagnostics: () => Effect.succeed(ok([])),
};

const run = async (strategy: CodeRetrievalStrategy): Promise<{
  readonly embeddingCalls: number;
  readonly sparseQueryCalls: number;
  readonly observed: Parameters<CodeCandidatePort['search']>[0] | undefined;
}> => {
  let embeddingCalls = 0;
  let sparseQueryCalls = 0;
  let observed: Parameters<CodeCandidatePort['search']>[0] | undefined;
  const embeddings: VectorEmbeddingPort = {
    embedMany: () => {
      embeddingCalls += 1;
      return Effect.succeed(ok([[0.25, 0.75]]));
    },
  };
  const sparseEmbeddings: SparseEmbeddingPort = {
    embedDocuments: () => Effect.succeed(ok([])),
    embedQueries: () => {
      sparseQueryCalls += 1;
      return Effect.succeed(ok([{ indices: [2, 7], values: [1.4, 0.6] }]));
    },
  };
  const qdrant: CodeCandidatePort = {
    upsert: () => Effect.succeed(ok(undefined)),
    search: (input) => {
      observed = input;
      return Effect.succeed(ok([]));
    },
  };
  const provider = makeQdrantContextProvider({
    workspaceId,
    rootPath: '/repo',
    files,
    qdrant,
    embeddings,
    sparseEmbeddings,
    artifacts,
    semantics,
    retrievalStrategy: strategy,
    newRequestId: () => `strategy-${strategy}`,
  });
  const result = await Effect.runPromise(provider.search({
    workspaceId,
    query: 'find exact ACE_QDRANT_COLLECTION usage',
    includeDocs: false,
    includeMemory: false,
  }));
  assert.equal(result._tag, 'Err', 'unsnapshotted zero-hit code retrieval cannot certify source absence');
  if (result._tag === 'Err') assert.equal(result.error.code, 'NOT_READY');
  return { embeddingCalls, sparseQueryCalls, observed };
};

test('sparse-only context retrieval skips dense query embedding entirely', async () => {
  const result = await run('sparse');
  assert.equal(result.embeddingCalls, 0);
  assert.equal(result.sparseQueryCalls, 1);
  assert.equal(result.observed?.strategy, 'sparse');
  assert.equal(result.observed?.queryText, 'find exact ACE_QDRANT_COLLECTION usage');
  assert.equal(result.observed?.vector, undefined);
  assert.deepEqual(result.observed?.sparseVector, { indices: [2, 7], values: [1.4, 0.6] });
});

test('dense-only context retrieval computes a dense query vector through the same production adapter', async () => {
  const result = await run('dense');
  assert.equal(result.embeddingCalls, 1);
  assert.equal(result.sparseQueryCalls, 0);
  assert.equal(result.observed?.strategy, 'dense');
  assert.deepEqual(result.observed?.vector, [0.25, 0.75]);
});

test('hybrid RRF context retrieval computes dense query vector and preserves lexical query text', async () => {
  const result = await run('hybrid_rrf');
  assert.equal(result.embeddingCalls, 1);
  assert.equal(result.sparseQueryCalls, 1);
  assert.equal(result.observed?.strategy, 'hybrid_rrf');
  assert.deepEqual(result.observed?.vector, [0.25, 0.75]);
  assert.deepEqual(result.observed?.sparseVector, { indices: [2, 7], values: [1.4, 0.6] });
  assert.equal(result.observed?.queryText, 'find exact ACE_QDRANT_COLLECTION usage');
});


test('zero-hit code search detects source mutation after vector retrieval and before empty certification', async () => {
  const initialManifest = workspaceManifestFromFiles({
    headRevision: 'unavailable', scopeFingerprint: 'scope', files: [],
  });
  const changedManifest = workspaceManifestFromFiles({
    headRevision: 'unavailable', scopeFingerprint: 'scope',
    files: [{
      repoPath: 'src/new.ts' as never, sourceDigest: 'a'.repeat(64) as never,
      sizeBytes: 5, state: 'untracked',
    }],
  });
  let mutatedDuringQuery = false;
  let observations = 0;
  const workspaceSync: WorkspaceSync = {
    initialize: () => Effect.succeed(ok({
      workspaceId, workspaceManifest: initialManifest,
      generation: 1, indexKey: 'index-one', candidateIdsByPath: new Map(),
    })),
    refresh: () => {
      observations += 1;
      const state: WorkspaceSyncState = {
        workspaceId,
        workspaceManifest: mutatedDuringQuery ? changedManifest : initialManifest,
        generation: mutatedDuringQuery ? 2 : 1,
        indexKey: mutatedDuringQuery ? 'index-two' : 'index-one',
        candidateIdsByPath: new Map(),
      };
      return Effect.succeed(ok({
        state,
        delta: { changed: [], added: mutatedDuringQuery ? ['src/new.ts' as never] : [],
          deleted: [], renamed: [], scopeChanged: false },
        refreshed: mutatedDuringQuery,
      }));
    },
    refreshExact: () => { throw new Error('not used'); },
  };
  const qdrant: CodeCandidatePort = {
    upsert: () => Effect.succeed(ok(undefined)),
    search: () => {
      mutatedDuringQuery = true;
      return Effect.succeed(ok([]));
    },
  };
  const provider = makeQdrantContextProvider({
    workspaceId, rootPath: '/repo', files, qdrant, artifacts, semantics,
    embeddings: { embedMany: () => Effect.succeed(ok([[0.25, 0.75]])) },
    workspaceManifest: initialManifest, workspaceSync,
    indexKey: 'index-one', newRequestId: () => 'empty-race',
  });
  const result = await Effect.runPromise(provider.search({
    workspaceId, query: 'new source after initial observation',
    includeDocs: false, includeMemory: false,
  }));
  assert.equal(result._tag, 'Err');
  if (result._tag === 'Err') assert.equal(result.error.code, 'NOT_READY');
  assert.equal(observations, 2, 'source must be observed both before and after zero-hit retrieval');
});
