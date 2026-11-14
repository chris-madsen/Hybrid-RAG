import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  classifyFeedbackVerifierHttpStatus,
  hermesCodexAuthenticationRoute,
  inspectFeedbackVerifierConfiguration,
  inspectFeedbackVerifierModelsResponse,
  inspectHermesAuthJson,
} from '../src/domain/feedback-preflight.js';
import * as feedbackPreflight from '../src/domain/feedback-preflight.js';
import {
  feedbackHermesAgentImportPath,
  feedbackHermesVersion,
  type FeedbackReasoningEffort,
  validateFeedbackHarborJob,
  validateMatchingFeedbackHarborJobs,
} from '../src/domain/feedback-harbor-config.js';
import { validateFeedbackExperimentManifest } from '../src/domain/feedback-loop-experiment.js';

const validAuth = JSON.stringify({
  providers: {
    'openai-codex': {
      auth_mode: 'chatgpt',
      tokens: {
        access_token: 'oauth-access-token',
        refresh_token: 'oauth-refresh-token',
      },
      last_refresh: '2026-10-22T16:00:00Z',
    },
  },
});

test('Hermes ChatGPT/Codex OAuth is ready without a manually supplied API key', () => {
  const observed = inspectHermesAuthJson('/home/test/.hermes/auth.json', validAuth);
  assert.equal(observed.status, 'ready');
  assert.equal(observed.authenticationRoute, hermesCodexAuthenticationRoute);
  assert.equal(observed.identity, '/home/test/.hermes/auth.json');
  assert.doesNotMatch(JSON.stringify(observed), /oauth-access-token|oauth-refresh-token|oauth-id-token/u);
});

test('current Hermes credential_pool OAuth schema is accepted without exposing tokens', () => {
  const observed = inspectHermesAuthJson('/home/test/.hermes/auth.json', JSON.stringify({
    active_provider: 'openai-codex',
    credential_pool: {
      'openai-codex': [{
        auth_type: 'oauth',
        access_token: 'oauth-access-token',
        refresh_token: 'oauth-refresh-token',
        last_refresh: '2026-10-23T16:18:50.493094Z',
      }],
    },
  }));
  assert.equal(observed.status, 'ready');
  assert.doesNotMatch(JSON.stringify(observed), /oauth-access-token|oauth-refresh-token/u);
});

test('Hermes Codex-OAuth preflight rejects missing or malformed OAuth state', () => {
  assert.equal(inspectHermesAuthJson('/tmp/auth.json', '').status, 'not_ready');
  assert.equal(inspectHermesAuthJson('/tmp/auth.json', '{}').status, 'not_ready');
  assert.equal(inspectHermesAuthJson('/tmp/auth.json', JSON.stringify({
    providers: { 'openai-codex': { auth_mode: 'chatgpt', tokens: { access_token: 'access-only' }, last_refresh: '2026-10-22T16:00:00Z' } },
  })).status, 'not_ready');
  assert.equal(inspectHermesAuthJson('/tmp/auth.json', JSON.stringify({
    providers: { 'openai-codex': { auth_mode: 'api_key', tokens: { access_token: 'access', refresh_token: 'refresh' }, last_refresh: '2026-10-22T16:00:00Z' } },
  })).status, 'not_ready');
  assert.equal(inspectHermesAuthJson('/tmp/auth.json', JSON.stringify({
    providers: { 'openai-codex': { auth_mode: 'chatgpt', tokens: { access_token: 'access', refresh_token: 'refresh' }, last_refresh: 'not-a-date' } },
  })).status, 'not_ready');
});

test('task verifier preflight never exposes credentials and classifies invalid configuration', () => {
  const missing = inspectFeedbackVerifierConfiguration({ apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'model' });
  assert.equal(missing.status, 'missing_configuration');
  const invalid = inspectFeedbackVerifierConfiguration({ apiKey: '${OPENAI_API_KEY}', baseUrl: 'not-a-url', model: 'model' });
  assert.equal(invalid.status, 'invalid_configuration');
  assert.doesNotMatch(JSON.stringify(invalid), /OPENAI_API_KEY/u);
});

test('verifier readiness rejects model-list success without the requested model', () => {
  const identity = 'https://api.openai.com/v1#model=eval-model';
  assert.equal(inspectFeedbackVerifierModelsResponse({
    data: [{ id: 'eval-model' }, { id: 'another-model' }],
  }, 'eval-model', identity).status, 'ready');
  for (const body of [
    { data: [{ id: 'another-model' }] },
    { data: [] },
    { data: [{ invalid: 'missing id' }] },
    { error: { message: 'not available' } },
    null,
  ]) {
    assert.notEqual(inspectFeedbackVerifierModelsResponse(body, 'eval-model', identity).status, 'ready');
  }
  const queryUrl = inspectFeedbackVerifierConfiguration({
    apiKey: 'x', baseUrl: 'https://example.invalid/v1?mode=1', model: 'm',
  });
  assert.equal(queryUrl.status, 'invalid_configuration');
  const userInfoUrl = new URL('https://example.invalid/v1');
  userInfoUrl.username = 'u';
  userInfoUrl.password = 'p';
  assert.equal(inspectFeedbackVerifierConfiguration({
    apiKey: 'x', baseUrl: userInfoUrl.toString(), model: 'm',
  }).status, 'invalid_configuration');
});

test('task verifier HTTP probe rejects authentication without treating it as a successful result', () => {
  const identity = 'https://api.openai.com/v1#model=eval-model';
  assert.equal(classifyFeedbackVerifierHttpStatus(401, identity).status, 'authentication_rejected');
  assert.equal(classifyFeedbackVerifierHttpStatus(503, identity).status, 'unavailable');
  assert.equal(classifyFeedbackVerifierHttpStatus(200, identity).status, 'ready');
});
test('retired Stage0 tool runner is not a Gateway delivery path', async () => {
  const runtime = await readFile('src/bin/ace-runtime.ts', 'utf8');
  const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { scripts: Record<string, string> };
  assert.match(runtime, /Direct agent context bridge mode is retired/u);
  assert.equal(pkg.scripts['test:feedback-stage0'], undefined);
  assert.equal(pkg.scripts['test:real-provider'], 'npm run build && node scripts/real-provider-e2e.mjs');
});

test('exact-current preflight binds experiment identity to checkout, jobs, Harbor and auth route', () => {
  const module = feedbackPreflight as unknown as {
    readonly validateFeedbackPreflightBinding?: (input: {
      readonly currentSourceCommit: string;
      readonly actualHarborVersion: string;
      readonly expectedAuthenticationRoute: string;
      readonly jobAgent: 'hermes';
      readonly jobAgentVersion: string;
      readonly jobModel: string;
      readonly jobReasoningEffort: FeedbackReasoningEffort;
      readonly experiment: {
        readonly sourceCommit: string;
        readonly agent: 'hermes';
        readonly agentVersion: string;
        readonly model: string;
        readonly reasoningEffort: FeedbackReasoningEffort;
        readonly harborVersion: string;
        readonly authenticationRoute: string;
      };
    }) => readonly string[];
  };
  assert.equal(typeof module.validateFeedbackPreflightBinding, 'function');
  if (module.validateFeedbackPreflightBinding === undefined) return;
  const base = {
    currentSourceCommit: 'a'.repeat(40),
    actualHarborVersion: 'harbor 0.24.0',
    expectedAuthenticationRoute: hermesCodexAuthenticationRoute,
    jobAgent: 'hermes' as const,
    jobAgentVersion: 'v0.22.3',
    jobModel: 'openai-codex/gpt-6-luna',
    jobReasoningEffort: 'xhigh' as const,
    experiment: {
      sourceCommit: 'a'.repeat(40),
      agent: 'hermes' as const,
      agentVersion: 'v0.22.3',
      model: 'openai-codex/gpt-6-luna',
      reasoningEffort: 'xhigh' as const,
      harborVersion: 'harbor 0.24.0',
      authenticationRoute: hermesCodexAuthenticationRoute,
    },
  };
  assert.deepEqual(module.validateFeedbackPreflightBinding(base), []);
  assert.deepEqual(module.validateFeedbackPreflightBinding({
    ...base,
    experiment: { ...base.experiment, sourceCommit: 'b'.repeat(40) },
  }), ['sourceCommit']);
  assert.deepEqual(module.validateFeedbackPreflightBinding({
    ...base,
    experiment: { ...base.experiment, agentVersion: 'v0.0.0' },
  }), ['agentVersion']);
  assert.deepEqual(module.validateFeedbackPreflightBinding({
    ...base,
    experiment: { ...base.experiment, model: 'openai-codex/different-model' },
  }), ['model']);
  assert.deepEqual(module.validateFeedbackPreflightBinding({
    ...base,
    experiment: { ...base.experiment, reasoningEffort: 'medium' },
  }), ['reasoningEffort']);
  assert.deepEqual(module.validateFeedbackPreflightBinding({
    ...base,
    experiment: { ...base.experiment, harborVersion: 'harbor 0.23.0' },
  }), ['harborVersion']);
  assert.deepEqual(module.validateFeedbackPreflightBinding({
    ...base,
    experiment: { ...base.experiment, authenticationRoute: 'different-route' },
  }), ['authenticationRoute']);
});

test('Hermes feedback jobs and manifests preserve exact gpt-6-luna model and xhigh effort', () => {
  const job = (aceContextEnabled: boolean) => ({
    tasks: [{ path: '/frozen/xhigh-task' }],
    agents: [{
      import_path: feedbackHermesAgentImportPath,
      model_name: 'openai-codex/gpt-6-luna',
      kwargs: {
        version: feedbackHermesVersion,
        reasoning_effort: 'xhigh',
        ace_context_enabled: aceContextEnabled,
        ...(aceContextEnabled ? {
          ace_context_bridge_sha256: 'a'.repeat(64),
          context_plugin_sha256: 'b'.repeat(64),
        } : {}),
      },
    }],
    n_concurrent_trials: 1,
    n_attempts: 1,
  });
  const native = validateFeedbackHarborJob(job(false));
  const pair = validateMatchingFeedbackHarborJobs(job(false), job(true));
  assert.equal(native._tag, 'Ok');
  if (native._tag === 'Ok') {
    assert.equal(native.value.model, 'openai-codex/gpt-6-luna');
    assert.equal(native.value.reasoningEffort, 'xhigh');
  }
  assert.equal(pair._tag, 'Ok');

  const manifest = validateFeedbackExperimentManifest({
    schemaVersion: 1,
    runId: 'xhigh-smoke',
    sourceCommit: 'c'.repeat(40),
    taskManifestSha256: 'd'.repeat(64),
    agent: 'hermes',
    agentVersion: feedbackHermesVersion,
    model: 'openai-codex/gpt-6-luna',
    reasoningEffort: 'xhigh',
    harborVersion: 'harbor 0.24.0',
    taskImages: [{ reference: 'registry.example/task:1', digest: `sha256:${'e'.repeat(64)}` }],
    agentAdapterSha256: 'f'.repeat(64),
    aceContextBridgeSha256: 'a'.repeat(64),
    contextPluginSha256: 'b'.repeat(64),
    seed: 'unknown',
    mode: 'cold',
    nConcurrentTrials: 1,
    nAttempts: 1,
    authenticationRoute: hermesCodexAuthenticationRoute,
  });
  assert.equal(manifest._tag, 'Ok');
  if (manifest._tag === 'Ok') {
    assert.equal(manifest.value.model, 'openai-codex/gpt-6-luna');
    assert.equal(manifest.value.reasoningEffort, 'xhigh');
  }
});

test('unsupported feedback reasoning effort is blocked instead of normalized', () => {
  const job = {
    tasks: [{ path: '/frozen/unsupported-effort-task' }],
    agents: [{
      import_path: feedbackHermesAgentImportPath,
      model_name: 'openai-codex/gpt-6-luna',
      kwargs: {
        version: feedbackHermesVersion,
        reasoning_effort: 'ultra',
        ace_context_enabled: false,
      },
    }],
    n_concurrent_trials: 1,
    n_attempts: 1,
  };
  const invalidJob = validateFeedbackHarborJob(job);
  assert.equal(invalidJob._tag, 'Err');
  if (invalidJob._tag === 'Err') assert.equal(invalidJob.error.code, 'INVALID_BENCHMARK');

  const invalidManifest = validateFeedbackExperimentManifest({
    schemaVersion: 1,
    runId: 'unsupported-effort',
    sourceCommit: 'c'.repeat(40),
    taskManifestSha256: 'd'.repeat(64),
    agent: 'hermes',
    agentVersion: feedbackHermesVersion,
    model: 'openai-codex/gpt-6-luna',
    reasoningEffort: 'ultra',
    harborVersion: 'harbor 0.24.0',
    taskImages: [{ reference: 'registry.example/task:1', digest: `sha256:${'e'.repeat(64)}` }],
    agentAdapterSha256: 'f'.repeat(64),
    aceContextBridgeSha256: 'a'.repeat(64),
    contextPluginSha256: 'b'.repeat(64),
    seed: 'unknown',
    mode: 'cold',
    nConcurrentTrials: 1,
    nAttempts: 1,
    authenticationRoute: hermesCodexAuthenticationRoute,
  });
  assert.equal(invalidManifest._tag, 'Err');
  if (invalidManifest._tag === 'Err') assert.equal(invalidManifest.error.code, 'INVALID_BENCHMARK');
});

test('explicit image digest cannot contradict experiment task-image provenance', () => {
  const module = feedbackPreflight as unknown as {
    readonly validateFeedbackImageOverride?: (
      requested: string | undefined,
      experimentImageDigest: string | undefined,
      taskImages: readonly { readonly reference: string; readonly digest: string }[],
    ) => readonly string[];
  };
  assert.equal(typeof module.validateFeedbackImageOverride, 'function');
  if (module.validateFeedbackImageOverride === undefined) return;
  const digestA = `sha256:${'a'.repeat(64)}`;
  const digestB = `sha256:${'b'.repeat(64)}`;
  assert.deepEqual(module.validateFeedbackImageOverride(undefined, digestA, [{ reference: 'task:1', digest: digestA }]), []);
  assert.deepEqual(module.validateFeedbackImageOverride(digestA, digestA, [{ reference: 'task:1', digest: digestA }]), []);
  assert.deepEqual(module.validateFeedbackImageOverride(digestB, digestA, [{ reference: 'task:1', digest: digestA }]), ['imageDigest']);
  assert.deepEqual(module.validateFeedbackImageOverride(digestA, undefined, [
    { reference: 'task:1', digest: digestA },
    { reference: 'task:2', digest: digestB },
  ]), ['imageDigest']);
});


test('OAuth preflight inspects the dedicated Hermes auth store, not Codex CLI state', async () => {
  const preflight = await readFile('scripts/feedback-loop-preflight.ts', 'utf8');
  assert.doesNotMatch(preflight, /CODEX_HOME|\.codex.*auth\.json/u);
  assert.match(preflight, /HERMES_AUTH_JSON_PATH/u);
  assert.match(preflight, /HERMES_HOME/u);
  assert.match(preflight, /\.hermes/u);
});


test('exact-current feedback preflight does not certify retired Hermes bridge digests', async () => {
  const preflight = await readFile('scripts/feedback-loop-preflight.ts', 'utf8');
  assert.match(preflight, /status', '--porcelain=v1'/u);
  assert.match(preflight, /verifyCompiledRuntimeProvenance/u);
  assert.match(preflight, /agentAdapterSha256/u);
  assert.doesNotMatch(preflight, /aceContextBridgeSha256/u);
  assert.match(preflight, /Gateway final-send evidence must be collected independently/u);
  assert.doesNotMatch(preflight, /contextPluginSha256/u);
  assert.match(preflight, /taskVerifier/u);
  assert.match(preflight, /local-task-verifier/u);
  assert.match(preflight, /AbortSignal\.timeout\(5_000\)/u);
});

test('local deterministic preflight makes external dataset registry access not required', async () => {
  const preflight = await readFile('scripts/feedback-loop-preflight.ts', 'utf8');
  assert.match(preflight, /local deterministic dataset does not require Harbor registry access/u);
  assert.match(preflight, /--fast-local/u);
  assert.match(preflight, /host embedding workers/u);
  assert.match(preflight, /harborDataset\(datasetId\)/u);
  assert.match(preflight, /\['ready', 'not_required'\]/u);
});

test('Hermes paired arms leave provider-owned context-window configuration untouched', async () => {
  const adapter = await readFile('scripts/harbor_hermes_codex_oauth.py', 'utf8');
  const beforeBranch = adapter.split('if ace_context_enabled:')[0];
  assert.doesNotMatch(beforeBranch, /model_config\["context_length"\]\s*=/u);
  assert.doesNotMatch(beforeBranch, /config\["model"\]\s*=\s*model_config/u);
});
