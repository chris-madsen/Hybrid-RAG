import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { retrievalSourceManifestSha256 } from '../src/domain/retrieval-source-manifest.js';

const repositoryRoot = path.resolve('.');
const tsxCli = path.resolve('node_modules/tsx/dist/cli.mjs');
const freezer = path.resolve('scripts/freeze-retrieval-holdout.ts');

const git = (root: string, args: readonly string[]): string => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });

const kinds = ['behavior_without_name', 'exact_symbol_or_config', 'rare_literal', 'same_name_distractor',
  'multilingual', 'working_context', 'compactness', 'partial_coverage'] as const;
const sourceSpec = (revisions: readonly string[]): string => JSON.stringify({
  schemaVersion: 1,
  status: 'frozen_multi_repository_holdout',
  repositories: revisions.map((revision, i) => ({ id: i === 0 ? 'repo-a' : 'repo-b', revision })),
  cases: revisions.flatMap((_, i) => Array.from({ length: 12 }, (__, index) => ({
    id: (i === 0 ? 'repo-a' : 'repo-b') + '-case-' + index,
    repositoryId: i === 0 ? 'repo-a' : 'repo-b',
    query: 'find the source behavior ' + index,
    relevantSpans: [{ repoPath: 'src/example.ts', startLine: 1, endLine: 1 }],
    critical: index < 2,
    kind: kinds[index % kinds.length],
  }))),
}, null, 2) + '\n';

const runFreeze = (source: string, holdout: string, manifests: string, checkouts: readonly string[]): void => {
  execFileSync(process.execPath, [tsxCli, freezer, source, holdout, manifests,
    `repo-a=${checkouts[0]}`, `repo-b=${checkouts[1]}`], {
    cwd: repositoryRoot,
    stdio: 'pipe',
  });
};

test('external holdout freezer writes only to an external evidence directory', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'ace-external-holdout-'));
  try {
    const checkouts = [path.join(temporaryRoot, 'checkout-a'), path.join(temporaryRoot, 'checkout-b')];
    const revisions = [];
    for (const [index, checkout] of checkouts.entries()) {
      await mkdir(path.join(checkout, 'src'), { recursive: true });
      await writeFile(path.join(checkout, 'src', 'example.ts'), 'export const value = ' + index + ';\n', 'utf8');
      git(checkout, ['init', '--quiet']);
      git(checkout, ['config', 'user.email', 'ace-tests@example.invalid']);
      git(checkout, ['config', 'user.name', 'ACE tests']);
      git(checkout, ['add', 'src/example.ts']);
      git(checkout, ['commit', '--quiet', '-m', 'fixture']);
      revisions.push(git(checkout, ['rev-parse', 'HEAD']).trim());
    }
    const source = path.join(temporaryRoot, 'source-spec.json');
    await writeFile(source, sourceSpec(revisions), 'utf8');
    const holdout = path.join(temporaryRoot, 'evidence', 'holdout.json');
    const manifests = path.join(temporaryRoot, 'evidence', 'manifests');

    runFreeze(source, holdout, manifests, checkouts);

    const generated = JSON.parse(await readFile(holdout, 'utf8')) as {
      readonly status: string;
      readonly repositories: readonly { readonly id: string; readonly revision: string }[];
      readonly cases: readonly unknown[];
    };
    assert.equal(generated.status, 'frozen_multi_repository_holdout');
    assert.deepEqual(generated.repositories.map((item) => item.id), ['repo-a', 'repo-b']);
    assert.deepEqual(generated.repositories.map((item) => item.revision), revisions);
    assert.equal(generated.cases.length, 24);
    const repoAManifestPath = path.join(manifests, 'manifest-repo-a.json');
    const repoAManifestBytes = await readFile(repoAManifestPath);
    const repoAManifest = JSON.parse(repoAManifestBytes.toString('utf8')) as {
      readonly repositoryId: string;
      readonly revision: string;
      readonly entries: readonly { readonly path: string; readonly sizeBytes: number; readonly sha256: string }[];
    };
    assert.match(repoAManifestBytes.toString('utf8'), /"repositoryId": "repo-a"/u);
    assert.equal(
      retrievalSourceManifestSha256(repoAManifest.repositoryId, repoAManifest.revision, repoAManifest.entries),
      createHash('sha256').update(repoAManifestBytes).digest('hex'),
    );
    assert.match(await readFile(path.join(manifests, 'manifest-repo-b.json'), 'utf8'), /"repositoryId": "repo-b"/u);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('external holdout freezer refuses tracked ACE output paths', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'ace-external-holdout-guard-'));
  try {
    const source = path.join(temporaryRoot, 'source-spec.json');
    await writeFile(source, sourceSpec(['0'.repeat(40), '1'.repeat(40)]), 'utf8');
    assert.throws(
      () => runFreeze(source, path.join(repositoryRoot, 'benchmarks', 'holdout.json'), path.join(repositoryRoot, 'benchmarks', 'manifests'), [temporaryRoot, temporaryRoot]),
      /external evidence directory/iu,
    );
    const alias = path.join(temporaryRoot, 'alias');
    await symlink(repositoryRoot, alias, 'dir');
    assert.throws(() => runFreeze(source, path.join(alias, 'holdout.json'), path.join(alias, 'manifests'),
      [temporaryRoot, temporaryRoot]), /external evidence directory/iu);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
