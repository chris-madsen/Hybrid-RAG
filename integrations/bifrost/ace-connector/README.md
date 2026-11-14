# ACE Bifrost connector

This directory contains the thin, provider-neutral Go IPC client for the versioned `ace.gateway.v1` projection contract.

Current status:

- `adapter-implemented`: request identity, bounded body transport, original-body digest binding, decision validation and fail-closed application are implemented.
- `provider-wire-tested`: the pinned Bifrost revision `fe7634a6c828927d05ffdd57c62be0aaab04193f` loaded the plugin and a mock upstream captured the transformed body; retained evidence is in `docs/reviews/2026-10-25-bifrost-gateway-wire-e2e.md`.
- `agent-E2E-tested`: NOT RUN against a real coding-agent process; request-bound Bifröst host binding is implemented and the native plugin is compiled in PR CI against the pinned upstream revision.

**Request-bound host binding:** The plugin now uses identity already established by the pinned Bifröst HTTP transport instead of waiting for a second ACE-specific host bridge. `BifrostContextKeySessionID` is resolved by Bifröst from `x-bf-session-id` or the supported coding-harness session headers (Codex CLI, Claude Code, OpenCode); `BifrostContextKeyRequestID` identifies the physical model-bound request and is also the first attempt-group identity. The plugin attests the exact inbound Chat JSON bytes as the visible transcript, records that request ID as the transcript revision, declares no host compaction at this seam, and derives provider/model identity with Bifröst's pinned `ParseModelString` behavior. An explicit provider prefix is enforced at PreLLM; an unprefixed model is marked `bifrost:auto` and may use Bifröst's trusted model routing, while the normalized model and inserted context remain bound. Missing session/request identity still fails closed. No static transcript/session attestation is accepted from environment variables.

**Projection HTTP authentication:** Set the same high-entropy secret as `ACE_GATEWAY_HTTP_SHARED_SECRET` on the ACE service and `ACE_GATEWAY_PROJECTION_TOKEN` on the Bifröst plugin process. The plugin refuses initialization without the latter, and the ACE HTTP endpoint refuses unauthenticated POST requests even from loopback. Never commit the secret or put it in a request-body attestation. The credential authenticates the connector process only; it does not replace trusted per-request host/session binding.

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

The build also requires a clean tracked ACE checkout and embeds its exact Git commit into the native plugin. Runtime `Init` refuses a plugin whose ACE source provenance was not injected by this build path; request-bound host attestations therefore identify both the ACE plugin source and pinned Bifröst ABI source.
