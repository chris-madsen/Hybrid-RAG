import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Effect } from 'effect';
import { makeResponsesProjectionService } from '../src/application/responses-projection-service.js';
import { handleGatewayProjectionHttp, createGatewayProjectionServer } from '../src/transport/gateway-projection-http.js';
import { makeContextTransformService, type ContextTransformService, type AceTransformResult } from '../src/application/context-transform-service.js';
import type { ResponsesProjectionRequest } from '../src/domain/responses-projection.js';
import { defaultLocalPolicy } from '../src/domain/policy.js';
import type { DataClass } from '../src/domain/policy.js';
import { makeWorkspaceId } from '../src/domain/workspace.js';
import type { WorkspaceRecord } from '../src/domain/workspace.js';
import type { ContextBundle } from '../src/domain/retrieval.js';
import { domainError } from '../src/domain/errors.js';
import { err, ok } from '../src/domain/result.js';
import type { GatewayProjectionSecurity } from '../src/application/gateway-security-contract.js';

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
const req = (override: Partial<ResponsesProjectionRequest> = {}, bodyValue: unknown = native): ResponsesProjectionRequest => {
  const bodyBase64 = Buffer.from(JSON.stringify(bodyValue)).toString('base64');
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
      providerManagedHistoryCapability: 'unknown', hostTranscriptAttested: false, compactionEnabled: false,
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
interface MakeOptions {
  readonly result?: Partial<AceTransformResult>;
  readonly deny?: boolean;
  readonly allowedProviders?: readonly string[];
  readonly allowedDataClasses?: readonly Exclude<DataClass, 'secret'>[];
  readonly context?: ContextTransformService;
  readonly audit?: GatewayProjectionSecurity['audit'];
}
const make = (options: MakeOptions = {}) => {
  const workspace = makeWorkspaceId('ws1');
  if (workspace._tag === 'Err') throw Error(workspace.error.message);
  const policy = {
    ...defaultLocalPolicy(workspace.value), cloudOptIn: options.deny !== true,
    allowedCloudProviders: ['other_external'],
    allowedCloudDataClassesByProvider: { other_external: options.allowedDataClasses ?? ['private_source'] },
  };
  const context = options.context ?? { transform: () => Effect.succeed(ok({ ...example, ...(options.result ?? {}) })) };
  return makeResponsesProjectionService(context, {
    policy, allowedProviders: options.allowedProviders ?? ['openai'], clock: { nowMs: () => Date.now() },
    audit: options.audit ?? { append: () => Effect.succeed(ok(undefined)) },
  });
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
  const response = await Effect.runPromise(make({ deny: true }).projectResponses(req()));
  assert.equal(response._tag, 'Ok');
  if (response._tag === 'Ok') assert.equal(response.value.kind, 'BLOCK');
});
test('identity mismatch or no retrieved evidence blocks transformation', async () => {
  for (const changed of [
    { requestId: 'wrong' }, { selectedEvidenceIds: [] }, { contextText: '' },
  ]) {
    const response = await Effect.runPromise(make({ result: changed }).projectResponses(req()));
    assert.equal(response._tag, 'Ok');
    if (response._tag === 'Ok') assert.equal(response.value.kind, 'BLOCK');
  }
});

test('verified empty context preserves native request byte-for-byte; incomplete remains blocked', async () => {
  const original = req();
  const empty = await Effect.runPromise(make({
    result: { contextText: '', selectedEvidenceIds: [], evidence: [], limitations: [] },
  }).projectResponses(original));
  assert.equal(empty._tag, 'Ok');
  if (empty._tag === 'Ok') {
    assert.equal(empty.value.kind, 'PREPARED');
    assert.equal(empty.value.reasonCode, 'VERIFIED_NO_CONTEXT_NEEDED');
    if (empty.value.kind === 'PREPARED') {
      assert.equal(empty.value.bodyBase64, original.bodyBase64);
      assert.equal(empty.value.projectedBodySha256, original.bodySha256);
    }
  }
  for (const result of [
    { status: 'partial' as const, contextText: '', selectedEvidenceIds: [], limitations: [] },
    { contextText: '', selectedEvidenceIds: [], limitations: ['required code source is stale'] },
  ]) {
    const denied = await Effect.runPromise(make({ result }).projectResponses(original));
    assert.equal(denied._tag, 'Ok');
    if (denied._tag === 'Ok') assert.equal(denied.value.kind, 'BLOCK');
  }
});

test('hidden provider state and active host compaction block before retrieval', async () => {
  let transforms = 0;
  const context: ContextTransformService = { transform: () => {
    transforms += 1;
    return Effect.succeed(ok(example));
  } };
  for (const attestation of [
    { ...req().attestation, providerManagedHistoryCapability: 'hidden' as const },
    { ...req().attestation, hostTranscriptAttested: true, providerManagedHistoryCapability: 'unknown' as const },
    { ...req().attestation, hostTranscriptAttested: true, compactionEnabled: true },
    { ...req().attestation, hostTranscriptAttested: true, hostCompactionEpoch: 'unknown' as const },
  ]) {
    const response = await Effect.runPromise(make({ context }).projectResponses(req({ attestation })));
    assert.equal(response._tag, 'Ok');
    if (response._tag === 'Ok') assert.equal(response.value.kind, 'BLOCK');
  }
  assert.equal(transforms, 0);
});

test('unattested but explicitly stateless native input may prepare context without fabricated provider history evidence', async () => {
  const response = await Effect.runPromise(make().projectResponses(req()));
  assert.equal(response._tag, 'Ok');
  if (response._tag === 'Ok') assert.equal(response.value.kind, 'PREPARED');
});

test('provider allowlist, cloud opt-in, and private-source policy deny before retrieval', async () => {
  let transforms = 0;
  const context: ContextTransformService = { transform: () => {
    transforms += 1;
    return Effect.succeed(ok(example));
  } };
  for (const service of [
    make({ context, allowedProviders: ['another-provider'] }),
    make({ context, deny: true }),
    make({ context, allowedDataClasses: ['public'] }),
  ]) {
    const response = await Effect.runPromise(service.projectResponses(req()));
    assert.equal(response._tag, 'Ok');
    if (response._tag === 'Ok') assert.equal(response.value.kind, 'BLOCK');
  }
  assert.equal(transforms, 0);
});

test('secret material in the original request or selected evidence blocks projection', async () => {
  let transforms = 0;
  const context: ContextTransformService = { transform: () => {
    transforms += 1;
    return Effect.succeed(ok(example));
  } };
  const secretInput = {
    ...native,
    input: [{ role: 'user', content: 'deploy with api_key=abcd1234567890' }],
  };
  const originalSecret = await Effect.runPromise(make({ context }).projectResponses(
    req({ query: 'deploy with api_key=abcd1234567890' }, secretInput),
  ));
  assert.equal(originalSecret._tag, 'Ok');
  if (originalSecret._tag === 'Ok') assert.equal(originalSecret.value.kind, 'BLOCK');
  assert.equal(transforms, 0);

  const selectedSecret = await Effect.runPromise(make({
    result: { contextText: 'deployment api_key=abcd1234567890' },
  }).projectResponses(req()));
  assert.equal(selectedSecret._tag, 'Ok');
  if (selectedSecret._tag === 'Ok') assert.equal(selectedSecret.value.kind, 'BLOCK');
});

test('body/model/query mismatch and transform failure never become empty success', async () => {
  let transforms = 0;
  const context: ContextTransformService = { transform: () => {
    transforms += 1;
    return Effect.succeed(ok(example));
  } };
  for (const request of [req({ model: 'different-model' }), req({ query: 'unbound query' })]) {
    const response = await Effect.runPromise(make({ context }).projectResponses(request));
    assert.ok(response._tag === 'Err' || response.value.kind === 'BLOCK');
  }
  assert.equal(transforms, 0);

  const failing: ContextTransformService = {
    transform: () => Effect.succeed(err(domainError('NOT_READY', 'context', 'fixture unavailable'))),
  };
  const response = await Effect.runPromise(make({ context: failing }).projectResponses(req()));
  assert.equal(response._tag, 'Ok');
  if (response._tag === 'Ok') assert.equal(response.value.kind, 'BLOCK');
});

test('audit failure is explicit and blocks native projection', async () => {
  const audit: GatewayProjectionSecurity['audit'] = {
    append: () => Effect.succeed(err(domainError('AUDIT_FAILED', 'audit', 'fixture audit unavailable'))),
  };
  const response = await Effect.runPromise(make({ audit }).projectResponses(req()));
  assert.equal(response._tag, 'Err');
  if (response._tag === 'Err') assert.equal(response.error.code, 'AUDIT_FAILED');
});

test('native gateway HTTP endpoint requires auth and returns local preparation only', async () => {
  const service = make();
  const payload = JSON.stringify(req());
  const direct = await handleGatewayProjectionHttp(service, 'POST', '/internal/ace-gateway/v2/project', payload);
  assert.equal(direct.statusCode, 200);
  assert.equal(direct.body.kind, 'PREPARED');
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
  } finally {
    await new Promise<void>((done) => server.close(done));
  }
});

test('native projection forwards only visible input text to incremental receipt assembly', async () => {
  let seen: readonly string[] | undefined;
  const context: ContextTransformService = {
    transform: (args) => {
      seen = args.visibleNativeInputText;
      return Effect.succeed(ok(example));
    },
  };
  const response = await Effect.runPromise(make({ context }).projectResponses(req()));
  assert.equal(response._tag, 'Ok');
  if (response._tag === 'Ok') assert.equal(response.value.kind, 'PREPARED');
  assert.deepEqual(seen, ['find entrypoint', 'entrypoint here']);
});

test('completed empty retrieval and unavailable retrieval have different outcomes', async () => {
  const workspaceId = makeWorkspaceId('ws1');
  assert.equal(workspaceId._tag, 'Ok');
  if (workspaceId._tag === 'Err') return;
  const workspace: WorkspaceRecord = {
    workspaceId: workspaceId.value, rootPath: '/workspace',
    observationEpoch: 1, createdAtMs: 1,
  };
  const makeSearch = (complete: boolean, partialSources: string[] = []) =>
    makeContextTransformService({
      ids: { newRequestId: () => 'search-generated-id' },
      store: { get: () => Effect.succeed(ok(workspace)) },
      context: { search: () => Effect.succeed(ok({
        requestId: 'search-empty' as ContextBundle['requestId'],
        query: 'summarize the task', evidence: [], warnings: [],
        partialSources, complete,
      })) },
    });
  const body = { ...native, input: [{ role: 'user', content: 'summarize the task' }] };
  const request = req({ query: 'summarize the task' }, body);
  const success = await Effect.runPromise(make({ context: makeSearch(true) }).projectResponses(request));
  assert.equal(success._tag, 'Ok');
  if (success._tag === 'Ok') {
    assert.equal(success.value.kind, 'PREPARED');
    if (success.value.kind === 'PREPARED') assert.equal(success.value.bodyBase64, request.bodyBase64);
  }
  const unavailable = await Effect.runPromise(make({
    context: makeSearch(false, ['code']),
  }).projectResponses(request));
  assert.equal(unavailable._tag, 'Ok');
  if (unavailable._tag === 'Ok') assert.equal(unavailable.value.kind, 'BLOCK');
});

test('end-to-end native projection keeps Hermes input and sends only references for already-visible verified code', async () => {
  const code = 'export function locateEntry() {\n  return true;\n}';
  const workspaceId = makeWorkspaceId('ws1');
  if (workspaceId._tag === 'Err') throw Error('invalid workspace fixture');
  const workspace: WorkspaceRecord = {
    workspaceId: workspaceId.value,
    rootPath: '/workspace',
    observationEpoch: 1,
    createdAtMs: 1,
    lastObservation: {
      headRevision: 'a'.repeat(40), observationEpoch: 1,
      files: [], removedPaths: [], gitStatus: 'available',
    },
  };
  const providerResult: ContextBundle = {
    requestId: 'search-1' as ContextBundle['requestId'],
    query: code,
    evidence: [{
      evidenceId: 'evidence-code' as ContextBundle['evidence'][number]['evidenceId'],
      source: 'code', citation: 'src/entrypoint.ts:1-3', content: code,
      sourceDigest: 'b'.repeat(64) as never,
      proofClass: 'direct', freshness: 'current',
    }],
    warnings: [], partialSources: [], complete: true,
  };
  let searches = 0;
  const context = makeContextTransformService({
    ids: { newRequestId: () => 'search-generated-id' },
    store: { get: () => Effect.succeed(ok(workspace)) },
    context: { search: () => {
      searches += 1;
      return Effect.succeed(ok(providerResult));
    } },
  });
  const nativeWithCode = {
    ...native,
    input: [
      native.input[0],
      native.input[1],
      { type: 'function_call_output', call_id: 'call-1', output: code },
    ],
  };
  const prior = req({ query: code }, nativeWithCode);
  const decision = await Effect.runPromise(make({ context }).projectResponses(prior));
  assert.equal(decision._tag, 'Ok');
  if (decision._tag === 'Err') return;
  assert.equal(decision.value.kind, 'PREPARED', 'all-known evidence must not BLOCK normal Hermes progression');
  if (decision.value.kind !== 'PREPARED') return;
  const parsed = JSON.parse(Buffer.from(decision.value.bodyBase64, 'base64').toString('utf8')) as {
    input: { role?: string; content?: string }[];
    reasoning: unknown; tools: unknown; store: boolean;
  };
  assert.equal(parsed.input.length, nativeWithCode.input.length + 1);
  assert.deepEqual(parsed.input.slice(1), nativeWithCode.input);
  assert.match(parsed.input[0]?.content ?? '', /src\/entrypoint\.ts:1-3/u);
  assert.match(parsed.input[0]?.content ?? '', /known source body/u);
  assert.ok(!(parsed.input[0]?.content ?? '').includes(code),
    'developer evidence item must not repeat the already-visible code body');
  assert.deepEqual(parsed.reasoning, native.reasoning);
  assert.deepEqual(parsed.tools, native.tools);
  assert.equal(parsed.store, false);
  assert.equal(searches, 1, 'native visibility check must not trigger a second retrieval');

  const unseen = await Effect.runPromise(make({ context }).projectResponses(req()));
  assert.equal(unseen._tag, 'Ok');
  if (unseen._tag === 'Ok' && unseen.value.kind === 'PREPARED') {
    const unchanged = JSON.parse(Buffer.from(unseen.value.bodyBase64, 'base64').toString('utf8')) as {
      input: { content?: string }[];
    };
    assert.match(unchanged.input[0]?.content ?? '', /export function locateEntry/u,
      'unseen source evidence must still be delivered exactly');
    assert.equal(searches, 2);
  } else {
    assert.fail('normal unseen evidence must prepare successfully');
  }
});

