import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path: string): Promise<string> => readFile(path, 'utf8');

test('active ACE runtime only composes the native Responses projector', async () => {
  const runtime = await source('src/bin/ace-runtime.ts');
  assert.match(runtime, /makeResponsesProjectionService/u);
});

test('native projection owns its request contract and protected provider controls', async () => {
  const domain = await source('src/domain/responses-projection.ts');
  const service = await source('src/application/responses-projection-service.ts');
  assert.match(domain, /'openai\.responses'/u);
  assert.match(domain, /value\.store !== false/u);
  assert.match(service, /kind: 'PREPARED'/u);
  assert.match(service, /kind: 'BLOCK'/u);
});

test('pinned Bifröst plugin never treats prepared Responses context as provider-send approval', async () => {
  const plugin = await source('integrations/bifrost/ace-connector/plugin/main.go');
  const wire = await source('integrations/bifrost/ace-connector/responses.go');
  assert.match(plugin, /case "\/v1\/responses":/u);
  assert.match(plugin, /return prepareNativeResponses\(ctx, req\)/u);
  assert.match(plugin, /return blockProviderAttempt\(req, "ACE provider dispatch disabled until native Responses is certified"\)/u);
  assert.match(wire, /decision\.Kind != "PREPARED"/u);
});

test('TypeSpec and generated SDK publish only the native v2 projection contract', async () => {
  const v2 = await source('typespec/responses-v2.tsp');
  assert.match(v2, /protocol: "openai\.responses"/u);
  assert.match(v2, /union ProjectionDecision \{/u);
  assert.match(v2, /PREPARED: PreparedProjection;/u);
  assert.match(v2, /BLOCK: BlockedProjection;/u);
  assert.match(v2, /kind: "PREPARED";/u);
  assert.match(v2, /kind: "BLOCK";/u);
  assert.match(v2, /@route\("\/internal\/ace-gateway\/v2\/project"\)/u);
  const generated = await source('src/generated/ace-gateway/v2/types.gen.ts');
  assert.match(generated, /schemaVersion: 'ace\.gateway\.v2'/u);
});
test('active Gateway and Bifröst wiring stays on native v2 and blocks every dispatch', async () => {
  const runtime = await source('src/bin/ace-runtime.ts');
  assert.match(runtime, /makeResponsesProjectionService/u);
  const server = await source('src/bin/ace-gateway-http.ts');
  assert.match(server, /ACE_GATEWAY_HTTP_MODE/u);
  assert.match(server, /ace-runtime\.js/u);
  const gateway = await source('src/transport/gateway-projection-http.ts');
  assert.match(gateway, /ace-gateway\/v2/u);
  assert.match(gateway, /routes: \[\]/u, 'gateway must not advertise uncertified generation');
  assert.match(gateway, /providerWire: 'not_certified'/u);
  const plugin = await source('integrations/bifrost/ace-connector/plugin/main.go');
  assert.match(plugin, /return blockProviderAttempt\(req, "ACE provider dispatch disabled until native Responses is certified"\)/u);
});
