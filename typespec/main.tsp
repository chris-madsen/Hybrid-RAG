import "@typespec/http";
import "@typespec/openapi3";
import "@typespec/openapi";
import "@typespec/json-schema";
using Http;
using JsonSchema;

// Canonical wire model for the existing ACE Gateway v1 protocol.
// OpenSpec owns behavior, while domain functions own hash/identity checks.
// Do not claim provider-wire delivery or introduce a token admission gate.
@service(#{ title: "ACE Gateway Projection v1" })
@TypeSpec.OpenAPI.info(#{ version: "1.0.0" })
namespace AceGatewayV1 {
  @minLength(1)
  scalar EvidenceId extends string;

  /** Checked by the existing application validator; string constraints are wire-only. */
  model HostCompactionAttestation {
    @pattern("^[a-f0-9]{64}$")
    hostBuildDigest: string;
    @minLength(1)
    sessionId: string;
    @minLength(1)
    parentSessionId?: string;
    @minLength(1)
    activeEngineId: string;
    @pattern("^[a-f0-9]{64}$")
    effectiveCompressionControlsDigest: string;
    @minLength(1)
    durableActiveTranscriptRevision: string;
    @pattern("^[a-f0-9]{64}$")
    durableActiveTranscriptDigest: string;
    @minValue(0)
    hostCompactionEpoch: int64 | "unknown";
    @minLength(1)
    attestorId: string;
    providerManagedHistoryCapability: "visible" | "hidden" | "unknown";
    hostTranscriptAttested: boolean;
    compactionEnabled: boolean;
  }

  @jsonSchema
  model ProjectionRequest {
    schemaVersion: "ace.gateway.v1";
    @minLength(1)
    requestId: string;
    @minLength(1)
    attemptGroupId: string;
    @minLength(1)
    agentSessionId: string;
    @minLength(1)
    workspaceId: string;
    dataClass: "private" | "project_document" | "public";
    protocol: "openai.chat.completions";
    @minLength(1)
    provider: string;
    @minLength(1)
    `model`: string;
    @pattern("^[A-Za-z0-9+/]+={0,2}$")
    @maxLength(5592408)
    bodyBase64: string;
    @pattern("^[a-f0-9]{64}$")
    bodySha256: string;
    @minLength(1)
    query: string;
    projectionMode: "native" | "gateway" | "assist-only" | "observe-only" | "off";
    @minValue(1)
    deadlineEpochMs: int64;
    attestation: HostCompactionAttestation;
    nativeProjectionActive?: boolean;
    @uniqueItems
    requestedEvidenceIds?: EvidenceId[];
  }

  model ProjectionReceipt {
    schemaVersion: "ace.gateway.v1";
    @minLength(1)
    requestId: string;
    @minLength(1)
    attemptGroupId: string;
    @minValue(0)
    attemptIndex: int64;
    @minLength(1)
    projectionId?: string;
    @minLength(1)
    receiptId: string;
    decision: "APPLY" | "UNCHANGED_AUTHORIZED" | "DEGRADED_AUTHORIZED" | "BLOCK";
    @minLength(1)
    reasonCode?: string;
    @pattern("^[a-f0-9]{64}$")
    baseBodySha256: string;
    @pattern("^[a-f0-9]{64}$")
    projectedBodySha256?: string;
    @minValue(0)
    hostCompactionEpoch: int64 | "unknown";
    @minLength(1)
    activeEngineId: string;
    @uniqueItems
    permittedWireRewrites: string[];
  }

  @jsonSchema
  model ProjectionDecision {
    kind: "APPLY" | "UNCHANGED_AUTHORIZED" | "DEGRADED_AUTHORIZED" | "BLOCK";
    @pattern("^[A-Za-z0-9+/]+={0,2}$")
    bodyBase64?: string;
    receipt: ProjectionReceipt;
  }

  /** Real informational routes; statuses are local adapter facts, not provider-wire approval. */
  model GatewayHealth {
    schemaVersion: "ace.gateway.v1";
    liveness: "ready";
    readiness: "adapter_implemented";
    providerWire: "not_certified";
  }

  model GatewayRouteCapability {
    protocol: "openai.chat.completions";
    mode: "structured";
    capability: "G2_GATEWAY_VISIBLE_ONLY";
  }

  model GatewayCapabilities {
    schemaVersion: "ace.gateway.v1";
    routes: GatewayRouteCapability[];
    @minValue(0)
    maxBodyBytes: int64;
    projectionModes: ("native" | "gateway" | "assist-only" | "observe-only" | "off")[];
    providerWireCertification: "not_certified";
  }

  /** This public endpoint deliberately has no successful delivery response. */
  model DeliveryNotCertified {
    @statusCode
    status: 501;
    error: {
      code: "PROVIDER_WIRE_NOT_CERTIFIED";
      message: string;
    };
  }

  /** Existing HTTP failure envelope; errors are not fabricated success results. */
  model GatewayError {
    @statusCode
    status: 400 | 503;
    error: { code: string; message: string };
  }

  @get
  @route("/internal/ace-gateway/v1/health")
  op health(): GatewayHealth;

  @get
  @route("/internal/ace-gateway/v1/capabilities")
  op capabilities(): GatewayCapabilities;

  @TypeSpec.OpenAPI.extension("x-ace-final-provider-wire", "not_certified")
  @post
  @route("/internal/ace-gateway/v1/record-delivery")
  op recordDelivery(): DeliveryNotCertified;

  // Supported OpenAPI metadata only; these attributes are not access control.
  // Runtime authorization and final-send safety remain independent domain duties.
  @TypeSpec.OpenAPI.extension("x-ace-runtime-policy-owner", "domain-policy")
  @TypeSpec.OpenAPI.extension("x-ace-final-provider-wire", "not_certified")
  @post
  @route("/internal/ace-gateway/v1/project")
  op project(@body request: ProjectionRequest): ProjectionDecision | GatewayError;
}
