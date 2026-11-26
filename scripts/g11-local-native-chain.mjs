// Zero-egress local chain. Reuses the existing native CBM fixture.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { spawnRealProviderProcess } from './real-provider-process.mjs';

const exec = promisify(execFile);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonl = async (path) => (await readFile(path, 'utf8')).trim().split('\n').map(JSON.parse);

export async function runLocalNativeChain({ directory, endpoint, workspaceId, model, port, runtime,
  tracePath, providerTracePath, core, stopRealProviderProcess }) {
  assert.deepEqual(await readdir('/sys/class/net'), ['lo']);
  const [binary, plugin, catalog] = await Promise.all(
    ['ACE_G11_BIFROST_BINARY', 'ACE_G11_BIFROST_PLUGIN', 'ACE_G11_BIFROST_CATALOG'].map((key) => {
      assert.ok(process.env[key], 'missing chain artifact: ' + key);
      return realpath(process.env[key]);
    }));
  const root = join(directory, 'bifrost');
  await mkdir(root);
  const portNumber = await port();
  const base = 'http://127.0.0.1:' + portNumber + '/chatgpt_passthrough/backend-api/codex';
  const config = {
    version: 2, source_of_truth: 'config.json',
    framework: { pricing: { pricing_url: pathToFileURL(join(catalog, 'pricing.json')).href,
      model_parameters_url: pathToFileURL(join(catalog, 'model-parameters.json')).href,
      live_models_sync_interval: 0 } },
    providers: { openai: { keys: [{ name: 'never-selected-synthetic', value: 'synthetic-unused',
      weight: 1, models: ['*'] }] } },
    client: { enable_logging: false, disable_content_logging: true, enforce_auth_on_inference: false },
    plugins: [{ name: 'ace-bifrost-context', path: plugin, enabled: true, placement: 'post_builtin', order: 0 }],
  };
  await writeFile(join(root, 'config.json'), JSON.stringify(config));
  const gateway = spawnRealProviderProcess(binary, ['-host', '127.0.0.1', '-port', String(portNumber), '-app-dir', root], {
    env: { PATH: process.env.PATH, HOME: root,
      BIFROST_REQUIRED_PHYSICAL_SEND_PLUGIN: 'ace-bifrost-context',
      BIFROST_CHATGPT_PASSTHROUGH_SUBSCRIPTION_ONLY: 'true',
      ACE_CONTEXT_RPC_URL: endpoint + '/project',
      ACE_CONTEXT_RPC_TOKEN: 'real-provider-fixture-secret',
      ACE_BIFROST_TENANCY_MODE: 'single-workspace', ACE_BIFROST_WORKSPACE_ID: workspaceId },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let logs = '';
  gateway.stderr.on('data', (chunk) => { logs = (logs + chunk.toString()).slice(-8000); });
  try {
    let ready = false;
    const until = Date.now() + 60000;
    while (Date.now() < until && gateway.exitCode === null) {
      try {
        ready = (await fetch('http://127.0.0.1:' + portNumber + '/health', { signal: AbortSignal.timeout(1000) })).ok;
        if (ready) break;
      } catch { /* startup */ }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, 'Bifröst did not start: ' + logs);
    const { stdout } = await exec('python', [join(import.meta.dirname, 'hermes-task-runtime-probe.py'),
      sha(base), model, 'high'], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, HERMES_CODEX_BASE_URL: base,
        ACE_HERMES_LOCAL_CHAIN: 'true' },
      timeout: 90000,
    });
    const hermes = JSON.parse(stdout.trim().split('\n').at(-1));
    assert.equal(hermes.status, 'READY');
    assert.equal(hermes.localChainObserved, true);
    assert.equal(hermes.physicalDenialObserved, true);
    assert.equal(hermes.endpointSha256, sha(base));
    assert.equal(hermes.modelSha256, sha(model));
    assert.equal(hermes.providerWireCertified, false);
    const audit = await jsonl(join(directory, 'state', 'gateway-policy-audit.jsonl'));
    const physical = audit.filter((entry) => entry.component === 'gateway-physical-send');
    assert.equal(physical.length, 1, 'one real physical attempt must be observed, no retries');
    const [attempt] = physical;
    assert.equal(attempt.outcome, 'denied');
    assert.equal(attempt.reasonCode, 'DESTINATION_NOT_ALLOWED');
    const binding = attempt.physicalSend;
    assert.match(binding.requestId, /^ace-[a-f0-9]{32}$/u);
    assert.match(binding.attemptId, /^bf-attempt-[a-f0-9]{32}$/u);
    assert.equal(attempt.correlationId, binding.attemptId);
    assert.equal(binding.workspaceId, workspaceId);
    assert.equal(binding.provider, 'openai');
    assert.equal(binding.model, model);
    assert.equal(binding.method, 'POST');
    assert.equal(binding.destinationSha256, sha('https://chatgpt.com/backend-api/codex/responses'));
    assert.deepEqual(binding.dataClasses, ['private_source', 'private_conversation']);
    for (const key of ['bodySha256', 'preparedBodySha256', 'projectionReceiptSha256']) {
      assert.match(binding[key], /^[a-f0-9]{64}$/u);
    }
    const providerEvents = await jsonl(providerTracePath);
    assert.ok(providerEvents.some((event) => event.provider === 'codebase_memory'
      && event.operation === 'search_graph' && event.status === 'success'));
    assert.ok(!providerEvents.some((event) => ['qdrant', 'embedding', 'sparse_embedding', 'reranker', 'lsp'].includes(event.provider)));
    await stopRealProviderProcess(core, { termTimeoutMs: 10000 });
    assert.equal(core.exitCode, 0, 'Core must close its trace successfully');
    const terminal = JSON.parse(await readFile(tracePath + '.receipt.json', 'utf8'));
    const trace = await readFile(tracePath);
    assert.equal(terminal.sourceCommit, runtime.sourceCommit);
    assert.equal(terminal.flushStatus, 'ok');
    assert.equal(terminal.closeStatus, 'ok');
    assert.equal(terminal.traceDigest, sha(trace));
    assert.equal(terminal.projections.length, 1);
    const [projection] = terminal.projections;
    assert.equal(projection.requestId, binding.requestId);
    assert.equal(projection.baseBodySha256, hermes.ingressBodySha256, 'actual SDK ingress must match signed projection input');
    assert.equal(projection.receiptSha256, binding.projectionReceiptSha256);
    assert.equal(projection.projectedBodySha256, binding.preparedBodySha256);
    assert.ok(projection.selectedEvidenceIds.length > 0);
    const events = await jsonl(tracePath);
    const delivered = events.filter((event) => event.requestId === projection.providerRequestId && event.stage === 'delivered');
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].status, 'executed');
    assert.ok(delivered[0].candidates.some((candidate) => candidate.repoPath === 'service.ts'), 'fixture source must be delivered');
    assert.deepEqual(delivered[0].candidates.map((candidate) => candidate.evidenceId).sort(), [...projection.selectedEvidenceIds].sort());
    return { status: 'local-native-chain-denied', sourceCommit: runtime.sourceCommit,
      bifrostBinarySha256: sha(await readFile(binary)), bifrostPluginSha256: sha(await readFile(plugin)),
      aceRuntimeSha256: sha(await readFile(runtime.executable)),
      hermes, requestId: binding.requestId, attemptId: binding.attemptId,
      baseBodySha256: projection.baseBodySha256, preparedBodySha256: binding.preparedBodySha256, finalBodySha256: binding.bodySha256,
      projectionReceiptSha256: binding.projectionReceiptSha256,
      retrievalTraceSha256: terminal.traceDigest, reasonCode: attempt.reasonCode,
      providerWireCertified: false };
  } finally {
    await stopRealProviderProcess(gateway, { termTimeoutMs: 5000 });
  }
}
