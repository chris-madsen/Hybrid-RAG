> **Native Responses v2 projection and per-attempt guard are implemented; provider-wire certification is NOT RUN.** The active ACE runtime exposes only the authenticated loopback `ace.gateway.v2` projection and attempt-authorization routes. Bifröst admits native `/v1/responses` only when a fresh projection receipt and request-scoped physical-send guard are present. The guard stages and checks each physical request before dialing/writing; all policy, receipt, route, deadline, size, unsupported-body and audit failures fail closed. Exact destination/provider/data opt-ins default to empty/off. No real provider call, Hermes agent loop, production readiness or owner approval is claimed. The previous projection contract and every non-native route remain retired. See the canonical `openspec/changes/013-gateway-g11-production-acceptance/` specification and C03 phase record.

# ACE Bifrost connector

This directory contains the thin Go IPC client for **native `ace.gateway.v2` local Responses projection**. The prior projection DTOs and wire schemas are removed; generated v2 types are the only Gateway contract surface.

Current evidence status:

- `adapter-implemented`: authenticated TypeSpec v2 projection receipt, exact destination/provider/model binding, bounded staging, per-RoundTrip authorization, retry-specific IDs, non-inherited guard with fail-closed internal-child marker, and denial/no-dial contract tests are implemented.
- `provider-wire-tested`: **NOT CERTIFIED for Native Responses**. Scripted TCP and serializer tests are local tests only; no current provider-wire capture or real-provider acknowledgement is present in this source tree.
- `agent-E2E-tested`: **NOT RUN** for native Responses; compiling the plugin and local projection tests does not certify any provider dispatch or long Hermes loop.

The exact staging/semantic-binding and process-local single-use ledger are proposed C03 implementation mechanics awaiting G02 review. The provider-bound API defaults to deny because the destination list and external LLM opt-in are empty/false; no live request was made for this PR.

The plugin build currently pins Bifröst commit `6baf302dc73a9858bb96da017a436ef2e60f82f1` from the review fork because the required core transport API is in the open upstream PR. After that PR merges, update this pin and the CI checkout to the merged `maximhq/bifrost` commit before treating the integration as a maintained upstream dependency.

Historical upstream source facts needed by C03–C05 were preserved in [Native Responses upstream evidence notes](../../../docs/reviews/2026-11-18-native-responses-upstream-evidence-notes.md) without retaining any retired generation contract. They require current-source revalidation; they are not provider-wire proof.

**Request-bound Gateway binding:** `HTTPTransportPreHook` runs after Bifröst transport authentication but before Bifröst Core populates its request/session context. The plugin mints a fresh 128-bit ACE request ID, records the caller-asserted coding-harness session only as correlation, normalizes the explicit `provider/model` route, and binds the original ingress bytes through the host attestation. ACE returns an HMAC-signed, process-scoped projection receipt. `PreLLMHook` admits only the native Responses request carrying that receipt and its physical-send guard; it is not itself a send permit. Each actual `contextTransport.RoundTrip` stages the exact HTTP body, derives a fresh attempt ID and calls ACE before dialing. The connector checks the staged final body digest plus lossless semantic equality with the receipt-bound prepared body; ACE rechecks the receipt, actual body digest, provider/model/destination, non-streaming `store:false`, source policy, deadline and audit before returning `ALLOW`. An `ALLOW` is never cached or reused. A caller-supplied `x-request-id` is never ACE security identity.

**Bifröst is not a coding-host transcript attestor.** It cannot know whether the agent compacted, pruned or summarized its durable conversation before constructing the HTTP request. Therefore the connector deliberately sends `hostTranscriptAttested=false`, `hostCompactionEpoch="unknown"`, `providerManagedHistoryCapability="unknown"`, `activeEngineId="bifrost-visible-request-only"`, and an `unattested:<request-id>` revision marker. The current v2 native digest binds the exact visible request bytes only and MUST NOT be interpreted as proof of the host's durable transcript. ACE may still perform additive verified-evidence delivery for this honest lower-assurance state; any claim that ACE exclusively controlled host context/compaction requires a separate authenticated host attestor plus G11/benchmark evidence.

An explicit Bifröst `provider/model` identifier is mandatory; unprefixed models, provider-query conflicts, model aliases that change the route, changed request bodies and provider/model fallbacks fail closed. ACE requires `ACE_GATEWAY_EXTERNAL_LLM_OPT_IN=true`, an exact provider in `ACE_GATEWAY_ALLOWED_LLM_PROVIDERS_JSON`, and an exact canonical HTTPS Responses URL in `ACE_GATEWAY_ALLOWED_LLM_DESTINATIONS_JSON` before a send can be allowed. Both allowlists default to empty. Streaming (`stream:true`) is denied until C06; omission of `stream` is accepted only as the native non-streaming default. The process-scoped receipt key and bounded in-memory attempt-ID ledger intentionally deny in-flight or replayed attempts after restart; this mechanism is a reviewable C03 proposal, not G02-approved durable storage. Missing/invalid session correlation, unavailable audit, expired receipt, policy denial, secret detection, unsupported body framing, oversized serialization or inability to mint request identity fails closed. No static transcript/session attestation is accepted from environment variables.

**Workspace isolation / tenancy:** Bifröst's shared connector credential is NOT authentication of an individual coding user or session. Until an authenticated per-principal tenant mapping exists, set `ACE_BIFROST_TENANCY_MODE=single-workspace` and `ACE_BIFROST_WORKSPACE_ID=<the sole isolated workspace>` in the Bifröst plugin process. Initialization fails without both. Caller-provided workspace headers cannot select another workspace; mismatches are refused. Do **not** share this configured Bifröst listener among mutually untrusted workspaces or users. This is an explicit single-workspace deployment contract, not an implemented multi-tenant service.

**Projection/attempt HTTP authentication:** Set the same high-entropy secret as `ACE_GATEWAY_HTTP_SHARED_SECRET` on the ACE service and `ACE_GATEWAY_PROJECTION_TOKEN` on the Bifröst plugin process. The plugin refuses initialization without the latter, and both ACE POST endpoints refuse unauthenticated requests even from loopback. Never commit the secret or put it in a request-body attestation. The credential authenticates the connector process only; it does not turn caller session headers into authenticated identity. ACE resolves its process-scoped receipt key at startup; a restart invalidates all outstanding receipts.

**Terminal guard ordering:** Bifröst permits later custom `PreLLMHook` plugins to mutate a request. Keep `ace-gateway-projection` in `post_builtin` **after every other custom request-mutating plugin** to avoid needless denials; the final transport guard still rejects any changed provider/model/body semantics. Internal child requests shed the guard itself but inherit a guard-required marker, so an unguarded internal send is refused before dialing. Repository tests prove the local transport/connector boundary only; they do not prove the deployed plugin order or real provider bytes. G11 must retain the loaded plugin order and after-last-mutation provider-wire capture; final-wire certification remains `NOT-RUN`.

The connector does not implement retrieval, compaction, reranking, policy selection or provider credentials. It calls `ProjectNativeResponses` and `AuthorizeNativeResponsesAttempt` through authenticated loopback HTTP. Only a `PREPARED` response with a signed receipt can install a guard; it cannot authorize dispatch by itself. The physical-send authorizer compares the staged provider body with the prepared semantics, posts the exact final body bytes/digest and route facts to ACE, validates the decision echo, and returns `nil` only for a fresh `ALLOW`. Same-route transport retries are reauthorized with new attempt IDs; route-changing fallbacks and unsupported body/stream paths are denied. These deterministic tests are not provider-wire or agent certification. Native plugin compilation against the exact revised Bifröst commit is a PR gate. No real-provider call or production claim is made.

Run the isolated contract tests with:

```bash
go test ./...
```

Build the native Bifrost plugin against an exact external Bifrost checkout:

```bash
GOWORK=off \
  GO_BIN=/absolute/path/to/go1.27.4/bin/go \
  BIFROST_SOURCE_ROOT=/absolute/path/to/bifrost-checkout \
  BIFROST_COMMIT=6baf302dc73a9858bb96da017a436ef2e60f82f1 \
  ./scripts/build-bifrost-ace-plugin.sh
```

The build script verifies the checkout revision before compiling and uses the
`bifrost_plugin` build tag so ordinary connector tests do not import the
external Bifrost module.

The build also requires a clean ACE checkout, including no untracked files, and embeds its exact Git commit into the native plugin. Runtime `Init` refuses a plugin whose ACE source provenance was not injected by this build path. This identifies the ACE plugin source and pinned Bifröst ABI source; it does not attest the coding host's transcript.
