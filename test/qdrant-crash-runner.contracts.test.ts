import assert from 'node:assert/strict';
import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

// Retained publication-adapter tests remain scoped to the historical mechanism
// until CBM-05 removes the adapter itself. Runtime safety is tested by real CBM E2E.
test('native runtime rejects historical failpoints and has no vector composition', async () => {
  const runtime = await readFile('src/bin/ace-runtime.ts', 'utf8');
  assert.match(runtime, /Retired vector runtime test failpoints are unsupported/u);
  assert.doesNotMatch(runtime, /QdrantClient|makeQdrantContextProvider|makeProcessEmbeddingPort|after_qdrant_verify_before_publish/u);
  const capture = await readFile('scripts/runtime-config-evidence.ts', 'utf8');
  assert.match(capture, /refuses environments with ACE test failpoints enabled/u);
});

const execFileAsync = promisify(execFile);
const ar03Worker = resolve('test/fixtures/qdrant-publication-worker.mjs');
const childArgs = (mode: string, dir: string, physical: string, workspace: string): string[] =>
  ['--import', 'tsx', ar03Worker, mode, dir, physical, workspace];

const awaitOutput = (child: ChildProcessWithoutNullStreams, token: string): Promise<string> =>
  new Promise((resolveText, rejectText) => {
    let output = '';
    const timeout = setTimeout(() => rejectText(Error('timed out waiting for ' + token)), 20_000);
    const onData = (chunk: Buffer): void => {
      output += chunk.toString('utf8');
      if (output.includes(token)) {
        clearTimeout(timeout);
        child.stdout.off('data', onData);
        child.off('error', rejectText);
        resolveText(output);
      }
    };
    child.stdout.on('data', onData);
    child.once('error', rejectText);
  });

test('AR03 two OS processes: B publishes epoch 2 while A is paused at epoch 1; A cannot roll back B', {
  skip: process.platform !== 'linux',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-ar03-process-'));
  const lockDir = join(root, 'authority');
  const physical = join(root, 'physical-qdrant-state.json');
  const workspace = 'ar03-single-authority-workspace';
  const first = spawn(process.execPath, childArgs('pause', lockDir, physical, workspace));
  try {
    assert.match(await awaitOutput(first, 'READY 1\n'), /READY 1/u);
    const next = await execFileAsync(process.execPath, childArgs('publish', lockDir, physical, workspace));
    assert.match(next.stdout, /Ok 2/u);
    const committed = JSON.parse(await readFile(physical, 'utf8')) as { epoch: number };
    assert.equal(committed.epoch, 2);

    // The older process is still alive. Its attempt must fail BEFORE its
    // write callback can delete or overwrite B's physical workspace points.
    const denied = awaitOutput(first, 'Err NOT_READY');
    first.stdin.write('continue\n');
    assert.match(await denied, /Err NOT_READY/u);
    const after = JSON.parse(await readFile(physical, 'utf8')) as { epoch: number };
    assert.equal(after.epoch, 2);
  } finally {
    first.kill('SIGKILL');
    await rm(root, { recursive: true, force: true });
  }
});

test('AR03 SIGKILL releases the kernel lock; fresh process may reserve and commit without stale-file stealing', {
  skip: process.platform !== 'linux',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-ar03-kill-'));
  const lockDir = join(root, 'authority');
  const physical = join(root, 'physical-qdrant-state.json');
  const workspace = 'ar03-crash-recovery-workspace';
  const holder = spawn(process.execPath, childArgs('hold', lockDir, physical, workspace));
  try {
    await awaitOutput(holder, 'LOCK_HELD\n');
    const closed = new Promise<void>((resolveClose) => holder.once('close', () => resolveClose()));
    holder.kill('SIGKILL');
    await closed;
    const next = await execFileAsync(process.execPath, childArgs('publish', lockDir, physical, workspace));
    assert.match(next.stdout, /Ok 2/u);
    const committed = JSON.parse(await readFile(physical, 'utf8')) as { epoch: number };
    assert.equal(committed.epoch, 2);
  } finally {
    holder.kill('SIGKILL');
    await rm(root, { recursive: true, force: true });
  }
});
