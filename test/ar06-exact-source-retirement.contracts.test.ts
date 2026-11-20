import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Effect } from 'effect';
import { makeFileArtifactStore } from '../src/adapters/file-artifact-store.js';
import { makeQdrantContextProvider } from '../src/adapters/qdrant-context-provider.js';
import { resolveExplicitSourceRequirements } from '../src/domain/source-coverage.js';
import { makeCandidateId, makeCodeCandidate } from '../src/domain/retrieval.js';
import { ok } from '../src/domain/result.js';
import { makeWorkspaceId } from '../src/domain/workspace.js';
import type { CodeCandidatePort, SemanticAnalysisPort, WorkspaceFilePort } from '../src/application/ports.js';

test('AR06 N identical verified Qdrant lookups do not persist any private source artifact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-ar06-retirement-'));
  try {
    const artifactsRoot = join(root, 'legacy-artifacts');
    const workspace = makeWorkspaceId('ar06-repeated-lookup');
    const candidateId = makeCandidateId('ar06-code-candidate');
    const requirements = resolveExplicitSourceRequirements({ required: ['code'], optional: [] });
    if (workspace._tag === 'Err' || candidateId._tag === 'Err' || requirements._tag === 'Err') {
      throw new Error('invalid AR06 fixture identities');
    }
    const source = 'export function originalSource() { return 42; }\n';
    const sourceDigest = createHash('sha256').update(source).digest('hex');
    const path = 'src/original.ts' as never;
    const candidate = makeCodeCandidate({
      candidateId: candidateId.value,
      workspaceId: workspace.value,
      repoPath: path,
      range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: Buffer.byteLength(source.trimEnd()) + 1 },
      symbolName: 'originalSource',
      text: source.trimEnd(),
      sourceDigest: sourceDigest as never,
      generation: 1 as never,
      indexedAtMs: 1,
    });
    if (candidate._tag === 'Err') throw new Error(candidate.error.message);
    let exactReads = 0;
    const files: WorkspaceFilePort = {
      canonicalizeRoot: () => Effect.succeed(ok('/repo')),
      snapshot: () => { throw new Error('snapshot not needed for verified fixture'); },
      observeChanges: () => { throw new Error('observation not needed for verified fixture'); },
      readExact: () => {
        exactReads += 1;
        return Effect.succeed(ok({ bytes: Buffer.from(source), digest: sourceDigest as never }));
      },
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
    // Deliberate legacy extra property: pre-AR06 Qdrant code writes a new UUID
    // full-file artifact through this port per request; AR06 must ignore it.
    const provider = makeQdrantContextProvider({
      workspaceId: workspace.value,
      rootPath: '/repo',
      files,
      qdrant,
      semantics,
      embeddings: { embedMany: () => Effect.succeed(ok([[0.3, 0.7]])) },
      newRequestId: () => 'ar06-request',
      artifacts: makeFileArtifactStore(artifactsRoot),
    });
    for (let index = 0; index < 12; index += 1) {
      const result = await Effect.runPromise(provider.search({
        workspaceId: workspace.value,
        query: 'originalSource',
        includeCode: true,
        includeDocs: false,
        includeMemory: false,
        sourceRequirements: requirements.value,
      }));
      assert.equal(result._tag, 'Ok');
      if (result._tag === 'Err') throw new Error(result.error.message);
      const item = result.value.evidence.find((entry) => entry.source === 'code');
      assert.ok(item, 'the source must still be delivered');
      assert.equal(item.content, source.trimEnd());
      assert.equal(item.sourceDigest, sourceDigest);
      assert.equal(item.expansionHandle, undefined, 'do not publish unreachable UUID expansion references');
    }
    assert.ok(exactReads >= 12, 'freshness still requires exact workspace reads');
    assert.deepEqual(await readdir(root), [], 'N requests must create zero full-file private artifact copies');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
