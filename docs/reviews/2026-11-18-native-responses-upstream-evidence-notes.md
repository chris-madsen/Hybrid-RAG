# Native Responses upstream integration — retained source observations

**Status:** HISTORICAL SOURCE NOTES, not active architecture instructions, provider-wire certification, owner release approval or a new implementation plan. Retained only the useful verifiable observations from superseded review documents. The supported target remains **Hermes → Bifröst native `/v1/responses` → ACE Gateway v2**. No alternate generation protocol, translation, second proxy or compatibility path is supported.

## Pinned source observations to revalidate before C03–C05

- Bifröst source used for prior static inspection and plugin compilation: `maximhq/bifrost@fe7634a6c828927d05ffdd57c62be0aaab04193f` (Go module declared Go 1.27.3). This is a **source pin**, not a production certification.
- Bifröst HTTP transport registers native `/v1/responses` and a separate native `/v1/responses/input_tokens` endpoint. The latter is a **candidate** for a provider-native token counter; its compatibility with an actual Hermes subscription, model identity and context window requires live proof. **ACE itself must not impose a guessed model/subscription token budget**.
- The pinned transport ingress hook sees the Bifröst HTTP request before all downstream normalization/serialization. The normalized pre-model hook is not evidence of observing the **last physical outbound bytes**, especially with provider-internal retries, raw-body variants and plugin ordering. C03 must prove every physical send passes a non-replayable final-send check; an ingress projection receipt is never a send permit.
- Hermes upstream snapshot previously inspected: `v0.22.3` at `5b147ab036d6d19131bff8d20701b5001eab844a`. Its native Codex OAuth model slug, reasoning effort, host context controls and actual provider credentials are separate concerns; the repository must preserve whatever supported model/effort the live host actually emits. Static model catalogs do not prove authenticated subscription routing.
- In a Bifröst ingress plugin, session headers offer **correlation, not individual-user authentication**. An authenticated loopback ACE connector authenticates the process, not every Hermes user or workspace. Until a verified per-principal tenant binding exists, deployment must be **explicitly single-workspace**, without sharing the configured listener across untrusted users.
- Provider-managed history and durable host compaction are **not attested** merely because Bifröst observes a native request. Truthful native local preparation may use self-contained stateless inputs with opaque provider continuation handles rejected; full agent context-ownership claims require a separate authenticated host attestor.
- The exact native JSON request and its tool/reasoning/multimodal controls must be preserved. Semantic JSON parsing can round large numeric literals; use a provenance-tested lossless serialization strategy and validate it at the Go connector boundary.

## Proof boundaries

These notes are old source observations, not evidence that any real provider request was sent, that a session was completed, or that the physical-send boundary has been certified. For C03, retain the exact **current** Bifröst commit, hook and provider paths, plugin order, current Hermes version, observed final wire digests, request/attempt identity, cancellation and authoritative owner approval. If a supported final-send interception point is unavailable, **report the missing implementation seam**; do not claim certification or hide it by changing a status file.

See `openspec/changes/013-gateway-g11-production-acceptance/` for the canonical owner-reviewed implementation DAG and acceptance criteria; `docs/docs/references/ADR-020-native-responses-only.md` for current architecture authority.
