import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { makeFileProjectionOutbox } from '../src/adapters/file-projection-outbox.js';

test('projection outbox survives restart and keeps one logical receipt per episode/extractor', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-projection-outbox-'));
  const first = await makeFileProjectionOutbox(root);
  const episodeId = 'episode-outbox' as never;
  const begun = await first.begin(episodeId, 'extractor-v1');
  assert.equal(begun._tag, 'Ok');
  if (begun._tag === 'Err') throw new Error(begun.error.message);
  assert.equal(begun.value.status, 'pending');
  assert.equal(begun.value.attempts, 0);

  const incomplete = { ...begun.value, status: 'incomplete' as const, attempts: 1 };
  assert.equal((await first.put(incomplete))._tag, 'Ok');

  const restarted = await makeFileProjectionOutbox(root);
  const replay = await restarted.begin(episodeId, 'extractor-v1');
  assert.equal(replay._tag, 'Ok');
  if (replay._tag === 'Err') throw new Error(replay.error.message);
  assert.deepEqual(replay.value, incomplete);

  const claimed = await restarted.startAttempt(episodeId, 'extractor-v1');
  assert.equal(claimed._tag, 'Ok');
  if (claimed._tag === 'Err') return;
  assert.equal((await restarted.put({
    ...claimed.value, status: 'projected', graphDispatchAcknowledged: true,
  }))._tag, 'Ok');
  const all = await restarted.list();
  assert.equal(all._tag, 'Ok');
  if (all._tag === 'Ok') {
    assert.equal(all.value.length, 1);
    assert.equal(all.value[0]?.status, 'projected');
  }
});


test('projection outbox persists backoff, dead-letter and manual-repair metadata across restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-projection-dead-letter-'));
  const first = await makeFileProjectionOutbox(root);
  const episodeId = 'episode-dead-letter' as never;
  const begun = await first.begin(episodeId, 'extractor-v2');
  assert.equal(begun._tag, 'Ok');
  if (begun._tag === 'Err') throw new Error(begun.error.message);

  const dead = {
    ...begun.value,
    status: 'dead_letter' as const,
    attempts: 5,
    totalAttempts: 8,
    lastErrorCode: 'EXTERNAL_UNAVAILABLE',
    deadLetteredAtMs: 1234,
    manualRepairCount: 2,
  };
  assert.equal((await first.put(dead))._tag, 'Ok');

  const restarted = await makeFileProjectionOutbox(root);
  const loaded = await restarted.get(dead.key);
  assert.equal(loaded._tag, 'Ok');
  if (loaded._tag === 'Ok') assert.deepEqual(loaded.value, dead);
});

test('projection outbox deletion fence rejects stale receipts and survives restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-projection-deletion-fence-'));
  const outbox = await makeFileProjectionOutbox(root);
  const episodeId = 'episode-delete-fence' as never;
  const begun = await outbox.begin(episodeId, 'extractor-v1');
  assert.equal(begun._tag, 'Ok');
  if (begun._tag === 'Err') throw new Error(begun.error.message);

  const premature = await outbox.beginDeletion(episodeId);
  assert.equal(premature._tag, 'Err', 'pending graph intent may still send after a purge');
  const claim = await outbox.startAttempt(episodeId, 'extractor-v1');
  assert.equal(claim._tag, 'Ok');
  if (claim._tag === 'Err') return;
  const settled = { ...claim.value, status: 'projected' as const, graphDispatchAcknowledged: true };
  assert.equal((await outbox.put(settled))._tag, 'Ok');
  assert.equal((await outbox.beginDeletion(episodeId))._tag, 'Ok');
  const stale = await outbox.put({ ...begun.value, status: 'projected' });
  assert.equal(stale._tag, 'Err');
  if (stale._tag === 'Err') assert.equal(stale.error.code, 'ARCHIVE_TOMBSTONED');
  const blocked = await outbox.isDeletionBlocked(episodeId);
  assert.deepEqual(blocked, { _tag: 'Ok', value: true });

  assert.equal((await outbox.finalizeDeletion(episodeId))._tag, 'Ok');
  assert.equal((await outbox.put({ ...settled, status: 'tombstoned' }))._tag, 'Ok');
  const restarted = await makeFileProjectionOutbox(root);
  const repeatedBegin = await restarted.begin(episodeId, 'extractor-v1');
  assert.equal(repeatedBegin._tag, 'Err');
  if (repeatedBegin._tag === 'Err') assert.equal(repeatedBegin.error.code, 'ARCHIVE_TOMBSTONED');
});

test('AR05 graph attempts are exclusive across extractor versions and survive restart as unknown on crash', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-ar05-attempt-'));
  const outbox = await makeFileProjectionOutbox(root);
  const episodeId = 'ar05-attempt-episode' as never;
  const first = await outbox.begin(episodeId, 'extractor-a');
  const second = await outbox.begin(episodeId, 'extractor-b');
  assert.equal(first._tag, 'Ok');
  assert.equal(second._tag, 'Ok');
  const claimed = await outbox.startAttempt(episodeId, 'extractor-a');
  assert.equal(claimed._tag, 'Ok');
  if (claimed._tag === 'Err') return;
  assert.ok(claimed.value.inflightAttemptId);
  const concurrentlyStarted = await outbox.startAttempt(episodeId, 'extractor-b');
  assert.equal(concurrentlyStarted._tag, 'Err', 'another extractor cannot send concurrently');
  const unknownDelete = await outbox.beginDeletion(episodeId);
  assert.equal(unknownDelete._tag, 'Err');
  const restarted = await makeFileProjectionOutbox(root);
  const afterCrash = await restarted.get(claimed.value.key);
  assert.equal(afterCrash._tag, 'Ok');
  if (afterCrash._tag === 'Ok') assert.equal(afterCrash.value?.inflightAttemptId, claimed.value.inflightAttemptId);
  const forged = await restarted.put({
    ...claimed.value, inflightAttemptId: 'forged-attempt', status: 'projected',
  });
  assert.equal(forged._tag, 'Err', 'a different attempt cannot settle the claim');
  assert.equal((await restarted.beginDeletion(episodeId))._tag, 'Err');
  assert.equal((await restarted.put({
    ...claimed.value, status: 'projected', graphDispatchAcknowledged: true,
  }))._tag, 'Ok');
  const settled = await restarted.get(claimed.value.key);
  assert.equal(settled._tag, 'Ok');
  if (settled._tag === 'Ok') assert.equal(settled.value?.inflightAttemptId, undefined);
  // The second extractor is still pending, so deletion is not safe.
  assert.equal((await restarted.beginDeletion(episodeId))._tag, 'Err');
});

test('AR05 uncertain Graphiti outcome blocks automatic retry and manual clearing after restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-ar05-uncertain-'));
  const outbox = await makeFileProjectionOutbox(root);
  const episodeId = 'ar05-uncertain-episode' as never;
  assert.equal((await outbox.begin(episodeId, 'extractor'))._tag, 'Ok');
  const first = await outbox.startAttempt(episodeId, 'extractor');
  assert.equal(first._tag, 'Ok');
  if (first._tag === 'Err') return;
  const failed = {
    ...first.value, status: 'incomplete' as const,
    attempts: 1, uncertainGraphAttempt: true,
  };
  assert.equal((await outbox.put(failed))._tag, 'Ok');
  const restarted = await makeFileProjectionOutbox(root);
  const replay = await restarted.startAttempt(episodeId, 'extractor');
  assert.equal(replay._tag, 'Err',
    'after restart a late Graphiti send may still materialize: no second dispatch');
  if (replay._tag === 'Err') assert.equal(replay.error.code, 'INVALID_MEMORY');
  const stored = await restarted.get(failed.key);
  assert.equal(stored._tag, 'Ok');
  if (stored._tag !== 'Ok' || stored.value === undefined) return;
  assert.equal(stored.value.uncertainGraphAttempt, true);
  assert.equal((await restarted.put({
    ...stored.value, status: 'projected', uncertainGraphAttempt: false,
    graphDispatchAcknowledged: true,
  }))._tag, 'Err', 'unknown outcome cannot become verified success by receipt update');
  assert.equal((await restarted.beginDeletion(episodeId))._tag, 'Err',
    'absence or elapsed retry deadline is not resolution of an unknown external side effect');
});

test('AR05 old projected receipt without a protected acknowledgement is not deletion proof', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-ar05-old-projected-'));
  const outbox = await makeFileProjectionOutbox(root);
  const episodeId = 'ar05-old-episode' as never;
  const begun = await outbox.begin(episodeId, 'old-extractor');
  assert.equal(begun._tag, 'Ok');
  if (begun._tag === 'Err') return;
  assert.equal((await outbox.put({ ...begun.value, status: 'projected' }))._tag, 'Ok');
  assert.equal((await outbox.beginDeletion(episodeId))._tag, 'Err',
    'old receipt alone cannot certify no unsettled Graphiti side effects');
  const forged = await outbox.put({ ...begun.value, status: 'projected', graphDispatchAcknowledged: true });
  assert.equal(forged._tag, 'Err', 'no dispatch claim exists to support this acknowledgment');
});

test('AR05 OS SIGKILL between durable claim and provider result blocks replay and deletion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-ar05-graph-kill-'));
  const killed = spawnSync(process.execPath, [
    '--import', 'tsx', 'test/fixtures/ar05-graph-attempt-kill.mjs', root,
  ], { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000 });
  assert.equal(killed.signal, 'SIGKILL', killed.stderr);
  const outbox = await makeFileProjectionOutbox(root);
  const observed = await outbox.get('ar05-killed-attempt:extractor-v1' as never);
  assert.equal(observed._tag, 'Ok');
  if (observed._tag === 'Ok') assert.ok(observed.value?.inflightAttemptId);
  assert.equal((await outbox.startAttempt('ar05-killed-attempt' as never, 'extractor-v1'))._tag, 'Err');
  assert.equal((await outbox.beginDeletion('ar05-killed-attempt' as never))._tag, 'Err');
});

test('AR05 cannot forge a completed graph receipt by tombstoning pending intent before deletion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-ar05-fake-tombstone-'));
  const outbox = await makeFileProjectionOutbox(root);
  const episode = 'ar05-fake-completion' as never;
  const pending = await outbox.begin(episode, 'extractor-v1');
  assert.equal(pending._tag, 'Ok');
  if (pending._tag === 'Err') return;
  const forged = await outbox.put({ ...pending.value, status: 'tombstoned' });
  assert.equal(forged._tag, 'Err',
    'pending intent cannot be rewritten to tombstone before a successful deletion');
  assert.equal((await outbox.beginDeletion(episode))._tag, 'Err',
    'graph may still be sent; archive deletion must remain blocked');
});

test('AR05 changing extractor version cannot bypass unresolved Graphiti side effects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-ar05-extractor-version-'));
  const outbox = await makeFileProjectionOutbox(root);
  const episode = 'ar05-extractor-version-episode' as never;
  assert.equal((await outbox.begin(episode, 'extractor-v1'))._tag, 'Ok');
  const first = await outbox.startAttempt(episode, 'extractor-v1');
  assert.equal(first._tag, 'Ok');
  if (first._tag === 'Err') return;
  assert.equal((await outbox.put({
    ...first.value, status: 'incomplete', attempts: 1, uncertainGraphAttempt: true,
  }))._tag, 'Ok');
  assert.equal((await outbox.begin(episode, 'extractor-v2'))._tag, 'Ok',
    'staging an intent is harmless, only the provider send needs an exclusive fence');
  const otherVersion = await outbox.startAttempt(episode, 'extractor-v2');
  assert.equal(otherVersion._tag, 'Err',
    'an unresolved v1 send could materialize after a v2 retry');
  if (otherVersion._tag === 'Err') assert.equal(otherVersion.error.code, 'INVALID_MEMORY');
  assert.equal((await outbox.beginDeletion(episode))._tag, 'Err');
});
