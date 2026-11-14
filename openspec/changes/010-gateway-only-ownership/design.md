# Design — request-bound Bifröst Gateway ownership

## Runtime path

```text
Coding agent
  -> provider-compatible HTTP request
  -> Bifröst HTTP transport
       - authenticates the request
       - ACE plugin snapshots exact visible request bytes
       - ACE plugin mints a physical request ID
       - ACE plugin normalizes caller-asserted coding-harness session correlation
  -> authenticated loopback ACE Gateway Projection API
  -> ACE Core (TypeScript + Effect)
       retrieval / source verification / policy / context projection
  -> validated additive projection
  -> Bifröst normalized Chat request / Core context
       - Bifröst resolves its session correlation
  -> PreLLM receipt/request/session/model/provider/context guard
  -> provider attempt
```

There is no alternative model-invoked tool path and no Hermes-native ACE context path.

## Request-bound physical identity and session correlation

The pinned Bifröst `HTTPTransportPreHook` runs after transport authentication but **before**
`ConvertToBifrostContext` populates `BifrostContextKeyRequestID` and
`BifrostContextKeySessionID`. The ACE plugin therefore does not pretend those later
Core values exist at projection time.

For a supported Chat request the plugin binds:

- a fresh 128-bit ACE physical request ID minted inside the post-auth transport hook; this is the projection request and initial attempt-group identity and is not caller-controlled;
- a normalized coding-harness session correlation derived directly from the same supported header precedence Bifröst Core uses later. Session headers are caller-asserted correlation, **not authentication**;
- deployment-configured workspace ID;
- explicit provider/model derived with the pinned Bifröst `ParseModelString` semantics; unprefixed/automatic provider routing is rejected;
- SHA-256 of the exact inbound JSON body.

The physical ID and session correlation are carried through plugin context. In `PreLLMHook`,
the receipt must bind the minted physical ID and Bifröst Core's later-resolved
`BifrostContextKeySessionID` must equal the correlation captured at ingress. A client-supplied
`x-request-id` is never used as ACE's security identity.

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

## Destination authorization

Private ACE source context is an outbound data transfer once it is inserted into an LLM request. Before retrieval/injection, Gateway Core therefore requires both:

- `ACE_GATEWAY_EXTERNAL_LLM_OPT_IN=true`;
- the exact Bifröst provider name in `ACE_GATEWAY_ALLOWED_LLM_PROVIDERS_JSON`.

The application service applies the existing `ProjectDataPolicy` to `other_external/private_source` and blocks likely secret material before constructing the projected body. Because automatic provider routing would make the destination unknown at authorization time, the connector rejects unprefixed models. PreLLM then proves that the authorized provider/model did not drift before the first network attempt. Retry/fallback remains blocked pending fresh authorization.

## Provider attempt guard

Before the provider call, PreLLM verifies:

- an APPLY receipt exists and binds the server-minted physical request ID / attempt group;
- Bifröst Core's resolved session correlation matches the post-auth ingress correlation;
- the selected normalized model matches the projected model;
- the selected provider is exactly the explicitly authorized provider and the normalized model matches;
- the exact inserted ACE context survived Bifröst normalization;
- no configured fallback is active;
- the receipt has not already authorized another PreLLM attempt.

A second attempt therefore fails closed until request-local reauthorization is implemented.

## Provenance

Native plugin compilation is pinned to the exact Bifröst commit. The build requires a clean tracked ACE checkout and embeds the exact ACE source commit into the plugin; runtime initialization refuses missing source provenance. This proves connector/plugin build provenance only; it is not coding-host transcript attestation.

## Evidence boundary

Contract/compile/mock-wire proof does not establish final external-provider bytes or real-agent task behavior. Those remain G11 and benchmark evidence with exact source/runtime identities.
