import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { writeFrozenArtifactPair } from '../scripts/write-frozen-artifact-pair.js';

test('frozen artifact and digest are exclusive and cannot overwrite existing evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ace-frozen-atomic-'));
  try {
    const target = join(dir, 'frozen.json');
    const bytes = Buffer.from('{"status":"frozen"}\n');
    await writeFrozenArtifactPair(target, bytes, 'a'.repeat(64));
    assert.deepEqual(await readFile(target), bytes);
    assert.equal(await readFile(target + '.sha256', 'utf8'), 'a'.repeat(64) + '  frozen.json\n');
    await assert.rejects(writeFrozenArtifactPair(target, Buffer.from('changed'), 'b'.repeat(64)));
    assert.deepEqual(await readFile(target), bytes);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('frozen artifact cannot follow a symlink or overwrite the checksum target', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ace-frozen-link-'));
  try {
    const victim = join(dir, 'victim');
    const alias = join(dir, 'alias');
    await writeFile(victim, 'untouched');
    await symlink(victim, alias);
    await assert.rejects(writeFrozenArtifactPair(alias, Buffer.from('changed'), 'a'.repeat(64)));
    assert.equal(await readFile(victim, 'utf8'), 'untouched');
    const guarded = join(dir, 'guarded');
    await symlink(victim, guarded + '.sha256');
    await assert.rejects(writeFrozenArtifactPair(guarded, Buffer.from('changed'), 'a'.repeat(64)));
    assert.equal(await readFile(victim, 'utf8'), 'untouched');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
