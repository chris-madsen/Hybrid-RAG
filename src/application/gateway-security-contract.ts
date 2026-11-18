import type { ProjectDataPolicy } from '../domain/policy.js';
import type { AuditSink, ClockPort } from './ports.js';

// Shared policy dependencies for native Responses Gateway projection.
export interface GatewayProjectionSecurity {
  readonly policy: ProjectDataPolicy;
  readonly allowedProviders: readonly string[];
  readonly clock: ClockPort;
  readonly audit: AuditSink;
}
