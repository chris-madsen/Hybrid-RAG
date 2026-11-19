import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const loadJson = async (path: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;

test('generated Gateway contract is native Responses v2 only', async () => {
  const openapi = await loadJson('typespec/generated/openapi.json');
  assert.equal((openapi.info as { version?: string }).version, '2.0.0');
  const paths = Object.keys(openapi.paths as Record<string, unknown>)
    .filter((path) => path.startsWith('/internal/ace-gateway/'))
    .sort();
  assert.deepEqual(paths, [
    '/internal/ace-gateway/v2/authorize-attempt',
    '/internal/ace-gateway/v2/capabilities',
    '/internal/ace-gateway/v2/health',
    '/internal/ace-gateway/v2/project',
    '/internal/ace-gateway/v2/record-delivery',
  ]);
  const request = await loadJson('typespec/generated/schema/ProjectionRequest.json');
  const properties = request.properties as Record<string, { const?: string }>;
  assert.equal(properties.schemaVersion?.const, 'ace.gateway.v2');
  assert.equal(properties.protocol?.const, 'openai.responses');
  assert.deepEqual(request.unevaluatedProperties, { not: {} });
  const components = openapi.components as { schemas: Record<string, Record<string, unknown>> };
  assert.deepEqual(components.schemas.ProjectionRequest.additionalProperties, { not: {} });
  const decision = components.schemas.ProjectionDecision as {
    oneOf?: readonly unknown[];
    discriminator?: { mapping?: Readonly<Record<string, string>> };
  };
  assert.equal(decision.oneOf?.length, 2);
  assert.deepEqual(decision.discriminator?.mapping, {
    PREPARED: '#/components/schemas/PreparedProjection',
    BLOCK: '#/components/schemas/BlockedProjection',
  });
});

test('generated Responses contract rejects unknown top-level fields', async () => {
  const request = await loadJson('typespec/generated/schema/ProjectionRequest.json');
  assert.deepEqual(request.unevaluatedProperties, { not: {} });
  const openapi = await loadJson('typespec/generated/openapi.json');
  const components = openapi.components as { schemas: Record<string, { properties: Record<string, { enum?: readonly string[] }> }> };
  assert.deepEqual(components.schemas.ProjectionRequest.properties.dataClass?.enum, ['private', 'project_document', 'public']);
});
