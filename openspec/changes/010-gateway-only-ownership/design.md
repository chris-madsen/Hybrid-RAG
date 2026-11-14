# Design — request-bound Bifröst Gateway ownership

## Runtime path

```text
Coding agent
  -> provider-compatible HTTP request
  -> Bifröst HTTP transport
       - resolves request ID and coding-harness session ID
       - ACE plugin snapshots exact visible request bytes
  -> authenticated loopback ACE Gateway Projection API
  -> ACE Core (TypeScript + Effect)
       retrieval / source verification / policy / context projection
  -> validated additive projection
  -> Bifröst normalized Chat request
  -> PreLLM receipt/model/provider/context guard
  -> provider attempt
```

There is no alternative model-invoked tool path and no Hermes-native ACE context path.

## Request-bound identity

For a supported Chat request the plugin uses Bifröst's own trusted context:

- `BifrostContextKeyRequestID` — physical ingress request and initial attempt-group identity.
- `BifrostContextKeySessionID` — session resolved by Bifröst from supported coding-harness/session headers.
- deployment-configured workspace ID;
- provider/model derived with the pinned Bifröst `ParseModelString` semantics;
- SHA-256 of the exact inbound JSON body.

Gateway v1 retains required legacy fields named `durableActiveTranscriptRevision` and `durableActiveTranscriptDigest`. Bifröst does **not** possess the evidence needed to populate them as durable-host facts. Therefore the connector sets `hostTranscriptAttested=false`, `hostCompactionEpoch="unknown"`, an explicit `bifrost-visible-request-only` engine marker, and an `unattested:<request-id>` revision marker. The digest is the exact visible request body only as a request-binding diagnostic; while `hostTranscriptAttested=false` it MUST NOT be interpreted as durable transcript proof.

## Host-history honesty

Two guarantees are deliberately separate:

1. **Gateway delivery:** ACE may add verified source evidence to the exact Bifröst-visible Chat request. This does not require pretending that Bifröst saw the host's durable transcript.
2. **Exclusive context/compaction ownership:** claims that ACE alone controlled the full host context, that upstream compaction was disabled, or that token savings are attributable to ACE require an authenticated host-side transcript/configuration attestor and G11/benchmark evidence.

When a trusted host attestor is eventually present, `hostTranscriptAttested=true` activates the strict no-compaction check. If such an attestation claims compaction active or leaves its epoch unknown, Gateway blocks. Unattested host history is acceptable only for additive Gateway delivery and remains explicit in the receipt.

## Local process authentication

The projection service remains loopback-only and additionally requires a high-entropy Bearer secret shared out of band between ACE and the Bifröst plugin. Missing server credentials are `NOT_READY`; wrong client credentials are unauthorized. Request-body attestation never carries this credential.

## Projection semantics

The accepted v1 wire remains backward compatible, but the Gateway-only runtime authorizes only:

- `APPLY` with exactly one `append_verified_context_system_message` rewrite; or
- `BLOCK`.

Legacy passthrough/degraded decision variants remain decodable only for v1 compatibility and do not authorize a provider call.

The connector checks semantic preservation, not merely hashes: model, stream flags, tools, unknown fields and all original messages remain identical; the single inserted message is a system message carrying the ACE verified-evidence envelope.

## Provider attempt guard

Before the provider call, PreLLM verifies:

- an APPLY receipt exists for the current request;
- the selected normalized model matches the projected model;
- an explicit requested provider did not change (an unprefixed model may use trusted Bifröst auto-routing);
- the exact inserted ACE context survived Bifröst normalization;
- no configured fallback is active;
- the receipt has not already authorized another PreLLM attempt.

A second attempt therefore fails closed until request-local reauthorization is implemented.

## Provenance

Native plugin compilation is pinned to the exact Bifröst commit. The build requires a clean tracked ACE checkout and embeds the exact ACE source commit into the plugin; runtime initialization refuses missing source provenance. This proves connector/plugin build provenance only; it is not coding-host transcript attestation.

## Evidence boundary

Contract/compile/mock-wire proof does not establish final external-provider bytes or real-agent task behavior. Those remain G11 and benchmark evidence with exact source/runtime identities.
