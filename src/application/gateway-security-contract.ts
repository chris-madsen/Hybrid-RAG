import type { ProjectDataPolicy } from '../domain/policy.js';
import type { AuditSink, ClockPort } from './ports.js';

// Shared policy dependencies for native Responses and historical Gateway v1.
export interface GatewayProjectionSecurity {
  readonly policy: ProjectDataPolicy;
  readonly allowedProviders: readonly string[];
  readonly clock: ClockPort;
  readonly audit: AuditSink;
}
