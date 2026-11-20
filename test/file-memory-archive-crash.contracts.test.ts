import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { makeAsyncFileMemoryArchive } from '../src/adapters/file-memory-archive.js';
import { createLocalMemoryBackup } from '../src/adapters/local-memory-backup.js';

const bytes = Buffer.from('immutable archive original: exact bytes after crash\n', 'utf8');
const digest = createHash('sha256').update(bytes).digest('hex');
const episode = {
  episodeId: 'ar04-crash-episode' as never,
  workspaceId: 'ar04-workspace' as never,
  sessionId: 'ar04-session',
  sourcePointer: 'codex://ar04/original/1',
  occurredAtMs: 100,
  importedAtMs: 101,
  contentDigest: digest as never,
  content: bytes,
  searchText: 'immutable archive original',
  tombstoned: false,
};
const newRoot = (): Promise<string> => mkdtemp(join(tmpdir(), 'ace-ar04-crash-'));
const episodeDir = (root: string): string => join(root, 'episodes');
const binPath = (root: string): string => join(episodeDir(root), digest + '.bin');
const jsonPath = (root: string): string => join(episodeDir(root), episode.episodeId + '.json');

for (const failpoint of ['during_blob_stage', 'after_blob_link', 'during_metadata_stage', 'after_metadata_link']) {
  test('AR04 SIGKILL at ' + failpoint + ' recovers exact bytes or a typed missing state', {
    skip: process.platform !== 'linux',
  }, async () => {
    const root = await newRoot();
    try {
      const crashed = spawnSync(process.execPath, [
        '--import', 'tsx', 'test/fixtures/file-memory-archive-import.mjs', root,
      ], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 20_000,
        env: {
          ...process.env,
          ACE_ENABLE_TEST_FAILPOINTS: 'true',
          ACE_ARCHIVE_TEST_FAILPOINT: failpoint,
        },
      });
      assert.equal(crashed.signal, 'SIGKILL', crashed.stderr || 'test failpoint did not terminate');
      const archive = await makeAsyncFileMemoryArchive(root);
      const original = await archive.readEpisode(episode.episodeId);
      if (failpoint === 'after_metadata_link') {
        assert.equal(original._tag, 'Ok');
        if (original._tag === 'Ok') assert.deepEqual(Buffer.from(original.value.content), bytes);
      } else {
        assert.equal(original._tag, 'Err', 'unfinished stage cannot appear as committed');
        if (original._tag === 'Err') assert.equal(original.error.code, 'FILE_NOT_FOUND');
      }
      const restored = await archive.importEpisode(episode);
      assert.equal(restored._tag, 'Ok', 'SIGKILL cannot leave a permanent stale lock');
      if (restored._tag === 'Err') return;
      assert.equal(restored.value.created, failpoint !== 'after_metadata_link');
      assert.deepEqual(Buffer.from(restored.value.episode.content), bytes);
      assert.deepEqual(await readFile(binPath(root)), bytes);
      const listed = await archive.listEpisodes();
      assert.equal(listed._tag, 'Ok');
      if (listed._tag === 'Ok') {
        assert.equal(listed.value.length, 1);
        assert.deepEqual(Buffer.from(listed.value[0]!.content), bytes);
      }
      assert.equal((await readdir(episodeDir(root))).some((name) => name.startsWith('.ar04-')), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test('AR04 corrupt pre-existing digest blob never passes EEXIST', async () => {
  const root = await newRoot();
  try {
    await mkdir(episodeDir(root));
    const corruption = Buffer.from('truncated unrelated bytes');
    await writeFile(binPath(root), corruption);
    const archive = await makeAsyncFileMemoryArchive(root);
    const imported = await archive.importEpisode(episode);
    assert.equal(imported._tag, 'Err');
    if (imported._tag === 'Err') assert.equal(imported.error.code, 'DIGEST_MISMATCH');
    assert.deepEqual(await readFile(binPath(root)), corruption);
    assert.equal((await readdir(episodeDir(root))).some((name) => name.endsWith('.json')), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('AR04 torn metadata cannot masquerade as a completed retry or listing', async () => {
  const root = await newRoot();
  try {
    const archive = await makeAsyncFileMemoryArchive(root);
    await writeFile(jsonPath(root), '{"episodeId":"ar04-crash-episode"', 'utf8');
    const imported = await archive.importEpisode(episode);
    assert.equal(imported._tag, 'Err');
    if (imported._tag === 'Err') assert.equal(imported.error.code, 'PERSISTENCE_FAILED');
    assert.equal((await archive.readEpisode(episode.episodeId))._tag, 'Err');
    const listed = await archive.listEpisodes();
    assert.equal(listed._tag, 'Err');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('AR04 committed metadata with missing blob refuses unsafe reimport', async () => {
  const root = await newRoot();
  try {
    const archive = await makeAsyncFileMemoryArchive(root);
    await writeFile(jsonPath(root), JSON.stringify({ ...episode, content: undefined }));
    const imported = await archive.importEpisode(episode);
    assert.equal(imported._tag, 'Err');
    if (imported._tag === 'Err') assert.equal(imported.error.code, 'PERSISTENCE_FAILED');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('AR04 immutable retry validates identity and ordinary backup excludes the inactive lock file', async () => {
  const root = await newRoot();
  try {
    const archive = await makeAsyncFileMemoryArchive(root);
    assert.equal((await archive.importEpisode(episode))._tag, 'Ok');
    const changed = await archive.importEpisode({ ...episode, sourcePointer: 'codex://different/source' });
    assert.equal(changed._tag, 'Err');
    if (changed._tag === 'Err') assert.equal(changed.error.code, 'DIGEST_MISMATCH');
    const good = await archive.readEpisode(episode.episodeId);
    assert.equal(good._tag, 'Ok');
    if (good._tag === 'Ok') assert.equal(good.value.sourcePointer, episode.sourcePointer);
    const backup = await createLocalMemoryBackup(root, root + '-backup', 101);
    assert.equal(backup._tag, 'Ok');
    if (backup._tag === 'Ok') {
      assert.equal(backup.value.files.some((file) => file.path === '.archive-write.lock'), false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(root + '-backup', { recursive: true, force: true });
  }
});

test('AR04 no-follow blob validation refuses symbolic links', async () => {
  const root = await newRoot();
  const external = root + '-external';
  try {
    await mkdir(episodeDir(root));
    await writeFile(external, bytes);
    await symlink(external, binPath(root));
    const archive = await makeAsyncFileMemoryArchive(root);
    const imported = await archive.importEpisode(episode);
    assert.equal(imported._tag, 'Err');
    if (imported._tag === 'Err') assert.equal(imported.error.code, 'PERSISTENCE_FAILED');
    assert.deepEqual(await readFile(external), bytes);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(external, { force: true });
  }
});
