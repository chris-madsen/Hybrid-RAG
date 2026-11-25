import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

assert.equal(process.env.ACE_CBM_HOLDOUT_ISOLATED, 'true');
const root = await mkdtemp(join(tmpdir(), 'ace-holdout-runner-smoke-'));
const sourceRoot = resolve(import.meta.dirname, '..');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const run = (script, args) => execFileSync(process.execPath, ['--import', 'tsx', join(sourceRoot, 'scripts', script), ...args], {
  cwd: sourceRoot, encoding: 'utf8', timeout: 240_000, stdio: ['ignore', 'pipe', 'pipe'],
});
try {
  const repositories = [];
  const cases = [];
  const code = 'export function retryAfterTransientFailure(input: string) {\n  return input.trim();\n}\n';
  const kinds = ['behavior_without_name', 'exact_symbol_or_config', 'rare_literal', 'same_name_distractor',
    'multilingual', 'working_context', 'compactness', 'partial_coverage'];
  for (const id of ['fixture-a', 'fixture-b']) {
    const checkout = join(root, id);
    await mkdir(checkout);
    await writeFile(join(checkout, 'service.ts'), code);
    git(checkout, 'init', '--quiet');
    git(checkout, 'add', 'service.ts');
    git(checkout, '-c', 'user.name=ACE fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture');
    repositories.push({ id, revision: git(checkout, 'rev-parse', 'HEAD') });
    for (let i = 0; i < 12; i++) cases.push({
      id: id + '-' + i, repositoryId: id, critical: i < 2, kind: kinds[i % kinds.length],
      query: 'Find retryAfterTransientFailure and its definition in service.ts.',
      relevantSpans: [{ repoPath: 'service.ts', startLine: 1, endLine: 3, startColumn: 1, endColumn: 2 }],
    });
  }
  const spec = join(root, 'spec.json');
  await writeFile(spec, JSON.stringify({ schemaVersion: 1, status: 'frozen_multi_repository_holdout', repositories, cases }));
  const holdout = join(root, 'holdout.json');
  const manifests = join(root, 'manifests');
  run('freeze-retrieval-holdout.ts', [spec, holdout, manifests, ...repositories.map((repo) => repo.id + '=' + join(root, repo.id))]);
  run('validate-retrieval-holdout.ts', [holdout, manifests]);
  const output = join(root, 'run');
  run('run-native-retrieval-holdout.ts', [holdout, join(manifests, 'manifest-fixture-a.json'), 'fixture-a', join(root, 'fixture-a'), output]);
  const observed = JSON.parse(await readFile(join(output, 'native-run.json'), 'utf8'));
  assert.equal(observed.observations.length, 12);
  assert.ok(observed.observations.every((item) => item.stageStatuses.delivered === 'executed' && item.retrievedCandidateIds.length > 0));
  assert.equal(observed.projectionEvidence.length, 1);
  console.log(JSON.stringify({ status: 'native-holdout-collector-smoke-pass', cases: 12, syntheticFixture: true, providerWireCertified: false }));
} finally {
  await rm(root, { recursive: true, force: true });
}
