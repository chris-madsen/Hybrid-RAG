import { domainError, type DomainError } from './errors.js';
import { err, ok, type Result } from './result.js';
import { sha256 } from './retrieval-benchmark.js';

// Shared transport byte-binding and host-attestation invariants.
// This module is protocol-neutral and contains no Chat request types.
export type ProviderManagedHistoryCapability = 'visible' | 'hidden' | 'unknown';

export interface HostCompactionAttestation {
  readonly hostBuildDigest: string;
  readonly sessionId: string;
  readonly parentSessionId?: string;
  readonly activeEngineId: string;
  readonly effectiveCompressionControlsDigest: string;
  readonly durableActiveTranscriptRevision: string;
  readonly durableActiveTranscriptDigest: string;
  readonly hostCompactionEpoch: number | 'unknown';
  readonly attestorId: string;
  readonly providerManagedHistoryCapability: ProviderManagedHistoryCapability;
  readonly hostTranscriptAttested: boolean;
  readonly compactionEnabled: boolean;
}

const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const safeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const firstUnknownField = (input: Record<string, unknown>, allowed: ReadonlySet<string>): string | undefined =>
  Object.keys(input).find((field) => !allowed.has(field));
const hostAttestationFields = new Set([
  'hostBuildDigest', 'sessionId', 'parentSessionId', 'activeEngineId', 'effectiveCompressionControlsDigest',
  'durableActiveTranscriptRevision', 'durableActiveTranscriptDigest', 'hostCompactionEpoch', 'attestorId',
  'providerManagedHistoryCapability', 'hostTranscriptAttested', 'compactionEnabled',
]);

export const sha256Base64 = (bodyBase64: string): string =>
  sha256(Buffer.from(bodyBase64, 'base64'));

export const validateHostCompactionAttestation = (
  value: unknown,
): Result<HostCompactionAttestation, DomainError> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return err(domainError('INVALID_ATTESTATION', 'attestation', 'host attestation must be an object'));
  }
  const input = value as Record<string, unknown>;
  const unknownField = firstUnknownField(input, hostAttestationFields);
  if (unknownField !== undefined) {
    return err(domainError('INVALID_ATTESTATION', `attestation.${unknownField}`, 'unknown host attestation field'));
  }
  const requiredStrings = [
    'hostBuildDigest', 'sessionId', 'activeEngineId', 'effectiveCompressionControlsDigest',
    'durableActiveTranscriptRevision', 'durableActiveTranscriptDigest', 'attestorId',
  ];
  if (requiredStrings.some((key) => !nonEmpty(input[key]))) {
    return err(domainError('INVALID_ATTESTATION', 'attestation.identity', 'host attestation identity is incomplete'));
  }
  if (!digest(input.hostBuildDigest)
    || !digest(input.effectiveCompressionControlsDigest)
    || !digest(input.durableActiveTranscriptDigest)) {
    return err(domainError('INVALID_ATTESTATION', 'attestation.digest', 'host attestation digests must be SHA-256'));
  }
  if ((!safeInteger(input.hostCompactionEpoch) || (input.hostCompactionEpoch as number) < 0) && input.hostCompactionEpoch !== 'unknown') {
    return err(domainError('INVALID_ATTESTATION', 'attestation.hostCompactionEpoch', 'compaction epoch must be an integer or unknown'));
  }
  if (input.parentSessionId !== undefined && !nonEmpty(input.parentSessionId)) {
    return err(domainError('INVALID_ATTESTATION', 'attestation.parentSessionId', 'parent session must be a non-empty string'));
  }
  if (typeof input.hostTranscriptAttested !== 'boolean' || typeof input.compactionEnabled !== 'boolean') {
    return err(domainError('INVALID_ATTESTATION', 'attestation.flags', 'host attestation flags are required'));
  }
  if (input.providerManagedHistoryCapability !== 'visible'
    && input.providerManagedHistoryCapability !== 'hidden'
    && input.providerManagedHistoryCapability !== 'unknown') {
    return err(domainError('INVALID_ATTESTATION', 'attestation.providerManagedHistoryCapability', 'provider history capability is invalid'));
  }
  return ok(input as unknown as HostCompactionAttestation);
};
