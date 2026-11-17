// Canonical TypeSpec source for *proposed* native Responses v2 wire.
// Compiled emission is an explicit migration gate; the frozen v1 schema is not rewritten.
import "@typespec/http";
import "@typespec/json-schema";
import "@typespec/openapi";
using Http;
using JsonSchema;

@service(#{ title: "ACE Native Responses Projection" })
@TypeSpec.OpenAPI.info(#{ version: "2.0.0" })
namespace ACE.ResponsesV2 {
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
    @minLength(1) model: string;
    @minLength(1) bodyBase64: string;
    @pattern("^[a-f0-9]{64}$") bodySha256: string;
    @minLength(1) query: string;
    projectionMode: "gateway";
    @minValue(1) deadlineEpochMs: int64;
    attestation: {
      @pattern("^[a-f0-9]{64}$") hostBuildDigest: string;
      @minLength(1) sessionId: string;
      @minLength(1) activeEngineId: string;
      @pattern("^[a-f0-9]{64}$") effectiveCompressionControlsDigest: string;
      @minLength(1) durableActiveTranscriptRevision: string;
      @pattern("^[a-f0-9]{64}$") durableActiveTranscriptDigest: string;
      hostCompactionEpoch: int64 | "unknown";
      @minLength(1) attestorId: string;
      providerManagedHistoryCapability: "visible" | "hidden" | "unknown";
      hostTranscriptAttested: boolean;
      compactionEnabled: boolean;
    };
  }

  @jsonSchema
  model ProjectionDecision {
    kind: "PREPARED" | "BLOCK";
    @pattern("^[a-f0-9]{64}$") baseBodySha256: string;
    @pattern("^[a-f0-9]{64}$") projectedBodySha256?: string;
    bodyBase64?: string;
    reasonCode: string;
  }

  @post
  @route("/internal/ace-gateway/v2/project")
  op project(@body request: ProjectionRequest): ProjectionDecision;
}
