import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Effect } from 'effect';
import { applyRepoMapPrior, makeQdrantContextProvider } from '../src/adapters/qdrant-context-provider.js';
import { domainError } from '../src/domain/errors.js';
import { resolveExplicitSourceRequirements, type SourceRequirements } from '../src/domain/source-coverage.js';
import { ok, err } from '../src/domain/result.js';
import { makeCandidateId, makeCodeCandidate, type RankedCandidate } from '../src/domain/retrieval.js';
import { makeWorkspaceId } from '../src/domain/workspace.js';
import { makeRepoMapSymbol } from '../src/domain/repo-map.js';
import type {
  ArtifactStore, CodeCandidatePort, SemanticAnalysisPort, WorkspaceFilePort,
} from '../src/application/ports.js';
import type { RepoMapService } from '../src/application/repo-map-service.js';

const ranked = (name: string, line: number, score: number): RankedCandidate => ({
  candidate: {
    candidateId: `${name}-candidate` as never,
    workspaceId: 'workspace' as never,
    repoPath: 'src/example.ts' as never,
    range: { startLine: line, startColumn: 1, endLine: line, endColumn: name.length + 1 },
    symbolName: name,
    structuralKind: 'function',
    text: `function ${name}() {}`,
    sourceDigest: 'a'.repeat(64) as never,
    generation: 1 as never,
    indexedAtMs: 1,
    invalidated: false,
  },
  score,
  freshness: 'current',
});

test('RepoMap prior reorders canonical source ranges without replacing Qdrant scores', () => {
  const first = ranked('first', 1, 0.7);
  const second = ranked('second', 2, 0.69);
  const result = applyRepoMapPrior(
    [first, second],
    {
      ranked: [{
        symbol: makeRepoMapSymbol({
          repoPath: 'src/example.ts' as never,
          name: 'second',
          kind: 'function',
          sourceDigest: 'a'.repeat(64) as never,
          range: second.candidate.range,
          text: second.candidate.text,
          references: [],
        }),
        score: 1,
      }],
      rendered: 'src/example.ts:2 function second',
      estimatedTokens: 8,
      truncated: false,
    },
    2,
  );
  assert.equal(result[0]?.candidate.symbolName, 'second');
  assert.equal(result[0]?.score, 0.74);
  assert.equal(result[1]?.candidate.symbolName, 'first');
});


test('RepoMap never boosts a candidate using a different source digest at the same path and range', () => {
  const current = ranked('current', 1, 0.4);
  const staleSymbol = makeRepoMapSymbol({
    repoPath: current.candidate.repoPath,
    name: 'current',
    kind: 'function',
    sourceDigest: 'b'.repeat(64) as never,
    range: current.candidate.range,
    text: current.candidate.text,
    references: [],
  });
  const result = applyRepoMapPrior(
    [current],
    {
      ranked: [{ symbol: staleSymbol, score: 1 }],
      rendered: '',
      estimatedTokens: 0,
      truncated: false,
    },
    1,
  );
  assert.equal(result[0]?.score, 0.4);
});


const repoMapPlan = (required: readonly ('code' | 'structural')[], optional: readonly ('code' | 'structural')[] = []): SourceRequirements => {
  const result = resolveExplicitSourceRequirements({ required, optional });
  if (result._tag === 'Err') throw Error(result.error.message);
  return result.value;
};

test('AR02 real Qdrant provider excludes stale RepoMap for code-only and refuses required structural freshness', async () => {
  const workspace = makeWorkspaceId('ar02-repomap-workspace');
  if (workspace._tag === 'Err') throw Error(workspace.error.message);
  const source = 'export function safe() { return true; }\n';
  const digest = createHash('sha256').update(source).digest('hex');
  const file = 'src/safe.ts' as never;
  const candidateId = makeCandidateId('safe-candidate');
  if (candidateId._tag === 'Err') throw Error(candidateId.error.message);
  const candidate = makeCodeCandidate({
    candidateId: candidateId.value, workspaceId: workspace.value,
    repoPath: file, range: {
      startLine: 1, startColumn: 1, endLine: 1, endColumn: Buffer.byteLength(source.trimEnd()) + 1,
    },
    symbolName: 'safe', text: source.trimEnd(),
    sourceDigest: digest as never, generation: 1 as never, indexedAtMs: 1,
  });
  if (candidate._tag === 'Err') throw Error(candidate.error.message);
  const filePort: WorkspaceFilePort = {
    canonicalizeRoot: () => Effect.succeed(ok('/repo')),
    snapshot: () => { throw Error('nonempty code evidence needs no full workspace snapshot'); },
    observeChanges: () => { throw Error('no metadata observer in this fixture'); },
    readExact: () => Effect.succeed(ok({ bytes: Buffer.from(source), digest: digest as never })),
  };
  const artifacts: ArtifactStore = {
    storeExact: () => Effect.succeed(ok({
      handle: 'source-fixture', digest: digest as never, sizeBytes: Buffer.byteLength(source),
    })),
    readRange: () => Effect.succeed(err(domainError('ARTIFACT_NOT_FOUND', 'handle', 'not used'))),
  };
  const qdrant: CodeCandidatePort = {
    upsert: () => Effect.succeed(ok(undefined)),
    search: () => Effect.succeed(ok([{ candidate: candidate.value, score: 0.8, freshness: 'current' }])),
  };
  const semantics: SemanticAnalysisPort = {
    definition: () => Effect.succeed(ok([])),
    references: () => Effect.succeed(ok([])),
    typeInfo: () => Effect.succeed(ok(undefined)),
    diagnostics: () => Effect.succeed(ok([])),
  };
  let mapRenders = 0;
  const staleMap = 'src/stale.ts:1 SECRET_STALE_MAP_MUST_NOT_REACH_MODEL';
  const repoMap: RepoMapService = {
    update: () => Effect.succeed(ok(undefined)),
    render: () => {
      mapRenders += 1;
      return Effect.succeed(ok({
        ranked: [], rendered: staleMap, estimatedTokens: 14, truncated: false,
      }));
    },
  };
  const provider = makeQdrantContextProvider({
    workspaceId: workspace.value, rootPath: '/repo',
    files: filePort, artifacts, qdrant, semantics, repoMap,
    embeddings: { embedMany: () => Effect.succeed(ok([[0.2, 0.8]])) },
    newRequestId: () => 'ar02-test-request',
  });
  const search = (sourceRequirements: SourceRequirements) => Effect.runPromise(provider.search({
    workspaceId: workspace.value, query: 'safe', includeCode: true,
    includeDocs: false, includeMemory: false, sourceRequirements,
  }));

  const codeOnly = await search(repoMapPlan(['code']));
  assert.equal(codeOnly._tag, 'Ok');
  if (codeOnly._tag === 'Err') return;
  assert.equal(mapRenders, 0, 'source code alone never grants RepoMap rendering');
  assert.equal(codeOnly.value.complete, true);
  assert.deepEqual(codeOnly.value.evidence.map((item) => item.source), ['code']);
  assert.equal(JSON.stringify(codeOnly.value.evidence).includes(staleMap), false);
  assert.equal(codeOnly.value.sourceCoverage?.find((x) => x.source === 'structural')?.status, 'not_requested');

  const requiredMap = await search(repoMapPlan(['code', 'structural']));
  assert.equal(requiredMap._tag, 'Ok');
  if (requiredMap._tag === 'Err') return;
  assert.equal(mapRenders, 1, 'an explicitly required structural source is queried');
  assert.equal(requiredMap.value.complete, false, 'unverified map never upgrades required source to ready');
  assert.ok(requiredMap.value.partialSources.includes('structural'));
  assert.equal(requiredMap.value.sourceCoverage?.find((x) => x.source === 'structural')?.status, 'partial');
  assert.deepEqual(requiredMap.value.evidence.map((item) => item.source), ['code']);
  assert.equal(JSON.stringify(requiredMap.value.evidence).includes(staleMap), false);

  const optionalMap = await search(repoMapPlan(['code'], ['structural']));
  assert.equal(optionalMap._tag, 'Ok');
  if (optionalMap._tag === 'Ok') {
    assert.equal(optionalMap.value.complete, true, 'optional unverified source cannot block verified code');
    assert.deepEqual(optionalMap.value.evidence.map((item) => item.source), ['code']);
  }
  assert.equal(mapRenders, 2);
});
