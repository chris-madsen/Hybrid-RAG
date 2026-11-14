# ACE Bifrost connector

This directory contains the thin, provider-neutral Go IPC client for the versioned `ace.gateway.v1` projection contract.

Current status:

- `adapter-implemented`: request identity, bounded body transport, original-body digest binding, decision validation and fail-closed application are implemented.
- `provider-wire-tested`: the pinned Bifrost revision `fe7634a6c828927d05ffdd57c62be0aaab04193f` loaded the plugin and a mock upstream captured the transformed body; retained evidence is in `docs/reviews/2026-10-25-bifrost-gateway-wire-e2e.md`.
- `agent-E2E-tested`: NOT RUN.

**Fail-closed host binding:** The plugin requires the authenticated Bifröst request context to supply `ace.session_id`, `ace.attempt_group_id`, `ace.provider` and `ace.host_attestation` (as JSON bytes) for each provider request. It cannot reuse a startup-time session or host transcript attestation. `ACE_BIFROST_WORKSPACE_ID` is only a configured workspace fallback; session, attempt and provider identity are never synthesized from environment defaults. Requests without authenticated per-request bindings are rejected with HTTP 503. The repository does not yet provide a certified external agent/host bridge that populates these values; full end-to-end deployment is therefore **NOT READY**. Unrecognized model routes cannot bypass ACE, and Post/PreLLM safeguards block attempts without an APPLY receipt. The selected normalized Bifröst model/provider and exact inserted context must match the ingress authorization. These checks are necessary but **do not** establish proof of final upstream provider bytes.

The connector does not implement retrieval, compaction, reranking, policy selection or provider credentials. The pinned plugin calls `Project` from the authenticated HTTP transport seam. A strict projected request with a missing receipt or configured fallback is short-circuited before the provider call; a repeated PreLLM attempt is also blocked rather than reusing the ingress receipt. Per-attempt reauthorization, native-plugin rebuild verification at the new revision, and retry/fallback provider-wire evidence remain NOT RUN / NOT IMPLEMENTED. No retry/fallback certification is claimed.

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
