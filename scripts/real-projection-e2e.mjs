#!/usr/bin/env node
// Real ACE projection -> Core -> native CBM retrieval E2E.
// This deliberately does NOT traverse Bifröst or an LLM provider wire. It proves
// real retrieval/projection behavior only; G11 provider-wire acceptance is separate.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, readFile, readlink, rename, rm, writeFile } from 'node:fs/promises';
import { availableParallelism, tmpdir, totalmem } from 'node:os';
import { basename, join } from 'node:path';
import { spawnRealProviderProcess, stopRealProviderProcess } from './real-provider-process.mjs';
import { resolveRealProviderRuntime } from './real-provider-runtime.mjs';

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
const maxWait = Number(process.env.ACE_REAL_PROJECTION_TIMEOUT_MS || '180000');
assert.ok(Number.isSafeInteger(maxWait) && maxWait >= 10000 && maxWait <= 600000);
const gatewayPort = await port();
const providerTracePath = join(directory, 'provider-trace.jsonl');
const nativeHome = join(directory, 'native-home');
await mkdir(nativeHome);
const nativeCache = join(nativeHome, 'cbm-cache');
const nativeEnvironment = {
  ...process.env,
  HOME: nativeHome,
  XDG_CACHE_HOME: join(nativeHome, 'cache'),
  XDG_DATA_HOME: join(nativeHome, 'data'),
  CBM_CACHE_DIR: nativeCache,
  CBM_ALLOWED_ROOT: workspace,
};
const spawnRuntime = () => spawnRealProviderProcess(process.execPath, [runtime.executable], {
  cwd: runtime.runtimeRoot,
  env: {
    ...process.env,
    ACE_RUNTIME_ROOT: runtime.runtimeRoot,
    ACE_WORKSPACE_ROOT: workspace,
    ACE_ALLOWED_ROOTS: directory,
    ACE_STATE_DIR: join(directory, 'state'),
    ACE_ARTIFACT_DIR: join(directory, 'artifacts'),
    ...nativeEnvironment,
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
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});
const startupAt = performance.now();
let child = spawnRuntime();
let startupLog = '';
const endpoint = `http://127.0.0.1:${gatewayPort}/internal/ace-context/v3`;
const timeout = (ms) => AbortSignal.timeout(ms);
const waitForStartup = async () => {
  startupLog = '';
  await new Promise((resolve, reject) => {
    let done = false;
    const settle = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => settle(new Error('Gateway startup timed out: ' + startupLog.slice(-3000))), maxWait);
    child.stderr.on('data', (chunk) => {
      startupLog += chunk.toString('utf8');
      if (startupLog.includes('ace-context-rpc listening')) settle();
    });
    child.once('exit', (code) => settle(new Error('Gateway exited before listening: ' + code + ': ' + startupLog.slice(-3000))));
    child.once('error', settle);
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

  const body = {
    model: 'test-model', store: false,
    input: initialQuery,
    extra_field: { preserve: true },
  };
  const bodyBytes = Buffer.from(JSON.stringify(body), 'utf8');
  const bodyBase64 = bodyBytes.toString('base64');
  const sessionId = 'real-projection-session';
  const payload = {
    schemaVersion: 'ace.context.v3', protocol: 'openai.responses', requestId: 'responses-projection-' + randomUUID(),
    attemptGroupId: 'turn-1', agentSessionId: sessionId, workspaceId,
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
  const responsePromise = fetch(endpoint + '/project', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer real-provider-fixture-secret' },
    body: JSON.stringify(payload), signal: timeout(maxWait),
  });
  const response = await responsePromise;
  const decision = await response.json();
  if (native) {
    nativeProcessNames = assertNoExternalRetrievalProcesses(child.pid);
    const traceEvents = await readProviderTrace(providerTracePath);
    const forbiddenProviders = traceEvents.filter((event) =>
      ['qdrant', 'embedding', 'sparse_embedding', 'reranker', 'lsp'].includes(event.provider));
    assert.deepEqual(forbiddenProviders, [], 'native retrieval trace must contain no legacy provider operations');
    const nativeEvents = traceEvents.filter((event) => event.provider === 'codebase_memory');
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
    console.log(JSON.stringify({
      status: 'projection-pass', transport: 'ace-internal-projection-http',
      retrieval: 'native_cbm',
      ...(native ? { nativeProcessNames } : {}),
      source: scale ? 'frozen ACE source subtree' : nonGit ? 'non-Git native CBM fixture' : 'Git-backed native CBM fixture',
      projectedBodySha256: decision.projectedBodySha256,
      providerWireCertified: false,
    }));
    }
    if (mutations || recovery || worktree || cancellation || restart || deadline || nonGit || scale || daemonRecovery) {
      const projectAgain = async (query = payload.query, signal = timeout(maxWait), deadlineMs = maxWait) => {
        const nextBytes = Buffer.from(JSON.stringify({ ...body, input: query }), 'utf8');
        const next = {
          ...payload, query, bodyBase64: nextBytes.toString('base64'), bodySha256: digest(nextBytes),
          requestId: 'responses-projection-' + randomUUID(),
          attemptGroupId: randomUUID(), deadlineEpochMs: Date.now() + deadlineMs,
        };
        const result = await fetch(endpoint + '/project', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer real-provider-fixture-secret' },
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
        const daemonPid = () => {
          const status = execFileSync(command, ['daemon', 'status'], {
            env: nativeEnvironment, encoding: 'utf8', timeout: 10000,
          });
          assert.match(status, /daemon: active \(session-managed\)/u);
          const match = /^\s*pid: (\d+)\s*$/mu.exec(status);
          assert.ok(match, 'upstream daemon status must identify its actual PID');
          return Number(match[1]);
        };
        const oldDaemon = daemonPid();
        assert.ok(oldDaemon > 1 && oldDaemon !== child.pid && oldDaemon !== frontend.pid);
        assert.equal(await readlink('/proc/' + oldDaemon + '/exe'), command);
        const daemonEnv = (await readFile('/proc/' + oldDaemon + '/environ', 'utf8')).split('\0');
        assert.ok(daemonEnv.includes('HOME=' + nativeHome) && daemonEnv.includes('CBM_CACHE_DIR=' + nativeCache),
          'refuse fault injection unless daemon is bound to the disposable fixture');
        const conflicting = spawnSync(command, ['cli', 'list_projects', '--format', 'json'], {
          env: { ...nativeEnvironment, CBM_CACHE_DIR: join(nativeHome, 'conflicting-cache') },
          encoding: 'utf8', timeout: 15000,
        });
        assert.equal(conflicting.error, undefined, 'a timeout is not proof of upstream cache admission refusal');
        assert.ok(typeof conflicting.status === 'number' && conflicting.status !== 0,
          'a second canonical cache root must not join the active account daemon');
        assert.equal(daemonPid(), oldDaemon, 'conflicting cache must not replace the active daemon');
        process.kill(oldDaemon, 'SIGKILL');
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
        assert.notEqual(daemonPid(), oldDaemon, 'recovery must use a new upstream daemon');
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
