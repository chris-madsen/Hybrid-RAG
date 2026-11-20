import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { makeLocalQdrantPublicationAuthority } from '../src/adapters/qdrant-publication-authority.js';
import { Effect } from 'effect';
import {
  embeddingContentKey,
  populateQdrantFromStructuralIndex,
  qdrantCollectionName,
  qdrantCurrentAlias,
  resolveQdrantAlias,
  switchQdrantAlias,
} from '../src/adapters/qdrant-context-provider.js';
import { makeCodeCandidate, createCodeIndex } from '../src/domain/retrieval.js';
import { makeWorkspaceId } from '../src/domain/workspace.js';
import { ok } from '../src/domain/result.js';
import type { CodeCandidatePort, HttpPort, VectorEmbeddingPort } from '../src/application/ports.js';
import { makeQdrantSdkTestDouble, makeQdrantSdkTestPort } from './helpers/qdrant-sdk-test-double.js';

const workspace = makeWorkspaceId('qdrant-alias-contract')._tag === 'Ok'
  ? makeWorkspaceId('qdrant-alias-contract').value
  : (() => { throw new Error('workspace fixture is invalid'); })();

test('Qdrant alias publication deletes the old target and creates the verified collection atomically', async () => {
  const requests: Array<{ readonly method: string; readonly url: string; readonly body?: unknown }> = [];
  const http: HttpPort = {
    request: (request) => {
      requests.push(request);
      if (request.method === 'GET') return Effect.succeed(ok({ status: 200, body: { result: { aliases: [{ alias_name: 'ace_ws_emb_current', collection_name: 'old' }] } } }));
      return Effect.succeed(ok({ status: 200, body: { result: true } }));
    },
  };
  const sdk = makeQdrantSdkTestPort(makeQdrantSdkTestDouble(http));
  const result = await Effect.runPromise(switchQdrantAlias(
    'ace_ws_emb_current',
    'ace_ws_emb_new-index',
    sdk,
  ));
  assert.equal(result._tag, 'Ok');
  assert.equal(requests.length, 2);
  assert.equal(requests[1]?.url, 'http://127.0.0.1:6333/collections/aliases');
  assert.deepEqual(requests[1]?.body, {
    actions: [
      { delete_alias: { alias_name: 'ace_ws_emb_current' } },
      { create_alias: { collection_name: 'ace_ws_emb_new-index', alias_name: 'ace_ws_emb_current' } },
    ],
  });
});

test('Qdrant collection and alias identities are provider/workspace scoped', () => {
  const collection = qdrantCollectionName('workspace', 'a'.repeat(64), 'b'.repeat(64));
  const alias = qdrantCurrentAlias('workspace', 'a'.repeat(64));
  assert.equal(collection, 'ace_workspace_aaaaaaaaaaaaaaaa_bbbbbbbbbbbbbbbb');
  assert.equal(alias, 'ace_workspace_aaaaaaaaaaaaaaaa_current');
});

test('Qdrant alias resolution returns the native current collection without inventing state', async () => {
  const http: HttpPort = {
    request: (request) => {
      assert.equal(request.method, 'GET');
      assert.equal(request.url, 'http://127.0.0.1:6333/aliases');
      return Effect.succeed(ok({
        status: 200,
        body: { result: { aliases: [{ alias_name: 'ace_ws_emb_current', collection_name: 'ace_ws_emb_old' }] } },
      }));
    },
  };
  const sdk = makeQdrantSdkTestPort(makeQdrantSdkTestDouble(http));
  const resolved = await Effect.runPromise(resolveQdrantAlias(
    'ace_ws_emb_current',
    sdk,
  ));
  assert.deepEqual(resolved, { _tag: 'Ok', value: 'ace_ws_emb_old' });
});

test('unchanged content reuses a vector by embedding content identity across source citation changes', async () => {
  const candidateResult = makeCodeCandidate({
    candidateId: 'candidate-1' as never,
    workspaceId: workspace,
    repoPath: 'src/renamed.ts' as never,
    range: { startLine: 1, endLine: 1, startColumn: 1, endColumn: 25 },
    symbolName: 'save',
    text: 'function save() { return 1; }',
    sourceDigest: 'a'.repeat(64) as never,
    generation: 1,
    indexedAtMs: 1,
  });
  assert.equal(candidateResult._tag, 'Ok');
  if (candidateResult._tag === 'Err') return;
  const indexResult = createCodeIndex(1, [candidateResult.value]);
  assert.equal(indexResult._tag, 'Ok');
  if (indexResult._tag === 'Err') return;
  const providerIdentity = 'fastembed/onnx|model=fixture@1|artifact=fixture#digest';
  const key = embeddingContentKey(providerIdentity, candidateResult.value.text);
  let inferenceCalls = 0;
  const embeddings: VectorEmbeddingPort = {
    embedMany: () => {
      inferenceCalls += 1;
      return Effect.succeed(ok([[0.25, 0.75]]));
    },
  };
  const points: unknown[] = [];
  const qdrant: CodeCandidatePort = {
    search: () => Effect.succeed(ok([])),
    upsert: (input) => {
      points.push(...input);
      return Effect.succeed(ok(undefined));
    },
  };
  const result = await Effect.runPromise(populateQdrantFromStructuralIndex(
    indexResult.value,
    qdrant,
    embeddings,
    'b'.repeat(64),
    new Map([[key, [0.1, 0.9]]]),
    providerIdentity,
  ));
  assert.equal(result._tag, 'Ok');
  assert.equal(inferenceCalls, 0);
  assert.equal((points[0] as { embeddingKey?: string }).embeddingKey, key);
});


test('AR03 fencing prevents a stale alias rollback and rejects same-epoch replay', {
  skip: process.platform !== 'linux',
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ace-ar03-alias-'));
  try {
    const authority = makeLocalQdrantPublicationAuthority({ workspaceId: workspace, directory, declaredTopology: 'single_host' });
    const a = await authority.reserve(async () => ok(true));
    const b = await authority.reserve(async () => ok(true));
    assert.equal(a._tag, 'Ok');
    assert.equal(b._tag, 'Ok');
    if (a._tag === 'Err' || b._tag === 'Err') return;
    assert.equal(a.value.epoch, 1);
    assert.equal(b.value.epoch, 2);

    let currentTarget = 'ace_collection_old';
    let writes = 0;
    const write = (ticket: typeof b.value, target: string) => authority.publish({
      ticket,
      indexKey: createHash('sha256').update(target).digest('hex'),
      collection: target,
      verifySource: async () => ok(true),
      write: async () => {
        writes += 1;
        currentTarget = target;
        return ok(undefined);
      },
      verifyMembership: async () => ok(true),
    });
    const newer = await write(b.value, 'ace_collection_new');
    assert.equal(newer._tag, 'Ok');
    const old = await write(a.value, 'ace_collection_old');
    assert.equal(old._tag, 'Err');
    if (old._tag === 'Err') assert.equal(old.error.code, 'NOT_READY');
    const replay = await write(b.value, 'ace_collection_new');
    assert.equal(replay._tag, 'Err', 'committed ticket is single-use even for the same key');
    assert.equal(currentTarget, 'ace_collection_new');
    assert.equal(writes, 1);
    const persisted = await authority.inspect();
    assert.equal(persisted._tag, 'Ok');
    if (persisted._tag === 'Ok') {
      assert.equal(persisted.value.committedEpoch, 2);
      assert.equal(persisted.value.committedCollection, 'ace_collection_new');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('AR03 cannot durably advance publication on failed physical Qdrant membership', {
  skip: process.platform !== 'linux',
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ace-ar03-membership-'));
  try {
    const authority = makeLocalQdrantPublicationAuthority({ workspaceId: workspace, directory, declaredTopology: 'single_host' });
    const ticket = await authority.reserve(async () => ok(true));
    assert.equal(ticket._tag, 'Ok');
    if (ticket._tag === 'Err') return;
    const attempted = await authority.publish({
      ticket: ticket.value,
      indexKey: 'a'.repeat(64),
      collection: 'ace_incomplete',
      verifySource: async () => ok(true),
      write: async () => ok(1),
      verifyMembership: async () => ok(false),
    });
    assert.equal(attempted._tag, 'Err');
    if (attempted._tag === 'Err') assert.equal(attempted.error.code, 'INVALID_EXTERNAL_RESPONSE');
    const persisted = await authority.inspect();
    assert.equal(persisted._tag, 'Ok');
    if (persisted._tag === 'Ok') assert.equal(persisted.value.committedEpoch, 0);

    // A restart must not mistake an incomplete write for committed membership.
    const anotherProcess = makeLocalQdrantPublicationAuthority({ workspaceId: workspace, directory, declaredTopology: 'single_host' });
    const next = await anotherProcess.reserve(async () => ok(true));
    assert.equal(next._tag, 'Ok');
    if (next._tag === 'Ok') assert.equal(next.value.epoch, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
