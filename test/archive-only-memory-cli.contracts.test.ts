import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeAsyncFileMemoryArchive } from '../src/adapters/file-memory-archive.js';
import { makeFileProjectionOutbox } from '../src/adapters/file-projection-outbox.js';
import { makeEpisodeId } from '../src/domain/memory.js';

test('CLI can delete durably never-projected originals without graph, preserving shared bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-archive-only-cli-'));
  const history = join(root, 'episodes.jsonl');
  const archivePath = join(root, 'archive');
  const run = (args: readonly string[]) => spawnSync(process.execPath,
    ['--import', 'tsx', 'src/bin/ace-memory.ts', ...args],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000, env: {
      ...process.env, ACE_WORKSPACE_ID: 'archive-only-fixture', ACE_MEMORY_ARCHIVE_ROOT: archivePath,
    } });
  try {
    // Two independent episodes with the same source text share an original
    // content-addressed blob. Deleting one must leave the other intact.
    await writeFile(history, [
      JSON.stringify({ session_id: 'fixture-session', ts: 1700000000, text: 'hello there' }),
      JSON.stringify({ session_id: 'fixture-session', ts: 1700000001, text: 'hello there' }),
    ].join('\n') + '\n', 'utf8');
    const imported = run(['import', history]);
    assert.equal(imported.status, 0, imported.stderr);
    const episodes = imported.stdout.trim().split('\n').map((line) =>
      JSON.parse(line) as { episode_id: string; memory_admission: string });
    assert.equal(episodes.length, 2);
    assert.ok(episodes.every((episode) => episode.memory_admission === 'archive_only'));
    const first = makeEpisodeId(episodes[0]?.episode_id ?? '');
    const second = makeEpisodeId(episodes[1]?.episode_id ?? '');
    assert.equal(first._tag, 'Ok');
    assert.equal(second._tag, 'Ok');
    if (first._tag === 'Err' || second._tag === 'Err') return;
    assert.notEqual(first.value, second.value);

    const removed = run(['delete', first.value]);
    assert.equal(removed.status, 0, removed.stderr);
    assert.equal((JSON.parse(removed.stdout) as { archive_only_deleted: boolean }).archive_only_deleted, true);

    const archive = await makeAsyncFileMemoryArchive(archivePath);
    const survivor = await archive.readEpisode(second.value);
    assert.equal(survivor._tag, 'Ok', 'shared immutable source blob must remain available');
    if (survivor._tag === 'Ok') {
      assert.equal(survivor.value.contentDigest, createHash('sha256').update(survivor.value.content).digest('hex'),
        'the surviving shared blob must remain byte- and digest-exact');
    }
    const deleted = await archive.readEpisode(first.value);
    assert.equal(deleted._tag, 'Err');
    const outbox = await makeFileProjectionOutbox(join(archivePath, 'projection-outbox'));
    const blocked = await outbox.begin(second.value, 'extractor-v1');
    assert.equal(blocked._tag, 'Err', 'durably archived-only source cannot later race into graph projection');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('CLI refuses deletion of an episode whose graph projection status is unknown', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-projection-cli-'));
  const history = join(root, 'episodes.jsonl');
  const archivePath = join(root, 'archive');
  const run = (args: readonly string[]) => spawnSync(process.execPath,
    ['--import', 'tsx', 'src/bin/ace-memory.ts', ...args],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000, env: {
      ...process.env, ACE_WORKSPACE_ID: 'projection-fixture', ACE_MEMORY_ARCHIVE_ROOT: archivePath,
    } });
  try {
    await writeFile(history, JSON.stringify({
      session_id: 'fixture-session', ts: 1700000000, text: 'Decision: we chose to preserve the source',
    }) + '\n');
    const imported = run(['import', history]);
    assert.equal(imported.status, 0, imported.stderr);
    const episode = JSON.parse(imported.stdout.trim()) as { episode_id: string; memory_admission: string };
    assert.equal(episode.memory_admission, 'project');
    const removed = run(['delete', episode.episode_id]);
    assert.notEqual(removed.status, 0, 'unverified projected/attempted data requires graph absence proof');
    const archive = await makeAsyncFileMemoryArchive(archivePath);
    const id = makeEpisodeId(episode.episode_id);
    assert.equal(id._tag, 'Ok');
    if (id._tag === 'Ok') assert.equal((await archive.readEpisode(id.value))._tag, 'Ok');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
