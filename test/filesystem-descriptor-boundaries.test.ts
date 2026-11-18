import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Effect } from 'effect';
import { makeNodeWorkspacePort } from '../src/adapters/node-workspace-port.js';
import { computeAceRuntimeBundleDigest } from '../src/application/ace-runtime-bundle.js';
import { hashHarborPathBytes } from '../src/application/harbor-byte-binding.js';
import { ingestRepoPath } from '../src/domain/workspace.js';

test('workspace exact read returns actual descriptor bytes and rejects a leaf symlink escaping root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-stable-read-'));
  const other = await mkdtemp(join(tmpdir(), 'ace-stable-other-'));
  try {
    const file = join(root, 'target.ts');
    await writeFile(file, 'export const safe = 1;\n');
    const port = makeNodeWorkspacePort({ allowedRoots: [root] });
    const path = ingestRepoPath('target.ts');
    assert.equal(path._tag, 'Ok');
    if (path._tag === 'Err') return;
    const read = await Effect.runPromise(port.readExact(root, path.value));
    assert.equal(read._tag, 'Ok');
    if (read._tag === 'Ok') {
      const bytes = Buffer.from(read.value.bytes);
      assert.equal(bytes.toString('utf8'), 'export const safe = 1;\n');
      assert.equal(read.value.digest, createHash('sha256').update(bytes).digest('hex'));
    }
    const outside = join(other, 'secret.ts');
    await writeFile(outside, 'const secret = true;');
    const alias = join(root, 'alias.ts');
    await symlink(outside, alias);
    const aliasPath = ingestRepoPath('alias.ts');
    assert.equal(aliasPath._tag, 'Ok');
    if (aliasPath._tag === 'Ok') {
      const rejected = await Effect.runPromise(port.readExact(root, aliasPath.value));
      assert.equal(rejected._tag, 'Err');
    }
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});

test('runtime-bundle and Harbor byte hashing reject symlink entries without following them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-runtime-nosymlink-'));
  const other = await mkdtemp(join(tmpdir(), 'ace-runtime-secret-'));
  try {
    await writeFile(join(root, 'regular.txt'), 'trusted');
    const digest = await hashHarborPathBytes(join(root, 'regular.txt'));
    assert.equal(digest, createHash('sha256').update('trusted').digest('hex'));
    await computeAceRuntimeBundleDigest(root);
    const outside = join(other, 'hidden.txt');
    await writeFile(outside, 'untrusted');
    await symlink(outside, join(root, 'hijack.txt'));
    await assert.rejects(hashHarborPathBytes(join(root, 'hijack.txt')));
    await assert.rejects(computeAceRuntimeBundleDigest(root));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});
