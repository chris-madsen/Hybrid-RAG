import type { ProjectDataPolicy } from '../domain/policy.js';
import type { AuditSink, ClockPort } from './ports.js';

export interface NativeResponsesStreamingRoute {
  readonly provider: string;
  readonly model: string;
  readonly destination: string;
}

const streamingRouteKeys = new Set(['provider', 'model', 'destination']);

export const validateNativeResponsesStreamingRoutes = (
  raw: unknown,
): readonly NativeResponsesStreamingRoute[] => {
  if (!Array.isArray(raw)) throw new Error('streaming routes must be a JSON array');
  const routes: NativeResponsesStreamingRoute[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)
      || Object.keys(item).some((key) => !streamingRouteKeys.has(key))) {
      throw new Error('each streaming route must contain only provider, model, and destination');
    }
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.provider !== 'string' || typeof candidate.model !== 'string'
      || typeof candidate.destination !== 'string') {
      throw new Error('streaming route provider, model, and destination must be strings');
    }
    const provider = candidate.provider.trim().toLowerCase();
    const model = candidate.model.trim();
    const destination = candidate.destination.trim();
    if (!/^[a-z0-9._-]{1,128}$/u.test(provider)
      || !/^[A-Za-z0-9._:/-]{1,256}$/u.test(model)) {
      throw new Error('streaming route provider or model identity is invalid');
    }
    let parsed: URL;
    try { parsed = new URL(destination); } catch {
      throw new Error('streaming route destination is invalid');
    }
    if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== ''
      || parsed.search !== '' || parsed.hash !== '' || !parsed.pathname.endsWith('/v1/responses')
      || parsed.toString() !== destination) {
      throw new Error('streaming route destination must be a canonical credential-free HTTPS Responses URL');
    }
    const key = JSON.stringify([provider, model, destination]);
    if (seen.has(key)) throw new Error('streaming route list contains a duplicate route');
    seen.add(key);
    routes.push(Object.freeze({ provider, model, destination }));
  }
  return Object.freeze(routes);
};

// Shared policy dependencies for native Responses Gateway projection.
export interface GatewayProjectionSecurity {
  readonly policy: ProjectDataPolicy;
  readonly allowedProviders: readonly string[];
  /** Exact model IDs permitted for each normalized provider. Missing means deny all. */
  readonly allowedModelsByProvider: Readonly<Record<string, readonly string[]>>;
  /** Exact HTTPS provider request URLs authorized at the physical-send boundary. */
  readonly allowedDestinations: readonly string[];
  /** Exact native streaming routes; empty by default and independent of ordinary egress opt-in. */
  readonly allowedStreamingRoutes: readonly NativeResponsesStreamingRoute[];
  /** Ephemeral per-process signing key; restart invalidates all prepared receipts. */
  readonly receiptSigningKey: string;
  readonly clock: ClockPort;
  readonly audit: AuditSink;
}
