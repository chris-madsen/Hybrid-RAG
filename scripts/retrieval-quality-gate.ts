import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { nativeCodeRetrieval } from '../src/domain/retrieval.js';
import {
  evaluateRetrievalQualityPolicy,
  evaluateRetrievalStrategy,
  validateNativeRetrievalRunIdentity,
  type RetrievalHoldout,
  type RetrievalQualityPolicy,
  type RetrievalStrategyRun,
} from '../src/domain/retrieval-quality-evaluation.js';

const args = process.argv.slice(2);
const [holdoutArg, runArg, policyArg, outputArg] = args;
if (args.length !== 4 || holdoutArg === undefined || runArg === undefined
  || policyArg === undefined || outputArg === undefined) {
  throw new Error('Usage: tsx scripts/retrieval-quality-gate.ts <holdout.json> <native-run.json> <absolute-policy.json> <external-output.json>');
}
const root = await realpath(process.cwd());
const outputPath = resolve(outputArg);
const outputParent = await realpath(dirname(outputPath));
const relation = relative(root, outputParent);
if (relation === '' || (!isAbsolute(relation) && relation !== '..' && !relation.startsWith('..' + sep))) {
  throw new Error('native acceptance output must stay in the external evidence workspace');
}
const [holdoutBytes, runBytes, policyBytes] = await Promise.all([
  readFile(resolve(holdoutArg)), readFile(resolve(runArg)), readFile(resolve(policyArg)),
]);
const holdoutSha256 = createHash('sha256').update(holdoutBytes).digest('hex');
const holdout = JSON.parse(holdoutBytes.toString('utf8')) as RetrievalHoldout;
const run = JSON.parse(runBytes.toString('utf8')) as RetrievalStrategyRun;
const policy = JSON.parse(policyBytes.toString('utf8')) as RetrievalQualityPolicy;
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const identity = validateNativeRetrievalRunIdentity(holdout, run, sourceCommit);
if (identity._tag === 'Err') throw new Error(identity.error.message);
if ((process.env.ACE_EVIDENCE_SOURCE_COMMIT?.trim() || sourceCommit) !== sourceCommit
  || policy.selectedStrategy !== nativeCodeRetrieval.strategy || policy.nonInferiority !== undefined) {
  throw new Error('native retrieval acceptance requires an absolute policy and exact ACE source commit');
}
if (run.holdoutSha256 !== holdoutSha256) throw new Error('run holdout SHA-256 does not match actual holdout');
const metrics = evaluateRetrievalStrategy(holdout, run);
if (metrics._tag === 'Err') throw new Error(`${metrics.error.code}: ${metrics.error.message}`);
const verdict = evaluateRetrievalQualityPolicy(metrics.value, holdoutSha256, policy);
if (verdict._tag === 'Err') throw new Error(`${verdict.error.code}: ${verdict.error.message}`);
await writeFile(outputPath, JSON.stringify({
  schemaVersion: 2,
  sourceCommit,
  holdoutPath: resolve(holdoutArg),
  runPath: resolve(runArg),
  policyPath: resolve(policyArg),
  providerIdentities: run.providerIdentities,
  holdoutSha256,
  runSha256: createHash('sha256').update(runBytes).digest('hex'),
  policySha256: createHash('sha256').update(policyBytes).digest('hex'),
  verdict: verdict.value,
}, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
process.stdout.write(JSON.stringify({ output: outputPath, strategy: verdict.value.selectedStrategy, accepted: verdict.value.measurementAccepted }) + '\n');
if (!verdict.value.measurementAccepted) process.exitCode = 2;
