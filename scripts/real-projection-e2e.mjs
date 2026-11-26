#!/usr/bin/env node
// Real ACE projection -> Core -> native CBM retrieval E2E.
// Default: direct local projection. Optional G11 chain: real Hermes SDK ->
// Bifröst -> ACE/CBM -> physical-send denial. Neither certifies provider wire.
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, open, readdir, readFile, readlink, rename, rm, writeFile } from 'node:fs/promises';
import { availableParallelism, tmpdir, totalmem } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { spawnRealProviderProcess, stopRealProviderProcess } from './real-provider-process.mjs';
import { resolveRealProviderRuntime } from './real-provider-runtime.mjs';
import { assertLoopbackOnlyNetworkNamespace } from './network-namespace-evidence.mjs';

const execFileAsync = promisify(execFile);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const port = async () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (typeof address !== 'object' || address === null) { server.close(); reject(new Error('no local port')); return; }
    server.close((error) => error ? reject(error) : resolve(address.port));
  });
});
const processDescendants = (rootPid) => {
  assert.equal(process.platform, 'linux', 'native provider process-tree acceptance requires Linux');
  const childrenByParent = new Map();
  for (const line of execFileSync('ps', ['-eo', 'pid=,ppid=,args='], { encoding: 'utf8' }).split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/u.exec(line);
    if (!match) continue;
    const entry = { pid: Number(match[1]), parentPid: Number(match[2]), command: match[3] };
    const children = childrenByParent.get(entry.parentPid) ?? [];
    children.push(entry);
    childrenByParent.set(entry.parentPid, children);
  }
  const descendants = [];
  const pending = [rootPid];
  const seen = new Set(pending);
  while (pending.length > 0) {
    for (const child of childrenByParent.get(pending.shift()) ?? []) {
      if (seen.has(child.pid)) continue;
      seen.add(child.pid);
      descendants.push(child);
      pending.push(child.pid);
    }
  }
  return descendants;
};
const assertNoExternalRetrievalProcesses = (rootPid) => {
  const descendants = processDescendants(rootPid);
  const forbidden = descendants.filter((entry) =>
    /qdrant|fastembed|onnxruntime|sentence-transformers|typescript-language-server|reranker-worker|embedding-worker/iu.test(entry.command));
  assert.deepEqual(forbidden, [], 'native CBM mode must not start legacy vector, embedding, reranker or external LSP processes');
  return [...new Set(descendants.map((entry) => basename(entry.command.trim().split(/\s+/u)[0] ?? 'unknown')))].sort();
};
const actualNativeChild = async (rootPid) => {
  const matches = [];
  for (const entry of processDescendants(rootPid)) {
    try {
      const executable = basename(await readlink(`/proc/${entry.pid}/exe`));
      if (executable === 'codebase-memory-mcp') matches.push(entry);
    } catch { /* process exited between observations */ }
  }
  assert.equal(matches.length, 1, 'exactly one actual native CBM executable must be running');
  assert.equal(matches[0].parentPid, rootPid, 'ACE must own the native child directly, not an npm shim');
  return matches[0];
};
const readProviderTrace = async (path) => {
  try {
    const content = (await readFile(path, 'utf8')).trim();
    return content.length === 0 ? [] : content.split('\n').map((line) => JSON.parse(line));
  } catch {
    return [];
  }
};
const localChain = process.env.ACE_REAL_PROJECTION_G11_CHAIN === 'true';
if (localChain) assertLoopbackOnlyNetworkNamespace();
const runtime = await resolveRealProviderRuntime(import.meta.dirname);
const directory = await mkdtemp(join(tmpdir(), 'ace-gateway-real-projection-'));
const workspace = join(directory, 'workspace');
await mkdir(workspace);
const workspaceId = randomUUID();
const code = [
  'export function retryAfterTransientFailure(input: string) {',
  '  let attempt = 0;',
  '  while (attempt < 3) {',
  '    const value = input.trim();',
  '    if (value.length) return value;',
  '    attempt += 1;',
  '  }',
  "  throw new Error('retry failed');",
  '}',
].join('\n') + '\n';
const native = true;
assert.notEqual(process.env.ACE_REAL_PROJECTION_NATIVE_CBM, 'false', 'historical vector projection is retired');
const scale = process.env.ACE_REAL_PROJECTION_NATIVE_SCALE === 'true';
// Frozen development corpus: actual source from the exact built ACE commit,
// not generated filler or a release-grade external holdout.
const scaleCases = [
  { query: 'Find makeResponsesProjectionService in src/application/responses-projection-service.ts.', path: 'src/application/responses-projection-service.ts', symbol: 'makeResponsesProjectionService' },
  { query: 'Find workspaceManifestEqual in src/domain/workspace-manifest.ts.', path: 'src/domain/workspace-manifest.ts', symbol: 'workspaceManifestEqual' },
  { query: 'Find validateNativeResponsesStreamingRoutes in src/application/gateway-security-contract.ts.', path: 'src/application/gateway-security-contract.ts', symbol: 'validateNativeResponsesStreamingRoutes' },
  { query: 'Where does ACE read and verify the current semantic snapshot? Find readVerifiedSemanticSnapshot.', path: 'src/application/semantic-snapshot.ts', symbol: 'readVerifiedSemanticSnapshot' },
];
const initialQuery = scale ? scaleCases[0].query : 'Find retryAfterTransientFailure and its definition.';
const chainModel = 'gpt-5.6-sol';
const chainTracePath = join(directory, 'chain-retrieval-trace.jsonl');
let corpusTree;
let corpusFiles;
let corpusBytes;
const restart = process.env.ACE_REAL_PROJECTION_NATIVE_RESTART === 'true';
const deadline = process.env.ACE_REAL_PROJECTION_NATIVE_DEADLINE === 'true';
const nonGit = process.env.ACE_REAL_PROJECTION_NATIVE_NON_GIT === 'true';
const filler = Array.from({ length: 8 }, (_, i) => 'export const filler_' + i + ' = ' + i + ';').join('\n');
const codePath = join(workspace, 'service.ts');
if (scale) {
  assert.ok(native, 'scale uses native mode only');
  const archive = execFileSync('git', ['-C', runtime.runnerRoot, 'archive', runtime.sourceCommit, 'src'], { maxBuffer: 128 * 1024 * 1024 });
  execFileSync('tar', ['-xf', '-', '-C', workspace], { input: archive });
  corpusTree = execFileSync('git', ['-C', runtime.runnerRoot, 'rev-parse', `${runtime.sourceCommit}:src`], { encoding: 'utf8' }).trim();
  corpusFiles = execFileSync('git', ['-C', runtime.runnerRoot, 'ls-tree', '-r', '--name-only', `${runtime.sourceCommit}:src`], { encoding: 'utf8' }).trim().split('\n').length;
  corpusBytes = archive.byteLength;
  for (const item of scaleCases) assert.ok((await readFile(join(workspace, item.path), 'utf8')).includes(item.symbol));
} else {
  await writeFile(codePath, code + filler + '\n');
}
const git = (...args) => execFileSync('git', ['-C', workspace, ...args], { encoding: 'utf8' });
if (native && !nonGit) {
  git('init', '--quiet');
  git('add', '.');
  git('-c', 'user.name=ACE Test', '-c', 'user.email=ace@example.invalid', 'commit', '--quiet', '-m', 'native fixture');
}
const outage = process.env.ACE_REAL_PROJECTION_OUTAGE === 'true' || process.env.ACE_REAL_PROJECTION_HARD_OUTAGE === 'true';
const race = process.env.ACE_REAL_PROJECTION_RACE === 'true';
const mutations = process.env.ACE_REAL_PROJECTION_NATIVE_MUTATIONS === 'true';
const recovery = process.env.ACE_REAL_PROJECTION_NATIVE_RECOVERY === 'true';
const worktree = process.env.ACE_REAL_PROJECTION_NATIVE_WORKTREE === 'true';
const cancellation = process.env.ACE_REAL_PROJECTION_NATIVE_CANCELLATION === 'true';
const daemonRecovery = process.env.ACE_REAL_PROJECTION_NATIVE_DAEMON_RECOVERY === 'true';
const sharedCache = process.env.ACE_REAL_PROJECTION_NATIVE_SHARED_CACHE === 'true';
assert.ok(!sharedCache || (process.env.ACE_REAL_PROJECTION_ISOLATED_CONTAINER === 'true'
  && process.platform === 'linux' && !outage && !race && !mutations && !recovery && !worktree
  && !cancellation && !restart && !deadline && !nonGit && !scale && !daemonRecovery), 'shared-cache fault injection requires an isolated Linux container');
assert.ok(!daemonRecovery || (process.env.ACE_REAL_PROJECTION_ISOLATED_CONTAINER === 'true'
  && process.platform === 'linux' && !outage && !race && !mutations && !recovery && !worktree
  && !cancellation && !restart && !deadline && !nonGit && !scale), 'daemon fault injection is restricted to the isolated container fixture');
assert.ok(!cancellation || (native && !outage && !race && !mutations && !recovery && !worktree), 'native cancellation requires a healthy standalone fixture');
assert.ok(!worktree || (native && !outage && !race && !mutations && !recovery), 'native worktree evidence requires a healthy standalone fixture');
assert.ok(!recovery || (native && !outage && !race && !mutations), 'native recovery requires a healthy standalone native fixture');
assert.ok(!mutations || (native && !outage && !race), 'native mutation test requires a healthy native-only fixture');
assert.ok(!(restart || deadline || nonGit) || (native && !outage && !race && !mutations && !recovery && !worktree && !cancellation), 'new native scenarios require standalone healthy fixture');
assert.ok([restart, deadline, nonGit, scale].filter(Boolean).length <= 1);
assert.ok(!scale || (native && !outage && !race && !mutations && !recovery && !worktree && !cancellation));
assert.ok(!(native && race), 'historical embedding delay is not a native CBM race oracle');
if (localChain) {
  assert.ok(!outage && !race && !mutations && !recovery && !worktree && !cancellation
    && !daemonRecovery && !sharedCache && !restart && !deadline && !nonGit && !scale);
  assertLoopbackOnlyNetworkNamespace();
}
const maxWait = Number(process.env.ACE_REAL_PROJECTION_TIMEOUT_MS || '180000');
assert.ok(Number.isSafeInteger(maxWait) && maxWait >= 10000 && maxWait <= 600000);
const gatewayPort = await port();
const providerTracePath = join(directory, 'provider-trace.jsonl');
const nativeHome = join(directory, 'native-home');
await mkdir(nativeHome);
const nativeCache = join(nativeHome, 'cbm-cache');
const nativeEnvironment = {
  // The zero-egress chain must not inherit operator credentials, provider flags,
  // proxy configuration or unrelated runtime policy from the invoking shell.
  ...(localChain ? { PATH: process.env.PATH, ACE_CBM_COMMAND: process.env.ACE_CBM_COMMAND } : process.env),
  HOME: nativeHome,
  XDG_CACHE_HOME: join(nativeHome, 'cache'),
  XDG_DATA_HOME: join(nativeHome, 'data'),
  CBM_CACHE_DIR: nativeCache,
  CBM_ALLOWED_ROOT: workspace,
};
const spawnRuntime = (overrides = {}) => spawnRealProviderProcess(process.execPath, [runtime.executable], {
  cwd: runtime.runtimeRoot,
  env: {
    // Inherited container defaults must never override isolated fixture paths.
    ...nativeEnvironment,
    ACE_RUNTIME_ROOT: runtime.runtimeRoot,
    ACE_WORKSPACE_ROOT: workspace,
    ACE_ALLOWED_ROOTS: directory,
    ACE_STATE_DIR: join(directory, 'state'),
    ACE_ARTIFACT_DIR: join(directory, 'artifacts'),
    ACE_PROVIDER_TRACE_FILE: providerTracePath,
    ACE_WORKSPACE_ID: workspaceId,
    ...(native ? {
      ...(outage ? { ACE_CBM_COMMAND: join(directory, 'must-not-start-cbm') } : {}),
    } : {}),
    ACE_ENABLE_GRAPHITI: 'false',
    ACE_CONTEXT_RPC_HOST: '127.0.0.1',
    ACE_CONTEXT_RPC_PORT: String(gatewayPort),
    ACE_CONTEXT_RPC_SHARED_SECRET: 'real-provider-fixture-secret',
    ACE_CONTEXT_EXTERNAL_LLM_OPT_IN: 'true',
    ACE_CONTEXT_ALLOWED_LLM_PROVIDERS_JSON: '["mock"]',
    ACE_CONTEXT_ALLOWED_LLM_MODELS_BY_PROVIDER_JSON: '{"mock":["test-model"]}',
    ACE_CONTEXT_ALLOWED_LLM_DATA_CLASSES_JSON: '["private_source"]',
    ACE_CONTEXT_ALLOWED_LLM_DESTINATIONS_JSON: '[]',
    ACE_CONTEXT_ALLOWED_LLM_STREAMING_ROUTES_JSON: '[]',
    ...(localChain ? {
      ACE_CONTEXT_ALLOWED_LLM_PROVIDERS_JSON: '["openai"]',
      ACE_CONTEXT_ALLOWED_LLM_MODELS_BY_PROVIDER_JSON: JSON.stringify({ openai: [chainModel] }),
      ACE_CONTEXT_ALLOWED_LLM_DATA_CLASSES_JSON: '["private_source","private_conversation"]',
      ACE_BENCHMARK_TRACE_FILE: chainTracePath,
      ACE_EVIDENCE_SOURCE_COMMIT: runtime.sourceCommit,
    } : {}),
    ...overrides,
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});
const startupAt = performance.now();
let child = spawnRuntime();
let startupLog = '';
const endpoint = `http://127.0.0.1:${gatewayPort}/internal/ace-context/v3`;
const timeout = (ms) => AbortSignal.timeout(ms);
const waitForStartup = async (target = child) => {
  let log = '';
  if (target === child) startupLog = '';
  await new Promise((resolve, reject) => {
    let done = false;
    const settle = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => settle(new Error('Gateway startup timed out: ' + log.slice(-3000))), maxWait);
    target.stderr.on('data', (chunk) => {
      log += chunk.toString('utf8');
      if (target === child) startupLog = log;
      if (log.includes('ace-context-rpc listening')) settle();
    });
    target.once('exit', (code) => settle(new Error('Gateway exited before listening: ' + code + ': ' + log.slice(-3000))));
    target.once('error', settle);
  });
};
try {
  await waitForStartup();
  const startupReadyMs = performance.now() - startupAt;
  if (!outage) assert.match(startupLog, /native CBM code retrieval initialized/u);
  if (outage) assert.match(startupLog, /native CBM index failed/u);
  let nativeProcessNames = [];
  if (native) {
    assert.match(startupLog, /provider identities codebase_memory=codebase-memory-mcp\/0\.12\.1/u);
    assert.match(startupLog, /provider identities codebase_memory=codebase-memory-mcp\/0\.12\.1 lsp=not_configured/u);
    assert.doesNotMatch(startupLog, /embedding=fastembed\/onnx|qdrant=qdrant\/|lsp=typescript-language-server/u,
      'runtime provenance must list only providers active in native mode');
    nativeProcessNames = assertNoExternalRetrievalProcesses(child.pid);
    if (!outage) await actualNativeChild(child.pid);
  }
  const health = await fetch(endpoint + '/health', {
    headers: { authorization: 'Bearer real-provider-fixture-secret' }, signal: timeout(10000),
  });
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.providerWire, 'not_certified');

  if (localChain) {
    const { runLocalNativeChain } = await import('./g11-local-native-chain.mjs');
    const observation = await runLocalNativeChain({
      directory, endpoint, workspaceId, model: chainModel, port, runtime,
      tracePath: chainTracePath, providerTracePath, core: child, stopRealProviderProcess,
    });
    console.log(JSON.stringify(observation));
  } else {
  const body = {
    model: 'test-model', store: false,
    input: initialQuery,
    extra_field: { preserve: true },
  };
  const bodyBytes = Buffer.from(JSON.stringify(body), 'utf8');
  const bodyBase64 = bodyBytes.toString('base64');
  const sessionId = 'real-projection-session';
  const requestId = 'ace-' + randomUUID().replaceAll('-', '');
  const payload = {
    schemaVersion: 'ace.context.v3', protocol: 'openai.responses', requestId,
    attemptGroupId: requestId, agentSessionId: sessionId, workspaceId,
    dataClass: 'private', provider: 'mock', model: 'test-model',
    bodyBase64, bodySha256: digest(bodyBytes),
    query: initialQuery,
    projectionMode: 'bifrost_hook', deadlineEpochMs: Date.now() + maxWait,
    attestation: {
      hostBuildDigest: digest('host'), sessionId, activeEngineId: 'bifrost-visible-request-only',
      effectiveCompressionControlsDigest: digest('controls'),
      durableActiveTranscriptRevision: 'rev1', durableActiveTranscriptDigest: digest('transcript'),
      hostCompactionEpoch: 'unknown', attestorId: 'responses-projection-e2e',
      providerManagedHistoryCapability: 'visible', hostTranscriptAttested: false, compactionEnabled: false,
    },
  };
  const projectionStarted = performance.now();
  const responsePromise = fetch(endpoint + '/project', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer real-provider-fixture-secret' },
    body: JSON.stringify(payload), signal: timeout(maxWait),
  });
  const response = await responsePromise;
  const decision = await response.json();
  const initialProjectionElapsedMs = Math.round(performance.now() - projectionStarted);
  let nativeOperationCounts;
  if (native) {
    nativeProcessNames = assertNoExternalRetrievalProcesses(child.pid);
    const traceEvents = await readProviderTrace(providerTracePath);
    const forbiddenProviders = traceEvents.filter((event) =>
      ['qdrant', 'embedding', 'sparse_embedding', 'reranker', 'lsp'].includes(event.provider));
    assert.deepEqual(forbiddenProviders, [], 'native retrieval trace must contain no legacy provider operations');
    const nativeEvents = traceEvents.filter((event) => event.provider === 'codebase_memory');
    nativeOperationCounts = Object.fromEntries([...new Set(nativeEvents.map((event) => event.operation))].map((operation) => [operation, nativeEvents.filter((event) => event.operation === operation).length]));
    assert.ok(nativeEvents.some((event) => event.operation === (outage ? 'index_repository' : 'search_graph')
      && event.status === (outage ? 'failure' : 'success')),
    'provider trace must prove the native CBM operation that determined the projection result');
  }
  assert.equal(response.status, 200, JSON.stringify(decision));
  if (decision.kind === 'BLOCK' && !scale) {
    assert.ok(outage, `normal ready real-provider fixture must not report BLOCK: ${decision.reasonCode}; ${startupLog.slice(-3000)}`);
    assert.equal(typeof decision.reasonCode, 'string');
    assert.ok(decision.reasonCode.length > 0, 'typed denial must specify a reason');
    assert.equal(decision.baseBodySha256, payload.bodySha256);
    if (native && outage) {
      assert.equal(decision.reasonCode, 'NOT_READY', 'missing native provider must cause the block, not a policy or malformed request');
      assert.equal(decision.projectionReceipt, undefined);
      assert.equal(decision.bodyBase64, undefined);
    }
    console.log(JSON.stringify({ status: 'projection-honest-block', outage, reason: decision.reasonCode }));
  } else {
    if (!scale || decision.kind === 'PREPARED') {
    assert.equal(decision.kind, 'PREPARED', JSON.stringify(decision));
    assert.equal(outage, false, 'outage must fail closed rather than returning PREPARED');
    assert.equal(decision.baseBodySha256, payload.bodySha256);
    const projected = JSON.parse(Buffer.from(decision.bodyBase64, 'base64').toString('utf8'));
    assert.deepEqual(projected.extra_field, body.extra_field);
    assert.equal(projected.input[1].content, body.input);
    const contextMessage = projected.input.find((item) => item.role === 'developer' && String(item.content).includes('[ACE verified context]'));
    assert.ok(contextMessage, 'real gateway projection must visibly add verified ACE context');
    if (!scale) assert.match(contextMessage.content, /retryAfterTransientFailure/u);
    if (!scale) assert.match(contextMessage.content, /service\.ts/u, 'context must cite source file');
    if (!scale) {
      // Exercise the compiled Core's real signed receipt, not a fabricated
      // receipt or a provider request. The empty destination policy is deliberate.
      const newAttemptId = () => 'bf-attempt-' + randomUUID().replaceAll('-', '');
      const finalDigest = digest(Buffer.from(decision.bodyBase64, 'base64'));
      assert.equal(finalDigest, decision.projectedBodySha256);
      assert.equal(typeof decision.projectionReceipt, 'string');
      const attempt = {
        schemaVersion: payload.schemaVersion, requestId, attemptGroupId: requestId,
        agentSessionId: sessionId, workspaceId, dataClass: payload.dataClass,
        provider: payload.provider, model: payload.model, attemptId: newAttemptId(),
        method: 'POST', destination: 'https://chatgpt.com/backend-api/codex/responses',
        bodyBase64: decision.bodyBase64, bodySha256: finalDigest,
        preparedBodySha256: decision.projectedBodySha256,
        projectionReceipt: decision.projectionReceipt, deadlineEpochMs: payload.deadlineEpochMs,
      };
      const authorize = async (input, reasonCode) => {
        const result = await fetch(endpoint + '/authorize-attempt', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer real-provider-fixture-secret' },
          body: JSON.stringify(input), signal: timeout(maxWait),
        });
        assert.equal(result.status, 200);
        assert.deepEqual(await result.json(), { kind: 'BLOCK', attemptId: input.attemptId, bodySha256: input.bodySha256, reasonCode });
      };
      const [claims, signature] = decision.projectionReceipt.split('.');
      assert.ok(claims && signature);
      const alteredSignature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
      const forged = { ...attempt, attemptId: newAttemptId(), projectionReceipt: claims + '.' + alteredSignature };
      const mismatched = { ...attempt, attemptId: newAttemptId(), preparedBodySha256: digest('different prepared body') };
      await authorize(forged, 'PROJECTION_RECEIPT_INVALID');
      await authorize(mismatched, 'ATTEMPT_BINDING_MISMATCH');
      await authorize(attempt, 'DESTINATION_NOT_ALLOWED');
      await authorize(attempt, 'ATTEMPT_REPLAYED_OR_CAPACITY_EXHAUSTED');
      const records = (await readFile(join(directory, 'state', 'gateway-policy-audit.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
      const physical = records.filter((entry) => entry.component === 'gateway-physical-send');
      assert.deepEqual(physical.map((entry) => [entry.correlationId, entry.reasonCode, entry.outcome]), [
        [forged.attemptId, 'PROJECTION_RECEIPT_INVALID', 'denied'],
        [mismatched.attemptId, 'ATTEMPT_BINDING_MISMATCH', 'denied'],
        [attempt.attemptId, 'DESTINATION_NOT_ALLOWED', 'denied'],
        [attempt.attemptId, 'ATTEMPT_REPLAYED_OR_CAPACITY_EXHAUSTED', 'denied'],
      ]);
      for (const [entry, input] of physical.map((entry, index) => [entry, [forged, mismatched, attempt, attempt][index]])) {
        assert.equal(entry.physicalSend.requestId, requestId);
        assert.equal(entry.physicalSend.workspaceId, workspaceId);
        assert.equal(entry.physicalSend.bodySha256, finalDigest);
        assert.equal(entry.physicalSend.preparedBodySha256, input.preparedBodySha256);
        assert.equal(entry.physicalSend.projectionReceiptSha256, digest(input.projectionReceipt));
        assert.equal(entry.physicalSend.destinationSha256, digest(input.destination));
      }
      console.log(JSON.stringify({ status: 'local-attempt-denial-pass', providerWireCertified: false }));
    }
    console.log(JSON.stringify({
      status: 'projection-pass', transport: 'ace-internal-projection-http',
      retrieval: 'native_cbm',
      ...(native ? { nativeProcessNames, nativeOperationCounts } : {}),
      elapsedMs: initialProjectionElapsedMs, decisionKind: decision.kind,
      reasonCode: decision.reasonCode,
      source: scale ? 'frozen ACE source subtree' : nonGit ? 'non-Git native CBM fixture' : 'Git-backed native CBM fixture',
      projectedBodySha256: decision.projectedBodySha256,
      providerWireCertified: false,
    }));
    }
    if (mutations || recovery || worktree || cancellation || restart || deadline || nonGit || scale || daemonRecovery || sharedCache) {
      const projectAgain = async (query = payload.query, signal = timeout(maxWait), deadlineMs = maxWait, targetEndpoint = endpoint, targetWorkspaceId = workspaceId) => {
        const nextBytes = Buffer.from(JSON.stringify({ ...body, input: query }), 'utf8');
        const next = {
          ...payload, workspaceId: targetWorkspaceId, query, bodyBase64: nextBytes.toString('base64'), bodySha256: digest(nextBytes),
          requestId: 'responses-projection-' + randomUUID(),
          attemptGroupId: randomUUID(), deadlineEpochMs: Date.now() + deadlineMs,
        };
        const result = await fetch(targetEndpoint + '/project', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer real-provider-fixture-secret',
            ...((daemonRecovery || sharedCache) ? { connection: 'close' } : {}) },
          body: JSON.stringify(next), signal,
        });
        const outcome = await result.json();
        assert.equal(result.status, 200, JSON.stringify(outcome));
        assert.equal(outcome.baseBodySha256, next.bodySha256);
        return outcome;
      };
      if (scale) {
        const delivered = (result, item) => {
          if (result.kind !== 'PREPARED') return { hit: false, citedPaths: [], reason: result.reasonCode };
          const projected = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString('utf8'));
          const context = projected.input.find((entry) => entry.role === 'developer' && String(entry.content).includes('[ACE verified context]'));
          const sections = String(context?.content ?? '').split(/(?=^\[code\] )/mu);
          const citedPaths = sections.map((section) => /^\[code\] ([^:\n]+):/u.exec(section)?.[1]).filter(Boolean);
          return { hit: sections.some((section) => section.startsWith('[code] ' + item.path + ':') && section.includes(item.symbol)), citedPaths };
        };
        const initial = delivered(decision, scaleCases[0]);
        const measurements = [];
        // Twenty warm observations; retain misses and BLOCK results rather
        // than dropping them. This is a fixed development corpus, not SLO approval.
        for (let iteration = 0; iteration < 5; iteration += 1) {
          for (const item of scaleCases) {
            const started = performance.now();
            const result = await projectAgain(item.query);
            measurements.push({ case: item.symbol, durationMs: Math.round(performance.now() - started), kind: result.kind, ...delivered(result, item) });
          }
        }
        const beforeRefresh = performance.now();
        const refreshPath = join(workspace, 'src/domain/workspace-manifest.ts');
        const original = await readFile(refreshPath, 'utf8');
        const symbol = 'nativeScaleRefreshMarker';
        await writeFile(refreshPath, original + '\nexport const nativeScaleRefreshMarker = 913;\n');
        const refreshed = await projectAgain('Find nativeScaleRefreshMarker in src/domain/workspace-manifest.ts.');
        const refreshMs = Math.round(performance.now() - beforeRefresh);
        // Inspect only the verified developer evidence, never the original
        // query (which already contains the symbol and would fake a hit).
        const refreshedInput = refreshed.kind === 'PREPARED'
          ? JSON.parse(Buffer.from(refreshed.bodyBase64, 'base64').toString('utf8')).input : [];
        const refreshedEvidence = refreshedInput.find((entry) => entry.role === 'developer' && String(entry.content).includes('[ACE verified context]'));
        const refreshHit = Boolean(refreshedEvidence?.content.includes('src/domain/workspace-manifest.ts:')
          && refreshedEvidence.content.includes('export const ' + symbol + ' = 913;'));
        const events = await readProviderTrace(providerTracePath);
        const indexEvents = events.filter((event) => event.provider === 'codebase_memory' && event.operation === 'index_repository' && event.status === 'success');
        assert.ok(indexEvents.length >= 2, 'cold and refresh must actually index');
        const durations = measurements.map((sample) => sample.durationMs).sort((a, b) => a - b);
        const percentile = (p) => durations[Math.ceil(p * durations.length) - 1];
        const readCounter = async (name) => { try { return (await readFile('/sys/fs/cgroup/' + name, 'utf8')).trim(); } catch { return null; } };
        const peak = await readCounter('memory.peak');
        const cpu = await readCounter('cpu.stat');
        const disk = Number(execFileSync('du', ['-sb', nativeHome], { encoding: 'utf8' }).trim().split(/\s+/u)[0]);
        const report = {
          status: 'native-scale-observed', scope: 'development-source-corpus-not-release-holdout',
          sourceCommit: runtime.sourceCommit, corpusTree, corpusFiles, corpusArchiveBytes: corpusBytes,
          node: process.version, provider: 'codebase-memory-mcp/0.12.1', availableParallelism: availableParallelism(), hostMemoryBytes: totalmem(),
          startupReadyMs: Math.round(startupReadyMs), coldIndexMs: indexEvents[0].durationMs, initial,
          warmSamples: measurements, warmP50Ms: percentile(0.5), warmP95Ms: percentile(0.95), refreshMs, refreshHit,
          cgroupPeakBytes: peak !== null && /^\d+$/u.test(peak) ? Number(peak) : null,
          cgroupCpuStat: cpu, nativeHomeDiskBytes: disk, providerProcessNames: assertNoExternalRetrievalProcesses(child.pid),
          failures: measurements.filter((sample) => !sample.hit).length + (refreshHit ? 0 : 1) + (initial.hit ? 0 : 1),
          providerWireCertified: false, resourceBudgetApproved: false,
        };
        console.log(JSON.stringify(report));
        assert.equal(report.failures, 0, 'development corpus misses are not silently discarded');
      }
      if (daemonRecovery) {
        // Reuse the pinned upstream daemon control interface. Never search for
        // or kill a process by name: verify fixture-owned cache and home first.
        const frontend = await actualNativeChild(child.pid);
        const command = await readlink('/proc/' + frontend.pid + '/exe');
        const daemonPid = async () => {
          const { stdout: status } = await execFileAsync(command, ['daemon', 'status'], {
            env: nativeEnvironment, encoding: 'utf8', timeout: 10000,
          });
          assert.match(status, /daemon: active \(session-managed\)/u);
          const match = /^\s*pid: (\d+)\s*$/mu.exec(status);
          assert.ok(match, 'upstream daemon status must identify its actual PID');
          return Number(match[1]);
        };
        const oldDaemon = await daemonPid();
        assert.ok(oldDaemon > 1 && oldDaemon !== child.pid && oldDaemon !== frontend.pid);
        assert.equal(await readlink('/proc/' + oldDaemon + '/exe'), command);
        const daemonEnv = (await readFile('/proc/' + oldDaemon + '/environ', 'utf8')).split('\0');
        assert.ok(daemonEnv.includes('HOME=' + nativeHome) && daemonEnv.includes('CBM_CACHE_DIR=' + nativeCache),
          'refuse fault injection unless daemon is bound to the disposable fixture');
        // Do not block the HTTP client's event loop while the upstream CLI
        // waits for cache admission. A stale idle socket is not daemon evidence.
        await assert.rejects(execFileAsync(command, ['cli', 'list_projects', '--format', 'json'], {
          env: { ...nativeEnvironment, CBM_CACHE_DIR: join(nativeHome, 'conflicting-cache') },
          encoding: 'utf8', timeout: 15000,
        }), (error) => typeof error?.code === 'number' && error.code !== 0
          && error.signal === null && !error.killed,
        'a conflicting cache must be explicitly refused, not timed out');
        assert.equal(await daemonPid(), oldDaemon, 'conflicting cache must not replace the active daemon');
        const indexCount = async () => (await readProviderTrace(providerTracePath)).filter((event) =>
          event.provider === 'codebase_memory' && event.operation === 'index_repository' && event.status === 'success').length;
        const indexesBeforeLoss = await indexCount();
        assert.ok(indexesBeforeLoss > 0);
        process.kill(oldDaemon, 'SIGKILL');
        // Health checks only the existing ACE transport, never the daemon.
        // Explicitly use a fresh socket to distinguish provider loss from an
        // idle fixture connection closed while the CLI was waiting.
        const alive = await fetch(endpoint + '/health', {
          headers: { authorization: 'Bearer real-provider-fixture-secret', connection: 'close' },
          signal: timeout(10000),
        });
        assert.equal(alive.status, 200);
        await alive.json();
        // A request racing the loss may be explicitly unavailable. Never credit
        // an unverified response, and require actual recovery on unchanged source.
        let recovered;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const result = await projectAgain();
          if (result.kind === 'PREPARED') { recovered = result; break; }
          assert.equal(result.kind, 'BLOCK');
          assert.equal(result.reasonCode, 'NOT_READY');
          assert.equal(result.projectionReceipt, undefined);
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        assert.ok(recovered, 'actual daemon loss must recover without source edits');
        const projected = JSON.parse(Buffer.from(recovered.bodyBase64, 'base64').toString('utf8'));
        const context = projected.input.find((item) => item.role === 'developer'
          && String(item.content).includes('[ACE verified context]'));
        assert.ok(context);
        assert.match(context.content, /retryAfterTransientFailure/u);
        assert.match(context.content, /service\.ts:/u);
        assert.equal(await readFile(codePath, 'utf8'), code + filler + '\n');
        assert.notEqual(await daemonPid(), oldDaemon, 'recovery must use a new upstream daemon');
        assert.ok(await indexCount() > indexesBeforeLoss, 'unchanged source must be indexed by the recovered session');
        console.log(JSON.stringify({ status: 'native-daemon-recovery-pass', cacheConflictRejected: true, providerWireCertified: false }));
      }
      if (recovery) {
        // Kill the actual stdio child, not the ACE runtime or a fake provider.
        // Observe its disappearance before requesting unchanged source again.
        const nativeChild = await actualNativeChild(child.pid);
        assert.ok(nativeChild, 'actual native stdio child must be present');
        const traceBefore = await readProviderTrace(providerTracePath);
        const indexesBefore = traceBefore.filter((event) => event.provider === 'codebase_memory'
          && event.operation === 'index_repository' && event.status === 'success').length;
        process.kill(nativeChild.pid, 'SIGKILL');
        const until = Date.now() + 10000;
        while (processDescendants(child.pid).some((entry) => entry.pid === nativeChild.pid)) {
          assert.ok(Date.now() < until, 'native stdio child did not exit');
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        const recovered = await Promise.all([projectAgain(), projectAgain()]);
        for (const outcome of recovered) {
          assert.equal(outcome.kind, 'PREPARED', JSON.stringify(outcome));
          const projected = JSON.parse(Buffer.from(outcome.bodyBase64, 'base64').toString('utf8'));
          const context = projected.input.find((item) => item.role === 'developer'
            && String(item.content).includes('[ACE verified context]'));
          assert.ok(context);
          assert.match(context.content, /retryAfterTransientFailure/u);
          assert.match(context.content, /service\.ts:/u);
        }
        assert.equal(await readFile(codePath, 'utf8'), code + filler + '\n', 'no artificial source mutation may trigger recovery');
        const traceAfter = await readProviderTrace(providerTracePath);
        const indexesAfter = traceAfter.filter((event) => event.provider === 'codebase_memory'
          && event.operation === 'index_repository' && event.status === 'success').length;
        assert.equal(indexesAfter, indexesBefore + 1, 'parallel requests must share exactly one recovered publication');
        assertNoExternalRetrievalProcesses(child.pid);
        console.log(JSON.stringify({ status: 'native-recovery-pass', providerWireCertified: false }));
      }
      if (sharedCache) {
        const nativeChild = await actualNativeChild(child.pid);
        const command = await readlink('/proc/' + nativeChild.pid + '/exe');
        const daemonPid = async () => {
          const status = await execFileAsync(command, ['daemon', 'status'], {
            env: nativeEnvironment, encoding: 'utf8', timeout: 10000,
          });
          assert.match(status.stdout, /daemon: active \(session-managed\)/u);
          const match = /^\s*pid: (\d+)\s*$/mu.exec(status.stdout);
          assert.ok(match, 'session-managed native daemon must be visible');
          return Number(match[1]);
        };
        const daemon = await daemonPid();
        const otherPort = await port();
        const otherEndpoint = 'http://127.0.0.1:' + otherPort + '/internal/ace-context/v3';
        const otherTrace = join(directory, 'provider-trace-other.jsonl');
        const otherOverrides = {
          ACE_CONTEXT_RPC_PORT: String(otherPort),
          ACE_STATE_DIR: join(directory, 'state-other'),
          ACE_ARTIFACT_DIR: join(directory, 'artifacts-other'),
          ACE_PROVIDER_TRACE_FILE: otherTrace,
        };
        let other = spawnRuntime(otherOverrides);
        let inFlight;
        let paused = false;
        const context = (outcome) => {
          assert.equal(outcome.kind, 'PREPARED');
          const body = JSON.parse(Buffer.from(outcome.bodyBase64, 'base64').toString('utf8'));
          return body.input.find((entry) => entry.role === 'developer' && String(entry.content).includes('[ACE verified context]')).content;
        };
        const before = await readFile(codePath, 'utf8');
        const sourceHandle = await open(codePath, 'r+');
        const metadata = await sourceHandle.stat();
        const writeSource = async (value) => {
          const bytes = Buffer.from(value, 'utf8');
          await sourceHandle.truncate(0);
          const written = await sourceHandle.write(bytes, 0, bytes.length, 0);
          assert.equal(written.bytesWritten, bytes.length);
        };
        const changed = (marker) => before.replace('return value;', "return value + '" + marker + "';");
        const assertCurrent = (outcome, marker) => {
          const delivered = context(outcome);
          assert.ok(delivered.includes(marker), 'native context must contain the current exact marker');
          assert.ok(!delivered.includes('older-generation'), 'stale writer must not deliver older source');
        };
        try {
          await waitForStartup(other);
          assert.notEqual((await actualNativeChild(other.pid)).pid, nativeChild.pid);
          assert.equal(await daemonPid(), daemon, 'both runtimes must use one session-managed native daemon');
          assert.ok(context(await projectAgain(payload.query, timeout(maxWait), maxWait, otherEndpoint)).includes('retryAfterTransientFailure'));
          const count = async () => (await readProviderTrace(providerTracePath)).filter((event) =>
            event.operation === 'index_repository_request_queued').length;
          const queued = await count();
          await writeSource(changed('older-generation'));
          process.kill(nativeChild.pid, 'SIGSTOP');
          paused = true;
          inFlight = projectAgain();
          // Observe rejection immediately even if the other runtime fails.
          void inFlight.catch(() => {});
          const until = Date.now() + 10000;
          while (await count() <= queued) {
            assert.ok(Date.now() < until, 'first runtime must queue a native index request before source advances');
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          const newer = changed('newer-generation');
          assert.equal(Buffer.byteLength(newer), Buffer.byteLength(changed('older-generation')));
          await writeSource(newer);
          await sourceHandle.utimes(metadata.atime, metadata.mtime);
          assertCurrent(await projectAgain(payload.query, timeout(maxWait), maxWait, otherEndpoint), 'newer-generation');
          process.kill(nativeChild.pid, 'SIGCONT');
          paused = false;
          const staleAttempt = await inFlight;
          if (staleAttempt.kind === 'PREPARED') assertCurrent(staleAttempt, 'newer-generation');
          else {
            assert.equal(staleAttempt.kind, 'BLOCK');
            assert.equal(staleAttempt.projectionReceipt, undefined);
            assert.equal(staleAttempt.bodyBase64, undefined);
          }
          assertCurrent(await projectAgain(), 'newer-generation');
          assertCurrent(await projectAgain(payload.query, timeout(maxWait), maxWait, otherEndpoint), 'newer-generation');
          // ABA: first runtime observes A and queues a real search while its
          // frontend is stopped. Another runtime publishes B; restore A with
          // the same size and mtime before the first search resumes. This
          // exercises stale shared graph hints, not merely two source scans.
          const searchCount = async () => (await readProviderTrace(providerTracePath)).filter((event) =>
            event.operation === 'search_graph_request_queued').length;
          const searchQueued = await searchCount();
          process.kill(nativeChild.pid, 'SIGSTOP');
          paused = true;
          inFlight = projectAgain();
          void inFlight.catch(() => {});
          const searchUntil = Date.now() + 10000;
          while (await searchCount() <= searchQueued) {
            assert.ok(Date.now() < searchUntil, 'first runtime must queue a native search before ABA mutation');
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          const intermediate = changed('other-generation');
          assert.equal(Buffer.byteLength(intermediate), Buffer.byteLength(newer));
          await writeSource(intermediate);
          await sourceHandle.utimes(metadata.atime, metadata.mtime);
          assertCurrent(await projectAgain(payload.query, timeout(maxWait), maxWait, otherEndpoint), 'other-generation');
          await writeSource(newer);
          await sourceHandle.utimes(metadata.atime, metadata.mtime);
          process.kill(nativeChild.pid, 'SIGCONT');
          paused = false;
          const abaAttempt = await inFlight;
          if (abaAttempt.kind === 'PREPARED') {
            assertCurrent(abaAttempt, 'newer-generation');
            assert.ok(!context(abaAttempt).includes('other-generation'), 'intermediate ABA source must never be delivered');
          } else {
            assert.equal(abaAttempt.kind, 'BLOCK');
            assert.equal(abaAttempt.projectionReceipt, undefined);
            assert.equal(abaAttempt.bodyBase64, undefined);
          }
          assertCurrent(await projectAgain(payload.query, timeout(maxWait), maxWait, otherEndpoint), 'newer-generation');
          assertCurrent(await projectAgain(), 'newer-generation');
          // Reuse the daemon/cache from a different registered root. A common
          // symbol and relative path must never substitute a foreign source.
          await stopRealProviderProcess(other);
          const foreign = join(directory, 'foreign-workspace');
          await mkdir(foreign);
          await writeFile(join(foreign, 'service.ts'), changed('foreign-generation'));
          const foreignId = randomUUID();
          other = spawnRuntime({
            ...otherOverrides,
            ACE_WORKSPACE_ROOT: foreign,
            CBM_ALLOWED_ROOT: foreign,
            ACE_WORKSPACE_ID: foreignId,
            ACE_STATE_DIR: join(directory, 'state-foreign'),
            ACE_ARTIFACT_DIR: join(directory, 'artifacts-foreign'),
            ACE_PROVIDER_TRACE_FILE: join(directory, 'provider-trace-foreign.jsonl'),
          });
          await waitForStartup(other);
          assert.equal(await daemonPid(), daemon);
          const foreignContext = context(await projectAgain(payload.query, timeout(maxWait), maxWait, otherEndpoint, foreignId));
          assert.ok(foreignContext.includes('foreign-generation'));
          assert.ok(!foreignContext.includes('newer-generation'));
          const local = context(await projectAgain());
          assert.ok(local.includes('newer-generation') && !local.includes('foreign-generation'));
        } finally {
          if (paused) { try { process.kill(nativeChild.pid, 'SIGCONT'); } catch {} }
          if (inFlight) await inFlight.catch(() => {});
          await sourceHandle.close();
          await stopRealProviderProcess(other);
        }
        // All frontends are now closed before reopening the same cache. The
        // portable export flag is false, but the local SQLite index persists.
        await stopRealProviderProcess(child);
        const sqliteFiles = [];
        const visit = async (path) => {
          for (const entry of await readdir(path, { withFileTypes: true })) {
            const full = join(path, entry.name);
            if (entry.isDirectory()) await visit(full);
            else if (entry.isFile() && /\.db$|\.sqlite3?$/u.test(entry.name)) {
              const file = await open(full, 'r');
              try {
                const magic = Buffer.alloc(16);
                const read = await file.read(magic, 0, magic.length, 0);
                if (read.bytesRead === 16 && magic.toString('utf8') === 'SQLite format 3\0') sqliteFiles.push(full);
              } finally { await file.close(); }
            }
          }
        };
        await visit(nativeCache);
        assert.ok(sqliteFiles.length > 0, 'actual native SQLite cache must remain after runtime stop');
        child = spawnRuntime();
        await waitForStartup();
        assertCurrent(await projectAgain(), 'newer-generation');
        console.log(JSON.stringify({ status: 'native-shared-cache-pass', retainedSqliteFiles: sqliteFiles.length,
          portableExport: false, providerWireCertified: false }));
      }
      if (restart) {
        const oldPid = (await actualNativeChild(child.pid)).pid;
        await stopRealProviderProcess(child);
        assert.throws(() => process.kill(oldPid, 0), { code: 'ESRCH' }, 'old native child must exit with runtime');
        // Reopen the same workspace identity, ACE state and isolated native
        // home. Current upstream invocation is persistence:false: this tests
        // cold recovery, not a claimed persisted native index cache hit.
        await writeFile(codePath, code.replace('return value;', "return value + '-after-restart';") + filler + '\n');
        child = spawnRuntime();
        await waitForStartup();
        const outcome = await projectAgain();
        assert.equal(outcome.kind, 'PREPARED', JSON.stringify(outcome));
        const projected = JSON.parse(Buffer.from(outcome.bodyBase64, 'base64').toString('utf8'));
        assert.match(projected.input[0].content, /-after-restart/u);
        assert.notEqual((await actualNativeChild(child.pid)).pid, oldPid);
        assertNoExternalRetrievalProcesses(child.pid);
        console.log(JSON.stringify({ status: 'native-restart-pass', persistence: false, providerWireCertified: false }));
      }
      if (nonGit) {
        const changed = code.replace('return value;', "return value + '-non-git';") + filler + '\n';
        await writeFile(codePath, changed);
        const outcome = await projectAgain();
        assert.equal(outcome.kind, 'PREPARED', JSON.stringify(outcome));
        const projected = JSON.parse(Buffer.from(outcome.bodyBase64, 'base64').toString('utf8'));
        assert.match(projected.input[0].content, /-non-git/u);
        await rm(codePath);
        const removed = await projectAgain();
        assert.equal(removed.kind, 'BLOCK');
        assert.equal(removed.projectionReceipt, undefined);
        console.log(JSON.stringify({ status: 'native-non-git-pass', providerWireCertified: false }));
      }
      if (deadline) {
        const old = await actualNativeChild(child.pid);
        const count = (events) => events.filter((event) => event.operation === 'index_repository_request_queued').length;
        const before = count(await readProviderTrace(providerTracePath));
        await writeFile(codePath, code.replace('return value;', "return value + '-expired';") + filler + '\n');
        process.kill(old.pid, 'SIGSTOP');
        const started = Date.now();
        const request = projectAgain(payload.query, timeout(15000), 3000);
        try {
          const until = Date.now() + 2500;
          while (count(await readProviderTrace(providerTracePath)) === before) {
            assert.ok(Date.now() < until, 'real reindex must be dispatched before deadline');
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          const expired = await request;
          assert.equal(expired.kind, 'BLOCK');
          assert.equal(expired.reasonCode, 'DEADLINE_EXCEEDED');
          assert.equal(expired.projectionReceipt, undefined);
          assert.ok(Date.now() - started < 10000, 'deadline must not wait for provider timeout');
          assert.throws(() => process.kill(old.pid, 0), { code: 'ESRCH' });
          await writeFile(codePath, code.replace('return value;', "return value + '-after-deadline';") + filler + '\n');
          const outcome = await projectAgain();
          assert.equal(outcome.kind, 'PREPARED', JSON.stringify(outcome));
          const projected = JSON.parse(Buffer.from(outcome.bodyBase64, 'base64').toString('utf8'));
          assert.match(projected.input[0].content, /-after-deadline/u);
          assert.doesNotMatch(projected.input[0].content, /-expired/u);
          await actualNativeChild(child.pid);
          console.log(JSON.stringify({ status: 'native-deadline-pass', elapsedMs: Date.now() - started, providerWireCertified: false }));
        } finally {
          if (processDescendants(child.pid).some((entry) => entry.pid === old.pid)) {
            try { process.kill(old.pid, 'SIGCONT'); } catch { /* retired */ }
          }
          await request;
        }
      }
      if (cancellation) {
        const nativeChild = await actualNativeChild(child.pid);
        assert.ok(nativeChild);
        const indexQueued = (events) => events.filter((event) => event.provider === 'codebase_memory'
          && event.operation === 'index_repository_request_queued').length;
        const queuedBefore = indexQueued(await readProviderTrace(providerTracePath));
        const changed = code.replace('return value;', "return value + '-cancelled-generation';") + filler + '\n';
        await writeFile(codePath, changed);
        const controller = new AbortController();
        // SIGSTOP is a deterministic barrier: the actual native child cannot
        // complete indexing until it is resumed or retired. Observe queued I/O
        // before aborting the HTTP caller, not a guessed delay.
        process.kill(nativeChild.pid, 'SIGSTOP');
        const inFlight = projectAgain(payload.query, controller.signal);
        const aborted = assert.rejects(inFlight, { name: 'AbortError' });
        try {
          const until = Date.now() + 10000;
          while (indexQueued(await readProviderTrace(providerTracePath)) === queuedBefore) {
            assert.ok(Date.now() < until, 'reindex was not queued to the real stopped child');
            await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
          }
          const cancelledAt = Date.now();
          controller.abort();
          await aborted;
          const newest = code.replace('return value;', "return value + '-after-cancellation';") + filler + '\n';
          await writeFile(codePath, newest);
          const outcome = await projectAgain(payload.query, timeout(15000));
          assert.equal(outcome.kind, 'PREPARED', JSON.stringify(outcome));
          const projected = JSON.parse(Buffer.from(outcome.bodyBase64, 'base64').toString('utf8'));
          const context = projected.input.find((item) => item.role === 'developer'
            && String(item.content).includes('[ACE verified context]'));
          assert.ok(context);
          assert.match(context.content, /-after-cancellation/u);
          assert.doesNotMatch(context.content, /-cancelled-generation/u);
          assert.ok(!processDescendants(child.pid).some((entry) => entry.pid === nativeChild.pid));
          assertNoExternalRetrievalProcesses(child.pid);
          console.log(JSON.stringify({ status: 'native-cancellation-pass', recoveryMs: Date.now() - cancelledAt, providerWireCertified: false }));
        } finally {
          controller.abort();
          if (processDescendants(child.pid).some((entry) => entry.pid === nativeChild.pid)) {
            try { process.kill(nativeChild.pid, 'SIGCONT'); } catch { /* child already retired */ }
          }
          await aborted;
        }
      }
      if (worktree) {
        const initialBranch = git('branch', '--show-current').trim();
        assert.ok(initialBranch);
        const addedPath = join(workspace, 'worktree-feature.ts');
        const symbol = 'resolveWorktreePublicationMarker';
        const query = `Find ${symbol} and its implementation in worktree-feature.ts.`;
        const addedCode = (marker) => `export function ${symbol}() {\n  return '${marker}';\n}\n`;
        const verifyAdded = async (marker, forbidden) => {
          const outcome = await projectAgain(query);
          assert.equal(outcome.kind, 'PREPARED', JSON.stringify(outcome));
          const projected = JSON.parse(Buffer.from(outcome.bodyBase64, 'base64').toString('utf8'));
          const context = projected.input.find((item) => item.role === 'developer'
            && String(item.content).includes('[ACE verified context]'));
          assert.ok(context);
          assert.ok(context.content.includes('worktree-feature.ts:'), 'new source must be cited');
          assert.ok(context.content.includes(symbol));
          assert.ok(context.content.includes(marker), 'exact current worktree bytes required');
          if (forbidden) assert.ok(!context.content.includes(forbidden), 'stale branch bytes must not appear');
        };
        await writeFile(addedPath, addedCode('native-worktree-untracked'));
        await verifyAdded('native-worktree-untracked');
        git('add', 'worktree-feature.ts');
        await verifyAdded('native-worktree-untracked');
        git('reset', '--quiet', 'HEAD', '--', 'worktree-feature.ts');
        await verifyAdded('native-worktree-untracked');
        git('add', 'worktree-feature.ts');
        git('-c', 'user.name=ACE Test', '-c', 'user.email=ace@example.invalid', 'commit', '--quiet', '-m', 'add worktree feature');
        await verifyAdded('native-worktree-untracked');
        git('switch', '--quiet', '-c', 'alternate-worktree');
        await writeFile(addedPath, addedCode('native-worktree-alternate'));
        await verifyAdded('native-worktree-alternate', 'native-worktree-untracked');
        git('add', 'worktree-feature.ts');
        git('-c', 'user.name=ACE Test', '-c', 'user.email=ace@example.invalid', 'commit', '--quiet', '-m', 'alternate feature');
        await verifyAdded('native-worktree-alternate', 'native-worktree-untracked');
        git('switch', '--quiet', initialBranch);
        await verifyAdded('native-worktree-untracked', 'native-worktree-alternate');
        assertNoExternalRetrievalProcesses(child.pid);
        console.log(JSON.stringify({ status: 'native-worktree-pass', transitions: ['add-untracked', 'stage', 'unstage', 'commit', 'edit', 'branch-commit', 'branch-switch'], providerWireCertified: false }));
      }
      if (mutations) {
      // Every healthy edit/rename must project new bytes.
      const assertCurrent = (outcome, citation) => {
        assert.equal(outcome.kind, 'PREPARED', JSON.stringify(outcome));
        const projected = JSON.parse(Buffer.from(outcome.bodyBase64, 'base64').toString('utf8'));
        const context = projected.input.find((item) => item.role === 'developer'
          && String(item.content).includes('[ACE verified context]'));
        assert.ok(context);
        assert.match(context.content, /return value \+ '-changed'/u);
        assert.ok(context.content.includes(citation), 'current source citation required');
        return context.content;
      };
      await writeFile(codePath, code.replace('return value;', "return value + '-changed';") + filler + '\n');
      assertCurrent(await projectAgain(), 'service.ts:');
      const renamed = join(workspace, 'renamed.ts');
      await rename(codePath, renamed);
      const renamedContext = assertCurrent(await projectAgain(), 'renamed.ts:');
      assert.ok(!renamedContext.includes('service.ts:'), 'deleted path must not survive rename');
      await rm(renamed);
      const removed = await projectAgain();
      assert.equal(removed.kind, 'BLOCK', 'deleted sole source must not yield stale or falsely certified empty context');
      assert.equal(removed.reasonCode, 'NOT_READY');
      assert.equal(removed.projectionReceipt, undefined);
      nativeProcessNames = assertNoExternalRetrievalProcesses(child.pid);
      console.log(JSON.stringify({ status: 'native-mutations-pass', edits: ['modify', 'rename', 'delete'], providerWireCertified: false }));
      }
    }
  }
  }
} catch (error) {
  if (daemonRecovery) {
    // Fixed diagnostic categories only: do not expose native stderr, source
    // paths, private payloads or credentials in the test log.
    console.error(JSON.stringify({ status: 'native-daemon-recovery-failed',
      runtimeExitCode: child.exitCode, runtimeSignal: child.signalCode,
      brokenPipeObserved: /EPIPE|ERR_STREAM_DESTROYED/u.test(startupLog),
      unhandledErrorObserved: /Unhandled|uncaughtException/u.test(startupLog) }));
  }
  throw error;
} finally {
  await stopRealProviderProcess(child);
  await rm(directory, { recursive: true, force: true });
}
