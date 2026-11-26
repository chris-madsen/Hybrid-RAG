import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
    await writeFile(join(checkout, 'service.ts'), code + '// ' + id + '\n');
    git(checkout, 'init', '--quiet');
    git(checkout, 'add', 'service.ts');
    git(checkout, '-c', 'user.name=ACE fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture');
    repositories.push({ id, revision: git(checkout, 'rev-parse', 'HEAD') });
    for (let i = 0; i < 12; i++) cases.push({
      id: id + '-' + i, repositoryId: id, critical: i < 2, kind: kinds[i % kinds.length],
      query: 'Find retryAfterTransientFailure and its definition in service.ts.',
      // CBM line outlines are materialized as full verified lines, including the
      // terminating newline. The exclusive end is therefore line 4, column 1.
      relevantSpans: [{ repoPath: 'service.ts', startLine: 1, endLine: 4, startColumn: 1, endColumn: 1 }],
    });
  }
  const spec = join(root, 'spec.json');
  await writeFile(spec, JSON.stringify({ schemaVersion: 1, status: 'frozen_multi_repository_holdout', repositories, cases }));
  const invalidSpec = join(root, 'invalid-spec.json');
  const invalidCases = cases.map((item, index) => index === 0
    ? { ...item, relevantSpans: [{ ...item.relevantSpans[0], endColumn: 999 }] } : item);
  await writeFile(invalidSpec, JSON.stringify({ schemaVersion: 1, status: 'frozen_multi_repository_holdout',
    repositories, cases: invalidCases }));
  const invalidHoldout = join(root, 'invalid-holdout.json');
  const invalidManifests = join(root, 'invalid-manifests');
  assert.throws(() => run('freeze-retrieval-holdout.ts', [invalidSpec, invalidHoldout, invalidManifests,
    ...repositories.map((repo) => repo.id + '=' + join(root, repo.id))]),
  (error) => String(error.stderr).includes('invalid range'));
  await assert.rejects(readFile(invalidHoldout), { code: 'ENOENT' });
  await assert.rejects(readFile(join(invalidManifests, 'manifest-fixture-a.json')), { code: 'ENOENT' });
  const holdout = join(root, 'holdout.json');
  const manifests = join(root, 'manifests');
  run('freeze-retrieval-holdout.ts', [spec, holdout, manifests, ...repositories.map((repo) => repo.id + '=' + join(root, repo.id))]);
  run('validate-retrieval-holdout.ts', [holdout, manifests]);
  const frozen = JSON.parse(await readFile(holdout, 'utf8'));
  const policy = join(root, 'fixture-policy.json');
  // Test the evaluator with known fixture labels, not a release threshold.
  await writeFile(policy, JSON.stringify({ selectedStrategy: 'native_cbm',
    requiredHoldoutSha256: createHash('sha256').update(await readFile(holdout)).digest('hex'),
    requiredHoldoutStatus: frozen.status, minRepositoryCount: 2,
    minRecallAt1: 1, minRecallAt3: 1, minRecallAt5: 1, minCriticalRecallAt5: 1, minMrr: 1, minNdcgAt5: 1 }));
  const runs = [];
  for (const { id } of repositories) {
    const output = join(root, 'run-' + id);
    run('run-native-retrieval-holdout.ts', [holdout, join(manifests, 'manifest-' + id + '.json'), id, join(root, id), output]);
    const path = join(output, 'native-run.json');
    const observed = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(observed.observations.length, 12);
    assert.ok(observed.observations.every((item) => item.stageStatuses.delivered === 'executed' && item.retrievedCandidateIds.length > 0));
    assert.equal(observed.projectionEvidence.length, 1);
    runs.push(path);
  }
  const merged = join(root, 'merged');
  run('merge-retrieval-runs.ts', [holdout, merged, ...runs]);
  const mergedPath = join(merged, 'native_cbm.json');
  const verdictPath = join(root, 'fixture-verdict.json');
  try {
    run('retrieval-quality-gate.ts', [holdout, mergedPath, policy, verdictPath]);
  } catch (error) {
    // Only disposable synthetic evidence: expose the failed assertion, not real holdout data.
    const failure = JSON.parse(await readFile(verdictPath, 'utf8')).verdict;
    console.error(JSON.stringify({ failures: failure.failures, metrics: failure.metrics }));
    throw error;
  }
  const verdict = JSON.parse(await readFile(verdictPath, 'utf8')).verdict;
  assert.equal(verdict.measurementAccepted, true);
  assert.equal(verdict.metrics.cases, 24);
  assert.equal(verdict.metrics.repositoryCount, 2);
  const tampered = JSON.parse(await readFile(mergedPath, 'utf8'));
  tampered.observations[0].retrievedCandidateIds = ['forged'];
  const tamperedPath = join(root, 'tampered.json');
  await writeFile(tamperedPath, JSON.stringify(tampered));
  assert.throws(() => run('retrieval-quality-gate.ts', [holdout, tamperedPath, policy, join(root, 'bad-verdict.json')]),
    (error) => String(error.stderr).includes('do not match actual projection evidence'));
  console.log(JSON.stringify({ status: 'native-holdout-collector-smoke-pass', cases: 24, syntheticFixture: true, providerWireCertified: false }));
} finally {
  await rm(root, { recursive: true, force: true });
}
