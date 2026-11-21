# ACE ↔ Bifröst native Responses connector

**Updated for the owner’s 2026-11-21 subscription-only architecture decision.** This is the Go connector for the TypeSpec-owned `ace.gateway.v2` local projection and physical-send authorization API. ACE receives native Responses, prepares verified code context, and signs a short-lived request-bound receipt. Bifröst performs actual provider dispatch; the model provider—not ACE—validates the user's ChatGPT/Codex subscription OAuth token.

For active requirements and runbooks see [OpenSpec C04](../../../openspec/changes/013-gateway-g11-production-acceptance/phases/C04.md), [RESP-006](../../../openspec/changes/013-gateway-g11-production-acceptance/specs/gateway-native-responses/spec.md), and [subscription OAuth integration](../../../docs/operations/gateway-subscription-oauth.md).

## Actual local ACE authorization (after C04 correction)

- ACE **does not** inspect/attest the origin, refresh state or entitlement of OAuth credentials. There is no `OAUTH_ROUTE_UNVERIFIED` unconditional deny path. Subscription OAuth is owned by Hermes and authenticated by ChatGPT/Codex.
- The prepared projection receipt is signed and tied to exact request/workspace/session correlation, source data class, provider/model, prepared body digest, deadline and policy version. The per-attempt physical-send guard checks final provider route/destination and serialized native request body, `store:false`, secret and authorized data classes, then single-use attempt ID.
- If those checks pass and the audit sink records the safe attempt metadata, ACE returns **`ALLOW`**; otherwise **`BLOCK`** or typed error. No API-key OAuth fallback, direct provider bypass or alternate Chat/Completions transport is implemented. Retried sends require a new attempt ID and independent authorization.
- A permitted model-bound prompt with private conversation plus private source requires policy permission for **both** classes. Audit records contain only safe IDs, hashes, route identity and reason—not OAuth tokens, raw code or conversation.
- The valid final provider destination path can be the ordinary native `/v1/responses` **or** the exact official subscription `https://chatgpt.com/backend-api/codex/responses`. **Allowing the syntax does not grant permission**: `ACE_GATEWAY_ALLOWED_LLM_DESTINATIONS_JSON` must list the exact configured destination. A subscription-only deployment must **not** allowlist `https://api.openai.com/v1/responses`.

## Critical upstream compatibility, not yet certified

The connector's current Go plugin is built against a **pinned review fork**:

`chris-madsen/bifrost@6baf302dc73a9858bb96da017a436ef2e60f82f1`

That fork provides ACE's request-scoped physical-send guard for the standard native `/v1/responses` transport. **It has not been shown to forward Hermes's subscription bearer to the ChatGPT Codex backend**. An apparent successful local ACE `ALLOW` does not make this transport subscription-compatible.

Maintained upstream Bifröst transport `transports/v2.6.0` has a native subscription-preserving `/chatgpt_passthrough/backend-api/codex/responses` route (see [official Codex guide](https://github.com/maximhq/bifrost/blob/transports/v2.6.0/docs/cli-agents/codex-cli.mdx)). It forwards the original caller's ChatGPT `Authorization` to ChatGPT, while a Bifröst virtual key is carried separately in `x-bf-vk`. This removes any need to implement ACE's own OAuth mechanism.

**Integration remains open:** verify that this maintained upstream route invokes ACE's *authenticated projection* and *post-mutation per-physical-send guard*, or supply a small upstream-compatible integration using maintained extension points. The review fork's plugin ABI and the current upstream v2.6 transport are not assumed compatible. Do not silently update the pin or bypass ACE by using a raw passthrough. This must be established before a genuine Hermes/Harbor subscription-based E2E PASS.

## Request and trust boundaries

1. Hermes targets Bifröst native Responses; never target a separate direct provider route for ACE trials.
2. `HTTPTransportPreHook` binds the actual incoming message to its workspace and creates the ACE request identity. Caller-provided session headers are *correlation*, not authentication.
3. `PreLLMHook` requires the ACE prepared projection receipt and installs the Bifröst physical-send guard. `PREPARED` alone cannot authorize provider network traffic.
4. The guard stages final native body bytes, obtains an ACE single-use attempt decision and permits transmission only on `ALLOW`. A later plugin mutation or an unknown route invalidates the receipt; retry/fallback attempts cannot reuse a permit.
5. On an unexpected upstream 401/403, surface the provider authentication error. Never retry via an OpenAI API key or another provider/model.
6. Bifröst does not attest the coding host's full durable transcript or compaction history. The current connector honestly marks that as `unattested`; the known request bytes and signed source evidence remain the only proven context.

## Current configuration

For a private single-workspace Bifröst instance, set in the **Bifröst plugin process**:

```bash
ACE_BIFROST_TENANCY_MODE=single-workspace
ACE_BIFROST_WORKSPACE_ID=<registered-workspace>
ACE_GATEWAY_PROJECTION_TOKEN=<private-shared-secret>
```

Set the same secret as `ACE_GATEWAY_HTTP_SHARED_SECRET` in the local ACE Gateway process. Never share it in logs or repository files. This authenticates the connector process; no multi-tenant identity claim is made.

The ACE Gateway reads independent explicit destination/model/data-class permission:

```bash
ACE_GATEWAY_EXTERNAL_LLM_OPT_IN=true
ACE_GATEWAY_ALLOWED_LLM_PROVIDERS_JSON='["openai"]'
ACE_GATEWAY_ALLOWED_LLM_MODELS_BY_PROVIDER_JSON='{"openai":["<selected-Bifrost-model-id>"]}'
ACE_GATEWAY_ALLOWED_LLM_DESTINATIONS_JSON='["https://chatgpt.com/backend-api/codex/responses"]'
ACE_GATEWAY_ALLOWED_LLM_DATA_CLASSES_JSON='["private_source","private_conversation"]'
```

These are an **admission-policy example, not a runnable subscription deployment** on the current fork. The final physical URL must originate from a maintained, subscription-preserving Bifröst implementation. The default streaming allowlist is empty; nonempty `ACE_GATEWAY_ALLOWED_LLM_STREAMING_ROUTES_JSON` requires separate C06 proof. Configure Hermes's existing OAuth store and a compatible `HERMES_CODEX_BASE_URL` without copying tokens to ACE.

## Local deterministic verification

```bash
# From repository root:
npx tsx --test test/responses-projection-service.contracts.test.ts
npm run check
npm run test:gateway-only-audit

# From integrations/bifrost/ace-connector:
go test ./...
```

Build the current fork-pinned plugin from repository root:

```bash
GOWORK=off GO_BIN=/absolute/path/to/go1.27.4/bin/go \
  BIFROST_SOURCE_ROOT=/absolute/path/to/bifrost-checkout \
  BIFROST_COMMIT=6baf302dc73a9858bb96da017a436ef2e60f82f1 \
  ./scripts/build-bifrost-ace-plugin.sh
```

The script requires clean pinned Bifröst and ACE checkouts, embeds the ACE source SHA and returns the plugin SHA-256. Passing this build, Go tests and local HTTP mocks is **not** a real OAuth provider trial. Full C03–C05 certification requires actual subscription-compatible Bifröst wire evidence and real provider acknowledgement; C07/C08 additionally need authorized real Hermes/Harbor trials.
