import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Effect } from 'effect';
import { applyRepoMapPrior, makeQdrantContextProvider } from '../src/adapters/qdrant-context-provider.js';
import { resolveExplicitSourceRequirements, type SourceRequirements } from '../src/domain/source-coverage.js';
import { ok } from '../src/domain/result.js';
import { makeCandidateId, makeCodeCandidate, type RankedCandidate } from '../src/domain/retrieval.js';
import { makeWorkspaceId } from '../src/domain/workspace.js';
import { makeRepoMapSymbol, measureRepoMapShortlist } from '../src/domain/repo-map.js';
import type {
  CodeCandidatePort, SemanticAnalysisPort, WorkspaceFilePort,
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
    files: filePort, qdrant, semantics, repoMap,
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
    sourceRequirements: repoMapPlan(['code']),
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

test('AR08 pinned multi-file target outside Qdrant top-K is measured, not fabricated as RepoMap code evidence', () => {
  const candidates = Array.from({ length: 8 }, (_, index) => {
    const candidate = ranked(`candidate-${index + 1}`, index + 1, 0.9 - index / 10);
    return {
      ...candidate,
      candidate: {
        ...candidate.candidate,
        repoPath: `src/module-${index + 1}.ts` as never,
        sourceDigest: String(index + 1).repeat(64) as never,
      },
    };
  });
  const baseline = candidates.slice(0, 3);
  const widened = candidates;
  const target = candidates[6]!;
  const report = measureRepoMapShortlist(
    baseline.map(({ candidate }) => ({
      candidateId: candidate.candidateId, repoPath: candidate.repoPath, sourceDigest: candidate.sourceDigest,
    })),
    widened.map(({ candidate }) => ({
      candidateId: candidate.candidateId, repoPath: candidate.repoPath, sourceDigest: candidate.sourceDigest,
    })),
    [target.candidate.candidateId],
    [{ repoPath: target.candidate.repoPath, sourceDigest: target.candidate.sourceDigest }],
  );
  assert.equal(report.boundary, 'qdrant_shortlist_not_verified_delivery');
  assert.equal(report.baselineDistinctSources, 3);
  assert.equal(report.overfetchDistinctSources, 8);
  assert.equal(report.relevantCandidateRecallAtBaseline, 0);
  assert.equal(report.relevantCandidateRecallAtOverfetch, 1);
  assert.equal(report.relevantSourceRecallAtBaseline, 0);
  assert.equal(report.relevantSourceRecallAtOverfetch, 1);
  assert.deepEqual(report.relevantSourcePathsOutsideBaseline, [target.candidate.repoPath]);
  assert.deepEqual(report.relevantCandidateIdsOutsideBaseline, [target.candidate.candidateId]);
  const mapHint = {
    ranked: [{
      symbol: makeRepoMapSymbol({
        repoPath: target.candidate.repoPath,
        name: target.candidate.symbolName ?? 'target',
        kind: 'function',
        sourceDigest: target.candidate.sourceDigest,
        range: target.candidate.range, text: target.candidate.text,
        references: [],
      }),
      score: 100,
    }],
    rendered: `${target.candidate.repoPath}: target`,
    estimatedTokens: 8,
    truncated: false,
  };
  const delivered = applyRepoMapPrior(baseline, mapHint, 3);
  assert.equal(delivered.length, 3);
  assert.equal(delivered.some((item) => item.candidate.repoPath === target.candidate.repoPath), false,
    'a RepoMap reference to an unshortlisted path MUST NOT appear as verified code');
});

test('AR08 source identity must include digest; no path-only or missing-label recall claim', () => {
  const current = ranked('fresh', 1, 0.7);
  const one = [{
    candidateId: current.candidate.candidateId,
    repoPath: current.candidate.repoPath,
    sourceDigest: current.candidate.sourceDigest,
  }];
  const unlabeled = measureRepoMapShortlist([], one, [current.candidate.candidateId]);
  assert.equal(unlabeled.relevantSourceRecallAtOverfetch, null, 'missing labels mean unknown, not a fake zero');
  assert.equal(unlabeled.relevantCandidateRecallAtOverfetch, 1);
  const staleLabel = measureRepoMapShortlist([], one, [current.candidate.candidateId], [{
    repoPath: current.candidate.repoPath, sourceDigest: 'b'.repeat(64) as never,
  }]);
  assert.equal(staleLabel.relevantSourceRecallAtOverfetch, 0);
  assert.deepEqual(staleLabel.relevantSourcePathsOutsideBaseline, []);
  const rerankedAway = measureRepoMapShortlist(
    one,
    [{ ...one[0]!, candidateId: 'other', sourceDigest: 'b'.repeat(64) as never }],
    [current.candidate.candidateId],
  );
  assert.deepEqual(rerankedAway.baselineCandidatesNotInOverfetch, [current.candidate.candidateId],
    'changing Qdrant fusion depth can reorder/drop a previously observed top-K hit');
});

test('AR08 an indexed revision change is not falsely counted as discovering a new repository path', () => {
  const a = [{
    candidateId: 'old',
    repoPath: 'src/unchanged-name.ts' as never,
    sourceDigest: 'a'.repeat(64) as never,
  }];
  const b = [{
    candidateId: 'new',
    repoPath: a[0]!.repoPath,
    sourceDigest: 'b'.repeat(64) as never,
  }];
  const report = measureRepoMapShortlist(a, b, ['new'], [{
    repoPath: b[0]!.repoPath, sourceDigest: b[0]!.sourceDigest,
  }]);
  assert.deepEqual(report.extraSourcePaths, [],
    'same path with a different digest is source drift, not path diversity');
  assert.equal(report.baselineDistinctPaths, 1);
  assert.equal(report.overfetchDistinctPaths, 1);
  assert.equal(report.relevantSourceRecallAtBaseline, 0);
  assert.equal(report.relevantSourceRecallAtOverfetch, 1);
  assert.deepEqual(report.extraSourceRevisions, [{
    repoPath: b[0]!.repoPath, sourceDigest: b[0]!.sourceDigest,
  }]);
});
