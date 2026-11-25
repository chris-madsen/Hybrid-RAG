#!/usr/bin/env node
// Real ACE projection -> Core -> native CBM or historical vector retrieval E2E.
// This deliberately does NOT traverse Bifröst or an LLM provider wire. It proves
// real retrieval/projection behavior only; G11 provider-wire acceptance is separate.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
const native = process.env.ACE_REAL_PROJECTION_NATIVE_CBM === 'true';
const filler = Array.from({ length: native ? 8 : 1991 }, (_, i) => 'export const filler_' + i + ' = ' + i + ';').join('\n');
const codePath = join(workspace, 'service.ts');
await writeFile(codePath, code + filler + '\n');
const git = (...args) => execFileSync('git', ['-C', workspace, ...args], { encoding: 'utf8' });
if (native) {
  git('init', '--quiet');
  git('add', '.');
  git('-c', 'user.name=ACE Test', '-c', 'user.email=ace@example.invalid', 'commit', '--quiet', '-m', 'native fixture');
}
const qdrantUrl = process.env.ACE_QDRANT_URL?.trim() || 'http://127.0.0.1:6333';
const outage = process.env.ACE_REAL_PROJECTION_OUTAGE === 'true' || process.env.ACE_REAL_PROJECTION_HARD_OUTAGE === 'true';
const race = process.env.ACE_REAL_PROJECTION_RACE === 'true';
const mutations = process.env.ACE_REAL_PROJECTION_NATIVE_MUTATIONS === 'true';
const recovery = process.env.ACE_REAL_PROJECTION_NATIVE_RECOVERY === 'true';
const worktree = process.env.ACE_REAL_PROJECTION_NATIVE_WORKTREE === 'true';
const cancellation = process.env.ACE_REAL_PROJECTION_NATIVE_CANCELLATION === 'true';
assert.ok(!cancellation || (native && !outage && !race && !mutations && !recovery && !worktree), 'native cancellation requires a healthy standalone fixture');
assert.ok(!worktree || (native && !outage && !race && !mutations && !recovery), 'native worktree evidence requires a healthy standalone fixture');
assert.ok(!recovery || (native && !outage && !race && !mutations), 'native recovery requires a healthy standalone native fixture');
assert.ok(!mutations || (native && !outage && !race), 'native mutation test requires a healthy native-only fixture');
assert.ok(!(native && race), 'historical embedding delay is not a native CBM race oracle');
const maxWait = Number(process.env.ACE_REAL_PROJECTION_TIMEOUT_MS || '180000');
assert.ok(Number.isSafeInteger(maxWait) && maxWait >= 10000 && maxWait <= 600000);
const gatewayPort = await port();
const providerTracePath = join(directory, 'provider-trace.jsonl');
const child = spawnRealProviderProcess(process.execPath, [runtime.executable], {
  cwd: runtime.runtimeRoot,
  env: {
    ...process.env,
    ACE_RUNTIME_ROOT: runtime.runtimeRoot,
    ACE_WORKSPACE_ROOT: workspace,
    ACE_ALLOWED_ROOTS: directory,
    ACE_STATE_DIR: join(directory, 'state'),
    ACE_ARTIFACT_DIR: join(directory, 'artifacts'),
    ...(native ? { ACE_PROVIDER_TRACE_FILE: providerTracePath } : {}),
    ACE_WORKSPACE_ID: workspaceId,
    ACE_CODE_RETRIEVAL_MODE: native ? 'cbm' : '',
    ACE_ENABLE_EXPERIMENTAL_QDRANT: native ? 'false' : 'true',
    ...(native ? {
      ACE_RERANKER_MODE: 'disabled',
      ...(outage ? { ACE_CBM_COMMAND: join(directory, 'must-not-start-cbm') } : {}),
    } : {}),
    ACE_ENABLE_GRAPHITI: 'false',
    ACE_RETRIEVAL_STRATEGY: process.env.ACE_RETRIEVAL_STRATEGY?.trim() || 'dense',
    ACE_QDRANT_URL: native || outage ? 'http://127.0.0.1:6339' : qdrantUrl,
    ACE_QDRANT_WRITER_TOPOLOGY: 'single_host',
    ACE_QDRANT_PUBLICATION_DIR: join(directory, 'qdrant-publication'),
    ACE_EMBEDDING_WORKER: native ? join(directory, 'must-not-start-embedding') : process.env.ACE_EMBEDDING_WORKER ?? runtime.embeddingWorker,
    ACE_CONTEXT_RPC_HOST: '127.0.0.1',
    ACE_CONTEXT_RPC_PORT: String(gatewayPort),
    ACE_CONTEXT_RPC_SHARED_SECRET: 'real-provider-fixture-secret',
    ACE_CONTEXT_EXTERNAL_LLM_OPT_IN: 'true',
    ACE_CONTEXT_ALLOWED_LLM_PROVIDERS_JSON: '["mock"]',
    ACE_CONTEXT_ALLOWED_LLM_MODELS_BY_PROVIDER_JSON: '{"mock":["test-model"]}',
    ACE_CONTEXT_ALLOWED_LLM_DATA_CLASSES_JSON: '["private_source"]',
    ...(race ? { ACE_ENABLE_TEST_FAILPOINTS: 'true', ACE_EMBEDDING_DELAY_MS: '1000' } : {}),
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});
let startupLog = '';
const endpoint = `http://127.0.0.1:${gatewayPort}/internal/ace-context/v3`;
const timeout = (ms) => AbortSignal.timeout(ms);
try {
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
  if (native && !outage) assert.match(startupLog, /native CBM code retrieval initialized/u);
  if (native && outage) assert.match(startupLog, /native CBM index failed/u);
  let nativeProcessNames = [];
  if (native) {
    assert.match(startupLog, /provider identities codebase_memory=codebase-memory-mcp\/0\.12\.1/u);
    assert.match(startupLog, /qdrant=disabled.*embedding=disabled.*sparse_embedding=disabled.*lsp=not_configured/u);
    assert.doesNotMatch(startupLog, /embedding=fastembed\/onnx|qdrant=qdrant\/|lsp=typescript-language-server/u,
      'runtime provenance must list only providers active in native mode');
    nativeProcessNames = assertNoExternalRetrievalProcesses(child.pid);
  }
  const health = await fetch(endpoint + '/health', {
    headers: { authorization: 'Bearer real-provider-fixture-secret' }, signal: timeout(10000),
  });
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.providerWire, 'not_certified');

  const body = {
    model: 'test-model', store: false,
    input: 'Find retryAfterTransientFailure and its definition.',
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
    query: 'Find retryAfterTransientFailure and its definition.',
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
  if (race) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await writeFile(codePath, code.replace('return value;', "return value + '-changed';") + filler + '\n');
  }
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
  if (decision.kind === 'BLOCK') {
    assert.ok(outage || race, `normal ready real-provider fixture must not report BLOCK: ${decision.reasonCode}; ${startupLog.slice(-3000)}`);
    assert.equal(typeof decision.reasonCode, 'string');
    assert.ok(decision.reasonCode.length > 0, 'typed denial must specify a reason');
    assert.equal(decision.baseBodySha256, payload.bodySha256);
    if (native && outage) {
      assert.equal(decision.reasonCode, 'NOT_READY', 'missing native provider must cause the block, not a policy or malformed request');
      assert.equal(decision.projectionReceipt, undefined);
      assert.equal(decision.bodyBase64, undefined);
    }
    console.log(JSON.stringify({ status: 'projection-honest-block', outage, race, reason: decision.reasonCode }));
  } else {
    assert.equal(decision.kind, 'PREPARED', JSON.stringify(decision));
    assert.equal(outage, false, 'outage must fail closed rather than returning PREPARED');
    assert.equal(decision.baseBodySha256, payload.bodySha256);
    const projected = JSON.parse(Buffer.from(decision.bodyBase64, 'base64').toString('utf8'));
    assert.deepEqual(projected.extra_field, body.extra_field);
    assert.equal(projected.input[1].content, body.input);
    const contextMessage = projected.input.find((item) => item.role === 'developer' && String(item.content).includes('[ACE verified context]'));
    assert.ok(contextMessage, 'real gateway projection must visibly add verified ACE context');
    assert.match(contextMessage.content, /retryAfterTransientFailure/u);
    if (race) assert.match(contextMessage.content, /-changed/u, 'stale source must not masquerade as current');
    else assert.match(contextMessage.content, /service\.ts/u, 'context must cite source file');
    console.log(JSON.stringify({
      status: 'projection-pass', transport: 'ace-internal-projection-http',
      retrieval: native ? 'native_cbm' : 'historical_vector', ...(native ? {} : { qdrant: qdrantUrl }),
      ...(native ? { nativeProcessNames } : {}),
      source: native ? 'Git-backed native CBM fixture' : '2000-line TypeScript fixture', race,
      projectedBodySha256: decision.projectedBodySha256,
      providerWireCertified: false,
    }));
    if (mutations || recovery || worktree || cancellation) {
      const projectAgain = async (query = payload.query, signal = timeout(maxWait)) => {
        const nextBytes = Buffer.from(JSON.stringify({ ...body, input: query }), 'utf8');
        const next = {
          ...payload, query, bodyBase64: nextBytes.toString('base64'), bodySha256: digest(nextBytes),
          requestId: 'responses-projection-' + randomUUID(),
          attemptGroupId: randomUUID(), deadlineEpochMs: Date.now() + maxWait,
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
      if (recovery) {
        // Kill the actual stdio child, not the ACE runtime or a fake provider.
        // Observe its disappearance before requesting unchanged source again.
        const nativeChild = processDescendants(child.pid).find((entry) =>
          entry.parentPid === child.pid && /codebase-memory-mcp/u.test(entry.command));
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
      if (cancellation) {
        const nativeChild = processDescendants(child.pid).find((entry) =>
          entry.parentPid === child.pid && /codebase-memory-mcp/u.test(entry.command));
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
} finally {
  await stopRealProviderProcess(child);
  await rm(directory, { recursive: true, force: true });
}
