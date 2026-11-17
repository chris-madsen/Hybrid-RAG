import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  validateResponsesProjectionRequest, decodeNativeResponsesBody,
  bodyQueryMatches, addVerifiedContextToResponses, type ResponsesProjectionRequest,
} from '../src/domain/responses-projection.js';
const digest = (s: string): string=>createHash('sha256').update(s).digest('hex');
const input = {
  model:'openai/gpt-test',
  stream:true,
  store:false,
  reasoning:{ effort:'high', summary:'auto' },
  tools:[{ type:'function', name:'read_file', parameters:{ type:'object', properties:{ path:{ type:'string' } } } }],
  input:[
    { role:'user', content:[{ type:'input_text', text:'find the entrypoint' }, { type:'input_image', image_url:'data:image/png;base64,AA==' }] },
    { type:'reasoning', id:'rs1', encrypted_content:'opaque-reasoning', summary:[{ type:'summary_text', text:'plan' }] },
    { type:'function_call', id:'fc1', call_id:'call_1', name:'read_file', arguments:'{"path":"src/a.ts"}' },
    { type:'function_call_output', call_id:'call_1', output:'entrypoint found' },
  ],
  metadata:{ host:'hermes' },
  unknown_extension:{ retain:true },
};
const body = (value: unknown): string=>Buffer.from(JSON.stringify(value)).toString('base64');
const attestation = {
  hostBuildDigest:digest('build'), sessionId:'hermes-session', activeEngineId:'bifrost-visible-request-only',
  effectiveCompressionControlsDigest:digest('controls'), durableActiveTranscriptRevision:'unattested',
  durableActiveTranscriptDigest:digest('body'), hostCompactionEpoch:'unknown' as const,
  attestorId:'ace-bifrost-test', providerManagedHistoryCapability:'visible' as const,
  hostTranscriptAttested:false, compactionEnabled:false,
};
const req = (override:Partial<ResponsesProjectionRequest> = {}, requestBody:unknown = input):ResponsesProjectionRequest=>{
  const bodyBase64 = body(requestBody);
  return {
    schemaVersion:'ace.gateway.v2', protocol:'openai.responses', requestId:'r1', attemptGroupId:'a1',
    agentSessionId:'hermes-session', workspaceId:'workspace-1', dataClass:'private',
    provider:'openai', model:'openai/gpt-test', bodyBase64,
    bodySha256:createHash('sha256').update(Buffer.from(bodyBase64, 'base64')).digest('hex'),
    query:'entrypoint found', projectionMode:'gateway', deadlineEpochMs:Date.now() + 60000,
    attestation, ...override,
  };
};
test('v2 validates exact original provider bytes and rejects Chat or version downgrade', ()=>{
  assert.equal(validateResponsesProjectionRequest(req())._tag, 'Ok');
  assert.equal(validateResponsesProjectionRequest(req({ protocol:'openai.chat.completions' as never }))._tag, 'Err');
  assert.equal(validateResponsesProjectionRequest(req({ schemaVersion:'ace.gateway.v1' as never }))._tag, 'Err');
  assert.equal(validateResponsesProjectionRequest(req({ bodySha256:digest('wrong') }))._tag, 'Err');
  assert.equal(validateResponsesProjectionRequest({ ...req(), unexpected:true })._tag, 'Err');
  assert.equal(validateResponsesProjectionRequest(req({ attestation:{ ...attestation, sessionId:'other' } }))._tag, 'Err');
});
test('native tool/reasoning input is preserved, original items stay in order', ()=>{
  const request = req();const d = decodeNativeResponsesBody(request);
  assert.equal(d._tag, 'Ok');if (d._tag === 'Err') return;
  assert.equal(bodyQueryMatches(d.value, request.query), true);
  const out = addVerifiedContextToResponses(d.value, 'context src/a.ts:3');
  assert.equal(out._tag, 'Ok');if (out._tag === 'Err') return;
  const parsed = JSON.parse(Buffer.from(out.value, 'base64').toString('utf8')) as Record<string, any>;
  assert.equal(parsed.input.length, 5);
  assert.equal(parsed.input[0].role, 'developer');
  assert.match(parsed.input[0].content, /ACE verified context/u);
  assert.deepEqual(parsed.input.slice(1), input.input);
  assert.deepEqual(parsed.reasoning, input.reasoning);
  assert.deepEqual(parsed.tools, input.tools);
  assert.deepEqual(parsed.unknown_extension, input.unknown_extension);
  assert.equal(parsed.store, false);
  assert.equal(parsed.stream, true);
});
test('stateless function-call output-only continuation remains valid', ()=>{
  const next = { ...input, input:[{ type:'function_call_output', call_id:'call_1', output:'entrypoint found' }] };
  const request = req({}, next);const d = decodeNativeResponsesBody(request);
  assert.equal(d._tag, 'Ok');if (d._tag === 'Err') return;
  assert.equal(bodyQueryMatches(d.value, 'entrypoint found'), true);
  const appended = addVerifiedContextToResponses(d.value, 'evidence');
  assert.equal(appended._tag, 'Ok');if (appended._tag === 'Err') return;
  const current = JSON.parse(Buffer.from(appended.value, 'base64').toString('utf8')) as Record<string, any>;
  assert.deepEqual(current.input.slice(1), next.input);
});
test('text input is represented as user native input rather than Chat messages', ()=>{
  const value = { ...input, input:'entrypoint found' };const d = decodeNativeResponsesBody(req({}, value));
  assert.equal(d._tag, 'Ok');if (d._tag === 'Err') return;
  const out = addVerifiedContextToResponses(d.value, 'evidence');
  assert.equal(out._tag, 'Ok');if (out._tag === 'Err') return;
  const current = JSON.parse(Buffer.from(out.value, 'base64').toString('utf8')) as Record<string, any>;
  assert.deepEqual(current.input.slice(1), [{ role:'user', content:'entrypoint found' }]);
  assert.equal('messages' in current, false);
});
test('deny provider-stored hidden history and forbidden Chat-shaped input', ()=>{
  const cases = [
    { ...input, previous_response_id:'resp_old' }, { ...input, conversation:'conv_old' },
    { ...input, store:true }, { ...input, messages:[{ role:'user', content:'x' }] },
    { ...input, input:[] }, { ...input, model:'different' },
  ];
  for (const value of cases)assert.equal(decodeNativeResponsesBody(req({}, value))._tag, 'Err');
});
test('query must be verified against actual visible Responses content', ()=>{
  const d = decodeNativeResponsesBody(req());
  assert.equal(d._tag, 'Ok');if (d._tag === 'Err') return;
  assert.equal(bodyQueryMatches(d.value, 'injected query'), false);
  assert.equal(bodyQueryMatches(d.value, 'entrypoint found'), true);
});
test('projected context never truncates or mutates opaque tool items or extends beyond limit', ()=>{
  const request = req();const d = decodeNativeResponsesBody(request);if (d._tag === 'Err') throw Error('fixture error');
  assert.equal(addVerifiedContextToResponses(d.value, 'x'.repeat(4 * 1024 * 1024))._tag, 'Err');
});
