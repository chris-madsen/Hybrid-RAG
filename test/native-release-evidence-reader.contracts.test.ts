import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { nativeReleaseEvidenceReader } from '../scripts/native-release-evidence-reader.js';

test('native preflight permits only explicitly authorized external evidence and rejects symlink escapes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-native-release-'));
  try {
    const repo = join(root, 'repo');
    const external = join(root, 'evidence');
    await mkdir(repo);
    await mkdir(external);
    const evidence = join(external, 'retrieval.json');
    const outside = join(root, 'private.json');
    await writeFile(evidence, '{"ok":true}');
    await writeFile(outside, '{}');
    await writeFile(join(repo, 'local.json'), '{}');
    await symlink(outside, join(external, 'escape.json'));
    await symlink(evidence, join(repo, 'escape.json'));
    const repositoryReader = async (path: string) => ({ path, sha256: 'repo-reader', value: {} });
    const noExternal = await nativeReleaseEvidenceReader(repo, undefined, repositoryReader);
    await assert.rejects(noExternal(evidence), /escapes/);
    const reader = await nativeReleaseEvidenceReader(repo, external, repositoryReader);
    assert.deepEqual((await reader(evidence)).value, { ok: true });
    assert.equal((await reader('local.json')).sha256, 'repo-reader');
    await assert.rejects(reader(outside), /escapes/);
    await assert.rejects(reader(join(external, 'escape.json')), /escapes/);
    await assert.rejects(reader('escape.json'), /escapes/);
    await assert.rejects(nativeReleaseEvidenceReader(repo, root, repositoryReader), /separate external/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
