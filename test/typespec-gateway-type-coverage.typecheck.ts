import type {
  ProjectionRequest as GeneratedProjectionRequest,
  ProjectionDecision as GeneratedProjectionDecision,
  HostCompactionAttestation as GeneratedHostAttestation,
} from '../typespec/generated/sdk/types.gen.js';
import type {
  ResponsesProjectionRequest,
  ResponsesProjectionDecision,
} from '../src/domain/responses-projection.js';
import type { HostCompactionAttestation } from '../src/domain/gateway-request-binding.js';

type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends
(<Value>() => Value extends Right ? 1 : 2) ? true : false;
type Expect<Value extends true> = Value;
type RequestVersionMatches = Expect<Equal<GeneratedProjectionRequest['schemaVersion'], ResponsesProjectionRequest['schemaVersion']>>;
type RequestProtocolMatches = Expect<Equal<GeneratedProjectionRequest['protocol'], ResponsesProjectionRequest['protocol']>>;
type RequestFieldsMatch = Expect<Equal<
GeneratedProjectionRequest['bodySha256' | 'bodyBase64' | 'query' | 'deadlineEpochMs'],
ResponsesProjectionRequest['bodySha256' | 'bodyBase64' | 'query' | 'deadlineEpochMs']
>>;
type AttestationSessionMatches = Expect<Equal<GeneratedHostAttestation['sessionId'], HostCompactionAttestation['sessionId']>>;
type AttestationHistoryMatches = Expect<Equal<GeneratedHostAttestation['providerManagedHistoryCapability'], HostCompactionAttestation['providerManagedHistoryCapability']>>;
type DecisionKindsMatch = Expect<Equal<GeneratedProjectionDecision['kind'], ResponsesProjectionDecision['kind']>>;

const request: GeneratedProjectionRequest = {
  schemaVersion: 'ace.gateway.v2', protocol: 'openai.responses', requestId: 'r1', attemptGroupId: 'a1',
  agentSessionId: 's1', workspaceId: 'ws1', dataClass: 'private', provider: 'openai', model: 'openai/model',
  bodyBase64: 'e30=', bodySha256: 'a'.repeat(64), query: 'query', projectionMode: 'gateway',
  deadlineEpochMs: 1, attestation: {
    hostBuildDigest: 'a'.repeat(64), sessionId: 's1', activeEngineId: 'bifrost-visible-request-only',
    effectiveCompressionControlsDigest: 'b'.repeat(64), durableActiveTranscriptRevision: 'unattested',
    durableActiveTranscriptDigest: 'c'.repeat(64), hostCompactionEpoch: 'unknown', attestorId: 'test',
    providerManagedHistoryCapability: 'visible', hostTranscriptAttested: false, compactionEnabled: false,
  },
};
const prepared: GeneratedProjectionDecision = {
  kind: 'PREPARED', baseBodySha256: 'a'.repeat(64), projectedBodySha256: 'b'.repeat(64),
  bodyBase64: 'e30=', reasonCode: 'VERIFIED_CONTEXT_ADDED',
};
const blocked: GeneratedProjectionDecision = { kind: 'BLOCK', baseBodySha256: 'a'.repeat(64), reasonCode: 'NOT_READY' };
const samples: readonly [GeneratedProjectionRequest, GeneratedProjectionDecision, GeneratedProjectionDecision] = [request, prepared, blocked];
type ContractChecks = readonly [RequestVersionMatches, RequestProtocolMatches, RequestFieldsMatch, AttestationSessionMatches, AttestationHistoryMatches, DecisionKindsMatch];
void [samples, null as unknown as ContractChecks];
