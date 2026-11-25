import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { nativeCodeRetrieval } from '../src/domain/retrieval.js';
import {
  evaluateRetrievalStrategy,
  validateNativeRetrievalRunIdentity,
  type RetrievalHoldout,
  type RetrievalStrategyRun,
} from '../src/domain/retrieval-quality-evaluation.js';

const [holdoutArg, outputDirectoryArg, ...runArgs] = process.argv.slice(2);
if (holdoutArg === undefined || outputDirectoryArg === undefined || runArgs.length < 2) {
  throw new Error('Usage: tsx scripts/merge-retrieval-runs.ts <holdout.json> <external-output-dir> <native-repository-run.json> [...]');
}
const holdoutBytes = await readFile(resolve(holdoutArg));
const holdout = JSON.parse(holdoutBytes.toString('utf8')) as RetrievalHoldout;
const holdoutSha256 = createHash('sha256').update(holdoutBytes).digest('hex');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const runs = await Promise.all(runArgs.map(async (path) => JSON.parse(await readFile(resolve(path), 'utf8')) as RetrievalStrategyRun));
const first = runs[0]!;
const repositories = new Set<string>();
for (const run of runs) {
  const identity = validateNativeRetrievalRunIdentity(holdout, run, sourceCommit);
  if (identity._tag === 'Err') throw new Error(identity.error.message);
  if (run.holdoutSha256 !== holdoutSha256 || run.runnerVersion !== first.runnerVersion) {
    throw new Error('native repository runs must bind the same holdout and runner version');
  }
  const ids = new Set(run.observations.map((item) => item.caseId));
  const matched = holdout.cases.filter((item) => ids.has(item.id));
  const repositoryId = matched[0]?.repositoryId;
  if (repositoryId === undefined || repositories.has(repositoryId)
    || matched.length !== run.observations.length || ids.size !== run.observations.length
    || matched.some((item) => item.repositoryId !== repositoryId)
    || holdout.cases.filter((item) => item.repositoryId === repositoryId).length !== matched.length) {
    throw new Error('each native repository run must cover exactly one distinct frozen repository');
  }
  repositories.add(repositoryId);
}
const tracePaths = runs.flatMap((run) => run.tracePaths ?? []);
const terminalTraceReceiptPaths = runs.flatMap((run) => run.terminalTraceReceiptPaths ?? []);
if (runs.some((run) => (run.tracePaths?.length ?? 0) !== (run.terminalTraceReceiptPaths?.length ?? 0))
  || new Set(tracePaths).size !== tracePaths.length
  || new Set(terminalTraceReceiptPaths).size !== terminalTraceReceiptPaths.length) {
  throw new Error('native run trace and terminal receipt paths must be paired and distinct');
}
const merged: RetrievalStrategyRun = {
  strategy: nativeCodeRetrieval.strategy,
  holdoutSha256,
  sourceCommit,
  runnerVersion: first.runnerVersion!,
  providerIdentities: nativeCodeRetrieval.providerIdentities,
  observations: runs.flatMap((run) => run.observations),
  ...(tracePaths.length === 0 ? {} : { tracePaths, terminalTraceReceiptPaths }),
};
const evaluated = evaluateRetrievalStrategy(holdout, merged);
if (evaluated._tag === 'Err') {
  throw new Error(`${evaluated.error.code}: ${evaluated.error.path}: ${evaluated.error.message}`);
}
const root = await realpath(process.cwd());
const outputDirectory = resolve(outputDirectoryArg);
const lexicalRelation = relative(root, outputDirectory);
const inside = (relation: string): boolean => relation === ''
  || (!isAbsolute(relation) && relation !== '..' && !relation.startsWith('..' + sep));
if (inside(lexicalRelation)) throw new Error('native run output must stay in the external evidence workspace');
await mkdir(outputDirectory, { recursive: true });
if (inside(relative(root, await realpath(outputDirectory)))) {
  throw new Error('native run output must stay in the external evidence workspace');
}
const outputPath = resolve(outputDirectory, 'native_cbm.json');
await writeFile(outputPath, JSON.stringify(merged, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
process.stdout.write(JSON.stringify({ strategy: merged.strategy, output: outputPath, cases: merged.observations.length }) + '\n');
