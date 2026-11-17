import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { Effect } from 'effect';
import type { ResponsesProjectionService } from '../application/responses-projection-service.js';
import { isIP } from 'node:net';
import type {
  GatewayHealth as GeneratedGatewayHealth,
  GatewayCapabilities as GeneratedGatewayCapabilities,
  DeliveryNotCertified as GeneratedDeliveryNotCertified,
} from '../generated/ace-gateway/v1/types.gen.js';

// Retain the constructor shape while retired v1 projection is quarantined.
// A new typed service will be introduced with the versioned native Responses wire.
export interface GatewayProjectionHttpService {
  readonly project: (value: unknown) => unknown;
  readonly projectResponses?: ResponsesProjectionService['projectResponses'];
}

export interface GatewayProjectionHttpOptions {
  readonly host?: string;
  readonly port?: number;
  readonly maxBodyBytes?: number;
  /** Shared token supplied out of band to the local Bifrost connector. */
  readonly authToken?: string;
}

export interface GatewayProjectionHttpResponse {
  readonly statusCode: number;
  readonly body: Readonly<Record<string, unknown>>;
}

const schemaVersion = 'ace.gateway.v1';
const defaultMaxBodyBytes = 4 * 1024 * 1024;
// The HTTP request is a JSON envelope containing Base64, not raw provider bytes.
// The query is repeated outside bodyBase64 and can occupy nearly all of the
// original provider body. Bound both representations, not just encoded bytes.
export const maxEnvelopeBytesFor = (bodyBytes: number): number => 4 * Math.ceil(bodyBytes / 3) + bodyBytes + 64 * 1024;
export const isLoopbackGatewayHttpHost = (host: string): boolean => {
  const normalizedHost = host.toLowerCase();
  if (normalizedHost === 'localhost') return true;
  const family = isIP(normalizedHost);
  if (family === 4) return normalizedHost.startsWith('127.');
  return family === 6 && (normalizedHost === '::1' || normalizedHost === '0:0:0:0:0:0:0:1');
};
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };

const json = (body: Readonly<Record<string, unknown>>): GatewayProjectionHttpResponse => ({
  statusCode: 200,
  body,
});

const error = (statusCode: number, code: string, message: string): GatewayProjectionHttpResponse => ({
  statusCode,
  body: { error: { code, message } },
});

export const handleGatewayProjectionHttp = async (
  service: GatewayProjectionHttpService,
  method: string,
  path: string,
  body: string,
): Promise<GatewayProjectionHttpResponse> => {
  if (method === 'GET' && path === '/internal/ace-gateway/v1/health') {
    const wire: GeneratedGatewayHealth = {
      schemaVersion, liveness: 'ready', readiness: 'adapter_implemented', providerWire: 'not_certified',
    };
    return json(wire as unknown as Readonly<Record<string, unknown>>);
  }
  if (method === 'GET' && path === '/internal/ace-gateway/v1/capabilities') {
    const wire: GeneratedGatewayCapabilities = {
      schemaVersion,
      // No supported provider route exists while native Responses is not certified.
      // The legacy v1 schema remains immutable for migration evidence only.
      routes: [],
      maxBodyBytes: defaultMaxBodyBytes,
      projectionModes: ['native', 'gateway', 'assist-only', 'observe-only', 'off'],
      providerWireCertification: 'not_certified',
    };
    return json(wire as unknown as Readonly<Record<string, unknown>>);
  }
  if (method !== 'POST') return error(405, 'METHOD_NOT_ALLOWED', 'unsupported gateway method');
  if (path === '/internal/ace-gateway/v1/record-delivery') {
    const unavailable: GeneratedDeliveryNotCertified = {
      error: { code: 'PROVIDER_WIRE_NOT_CERTIFIED', message: 'delivery recording requires a verified final-send integration' },
    };
    return error(501, unavailable.error.code, unavailable.error.message);
  }
  if (path === '/internal/ace-gateway/v2/project') {
    if (!service.projectResponses) return error(503, 'RESPONSES_NOT_READY', 'native Responses projector is not configured');
    let payload: unknown;
    try { payload = JSON.parse(body) as unknown; } catch {
      return error(400, 'INVALID_JSON', 'native Responses request must be JSON');
    }
    const response = await Effect.runPromise(service.projectResponses(payload));
    if (response._tag === 'Err') return error(400, response.error.code, response.error.message);
    if (response.value.kind === 'BLOCK') return error(409, response.value.reasonCode, 'native Responses projection refused');
    // Internal context transformation only. This result is NOT a provider-send permit.
    return json(response.value);
  }
  if (path !== '/internal/ace-gateway/v1/project') return error(404, 'NOT_FOUND', 'unknown gateway endpoint');
  void service;
  void body;
  return error(503, 'RESPONSES_ONLY_NOT_READY', 'legacy Gateway v1 projection is disabled until native Responses is certified');
};

const writeResponse = (response: ServerResponse, result: GatewayProjectionHttpResponse): void => {
  response.writeHead(result.statusCode, jsonHeaders);
  response.end(JSON.stringify(result.body));
};

const readRequestBody = async (request: IncomingMessage, maxBodyBytes: number): Promise<string> => {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBodyBytes) throw new Error('BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const authorizedProjectionRequest = (value: string | undefined, token: string): boolean => {
  if (!value || !token) return false;
  const actual = Buffer.from(value, 'utf8');
  const expected = Buffer.from(`Bearer ${token}`, 'utf8');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const createGatewayProjectionServer = (
  service: GatewayProjectionHttpService,
  options: GatewayProjectionHttpOptions = {},
): Server => {
  const maxBodyBytes = options.maxBodyBytes ?? defaultMaxBodyBytes;
  const maxEnvelopeBytes = maxEnvelopeBytesFor(maxBodyBytes);
  return createServer(async (request, response) => {
    try {
      if (request.method === 'POST' && (
        request.url === '/internal/ace-gateway/v1/project' || request.url === '/internal/ace-gateway/v2/project'
      )) {
        const token = options.authToken ?? process.env.ACE_GATEWAY_HTTP_SHARED_SECRET;
        if (!token?.trim()) {
          writeResponse(response, error(503, 'NOT_READY', 'Gateway projection authentication is not configured'));
          return;
        }
        if (!authorizedProjectionRequest(request.headers.authorization, token)) {
          writeResponse(response, error(401, 'UNAUTHORIZED', 'Gateway projection authentication failed'));
          return;
        }
      }
      const body = await readRequestBody(request, maxEnvelopeBytes);
      writeResponse(response, await handleGatewayProjectionHttp(service, request.method ?? 'GET', request.url ?? '/', body));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'gateway request failed';
      writeResponse(response, error(message === 'BODY_TOO_LARGE' ? 413 : 400, message, message === 'BODY_TOO_LARGE' ? 'request body exceeds gateway bound' : 'request could not be read'));
    }
  });
};

export const runGatewayProjectionHttp = async (
  service: GatewayProjectionHttpService,
  options: GatewayProjectionHttpOptions = {},
): Promise<void> => {
  const host = options.host ?? process.env.ACE_GATEWAY_HTTP_HOST ?? '127.0.0.1';
  if (!isLoopbackGatewayHttpHost(host)) throw new Error('ACE Gateway HTTP host must be a loopback address');
  const server = createGatewayProjectionServer(service, options);
  const port = options.port ?? Number(process.env.ACE_GATEWAY_HTTP_PORT ?? '8765');
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      process.stderr.write(`ace-gateway-http listening host=${host} port=${port} schema=${schemaVersion}\n`);
    });
    const shutdown = (): void => {
      server.close(() => resolve());
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
};
