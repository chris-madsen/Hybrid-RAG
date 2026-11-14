> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# ACE historical architecture remediation — import-boundary ledger

**Baseline:** `main@6df583fad7d45a4cda6586632240b6f364c08a8a` (2026-11-14).  
**Architecture authority:** ADR-014/017/019, root `AGENTS.md`, `docs/research/sdlc/ARCHITECTURE-FUNCTIONAL-DDD-TYPESPEC.md`, and QG2 pilot `docs/reviews/2026-11-10-sdlc-qg2-architecture-rule-selection.md`.  
**Status:** structural remediation merged through #246; this ledger distinguishes automatically enforced structural/process conformance from capability-specific real provider/agent acceptance.

## Scope and source evidence

Source tree has 128 TypeScript files under `src/` (57 domain, 22 application, 39 adapters, 3 transport, 6 bin, 1 gateway). The QG2 inventory already inspected the 57 domain imports and found no adapters; this remediation separately inspected all application and adapter import clauses and confirmed the concrete import violations below. Dynamic imports, non-TypeScript integrations and semantic data-flow are **not** proven by import-only scans. CI checks exact committed source, not a live production deployment.

## Confirmed findings / remediation

| ID | Baseline defect | Fix and proof | State |
|---|---|---|---|
| A-001 | `context-transform-service.ts` imported a provider-specific gateway port rather than application ownership | #237 moved `ContextProvider` to `src/application/ports.ts`; later Gateway-only retirement removed the legacy tool surface | **MERGED #237/#246** |
| A-002 | application memory services imported `AsyncMemoryArchivePort` from a concrete file adapter | #237 moved the port to `application/ports.ts`; architecture rules guard application→adapter recurrence | **MERGED #237** |
| A-003 | application layer owned concrete Node filesystem workspace persistence | #245 relocated the implementation to `adapters/file-workspace-store.ts` and retained race/persistence semantics | **MERGED #245** |
| A-004 | Policy denial prefix logic did not reject descendants of `.git/`, `secrets/`, and `.env.*` consistently | #237 normalized paths and added descendant/traversal negative fixtures | **MERGED #237** |
| A-005 | Gateway v1 public DTO/schema authority was manually duplicated among JSON Schema, TypeScript and Go | #244 added pinned TypeSpec/OpenAPI/JSON Schema/SDK generation, regeneration drift checks and exhaustive DTO compatibility; #246 retained Gateway-only v1 | **MERGED #244/#246; wider contract migration remains staged** |
| A-006 | After #246 the Bifröst plugin correctly failed closed but required custom `ace.session_id` / attempt / provider / host-attestation context that no repository integration populated | #247 binds the exact post-auth visible request/model/provider, mints a server-side ACE physical request ID inside the transport hook, treats coding-harness session headers only as normalized caller correlation, and cross-checks that correlation after Bifröst Core populates its context. Coding-host transcript/compaction state remains explicitly unattested/unknown; additive Gateway delivery stays usable without fabricating stronger evidence | **FIXED IN THIS FINALIZATION PR; merge pending** |
| A-007 | Gateway request carried `provider` / `dataClass` but projection did not authorize LLM destination before retrieving/injecting private source; `bifrost:auto` could defer provider choice until after ACE projection | #247 requires explicit provider/model, runtime provider allowlist + cloud opt-in, existing `ProjectDataPolicy` authorization before retrieval, secret-content blocking, exact PreLLM provider/model match, and always includes `private_source` authorization for retrieved code so a caller cannot downgrade it by declaring `public` | **FIXED IN THIS FINALIZATION PR; merge pending** |
| A-008 | Static/native plugin checks could be misread as proof that ACE is the final request mutator before the external provider, even though Bifröst permits later custom PreLLM hooks | #247 makes terminal custom-plugin ordering an explicit production precondition and keeps live plugin-order/final-wire capture in G11. Structural closure no longer claims what repository-only checks cannot observe | **OVERCLAIM FIXED; LIVE ORDER/WIRE REMAINS G11 NOT-RUN** |

## Architecture fitness enforcement

`npm run test:arch-rules` tests actual ast-grep rules with valid/invalid and false-positive cases; `npm run check:arch` scans the source tree. The rules are **report-only**, in keeping with QG2 and the owner's decision not to introduce new blocking merge policy:

- ACE-ARCH-001 — domain does not directly import concrete adapters
- ACE-ARCH-002 — explicit retired optional tool-call protocol tool transport does not import Gateway Projection implementation
- ACE-ARCH-003 — Gateway Projection transport does not import retired optional tool-call protocol framing
- ACE-ARCH-004 — generic application code does not import retired optional tool-call protocol gateway implementation
- ACE-ARCH-005 — application services do not import concrete adapters
- ACE-ARCH-006 — domain does not import application orchestration
- ACE-ARCH-007 — domain does not import Node filesystem, HTTP/network or child-process providers; pure node:path/util remain allowed

A native import-edge rule cannot prove provider failures are never turned into false completion, privacy authorization occurs at send time, or provenance/Graphiti readiness is production-certified. Do not add syntactic approximations that falsely claim those semantics.

## Remaining acceptance / exclusions

1. The structural/process refactor is checked by `npm run check:sdlc-closure`, `verify:pr`, Gateway-only audit, architecture rules, security gates, QG5 compatibility and TypeSpec regeneration. These checks may certify **repository structural/process conformance**, not external runtime behavior.
2. G11 remains capability-specific. A production claim for a changed provider path still requires real agent/provider evidence, source freshness/authorization negatives and exact tested SHA. Mock or static plugin tests never substitute for that evidence.
3. Retry/fallback and streaming are intentionally fail-closed or uncertified until request-local reauthorization/final-wire evidence is implemented. Their NOT-RUN status is not a structural-refactor failure.
4. TypeSpec is authoritative for the migrated Gateway v1 generated surface; broader public contracts remain staged and must not be deleted or rewritten merely to make a closure score green.
5. Previously inventoried lifecycle/persistence similarities remain candidates for semantic review, not proven architectural defects.

**Allowed claim after this finalization PR merges:** historical ACE source is automatically guarded against the accepted **structural/process** architecture regressions covered by the installed gates, and the sole agent-facing path is Gateway-only.  
**Still prohibited:** claiming that every semantic/provider/security property of every historical capability is production-certified without its applicable G11 evidence.
