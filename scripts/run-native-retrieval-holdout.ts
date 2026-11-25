import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { Effect } from 'effect';
import { makeNodeWorkspacePort } from '../src/adapters/node-workspace-port.js';
import { exactUtf8Span } from '../src/domain/utf8-range.js';
import { ingestRepoPath } from '../src/domain/workspace.js';
import { sha256, type RetrievalBenchmarkTraceEvent, type RetrievalBenchmarkTerminalReceipt } from '../src/domain/retrieval-benchmark.js';
import { nativeCodeRetrieval } from '../src/domain/retrieval.js';
import type { RetrievalHoldout, RetrievalStrategyRun } from '../src/domain/retrieval-quality-evaluation.js';
import { checkedFrozenManifest, deriveNativeProjectionObservations, nativeProjectionRunnerVersion,
  type NativeProjectionCapture, type NativeProjectionEvidence } from './native-projection-evidence.js';
import { resolveRealProviderRuntime } from './real-provider-runtime.mjs';
import { spawnRealProviderProcess, stopRealProviderProcess } from './real-provider-process.mjs';

const [holdoutArg, manifestArg, repositoryId, checkoutArg, outputArg] = process.argv.slice(2);
assert.ok(holdoutArg && manifestArg && repositoryId && checkoutArg && outputArg && process.argv.length === 7,
  'Usage: npm run run:native-retrieval-holdout -- <holdout.json> <manifest.json> <repo-id> <checkout> <new-external-output-dir>');
assert.ok(process.platform === 'linux' && process.env.ACE_CBM_HOLDOUT_ISOLATED === 'true',
  'run only in a dedicated Linux account or isolated container with no unrelated CBM daemon; no model egress');
const runtime = await resolveRealProviderRuntime(import.meta.dirname);
assert.ok(runtime.runnerClean && runtime.runnerCommit === runtime.sourceCommit, 'runner and compiled ACE must be the same clean commit');
const command = process.env.ACE_CBM_COMMAND;
assert.ok(command && isAbsolute(command), 'ACE_CBM_COMMAND must point to the pinned native executable');
const holdoutBytes = await readFile(resolve(holdoutArg));
const holdout = JSON.parse(holdoutBytes.toString('utf8')) as RetrievalHoldout;
assert.ok(holdout.status === 'frozen_multi_repository_holdout' && holdout.repositories!.length >= 2
  && holdout.cases.length >= 24, 'release holdout must contain at least two repositories and 24 cases');
const holdoutSha256 = sha256(holdoutBytes);
const manifestBytes = await readFile(resolve(manifestArg));
const manifest = checkedFrozenManifest(holdout, repositoryId, manifestBytes);
const cases = holdout.cases.filter((item) => item.repositoryId === repositoryId);
assert.ok(cases.length >= 12 && cases.filter((item) => item.critical === true).length >= 2, 'incomplete frozen repository partition');

const workspace = await realpath(checkoutArg);
const output = join(await realpath(dirname(resolve(outputArg))), resolve(outputArg).split(sep).at(-1)!);
const within = (root: string, path: string): boolean => {
  const relation = relative(root, path);
  return relation === '' || (!isAbsolute(relation) && relation !== '..' && !relation.startsWith('..' + sep));
};
assert.ok(!within(await realpath(runtime.runnerRoot), output) && !within(workspace, output)
  && !within(await realpath(runtime.runtimeRoot), output), 'projection evidence must stay outside source and runtime checkouts');
const git = (...args: string[]): string => execFileSync('git', ['-C', workspace, ...args], {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});
const files = makeNodeWorkspacePort({ allowedRoots: [workspace] });
const exact = async (path: string) => {
  const parsed = ingestRepoPath(path);
  assert.ok(parsed._tag === 'Ok' && parsed.value === path, 'invalid frozen source path');
  const read = await Effect.runPromise(files.readExact(workspace, parsed.value));
  assert.ok(read._tag === 'Ok', 'cannot read exact frozen source');
  return read.value;
};
const verifyCheckout = async () => {
  assert.ok(git('rev-parse', 'HEAD').trim() === manifest.revision
    && await realpath(git('rev-parse', '--show-toplevel').trim()) === workspace
    && git('status', '--porcelain=v1', '--untracked-files=all').trim() === ''
    && git('ls-files', '--others', '--ignored', '--exclude-standard', '-z') === '',
  'frozen checkout must be clean, exact, and free of ignored/untracked files');
  assert.ok(git('ls-files', '-v', '-z').split('\0').filter(Boolean).every((line) => line.startsWith('H ')),
    'frozen checkout cannot use trust-index flags or sparse/unmerged state');
  for (const entry of manifest.entries) {
    const read = await exact(entry.path);
    assert.ok(read.digest === entry.sha256 && read.bytes.byteLength === entry.sizeBytes, 'frozen checkout source digest mismatch');
  }
};
await verifyCheckout();
await mkdir(output, { mode: 0o700 }); // fresh path, never overwrite evidence
const home = join(output, 'native-home');
await mkdir(home, { mode: 0o700 });
const tracePath = join(output, 'retrieval-trace.jsonl');
const workspaceId = randomUUID();
const secret = randomUUID();
const port = await new Promise<number>((resolvePort, reject) => {
  const listener = createServer();
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', () => {
    const address = listener.address();
    if (!address || typeof address === 'string') { listener.close(); reject(new Error('no local RPC port')); return; }
    listener.close((error) => error ? reject(error) : resolvePort(address.port));
  });
});
const maxWait = 180_000;
const child = spawnRealProviderProcess(process.execPath, [runtime.executable], {
  cwd: runtime.runtimeRoot,
  // No inherited ACE/LLM credentials, proxy variables, or alternate routes.
  env: {
    PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: process.env.LANG ?? 'C.UTF-8',
    HOME: home, XDG_CACHE_HOME: join(home, 'cache'), XDG_DATA_HOME: join(home, 'data'),
    CBM_CACHE_DIR: join(home, 'cbm-cache'), CBM_ALLOWED_ROOT: workspace,
    ACE_CBM_COMMAND: command, ACE_RUNTIME_ROOT: runtime.runtimeRoot,
    ACE_WORKSPACE_ROOT: workspace, ACE_ALLOWED_ROOTS: workspace, ACE_WORKSPACE_ID: workspaceId,
    ACE_STATE_DIR: join(output, 'state'), ACE_ARTIFACT_DIR: join(output, 'artifacts'),
    ACE_CONTEXT_RPC_HOST: '127.0.0.1', ACE_CONTEXT_RPC_PORT: String(port), ACE_CONTEXT_RPC_SHARED_SECRET: secret,
    ACE_CONTEXT_EXTERNAL_LLM_OPT_IN: 'true', ACE_CONTEXT_ALLOWED_LLM_PROVIDERS_JSON: '["mock"]',
    ACE_CONTEXT_ALLOWED_LLM_MODELS_BY_PROVIDER_JSON: '{"mock":["test-model"]}',
    ACE_CONTEXT_ALLOWED_LLM_DATA_CLASSES_JSON: '["private_source"]',
    ACE_CONTEXT_ALLOWED_LLM_DESTINATIONS_JSON: '[]', ACE_CONTEXT_ALLOWED_LLM_STREAMING_ROUTES_JSON: '[]',
    ACE_ENABLE_GRAPHITI: 'false', ACE_ENABLE_VERTEX: 'false', ACE_CLOUD_DOCS_OPT_IN: 'false',
    ACE_BENCHMARK_TRACE_FILE: tracePath, ACE_BENCHMARK_REPOSITORY_ID: repositoryId,
    ACE_BENCHMARK_RUNNER_VERSION: nativeProjectionRunnerVersion, ACE_EVIDENCE_SOURCE_COMMIT: runtime.sourceCommit,
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});
const captures: NativeProjectionCapture[] = [];
try {
  await new Promise<void>((ready, reject) => {
    let settled = false;
    let tail = '';
    let indexed = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else ready();
    };
    const timer = setTimeout(() => finish(new Error('native holdout runtime startup timed out')), maxWait);
    child.stderr?.on('data', (chunk: Buffer) => {
      tail = (tail + chunk.toString('utf8')).slice(-8192);
      indexed ||= tail.includes('native CBM code retrieval initialized');
      if (tail.includes('ace-context-rpc listening')) {
        finish(indexed ? undefined : new Error('native holdout runtime failed initial indexing'));
      }
    });
    child.once('error', () => finish(new Error('native holdout runtime spawn failed')));
    child.once('exit', () => finish(new Error('native holdout runtime exited before ready')));
  });
  const endpoint = 'http://127.0.0.1:' + port + '/internal/ace-context/v3';
  const headers = { authorization: 'Bearer ' + secret, 'content-type': 'application/json', connection: 'close' };
  const health = await fetch(endpoint + '/health', { headers, signal: AbortSignal.timeout(10_000), redirect: 'error' });
  assert.ok(health.status === 200 && (await health.json()).providerWire === 'not_certified', 'unexpected RPC health contract');
  for (const item of cases) {
    // Do not pass frozen labels, focused-path hints or expected files to ACE.
    // Each query is a fresh stateless native request, not a simulated agent turn.
    const sessionId = randomUUID();
    const body = Buffer.from(JSON.stringify({ model: 'test-model', store: false, input: item.query }), 'utf8');
    const request = {
      schemaVersion: 'ace.context.v3', protocol: 'openai.responses', requestId: randomUUID(),
      attemptGroupId: randomUUID(), agentSessionId: sessionId, workspaceId, dataClass: 'private',
      provider: 'mock', model: 'test-model', bodyBase64: body.toString('base64'), bodySha256: sha256(body),
      query: item.query, projectionMode: 'bifrost_hook', deadlineEpochMs: Date.now() + maxWait,
      attestation: { hostBuildDigest: sha256(runtime.runnerCommit), sessionId,
        activeEngineId: 'bifrost-visible-request-only', effectiveCompressionControlsDigest: sha256('holdout-stateless'),
        durableActiveTranscriptRevision: 'rev1', durableActiveTranscriptDigest: sha256('unattested'),
        hostCompactionEpoch: 'unknown', attestorId: 'native-projection-holdout',
        providerManagedHistoryCapability: 'visible', hostTranscriptAttested: false, compactionEnabled: false },
    };
    const started = performance.now();
    const response = await fetch(endpoint + '/project', { method: 'POST', headers,
      body: JSON.stringify(request), signal: AbortSignal.timeout(maxWait), redirect: 'error' });
    assert.ok(response.status === 200, 'native projection RPC returned a transport error');
    const decision: unknown = await response.json();
    captures.push({ caseId: item.id, request, decision, latencyMs: performance.now() - started });
  }
} finally {
  // Request one graceful shutdown of ACE, not a process-group signal followed
  // by a second SIGTERM to the same process. ACE owns trace flush and CBM close.
  try {
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('native holdout graceful shutdown timed out')), 20_000);
        child.once('exit', () => { clearTimeout(timer); resolve(); });
        child.kill('SIGTERM');
      });
    }
  } finally {
    await stopRealProviderProcess(child, { termTimeoutMs: 2_000, killTimeoutMs: 2_000 });
  }
}
assert.ok(child.exitCode === 0, 'native holdout runtime did not close gracefully');
const trace = await readFile(tracePath, 'utf8');
const terminal = JSON.parse(await readFile(tracePath + '.receipt.json', 'utf8')) as RetrievalBenchmarkTerminalReceipt;
// Independently compare trace candidates against actual frozen source bytes.
// Do not retain whole files or print private source; the captured PREPARED body
// already passed the existing secret and data-policy checks.
for (const line of trace.split('\n').filter((value) => value.trim())) {
  const event = JSON.parse(line) as RetrievalBenchmarkTraceEvent;
  for (const candidate of event.candidates) {
    const source = await exact(candidate.repoPath);
    const span = exactUtf8Span(source.bytes, candidate.range);
    assert.ok(source.digest === candidate.sourceDigest && span !== undefined
      && sha256(span) === candidate.sourceTextSha256 && span.length === candidate.sourceTextCharacters,
    'retrieval trace candidate does not match exact frozen bytes');
  }
}
await verifyCheckout();
const evidence: NativeProjectionEvidence = {
  schemaVersion: 1, holdoutSha256, sourceCommit: runtime.sourceCommit, runnerVersion: nativeProjectionRunnerVersion,
  repositoryId, manifestBase64: manifestBytes.toString('base64'), trace, terminal, captures,
};
const observations = deriveNativeProjectionObservations(holdout, evidence, holdoutSha256, runtime.sourceCommit);
const evidencePath = join(output, 'projection-evidence.json');
const evidenceBytes = Buffer.from(JSON.stringify(evidence) + '\n', 'utf8');
await writeFile(evidencePath, evidenceBytes, { flag: 'wx', mode: 0o600 });
const run: RetrievalStrategyRun = {
  strategy: nativeCodeRetrieval.strategy, holdoutSha256, sourceCommit: runtime.sourceCommit,
  runnerVersion: nativeProjectionRunnerVersion, providerIdentities: nativeCodeRetrieval.providerIdentities,
  observations, projectionEvidence: [{ path: evidencePath, sha256: sha256(evidenceBytes) }],
};
await writeFile(join(output, 'native-run.json'), JSON.stringify(run, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
process.stdout.write(JSON.stringify({ repositoryId, cases: observations.length,
  blocked: captures.filter((item) => (item.decision as { kind?: unknown }).kind === 'BLOCK').length,
  sourceCommit: runtime.sourceCommit, providerWireCertified: false, output }) + '\n');
