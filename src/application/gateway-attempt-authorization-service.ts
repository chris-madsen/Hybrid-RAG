import { Effect } from 'effect';
import type {
  PhysicalSendAttemptDecision as GeneratedPhysicalSendAttemptDecision,
  PhysicalSendAttemptRequest as GeneratedPhysicalSendAttemptRequest,
} from '../generated/ace-gateway/v2/types.gen.js';
import type { DomainError } from '../domain/errors.js';
import { containsLikelySecret } from '../domain/sensitive-text.js';
import { makeWorkspaceId } from '../domain/workspace.js';
import { authorizeAndAudit } from './policy-service.js';
import type { GatewayProjectionSecurity } from './gateway-security-contract.js';
import { isErr, type Result } from '../domain/result.js';
import {
  physicalSendAttemptAllowed,
  physicalSendAttemptBlocked,
  validatePhysicalSendAttemptRequest,
} from '../domain/gateway-attempt-authorization.js';
import { verifyProjectionReceipt } from './projection-receipt.js';

export interface GatewayAttemptAuthorizationService {
  readonly authorizePhysicalSend: (value: unknown) => Effect.Effect<Result<GeneratedPhysicalSendAttemptDecision, DomainError>>;
}

const sendBlock = (
  request: GeneratedPhysicalSendAttemptRequest,
  reasonCode: string,
  security: GatewayProjectionSecurity,
): Effect.Effect<Result<GeneratedPhysicalSendAttemptDecision, DomainError>> =>
  Effect.gen(function* () {
    const written = yield* security.audit.append({
      occurredAtMs: security.clock.nowMs(),
      correlationId: request.attemptId,
      component: 'gateway-physical-send',
      category: 'policy',
      policyVersion: security.policy.policyVersion,
      outcome: 'denied',
      reasonCode,
    });
    if (isErr(written)) return written;
    return physicalSendAttemptBlocked(request, reasonCode);
  });

const dataClassesFor = (dataClass: GeneratedPhysicalSendAttemptRequest['dataClass']) => {
  const sourceClass = dataClass === 'private' ? 'private_source' : dataClass;
  return sourceClass === 'private_source' ? ['private_source'] as const : [sourceClass, 'private_source'] as const;
};

const makeSingleUseAttemptRegistry = (): ((attemptId: string, expiresAtMs: number, nowMs: number) => boolean) => {
  const consumed = new Map<string, number>();
  let operations = 0;
  return (attemptId, expiresAtMs, nowMs) => {
    operations += 1;
    if (operations % 64 === 0 || consumed.size >= 4096) {
      for (const [id, expiry] of consumed) if (expiry <= nowMs) consumed.delete(id);
    }
    if (consumed.has(attemptId) || consumed.size >= 4096) return false;
    consumed.set(attemptId, expiresAtMs);
    return true;
  };
};

export const makeGatewayAttemptAuthorizationService = (
  security: GatewayProjectionSecurity,
): GatewayAttemptAuthorizationService => {
  const claimAttempt = makeSingleUseAttemptRegistry();
  return {
    authorizePhysicalSend: (value) => Effect.gen(function* () {
      const valid = validatePhysicalSendAttemptRequest(value);
      if (valid._tag === 'Err') return valid;
      const request = valid.value;
      const now = security.clock.nowMs();
      if (request.deadlineEpochMs <= now) return yield* sendBlock(request, 'DEADLINE_EXCEEDED', security);

      const receipt = verifyProjectionReceipt(request.projectionReceipt, security.receiptSigningKey, now);
      if (receipt._tag === 'Err') return yield* sendBlock(request, 'PROJECTION_RECEIPT_INVALID', security);
      const claims = receipt.value;
      if (claims.requestId !== request.requestId
        || claims.attemptGroupId !== request.attemptGroupId
        || claims.agentSessionId !== request.agentSessionId
        || claims.workspaceId !== request.workspaceId
        || claims.dataClass !== (request.dataClass === 'private' ? 'private_source' : request.dataClass)
        || claims.provider !== request.provider.toLowerCase()
        || claims.model !== request.model
        || claims.projectedBodySha256 !== request.preparedBodySha256
        || claims.deadlineEpochMs !== request.deadlineEpochMs) {
        return yield* sendBlock(request, 'ATTEMPT_BINDING_MISMATCH', security);
      }
      if (!claimAttempt(request.attemptId, claims.deadlineEpochMs, now)) {
        return yield* sendBlock(request, 'ATTEMPT_REPLAYED_OR_CAPACITY_EXHAUSTED', security);
      }
      if (!security.allowedProviders.some((provider) => provider.toLowerCase() === request.provider.toLowerCase())) {
        return yield* sendBlock(request, 'PROVIDER_NOT_ALLOWED', security);
      }
      if (!security.allowedDestinations.includes(request.destination)) {
        return yield* sendBlock(request, 'DESTINATION_NOT_ALLOWED', security);
      }

      const bodyText = Buffer.from(request.bodyBase64, 'base64').toString('utf8');
      let body: unknown;
      try { body = JSON.parse(bodyText) as unknown; } catch {
        return yield* sendBlock(request, 'FINAL_BODY_INVALID', security);
      }
      if (typeof body !== 'object' || body === null || Array.isArray(body)
        || (body as Record<string, unknown>).model !== request.model
        || (body as Record<string, unknown>).store !== false
        || ((body as Record<string, unknown>).stream !== undefined && (body as Record<string, unknown>).stream !== false)
        || ['previous_response_id', 'conversation', 'conversation_id', 'thread_id']
          .some((field) => (body as Record<string, unknown>)[field] !== undefined)) {
        return yield* sendBlock(request, 'FINAL_BODY_NOT_CERTIFIED', security);
      }
      const secretDetected = containsLikelySecret(bodyText);
      const workspace = makeWorkspaceId(request.workspaceId);
      if (workspace._tag === 'Err') return workspace;
      const authorized = yield* authorizeAndAudit(security.policy, {
        workspaceId: workspace.value,
        operation: 'gateway_llm_physical_send',
        destination: 'other_external',
        dataClasses: dataClassesFor(request.dataClass),
        paths: [],
        secretDetected,
      }, request.attemptId, { clock: security.clock, audit: security.audit });
      if (isErr(authorized)) return authorized;
      if (authorized.value.decision.outcome !== 'allowed') {
        return physicalSendAttemptBlocked(request, authorized.value.decision.reasonCode);
      }
      return physicalSendAttemptAllowed(request);
    }),
  };
};
