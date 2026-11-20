import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { makeAsyncFileMemoryArchive } from '../src/adapters/file-memory-archive.js';
import { makeFileProjectionOutbox } from '../src/adapters/file-projection-outbox.js';
import { reconcileProjectionIntents } from '../src/application/memory-reconcile.js';
import { importMemoryEpisodes } from '../src/application/memory-import.js';
import { deleteNeverProjectedArchiveEpisode } from '../src/application/retained-memory.js';
import { makeEpisodeId, type SessionEpisode } from '../src/domain/memory.js';
import { makeWorkspaceId, type ContentDigest } from '../src/domain/workspace.js';

const workspace = makeWorkspaceId('memory-reconcile-fixture');
if (workspace._tag === 'Err') throw new Error(workspace.error.message);

const episodeFixture = (): SessionEpisode => {
  const content = Buffer.from('We decided to retain this source locally.\n', 'utf8');
  const contentDigest = createHash('sha256').update(content).digest('hex') as ContentDigest;
  const episodeId = makeEpisodeId('reconcile-episode');
  if (episodeId._tag === 'Err') throw new Error(episodeId.error.message);
  return {
    episodeId: episodeId.value,
    workspaceId: workspace.value,
    sessionId: 'reconcile-session',
    sourcePointer: 'codex://reconcile/session/1',
    occurredAtMs: 1_700_000_000_000,
    importedAtMs: 1_700_000_000_001,
    contentDigest,
    content,
    searchText: 'We decided to retain this source locally.',
    memoryHint: 'project',
    tombstoned: false,
  };
};

test('reconciliation rebuilds a missing projection intent from immutable archive truth', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-memory-reconcile-'));
  const archive = await makeAsyncFileMemoryArchive(join(root, 'archive'));
  const outbox = await makeFileProjectionOutbox(join(root, 'outbox'));
  const episode = episodeFixture();
  assert.equal((await archive.importEpisode(episode))._tag, 'Ok');

  const archived = await archive.listEpisodes();
  assert.equal(archived._tag, 'Ok');
  if (archived._tag === 'Err') throw new Error(archived.error.message);
  const rebuilt = await reconcileProjectionIntents({
    episodes: archived.value,
    extractorVersion: 'reconcile-v1',
    outbox,
  });
  assert.deepEqual(rebuilt, { _tag: 'Ok', value: 1 });

  const receipts = await outbox.list();
  assert.equal(receipts._tag, 'Ok');
  if (receipts._tag === 'Ok') {
    assert.equal(receipts.value.length, 1);
    assert.equal(receipts.value[0]?.episodeId, episode.episodeId);
    assert.equal(receipts.value[0]?.status, 'pending');
  }
});

test('AR05 a legacy created:false archive with no never-projected proof remains UNKNOWN', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-ar05-unknown-'));
  const archive = await makeAsyncFileMemoryArchive(join(root, 'archive'));
  const outbox = await makeFileProjectionOutbox(join(root, 'outbox'));
  const episode = { ...episodeFixture(), memoryHint: 'archive_only' as const };
  assert.equal((await archive.importEpisode(episode))._tag, 'Ok');
  let graphStarts = 0;
  const replay = await importMemoryEpisodes({
    episodes: [episode], archive, outbox, extractorVersion: 'reconcile-v1',
    createProjection: async () => { graphStarts += 1; throw new Error('not permitted'); },
  });
  assert.equal(replay._tag, 'Ok');
  if (replay._tag === 'Ok') assert.equal(replay.value[0]?.persisted, false);
  assert.deepEqual(await outbox.isArchiveOnly?.(episode.episodeId), { _tag: 'Ok', value: false });
  const rejected = await deleteNeverProjectedArchiveEpisode(archive, outbox, episode.episodeId);
  assert.equal(rejected._tag, 'Err', 'absence of Graphiti receipts is not positive proof');
  assert.equal(graphStarts, 0);
  assert.equal((await archive.readEpisode(episode.episodeId))._tag, 'Ok');
});

test('AR05 archive-only proof is present BEFORE original commit and survives created:false replay', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-ar05-archive-first-'));
  const archive = await makeAsyncFileMemoryArchive(join(root, 'archive'));
  const outbox = await makeFileProjectionOutbox(join(root, 'outbox'));
  const episode = { ...episodeFixture(), memoryHint: 'archive_only' as const };
  let commitCount = 0;
  const archiveWithInjectedCrash = {
    ...archive,
    importEpisode: async (input: SessionEpisode) => {
      const precommitted = await outbox.isArchiveOnly?.(input.episodeId);
      assert.deepEqual(precommitted, { _tag: 'Ok', value: true });
      const committed = await archive.importEpisode(input);
      assert.equal(committed._tag, 'Ok');
      commitCount += 1;
      throw new Error('injected crash after durable original commit');
      return committed;
    },
  };
  await assert.rejects(importMemoryEpisodes({
    episodes: [episode], archive: archiveWithInjectedCrash, outbox,
    extractorVersion: 'reconcile-v1',
    createProjection: async () => { throw new Error('no graph'); },
  }), /injected crash/);
  assert.equal(commitCount, 1);
  const restarted = await makeFileProjectionOutbox(join(root, 'outbox'));
  const replay = await importMemoryEpisodes({
    episodes: [episode], archive, outbox: restarted, extractorVersion: 'reconcile-v1',
    createProjection: async () => { throw new Error('no graph'); },
  });
  assert.equal(replay._tag, 'Ok');
  if (replay._tag === 'Ok') assert.equal(replay.value[0]?.persisted, false);
  assert.deepEqual(await restarted.isArchiveOnly?.(episode.episodeId), { _tag: 'Ok', value: true });
  assert.equal((await deleteNeverProjectedArchiveEpisode(archive, restarted, episode.episodeId))._tag, 'Ok');
  assert.equal((await archive.readEpisode(episode.episodeId))._tag, 'Err');
});
