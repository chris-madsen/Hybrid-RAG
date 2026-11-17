> **Owner-approved Responses-only migration in progress.** The former Chat-only route is retired and blocked in the Bifröst ACE plugin. Native Responses is **NOT READY** and also blocked, including custom passthrough aliases. The local Gateway v1 projection endpoint reports a 503 response and advertises no supported generation routes; v1 contracts remain immutable archival compatibility artifacts. This connector currently delivers **no agent context to a provider**. Do not run an inference or claim G11/agent E2E through it. See `openspec/changes/014-responses-native-agent-loop/` for the required native Responses work and gates. Earlier Chat mock-wire results below are historical evidence, not permission to restore the route.

# ACE Bifrost connector

This directory contains the thin, provider-neutral Go IPC client for the versioned `ace.gateway.v1` projection contract.

Current status:

- `adapter-implemented`: request identity, bounded body transport, original-body digest binding, decision validation and fail-closed application are implemented.
- `provider-wire-tested`: the pinned Bifrost revision `fe7634a6c828927d05ffdd57c62be0aaab04193f` loaded the plugin and a mock upstream captured the transformed body; retained evidence is in `docs/reviews/2026-10-25-bifrost-gateway-wire-e2e.md`.
- `agent-E2E-tested`: NOT RUN against a real coding-agent process; request-bound Bifröst host binding is implemented and the native plugin is compiled in PR CI against the pinned upstream revision.

**Request-bound Gateway binding:** `HTTPTransportPreHook` runs after Bifröst transport authentication but before Bifröst Core populates its request/session context. The plugin therefore mints a fresh 128-bit ACE physical request ID itself, normalizes the caller-asserted coding-harness session correlation directly from Bifröst's supported header precedence, and digest-binds the exact inbound JSON body. Those values are carried through plugin context; `PreLLMHook` requires the receipt to bind the minted ID and cross-checks the session correlation against Bifröst Core's later `BifrostContextKeySessionID`. A caller-supplied `x-request-id` is never ACE security identity.

**Bifröst is not a coding-host transcript attestor.** It cannot know whether the agent compacted, pruned or summarized its durable conversation before constructing the HTTP request. Therefore the connector deliberately sends `hostTranscriptAttested=false`, `hostCompactionEpoch="unknown"`, `activeEngineId="bifrost-visible-request-only"`, and an `unattested:<request-id>` revision marker. The required v1 digest field binds the exact visible request bytes only and MUST NOT be interpreted as proof of the host's durable transcript. ACE may still perform additive verified-evidence delivery for this honest lower-assurance state; any claim that ACE exclusively controlled host context/compaction requires a separate authenticated host attestor plus G11/benchmark evidence.

An explicit Bifröst `provider/model` identifier is mandatory. Unprefixed models and automatic provider routing are rejected because ACE must authorize the exact egress destination before retrieving or injecting private source context. The ACE runtime also requires `ACE_GATEWAY_EXTERNAL_LLM_OPT_IN=true` plus an exact provider name in `ACE_GATEWAY_ALLOWED_LLM_PROVIDERS_JSON`; PreLLM then verifies that the selected provider/model did not drift. Missing/invalid session correlation or inability to mint physical request identity fails closed. No static transcript/session attestation is accepted from environment variables.

**Projection HTTP authentication:** Set the same high-entropy secret as `ACE_GATEWAY_HTTP_SHARED_SECRET` on the ACE service and `ACE_GATEWAY_PROJECTION_TOKEN` on the Bifröst plugin process. The plugin refuses initialization without the latter, and the ACE HTTP endpoint refuses unauthenticated POST requests even from loopback. Never commit the secret or put it in a request-body attestation. The credential authenticates the connector process only; it does not turn caller session headers into authenticated identity.

**Terminal guard ordering:** ACE's `PreLLMHook` is the repository-owned admission guard, but Bifröst permits later custom `PreLLMHook` plugins to mutate a request. A production configuration must place `ace-gateway-projection` in `post_builtin` **after every other custom request-mutating plugin**. The pinned built-in model-catalog resolver may execute later, but with the mandatory explicit provider/model route it must not reroute the request. Repository compile/contract checks cannot prove a live deployment's plugin order or final upstream bytes; G11 must retain the loaded plugin order and provider-wire capture. Until that evidence exists, final-wire certification remains `NOT-RUN`.

The connector does not implement retrieval, compaction, reranking, policy selection or provider credentials. The pinned plugin calls `Project` from the authenticated HTTP transport seam. A strict projected request with a missing receipt or configured fallback is short-circuited before the provider call; a repeated PreLLM attempt is also blocked rather than reusing the ingress receipt. Per-attempt reauthorization and retry/fallback provider-wire evidence remain NOT RUN / NOT IMPLEMENTED; repeated attempts therefore fail closed. Native plugin compilation against the exact pinned Bifröst revision is a PR/nightly CI gate. No retry/fallback or real-agent production certification is claimed.

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
