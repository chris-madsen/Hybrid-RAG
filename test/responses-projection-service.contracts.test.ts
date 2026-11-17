import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Effect } from 'effect';
import { makeResponsesProjectionService } from '../src/application/responses-projection-service.js';
import { handleGatewayProjectionHttp, createGatewayProjectionServer } from '../src/transport/gateway-projection-http.js';
import type { ContextTransformService, AceTransformResult } from '../src/application/context-transform-service.js';
import type { ResponsesProjectionRequest } from '../src/domain/responses-projection.js';
import { defaultLocalPolicy } from '../src/domain/policy.js';
import { makeWorkspaceId } from '../src/domain/workspace.js';
import { ok } from '../src/domain/result.js';

const hash = (x: string): string => createHash('sha256').update(x).digest('hex');
const native = {
  model: 'openai/gpt-test', stream: true, store: false,
  reasoning: { effort: 'medium' },
  tools: [{ type: 'function', name: 'read_file', parameters: { type: 'object' } }],
  input: [
    { role: 'user', content: [{ type: 'input_text', text: 'find entrypoint' }] },
    { type: 'function_call', call_id: 'call-1', name: 'read_file', arguments: '{}' },
    { type: 'function_call_output', call_id: 'call-1', output: 'entrypoint here' },
  ],
};
const req = (override: Partial<ResponsesProjectionRequest> = {}): ResponsesProjectionRequest => {
  const bodyBase64 = Buffer.from(JSON.stringify(native)).toString('base64');
  return {
    schemaVersion: 'ace.gateway.v2', protocol: 'openai.responses',
    requestId: 'r1', attemptGroupId: 'g1', agentSessionId: 's1',
    workspaceId: 'ws1', dataClass: 'private', provider: 'openai', model: native.model,
    bodyBase64, bodySha256: createHash('sha256').update(Buffer.from(bodyBase64, 'base64')).digest('hex'),
    query: 'entrypoint here', projectionMode: 'gateway', deadlineEpochMs: Date.now() + 30000,
    attestation: {
      hostBuildDigest: hash('host'), sessionId: 's1', activeEngineId: 'bifrost-visible-request-only',
      effectiveCompressionControlsDigest: hash('controls'),
      durableActiveTranscriptRevision: 'unattested', durableActiveTranscriptDigest: hash('input'),
      hostCompactionEpoch: 'unknown', attestorId: 'ace-bifrost',
      providerManagedHistoryCapability: 'visible', hostTranscriptAttested: false, compactionEnabled: false,
    },
    ...override,
  };
};
const example: AceTransformResult = {
  schemaVersion: 1, requestId: 'r1', sessionId: 's1', turnId: 'g1',
  workspaceId: 'ws1' as never, status: 'ready',
  contextText: 'src/main.ts:20 confirmed', evidence: [],
  selectedEvidenceIds: ['ev1'], omittedEvidenceIds: [], estimatedTokens: 5,
  tokenCountMode: 'character_estimate', providerIdentities: {},
  receiptId: 'r', providerRequestId: 'p',
  limitations: ['character token estimate only'],
};
const make = (x: Partial<AceTransformResult> = {}, deny = false) => {
  const workspace = makeWorkspaceId('ws1');
  if (workspace._tag === 'Err') throw Error(workspace.error.message);
  const policy = {
    ...defaultLocalPolicy(workspace.value), cloudOptIn: !deny,
    allowedCloudProviders: ['other_external'],
    allowedCloudDataClassesByProvider: { other_external: ['private_source' as const] },
  };
  const context: ContextTransformService = { transform: () => Effect.succeed(ok({ ...example, ...x })) };
  const service = makeResponsesProjectionService(context, {
    policy, allowedProviders: ['openai'], clock: { nowMs: () => Date.now() },
    audit: { append: () => Effect.succeed(ok(undefined)) },
  });
  return service;
};
test('native policy/Effect produces additive context without mutating function/reasoning/tool items', async () => {
  const response = await Effect.runPromise(make().projectResponses(req()));
  assert.equal(response._tag, 'Ok');if (response._tag === 'Err') return;
  assert.equal(response.value.kind, 'PREPARED');
  if (response.value.kind !== 'PREPARED') return;
  const decoded = JSON.parse(Buffer.from(response.value.bodyBase64, 'base64').toString('utf8')) as {
    input: unknown[]; tools: unknown; reasoning: unknown; stream: boolean; store: boolean;
  };
  assert.deepEqual(decoded.input.slice(1), native.input);
  assert.deepEqual(decoded.tools, native.tools);
  assert.deepEqual(decoded.reasoning, native.reasoning);
  assert.equal(decoded.stream, true);
  assert.equal(decoded.store, false);
  assert.equal(response.value.baseBodySha256, req().bodySha256);
});
test('no policy opt-in means BLOCK, not fallthrough', async () => {
  const response = await Effect.runPromise(make({}, true).projectResponses(req()));
  assert.equal(response._tag, 'Ok');
  if (response._tag === 'Ok') assert.equal(response.value.kind, 'BLOCK');
});
test('identity mismatch or no retrieved evidence blocks transformation', async () => {
  for (const changed of [
    { requestId: 'wrong' }, { selectedEvidenceIds: [] }, { contextText: '' },
  ]) {
    const response = await Effect.runPromise(make(changed).projectResponses(req()));
    assert.equal(response._tag, 'Ok');
    if (response._tag === 'Ok') assert.equal(response.value.kind, 'BLOCK');
  }
});
test('native gateway HTTP endpoint requires auth and never invokes legacy project', async () => {
  let legacyCalled = 0;
  const service = { ...make(), project: () => { legacyCalled++; throw Error('legacy service must not be called'); } };
  const payload = JSON.stringify(req());
  const direct = await handleGatewayProjectionHttp(service, 'POST', '/internal/ace-gateway/v2/project', payload);
  assert.equal(direct.statusCode, 200);
  assert.equal(direct.body.kind, 'PREPARED');
  assert.equal(legacyCalled, 0);
  const server = createGatewayProjectionServer(service, { authToken: 'local-secret' });
  await new Promise<void>((done, reject) => { server.once('error', reject);server.listen(0, '127.0.0.1', done); });
  try {
    const addr = server.address();
    assert.ok(addr && typeof addr !== 'string');
    const url = 'http://127.0.0.1:' + addr.port + '/internal/ace-gateway/v2/project';
    const unauthenticated = await fetch(url, { method: 'POST', body: payload });
    assert.equal(unauthenticated.status, 401);
    const authorized = await fetch(url, {
      method: 'POST', headers: { Authorization: 'Bearer local-secret' }, body: payload,
    });
    assert.equal(authorized.status, 200);
    const decision = await authorized.json() as { kind: string };
    assert.equal(decision.kind, 'PREPARED');
    assert.equal(legacyCalled, 0);
  } finally {
    await new Promise<void>((done) => server.close(done));
  }
});
