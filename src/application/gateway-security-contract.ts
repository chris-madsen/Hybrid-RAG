import type { ProjectDataPolicy } from '../domain/policy.js';
import type { AuditSink, ClockPort } from './ports.js';

// Shared policy dependencies for native Responses Gateway projection.
export interface GatewayProjectionSecurity {
  readonly policy: ProjectDataPolicy;
  readonly allowedProviders: readonly string[];
  /** Exact HTTPS provider request URLs authorized at the physical-send boundary. */
  readonly allowedDestinations: readonly string[];
  /** Ephemeral per-process signing key; restart invalidates all prepared receipts. */
  readonly receiptSigningKey: string;
  readonly clock: ClockPort;
  readonly audit: AuditSink;
}
