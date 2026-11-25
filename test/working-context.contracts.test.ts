import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { Effect } from 'effect';
import { makeNodeWorkspacePort } from '../src/adapters/node-workspace-port.js';
import type { Result } from '../src/domain/result.js';

const exec = promisify(execFile);

const mustOk = <T, E>(value: Result<T, E>): T => {
  assert.equal(value._tag, 'Ok');
  if (value._tag === 'Err') throw new Error(String(value.error));
  return value.value;
};

test('workspace snapshot exposes branch and staged/unstaged/untracked/deleted path sets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-working-context-'));
  try {
    await exec('git', ['init', '-b', 'ace-test'], { cwd: root });
    await exec('git', ['config', 'user.email', 'ace@example.invalid'], { cwd: root });
    await exec('git', ['config', 'user.name', 'ACE Test'], { cwd: root });
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src/a.ts'), 'export const a = 1;\n');
    await writeFile(join(root, 'src/b.ts'), 'export const b = 1;\n');
    await writeFile(join(root, 'src/c.ts'), 'export const c = 1;\n');
    await exec('git', ['add', '.'], { cwd: root });
    await exec('git', ['commit', '-m', 'fixture'], { cwd: root });

    await writeFile(join(root, 'src/a.ts'), 'export const a = 2;\n');
    await writeFile(join(root, 'src/b.ts'), 'export const b = 2;\n');
    await exec('git', ['add', 'src/b.ts'], { cwd: root });
    await unlink(join(root, 'src/c.ts'));
    await writeFile(join(root, 'src/new.ts'), 'export const n = 1;\n');

    const port = makeNodeWorkspacePort({ allowedRoots: [root] });
    const canonical = mustOk(await Effect.runPromise(port.canonicalizeRoot(root)));
    const snapshot = mustOk(await Effect.runPromise(port.snapshot(canonical, 1234)));

    assert.equal(snapshot.gitStatus, 'available');
    assert.equal(snapshot.branch, 'ace-test');
    assert.deepEqual(snapshot.stagedPaths, ['src/b.ts']);
    assert.deepEqual(snapshot.unstagedPaths, ['src/a.ts']);
    assert.deepEqual(snapshot.untrackedPaths, ['src/new.ts']);
    assert.deepEqual(snapshot.deletedPaths, ['src/c.ts']);
    assert.deepEqual(snapshot.removedPaths, ['src/c.ts']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('workspace snapshot retains large Git path metadata instead of truncating it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-working-context-large-'));
  try {
    await exec('git', ['init', '-b', 'ace-large-test'], { cwd: root });
    await exec('git', ['config', 'user.email', 'ace@example.invalid'], { cwd: root });
    await exec('git', ['config', 'user.name', 'ACE Test'], { cwd: root });
    const generated = join(root, 'generated');
    await mkdir(generated, { recursive: true });
    for (let index = 0; index < 6_000; index += 1) {
      await writeFile(join(generated, `${String(index).padStart(5, '0')}-${'x'.repeat(220)}.txt`), 'generated\n');
    }
    await exec('git', ['add', '.'], { cwd: root });
    await exec('git', ['commit', '-m', 'large fixture'], { cwd: root, maxBuffer: 64 * 1024 * 1024 });

    const port = makeNodeWorkspacePort({ allowedRoots: [root] });
    const canonical = mustOk(await Effect.runPromise(port.canonicalizeRoot(root)));
    const snapshot = mustOk(await Effect.runPromise(port.snapshot(canonical, 1234)));

    assert.equal(snapshot.gitStatus, 'available');
    assert.equal(snapshot.files.length, 6_000);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

