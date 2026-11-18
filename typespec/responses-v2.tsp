// Canonical TypeSpec source for the active native Responses v2 Gateway wire.
// No previous projection contract or generated compatibility surface is retained.
import "@typespec/http";
import "@typespec/json-schema";
import "@typespec/openapi";
using Http;
using JsonSchema;

@service(#{ title: "ACE Native Responses Projection" })
@TypeSpec.OpenAPI.info(#{ version: "2.0.0" })
namespace ACE.ResponsesV2 {
  model HostCompactionAttestation {
    @pattern("^[a-f0-9]{64}$") hostBuildDigest: string;
    @minLength(1) sessionId: string;
    @minLength(1) parentSessionId?: string;
    @minLength(1) activeEngineId: string;
    @pattern("^[a-f0-9]{64}$") effectiveCompressionControlsDigest: string;
    @minLength(1) durableActiveTranscriptRevision: string;
    @pattern("^[a-f0-9]{64}$") durableActiveTranscriptDigest: string;
    hostCompactionEpoch: int64 | "unknown";
    @minLength(1) attestorId: string;
    providerManagedHistoryCapability: "visible" | "hidden" | "unknown";
    hostTranscriptAttested: boolean;
    compactionEnabled: boolean;
  }

  @jsonSchema
  model ProjectionRequest {
    schemaVersion: "ace.gateway.v2";
    protocol: "openai.responses";
    @minLength(1) requestId: string;
    @minLength(1) attemptGroupId: string;
    @minLength(1) agentSessionId: string;
    @minLength(1) workspaceId: string;
    dataClass: "private" | "project_document" | "public";
    @minLength(1) provider: string;
    @minLength(1) `model`: string;
    @pattern("^[A-Za-z0-9+/]+={0,2}$")
    @maxLength(5592408)
    bodyBase64: string;
    @pattern("^[a-f0-9]{64}$") bodySha256: string;
    @minLength(1) query: string;
    projectionMode: "gateway";
    @minValue(1) deadlineEpochMs: int64;
    attestation: HostCompactionAttestation;
  }

  @jsonSchema
  @discriminated(#{ envelope: "none", discriminatorPropertyName: "kind" })
  union ProjectionDecision {
    PREPARED: PreparedProjection;
    BLOCK: BlockedProjection;
  }

  @jsonSchema
  model PreparedProjection {
    kind: "PREPARED";
    @pattern("^[a-f0-9]{64}$") baseBodySha256: string;
    @pattern("^[a-f0-9]{64}$") projectedBodySha256: string;
    @pattern("^[A-Za-z0-9+/]+={0,2}$") bodyBase64: string;
    reasonCode: "VERIFIED_CONTEXT_ADDED";
  }

  @jsonSchema
  model BlockedProjection {
    kind: "BLOCK";
    @pattern("^[a-f0-9]{64}$") baseBodySha256: string;
    reasonCode: string;
  }

  @jsonSchema
  model GatewayHealth {
    schemaVersion: "ace.gateway.v2";
    liveness: "ready";
    readiness: "adapter_implemented";
    providerWire: "not_certified";
  }

  model GatewayRouteCapability {
    protocol: "openai.responses";
    mode: "structured";
    capability: "NATIVE_RESPONSES_NOT_CERTIFIED";
  }

  @jsonSchema
  model GatewayCapabilities {
    schemaVersion: "ace.gateway.v2";
    routes: GatewayRouteCapability[];
    @minValue(0) maxBodyBytes: int64;
    projectionModes: "gateway"[];
    providerWireCertification: "not_certified";
  }

  model DeliveryNotCertified {
    @statusCode status: 501;
    error: {
      code: "PROVIDER_WIRE_NOT_CERTIFIED";
      message: string;
    };
  }

  model GatewayError {
    @statusCode status: 400 | 401 | 404 | 405 | 409 | 413 | 501 | 503;
    error: { code: string; message: string };
  }

  @get
  @route("/internal/ace-gateway/v2/health")
  op health(): GatewayHealth;

  @get
  @route("/internal/ace-gateway/v2/capabilities")
  op capabilities(): GatewayCapabilities;

  @TypeSpec.OpenAPI.extension("x-ace-final-provider-wire", "not_certified")
  @post
  @route("/internal/ace-gateway/v2/record-delivery")
  op recordDelivery(): DeliveryNotCertified;

  @post
  @route("/internal/ace-gateway/v2/project")
  op project(@body request: ProjectionRequest): ProjectionDecision | GatewayError;
}
