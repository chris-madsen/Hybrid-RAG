#!/usr/bin/env node
import { cp, copyFile, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const sandbox = await mkdtemp(join(tmpdir(), 'ace-targeted-mutation-'));
const nodeModules = resolve(root, 'node_modules');

const runTest = (testFile) => spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', testFile],
  {
    cwd: sandbox,
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
    maxBuffer: 8 * 1024 * 1024,
  },
);

const replaceExactlyOnce = (source, before, after, label) => {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: expected mutation anchor exactly once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
};

const mutations = [
  {
    id: 'MUT-POLICY-DATA-CLASS',
    file: 'src/domain/policy.ts',
    test: 'test/data-class-policy.contracts.test.ts',
    before: "    const allowedDataClasses = policy.allowedCloudDataClassesByProvider[action.destination] ?? [];",
    after: "    const allowedDataClasses = action.dataClasses.filter((dataClass) => dataClass !== 'secret');",
  },
  {
    id: 'MUT-GATEWAY-POLICY-BYPASS',
    file: 'src/application/gateway-projection-service.ts',
    test: 'test/gateway-projection.contracts.test.ts',
    before: "    if (!authorized.value.allowed) return block(request, authorized.value.reasonCode);",
    after: "    if (false && !authorized.value.allowed) return block(request, authorized.value.reasonCode);",
  },
  {
    id: 'MUT-GATEWAY-SECRET-BYPASS',
    file: 'src/application/gateway-projection-service.ts',
    test: 'test/gateway-projection.contracts.test.ts',
    before: "    if (containsLikelySecret(result.contextText)) {",
    after: "    if (false && containsLikelySecret(result.contextText)) {",
  },
];

try {
  await cp(resolve(root, 'src'), resolve(sandbox, 'src'), { recursive: true });
  await cp(resolve(root, 'test'), resolve(sandbox, 'test'), { recursive: true });
  await copyFile(resolve(root, 'package.json'), resolve(sandbox, 'package.json'));
  await copyFile(resolve(root, 'tsconfig.json'), resolve(sandbox, 'tsconfig.json'));
  await symlink(nodeModules, resolve(sandbox, 'node_modules'), 'dir');

  const baselineTests = [...new Set(mutations.map(({ test }) => test))];
  let baselineFailed = false;
  for (const testFile of baselineTests) {
    const baseline = runTest(testFile);
    if (baseline.status !== 0) {
      process.stderr.write(`[mutation] baseline failed for ${testFile}\n${baseline.stdout}\n${baseline.stderr}\n`);
      process.exitCode = 2;
      baselineFailed = true;
      break;
    }
  }

  if (!baselineFailed) {
    const results = [];
    for (const mutation of mutations) {
      const target = resolve(sandbox, mutation.file);
      const original = await readFile(target, 'utf8');
      const mutated = replaceExactlyOnce(original, mutation.before, mutation.after, mutation.id);
      await writeFile(target, mutated, 'utf8');
      const run = runTest(mutation.test);
      await writeFile(target, original, 'utf8');

      const killed = run.status !== 0 && /not ok|AssertionError|ERR_ASSERTION/u.test(`${run.stdout}\n${run.stderr}`);
      results.push({
        id: mutation.id,
        file: mutation.file,
        test: mutation.test,
        killed,
        exitCode: run.status,
      });
      if (!killed) {
        process.stderr.write(`[mutation] SURVIVED ${mutation.id}\n${run.stdout}\n${run.stderr}\n`);
      }
    }

    process.stdout.write(JSON.stringify({
      schemaVersion: 'ace.targeted-mutation.v1',
      result: results.every(({ killed }) => killed) ? 'PASS' : 'FAIL',
      mutants: results,
    }, null, 2) + '\n');

    if (results.some(({ killed }) => !killed)) process.exitCode = 1;
  }
} finally {
  await rm(sandbox, { recursive: true, force: true });
}
