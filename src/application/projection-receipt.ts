import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import type { DataClass } from '../domain/policy.js';

export interface ProjectionReceiptClaims {
  readonly version: 1;
  readonly requestId: string;
  readonly attemptGroupId: string;
  readonly agentSessionId: string;
  readonly workspaceId: string;
  readonly dataClass: DataClass;
  readonly provider: string;
  readonly model: string;
  readonly baseBodySha256: string;
  readonly projectedBodySha256: string;
  readonly evidenceIdsSha256: string;
  readonly contextTextSha256: string;
  readonly policyVersion: number;
  readonly deadlineEpochMs: number;
}

const receiptKeys = new Set([
  'version', 'requestId', 'attemptGroupId', 'agentSessionId', 'workspaceId', 'dataClass',
  'provider', 'model', 'baseBodySha256', 'projectedBodySha256', 'evidenceIdsSha256',
  'contextTextSha256', 'policyVersion', 'deadlineEpochMs',
]);
const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

export const makeProjectionReceiptClaims = (input: Omit<ProjectionReceiptClaims, 'version' | 'evidenceIdsSha256' | 'contextTextSha256'> & {
  readonly selectedEvidenceIds: readonly string[];
  readonly contextText: string;
}): ProjectionReceiptClaims => ({
  version: 1,
  requestId: input.requestId,
  attemptGroupId: input.attemptGroupId,
  agentSessionId: input.agentSessionId,
  workspaceId: input.workspaceId,
  dataClass: input.dataClass,
  provider: input.provider,
  model: input.model,
  baseBodySha256: input.baseBodySha256,
  projectedBodySha256: input.projectedBodySha256,
  evidenceIdsSha256: sha256(JSON.stringify(input.selectedEvidenceIds)),
  contextTextSha256: sha256(input.contextText),
  policyVersion: input.policyVersion,
  deadlineEpochMs: input.deadlineEpochMs,
});

export const signProjectionReceipt = (claims: ProjectionReceiptClaims, secret: string): string => {
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(payload, 'utf8').digest('base64url');
  return `${payload}.${signature}`;
};

const invalidReceipt = (): Result<never, DomainError> =>
  err(domainError('POLICY_DENIED', 'projection_receipt', 'projection receipt is invalid or expired'));

export const verifyProjectionReceipt = (
  receipt: string,
  secret: string,
  nowMs: number,
): Result<ProjectionReceiptClaims, DomainError> => {
  if (!secret || receipt.length === 0 || receipt.length > 16 * 1024) return invalidReceipt();
  const parts = receipt.split('.');
  if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_-]+$/u.test(part))) return invalidReceipt();
  const [payload, signature] = parts as [string, string];
  const expected = createHmac('sha256', secret).update(payload, 'utf8').digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return invalidReceipt(); }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return invalidReceipt();

  let decoded: string;
  let parsed: unknown;
  try {
    const bytes = Buffer.from(payload, 'base64url');
    decoded = bytes.toString('utf8');
    if (Buffer.from(decoded, 'utf8').toString('base64url') !== payload) return invalidReceipt();
    parsed = JSON.parse(decoded) as unknown;
  } catch { return invalidReceipt(); }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return invalidReceipt();
  const claims = parsed as Record<string, unknown>;
  if (Object.keys(claims).length !== receiptKeys.size || Object.keys(claims).some((key) => !receiptKeys.has(key))) return invalidReceipt();
  if (JSON.stringify(claims) !== decoded || claims.version !== 1
    || typeof claims.requestId !== 'string' || typeof claims.attemptGroupId !== 'string'
    || typeof claims.agentSessionId !== 'string' || typeof claims.workspaceId !== 'string'
    || (claims.dataClass !== 'private_source' && claims.dataClass !== 'project_document' && claims.dataClass !== 'public')
    || typeof claims.provider !== 'string' || typeof claims.model !== 'string'
    || typeof claims.baseBodySha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(claims.baseBodySha256)
    || typeof claims.projectedBodySha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(claims.projectedBodySha256)
    || typeof claims.evidenceIdsSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(claims.evidenceIdsSha256)
    || typeof claims.contextTextSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(claims.contextTextSha256)
    || !Number.isSafeInteger(claims.policyVersion) || (claims.policyVersion as number) < 1
    || !Number.isSafeInteger(claims.deadlineEpochMs) || (claims.deadlineEpochMs as number) <= nowMs) {
    return invalidReceipt();
  }
  return ok(claims as unknown as ProjectionReceiptClaims);
};
