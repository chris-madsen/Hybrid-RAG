import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect } from 'effect';
import {
  createGatewayProjectionServer,
  handleGatewayProjectionHttp,
  isLoopbackGatewayHttpHost,
  maxEnvelopeBytesFor,
  runGatewayProjectionHttp,
} from '../src/transport/gateway-projection-http.js';
import { ok } from '../src/domain/result.js';

let projectCalls = 0;
const service = {
  projectResponses: () => {
    projectCalls += 1;
    return Effect.succeed(ok({ kind: 'BLOCK' as const, reasonCode: 'ROUTE_NOT_CERTIFIED', baseBodySha256: 'a'.repeat(64) }));
  },
};

test('gateway HTTP host validation accepts loopback addresses only', () => {
  for (const host of ['127.0.0.1', '127.10.20.30', '::1', '0:0:0:0:0:0:0:1', 'localhost', 'LOCALHOST']) {
    assert.equal(isLoopbackGatewayHttpHost(host), true, host);
  }
  for (const host of ['0.0.0.0', '192.168.1.4', '::', 'example.com', '127.0.0.1.example.com']) {
    assert.equal(isLoopbackGatewayHttpHost(host), false, host);
  }
});

test('gateway HTTP rejects non-loopback options and environment hosts before listening', async () => {
  await assert.rejects(runGatewayProjectionHttp(service, { host: '0.0.0.0' }), /loopback address/u);

  const previousHost = process.env.ACE_GATEWAY_HTTP_HOST;
  process.env.ACE_GATEWAY_HTTP_HOST = '192.168.1.4';
  try {
    await assert.rejects(runGatewayProjectionHttp(service), /loopback address/u);
  } finally {
    if (previousHost === undefined) delete process.env.ACE_GATEWAY_HTTP_HOST;
    else process.env.ACE_GATEWAY_HTTP_HOST = previousHost;
  }
});

test('gateway HTTP exposes native Responses v2 health and capability contracts', async () => {
  const health = await handleGatewayProjectionHttp(service, 'GET', '/internal/ace-gateway/v2/health', '');
  assert.equal(health.statusCode, 200);
  assert.equal(health.body.schemaVersion, 'ace.gateway.v2');
  assert.equal(health.body.providerWire, 'not_certified');
  const capabilities = await handleGatewayProjectionHttp(service, 'GET', '/internal/ace-gateway/v2/capabilities', '');
  assert.equal(capabilities.statusCode, 200);
  assert.equal(capabilities.body.schemaVersion, 'ace.gateway.v2');
  assert.deepEqual(capabilities.body.routes, [], 'provider generation must not be advertised before certification');
});

test('native Responses projection returns a typed denial until dispatch is certified', async () => {
  projectCalls = 0;
  const projected = await handleGatewayProjectionHttp(service, 'POST', '/internal/ace-gateway/v2/project', '{}');
  assert.equal(projected.statusCode, 409);
  assert.equal((projected.body as { error: { code: string } }).error.code, 'ROUTE_NOT_CERTIFIED');
  assert.equal(projectCalls, 1);
  const missing = await handleGatewayProjectionHttp(service, 'POST', '/unknown', '{}');
  assert.equal(missing.statusCode, 404);
  assert.equal(projectCalls, 1, 'unknown endpoints must not invoke the projection service');
});

test('gateway HTTP does not accept unverified final-delivery claims', async () => {
  const result = await handleGatewayProjectionHttp(service, 'POST', '/internal/ace-gateway/v2/record-delivery', '{}');
  assert.equal(result.statusCode, 501);
});

test('gateway allows Base64 and JSON framing beyond the raw four MiB body limit', () => {
  const rawBytes = 4 * 1024 * 1024;
  const encodedBytes = Buffer.alloc(rawBytes).toString('base64').length;
  assert.ok(encodedBytes > rawBytes);
  assert.ok(maxEnvelopeBytesFor(rawBytes) >= encodedBytes + rawBytes + 1024, 'query duplicates the user message outside Base64');
});

test('native projection HTTP refuses local callers without the configured shared secret', async () => {
  const server = createGatewayProjectionServer(service, { authToken: 'in-memory-test-token' });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/internal/ace-gateway/v2/project`;
  try {
    const anonymous = await fetch(url, { method: 'POST', body: '{}' });
    assert.equal(anonymous.status, 401);
    const wrong = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer wrong' }, body: '{}' });
    assert.equal(wrong.status, 401);
    const authenticated = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer in-memory-test-token' },
      body: '{}',
    });
    assert.equal(authenticated.status, 409);
    const result = await authenticated.json() as { error: { code: string } };
    assert.equal(result.error.code, 'ROUTE_NOT_CERTIFIED');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('native projection HTTP without a server credential is NOT_READY, not public', async () => {
  const server = createGatewayProjectionServer(service, { authToken: '' });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const reply = await fetch(`http://127.0.0.1:${address.port}/internal/ace-gateway/v2/project`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(reply.status, 503);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('only the generated native Responses v2 paths are recognized', async () => {
  const response = await handleGatewayProjectionHttp(service, 'POST', '/internal/ace-gateway/v2/unsupported', '{}');
  assert.equal(response.statusCode, 404);
});
