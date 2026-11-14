import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { Effect } from 'effect';
import { applyWorkingContextPriors } from '../src/adapters/qdrant-context-provider.js';
import { makeNodeWorkspacePort } from '../src/adapters/node-workspace-port.js';
import { makeCandidateId, makeCodeCandidate, type ContextBundle, type RankedCandidate } from '../src/domain/retrieval.js';
import { makeWorkspaceId, type RepoPath, type WorkingContext } from '../src/domain/workspace.js';
import { ok, type Result } from '../src/domain/result.js';

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

const workspaceId = mustOk(makeWorkspaceId('working-prior-fixture'));
const candidate = (id: string, path: string, score: number): RankedCandidate => ({
  candidate: mustOk(makeCodeCandidate({
    candidateId: mustOk(makeCandidateId(id)),
    workspaceId,
    repoPath: path as RepoPath,
    range: { startLine: 1, endLine: 1 },
    symbolName: id,
    text: `export function ${id}() {}`,
    sourceDigest: 'a'.repeat(64) as never,
    generation: 1 as never,
    indexedAtMs: 1,
  })),
  score,
  freshness: 'unknown',
});

test('working-context priors reorder close candidates but do not overwhelm a materially stronger hit', () => {
  const working: WorkingContext = {
    headRevision: 'a'.repeat(40),
    branch: 'feature',
    stagedPaths: [],
    unstagedPaths: ['src/focus.ts' as RepoPath],
    untrackedPaths: [],
    deletedPaths: [],
  };
  const close = applyWorkingContextPriors([
    candidate('normal', 'src/normal.ts', 0.95),
    candidate('focused', 'src/focus.ts', 0.90),
  ], working, { focusedPath: 'src/focus.ts' as RepoPath }, 2);
  assert.equal(close[0]?.candidate.repoPath, 'src/focus.ts');

  const strong = applyWorkingContextPriors([
    candidate('strong', 'src/strong.ts', 1.0),
    candidate('focused', 'src/focus.ts', 0.80),
  ], working, { focusedPath: 'src/focus.ts' as RepoPath }, 2);
  assert.equal(strong[0]?.candidate.repoPath, 'src/strong.ts');
});

