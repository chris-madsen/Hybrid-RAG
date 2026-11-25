import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect } from 'effect';
import { makeNativeCbmContextProvider } from '../src/adapters/native-cbm-context-provider.js';
import { domainError } from '../src/domain/errors.js';
import { ok, type Result } from '../src/domain/result.js';
import { makeWorkspaceId } from '../src/domain/workspace.js';
import type {
  CodeGraphCandidatePort,
  SemanticAnalysisPort,
  WorkspaceFilePort,
} from '../src/application/ports.js';
import { workspaceManifestFromSnapshot } from '../src/domain/workspace-manifest.js';
import { resolveExplicitSourceRequirements } from '../src/domain/source-coverage.js';

const mustOk = <T, E>(value: Result<T, E>): T => {
  assert.equal(value._tag, 'Ok');
  if (value._tag === 'Err') throw new Error(String(value.error));
  return value.value;
};

const workspaceId = mustOk(makeWorkspaceId('native-zero-hit-race'));

const files: WorkspaceFilePort = {
  canonicalizeRoot: () => Effect.succeed(ok('/repo')),
  snapshot: () => { throw new Error('snapshot is not required without workspaceManifest'); },
  readExact: () => Effect.succeed(err(domainError('FILE_NOT_FOUND', 'unused', 'no candidates expected'))),
};


const semantics: SemanticAnalysisPort = {
  definition: () => Effect.succeed(ok([])),
  references: () => Effect.succeed(ok([])),
  typeInfo: () => Effect.succeed(ok(undefined)),
  diagnostics: () => Effect.succeed(ok([])),
};

test('zero native hits never certify absence and a concurrent source change fails closed', async () => {
  let mutated = false;
  let mutateOnQuery = true;
  const initial = { headRevision: 'unavailable', files: [], removedPaths: [] };
  const manifest = workspaceManifestFromSnapshot(initial, 'scope');
  const codeGraph: CodeGraphCandidatePort = {
    search: () => Effect.sync(() => {
      if (mutateOnQuery) mutated = true;
      return ok([]);
    }),
  };
  const provider = makeNativeCbmContextProvider({
    mode: 'cbm', workspaceId, rootPath: '/repo', semantics, codeGraph,
    workspaceManifest: manifest, indexKey: 'initial', newRequestId: () => 'zero-hit',
    files: { ...files, snapshot: () => Effect.sync(() => ok(mutated ? {
      ...initial, files: [{ repoPath: 'src/new.ts' as never, digest: 'a'.repeat(64) as never,
        sizeBytes: 5, state: 'untracked' as const, observedAtMs: 1 }],
    } : initial)) },
  });
  const input = { workspaceId, query: 'find new source', includeDocs: false, includeMemory: false,
    sourceRequirements: mustOk(resolveExplicitSourceRequirements({ required: ['code'] })) };
  const raced = await Effect.runPromise(provider.search(input));
  assert.equal(raced._tag, 'Err');
  if (raced._tag === 'Err') assert.equal(raced.error.code, 'WORKTREE_RACED');
  mutated = false;
  mutateOnQuery = false;
  const empty = mustOk(await Effect.runPromise(provider.search(input)));
  assert.equal(empty.complete, false);
  assert.deepEqual(empty.evidence, []);
});
