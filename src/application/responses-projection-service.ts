import { Effect } from 'effect';
import { type DataClass } from '../domain/policy.js';
import { containsLikelySecret } from '../domain/sensitive-text.js';
import { makeWorkspaceId } from '../domain/workspace.js';
import { ok, type Result } from '../domain/result.js';
import type { DomainError } from '../domain/errors.js';
import {
  addVerifiedContextToResponses, bodyQueryMatches, decodeNativeResponsesBody,
  validateResponsesProjectionRequest, type ResponsesProjectionDecision,
  type ResponsesProjectionRequest,
} from '../domain/responses-projection.js';
import type { ContextTransformService } from './context-transform-service.js';
import { authorizeAndAudit } from './policy-service.js';
import type { GatewayProjectionSecurity } from './gateway-projection-service.js';
import { sha256Base64 } from '../domain/gateway-projection.js';

// This service prepares an additive native Responses input, not a provider
// delivery receipt. Bifröst's per-physical-send guard is a separate hard gate.
export interface ResponsesProjectionService {
  readonly projectResponses: (value: unknown) => Effect.Effect<Result<ResponsesProjectionDecision, DomainError>>;
}
const block = (req: ResponsesProjectionRequest, reasonCode: string): Result<ResponsesProjectionDecision, DomainError> =>
  ok({ kind: 'BLOCK', reasonCode, baseBodySha256: req.bodySha256 });
const classify = (req: ResponsesProjectionRequest): readonly DataClass[] => {
  const base: DataClass = req.dataClass === 'private' ? 'private_source' : req.dataClass;
  return base === 'private_source' ? ['private_source'] : [base, 'private_source'];
};

const permitProjection = (
  req: ResponsesProjectionRequest,
  security: GatewayProjectionSecurity,
  secretDetected: boolean,
): Effect.Effect<Result<{ allowed: boolean; reasonCode: string }, DomainError>> =>
  Effect.gen(function* () {
    const workspace = makeWorkspaceId(req.workspaceId);
    if (workspace._tag === 'Err') return workspace;
    if (!security.allowedProviders.some((p) => p.toLowerCase() === req.provider.toLowerCase())) {
      const denied = yield* security.audit.append({
        occurredAtMs: security.clock.nowMs(), correlationId: req.requestId,
        component: 'gateway-responses-projection', category: 'policy',
        policyVersion: security.policy.policyVersion, outcome: 'denied', reasonCode: 'POLICY_DENIED',
      });
      if (denied._tag === 'Err') return denied;
      return ok({ allowed: false, reasonCode: 'POLICY_DENIED' });
    }
    const authorized = yield* authorizeAndAudit(security.policy, {
      workspaceId: workspace.value, operation: 'gateway_llm_projection',
      destination: 'other_external', dataClasses: classify(req),
      paths: [], secretDetected,
    }, req.requestId, { clock: security.clock, audit: security.audit });
    if (authorized._tag === 'Err') return authorized;
    return ok({ allowed: authorized.value.decision.outcome === 'allowed', reasonCode: authorized.value.decision.reasonCode });
  });

export const makeResponsesProjectionService = (
  context: ContextTransformService, security: GatewayProjectionSecurity,
): ResponsesProjectionService => ({
  projectResponses: (value) => Effect.gen(function* () {
    const valid = validateResponsesProjectionRequest(value);
    if (valid._tag === 'Err') return valid;
    const request = valid.value;
    if (request.deadlineEpochMs <= Date.now()) return block(request, 'DEADLINE_EXCEEDED');
    if (request.attestation.hostTranscriptAttested && (request.attestation.compactionEnabled
      || request.attestation.hostCompactionEpoch === 'unknown')) {
      return block(request, 'HOST_COMPACTION_ACTIVE');
    }
    if (request.attestation.providerManagedHistoryCapability !== 'visible') {
      return block(request, 'PROVIDER_MANAGED_STATE_UNKNOWN');
    }
    const body = decodeNativeResponsesBody(request);
    if (body._tag === 'Err') return body;
    if (!bodyQueryMatches(body.value, request.query)) return block(request, 'BODY_QUERY_MISMATCH');

    // Deny secrets in original agent input before retrieval, not only in the
    // new evidence. Do not infer provider authorization from this check.
    const base = yield* permitProjection(request, security, containsLikelySecret(JSON.stringify(body.value)));
    if (base._tag === 'Err') return base;
    if (!base.value.allowed) return block(request, base.value.reasonCode);

    const transformed = yield* context.transform({
      schemaVersion: 1, requestId: request.requestId, sessionId: request.agentSessionId,
      turnId: request.attemptGroupId, workspaceId: request.workspaceId,
      query: request.query, budgetTokens: Number.MAX_SAFE_INTEGER,
      sourceObligations: { required: ['code'] },
    });
    if (transformed._tag === 'Err') return block(request, transformed.error.code);
    if (request.deadlineEpochMs <= Date.now()) return block(request, 'DEADLINE_EXCEEDED');
    const result = transformed.value;
    if (result.requestId !== request.requestId || result.sessionId !== request.agentSessionId
      || result.turnId !== request.attemptGroupId || result.workspaceId !== request.workspaceId) {
      return block(request, 'TRANSFORM_IDENTITY_MISMATCH');
    }
    if (result.status !== 'ready' || !result.contextText.trim() || result.selectedEvidenceIds.length === 0) {
      return block(request, 'TRANSFORM_NOT_READY');
    }
    if (containsLikelySecret(result.contextText)) {
      // Preserve the denial in the audit sink before exiting.
      const denied = yield* permitProjection(request, security, true);
      if (denied._tag === 'Err') return denied;
      return block(request, denied.value.reasonCode);
    }
    const injected = addVerifiedContextToResponses(body.value, result.contextText);
    if (injected._tag === 'Err') return block(request, injected.error.code);
    if (request.deadlineEpochMs <= Date.now()) return block(request, 'DEADLINE_EXCEEDED');
    return ok({
      kind: 'APPLY', reasonCode: 'VERIFIED_CONTEXT_ADDED',
      bodyBase64: injected.value,
      baseBodySha256: request.bodySha256,
      projectedBodySha256: sha256Base64(injected.value),
    });
  }),
});
