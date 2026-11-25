import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { makeLocalQdrantPublicationAuthority } from '../src/adapters/qdrant-publication-authority.js';
import { makeWorkspaceId } from '../src/domain/workspace.js';
import { ok } from '../src/domain/result.js';

const workspace = makeWorkspaceId('qdrant-alias-contract')._tag === 'Ok'
  ? makeWorkspaceId('qdrant-alias-contract').value
  : (() => { throw new Error('workspace fixture is invalid'); })();

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


test('AR03 refuses to recreate lost authority state when physical Qdrant workspace is not empty', {
  skip: process.platform !== 'linux',
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ace-ar03-bootstrap-'));
  try {
    const authority = makeLocalQdrantPublicationAuthority({
      workspaceId: workspace, directory, declaredTopology: 'single_host',
    });
    const rejected = await authority.reserve(async () => ok(false));
    assert.equal(rejected._tag, 'Err');
    if (rejected._tag === 'Err') assert.equal(rejected.error.code, 'NOT_READY');
    const valid = await authority.reserve(async () => ok(true));
    assert.equal(valid._tag, 'Ok');
    if (valid._tag === 'Ok') assert.equal(valid.value.epoch, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
