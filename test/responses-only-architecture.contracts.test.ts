import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path: string): Promise<string> => readFile(path, 'utf8');

test('active ACE runtime only composes the native Responses projector', async () => {
  const runtime = await source('src/bin/ace-runtime.ts');
  assert.match(runtime, /makeResponsesProjectionService/u);
  assert.doesNotMatch(runtime, /makeGatewayProjectionService/u);
});

test('native projection has no executable dependency on legacy Chat projection types or services', async () => {
  const domain = await source('src/domain/responses-projection.ts');
  const service = await source('src/application/responses-projection-service.ts');
  assert.doesNotMatch(domain, /from ['"]\.\/gateway-projection\.js['"]/u);
  assert.doesNotMatch(service, /from ['"]\.\/gateway-projection-service\.js['"]/u);
  assert.doesNotMatch(service, /from ['"]\.\.\/domain\/gateway-projection\.js['"]/u);
  assert.match(domain, /'openai\.responses'/u);
  assert.match(domain, /Object\.hasOwn\(value, 'messages'\)/u);
  assert.match(domain, /value\.store !== false/u);
});

test('pinned Bifröst plugin never treats prepared Responses context as provider-send approval', async () => {
  const plugin = await source('integrations/bifrost/ace-connector/plugin/main.go');
  const wire = await source('integrations/bifrost/ace-connector/responses.go');
  assert.match(plugin, /case "\/v1\/responses", "\/responses", "\/openai\/responses":/u);
  assert.match(plugin, /return prepareNativeResponses\(ctx, req\)/u);
  assert.match(plugin, /return blockProviderAttempt\(req, "ACE provider dispatch disabled until native Responses is certified"\)/u);
  assert.match(wire, /decision\.Kind != "PREPARED"/u);
  assert.doesNotMatch(wire, /ToChatRequest\(/u);
  assert.doesNotMatch(wire, /ChatCompletion\(/u);
});

test('new TypeSpec contract declares Responses-only and does not repurpose frozen v1', async () => {
  const v2 = await source('typespec/responses-v2.tsp');
  assert.match(v2, /protocol: "openai\.responses"/u);
  assert.match(v2, /kind: "PREPARED" \| "BLOCK"/u);
  assert.doesNotMatch(v2, /openai\.chat\.completions/u);
});
test('no active ACE entrypoint imports the retired Chat implementation', async () => {
  const entrypoints = [
    'src/bin/ace-runtime.ts',
    'src/bin/ace-gateway-http.ts',
    'src/transport/gateway-projection-http.ts',
  ] as const;
  for (const path of entrypoints) {
    const contents = await source(path);
    assert.doesNotMatch(contents, /makeGatewayProjectionService/u, `${path} resurrects legacy projection`);
    assert.doesNotMatch(contents, /from ['"][^'"]*gateway-projection-service\.js['"]/u, `${path} imports legacy service`);
    assert.doesNotMatch(contents, /openai\.chat\.completions/u, `${path} advertises forbidden protocol`);
  }
  const gateway = await source('src/transport/gateway-projection-http.ts');
  assert.match(gateway, /routes: \[\]/u, 'gateway must never advertise the old v1 route');
  assert.match(gateway, /return error\(503, 'RESPONSES_ONLY_NOT_READY'/u, 'retired v1 projection must deny');
  const plugin = await source('integrations/bifrost/ace-connector/plugin/main.go');
  assert.doesNotMatch(plugin, /projectionClient\.Project\(/u, 'Go plugin must never call old v1 projector');
  assert.doesNotMatch(plugin, /req\.ChatRequest/u, 'Go plugin must never consume ChatRequest');
  assert.match(plugin, /return blockProviderAttempt\(req, "ACE provider dispatch disabled until native Responses is certified"\)/u);
});
