> **Native Responses v2 prepared locally; provider dispatch remains DISABLED.** The active ACE runtime uses only `ace.gateway.v2` native Responses projection at `/internal/ace-gateway/v2/project` (authenticated loopback), while the installed Bifröst plugin accepts native `/v1/responses` for **local context preparation only**. All actual model requests are still denied by `PreLLMHook`, including retries/fallback. No authorization for physical provider egress, live Hermes agent loop or production is claimed. The previous projection contract and every non-native route are retired. The pinned Bifröst upstream has extra internal retries below `PreLLMHook`; a verified per-physical-send guard must precede enablement. See the canonical `openspec/changes/013-gateway-g11-production-acceptance/` Native Responses specification and phase plans.

# ACE Bifrost connector

This directory contains the thin Go IPC client for **native `ace.gateway.v2` local Responses projection**. The prior projection DTOs and wire schemas are removed; generated v2 types are the only Gateway contract surface.

Current status:

- `adapter-implemented`: request identity, bounded body transport, original-body digest binding, decision validation and fail-closed application are implemented.
- `provider-wire-tested`: **NOT CERTIFIED for Native Responses**. No current provider-wire capture or real-provider acknowledgement is present in this source tree.
- `agent-E2E-tested`: **NOT RUN** for native Responses; compiling the plugin and local projection tests does not certify any provider dispatch or long Hermes loop.

Historical upstream source facts needed by C03–C05 were preserved in [Native Responses upstream evidence notes](../../../docs/reviews/2026-11-18-native-responses-upstream-evidence-notes.md) without retaining any retired generation contract. They require current-source revalidation; they are not provider-wire proof.

**Request-bound Gateway binding:** `HTTPTransportPreHook` runs after Bifröst transport authentication but before Bifröst Core populates its request/session context. The plugin therefore mints a fresh 128-bit ACE physical request ID itself, normalizes the caller-asserted coding-harness session correlation directly from Bifröst's supported header precedence, and digest-binds the exact inbound JSON body. The native v2 projector binds this observed identity to the exact prepared request, **not** to a provider-send receipt. `PreLLMHook` currently short-circuits all model attempts; it does not yet check and grant final-send authorization. A caller-supplied `x-request-id` is never ACE security identity.

**Bifröst is not a coding-host transcript attestor.** It cannot know whether the agent compacted, pruned or summarized its durable conversation before constructing the HTTP request. Therefore the connector deliberately sends `hostTranscriptAttested=false`, `hostCompactionEpoch="unknown"`, `providerManagedHistoryCapability="unknown"`, `activeEngineId="bifrost-visible-request-only"`, and an `unattested:<request-id>` revision marker. The current v2 native digest binds the exact visible request bytes only and MUST NOT be interpreted as proof of the host's durable transcript. ACE may still perform additive verified-evidence delivery for this honest lower-assurance state; any claim that ACE exclusively controlled host context/compaction requires a separate authenticated host attestor plus G11/benchmark evidence.

An explicit Bifröst `provider/model` identifier is mandatory. Unprefixed models and automatic provider routing are rejected because ACE must authorize the exact egress destination before retrieving or injecting private source context. The ACE projection service requires `ACE_GATEWAY_EXTERNAL_LLM_OPT_IN=true` plus an exact provider name in `ACE_GATEWAY_ALLOWED_LLM_PROVIDERS_JSON` before preparing private evidence. **That does not grant a send**: `PreLLMHook` currently blocks every provider attempt, and future final-send verification must recheck the final provider/model and body. Missing/invalid session correlation or inability to mint physical request identity fails closed. No static transcript/session attestation is accepted from environment variables.

**Workspace isolation / tenancy:** Bifröst's shared connector credential is NOT authentication of an individual coding user or session. Until an authenticated per-principal tenant mapping exists, set `ACE_BIFROST_TENANCY_MODE=single-workspace` and `ACE_BIFROST_WORKSPACE_ID=<the sole isolated workspace>` in the Bifröst plugin process. Initialization fails without both. Caller-provided workspace headers cannot select another workspace; mismatches are refused. Do **not** share this configured Bifröst listener among mutually untrusted workspaces or users. This is an explicit single-workspace deployment contract, not an implemented multi-tenant service.

**Projection HTTP authentication:** Set the same high-entropy secret as `ACE_GATEWAY_HTTP_SHARED_SECRET` on the ACE service and `ACE_GATEWAY_PROJECTION_TOKEN` on the Bifröst plugin process. The plugin refuses initialization without the latter, and the ACE HTTP endpoint refuses unauthenticated POST requests even from loopback. Never commit the secret or put it in a request-body attestation. The credential authenticates the connector process only; it does not turn caller session headers into authenticated identity.

**Terminal guard ordering:** ACE's `PreLLMHook` is the repository-owned admission guard, but Bifröst permits later custom `PreLLMHook` plugins to mutate a request. A production configuration must place `ace-gateway-projection` in `post_builtin` **after every other custom request-mutating plugin**. The pinned built-in model-catalog resolver may execute later, but with the mandatory explicit provider/model route it must not reroute the request. Repository compile/contract checks cannot prove a live deployment's plugin order or final upstream bytes; G11 must retain the loaded plugin order and provider-wire capture. Until that evidence exists, final-wire certification remains `NOT-RUN`.

The connector does not implement retrieval, compaction, reranking, policy selection or provider credentials. The plugin calls **`ProjectNativeResponses`** through the authenticated HTTP transport seam and accepts only a `PREPARED` local projection, which is **not** a dispatch receipt. There is no supported way to send a model request in this migration step: **every** normalized model attempt, including fallback and retry, is short-circuited by `PreLLMHook`. The per-physical-attempt authorizer and native-only provider-wire evidence remain NOT RUN / NOT IMPLEMENTED. Native plugin compilation against the exact pinned Bifröst revision is a PR/nightly CI gate. No retry/fallback or real-agent production certification is claimed.

Run the isolated contract tests with:

```bash
go test ./...
```

Build the native Bifrost plugin against an exact external Bifrost checkout:

```bash
GOWORK=off \
  GO_BIN=/absolute/path/to/go1.27.3/bin/go \
  BIFROST_SOURCE_ROOT=/absolute/path/to/bifrost-checkout \
  BIFROST_COMMIT=fe7634a6c828927d05ffdd57c62be0aaab04193f \
  ./scripts/build-bifrost-ace-plugin.sh
```

The build script verifies the checkout revision before compiling and uses the
`bifrost_plugin` build tag so ordinary connector tests do not import the
external Bifrost module.

The build also requires a clean tracked ACE checkout and embeds its exact Git commit into the native plugin. Runtime `Init` refuses a plugin whose ACE source provenance was not injected by this build path. This identifies the ACE plugin source and pinned Bifröst ABI source; it does not attest the coding host's transcript.
