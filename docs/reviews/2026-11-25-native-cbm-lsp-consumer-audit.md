# Native CBM external LSP consumer audit

Date: 2026-11-25

**Scope:** execution-plan slice CBM-04, checked against `main` source baseline
`f08fc8b5d79c00d96096c49b3cd4cca27bab820f`.

**Result:** The current Bifröst/ACE code-only projection has no external-LSP
requirement or invocation in native CBM mode. The legacy Qdrant composition
still has a real external-LSP consumer for exact symbol selection and
definition validation. Accepted PRD/OpenSpec text still describes broader
semantic navigation as a capability, so this audit does not authorize removal
of the provider, dependency, tests, or normative requirement.

## Consumer matrix

| Surface | Caller / required behavior | Observable need | Status at baseline |
|---|---|---|---|
| Native Bifröst projection | `responses-projection-service.ts` calls the context transform with `sourceObligations: { required: ['code'] }`. It accepts only `code` evidence. `context-v3.tsp` has no LSP or semantic-source field. | Verify and deliver current source evidence for the code-only request. There is no LSP result, coverage, or readiness requirement in this wire contract. | Active target path; no external LSP invocation. |
| Native CBM runtime | `ace-runtime.ts` selects `ACE_CODE_RETRIEVAL_MODE=cbm`, supplies `makeRoutedLspSession([])`, and reports `semantic_lsp` as `not_ready`. It does not acquire a server from the LSP registry in this branch. | CBM supplies candidate discovery; ACE verifies the cited source independently. The Gateway requires code coverage only. | Active migration path; external LSP is not started or required. |
| Legacy Qdrant runtime | Under `ACE_ENABLE_EXPERIMENTAL_QDRANT=true`, `ace-runtime.ts` discovers/acquires maintained language servers and composes `makeRoutedLspSession`. `qdrant-context-provider.ts` calls `documentSymbols` when a candidate has no semantic anchor, then calls `definition` to confirm the exact source range. | Exact identifier selection columns and definition coordinates. Missing or conflicting evidence is recorded as LSP partial/failure; it is never synthesized from CBM line ranges. | Real runtime consumer, but only inside the legacy Qdrant composition slated for cutover. |
| Semantic port methods beyond selection/definition | `SemanticAnalysisPort` also exposes references, type information, and diagnostics. Runtime composition has no agent-facing call site for these methods; provider evaluation/conformance scripts and tests exercise them. | No demonstrated production request in the current Gateway route. | Test/evaluation capability, not evidence of a live Gateway consumer. |
| Context command schema | `context-commands.ts` accepts required/optional `lsp` in its local `context_query` schema. `makeContextCommands` has no call site in `src/` or `test/` at this baseline and is not composed by `ace-runtime.ts`. | Potential source-obligation model only; this audit found no active runtime transport using it. | Dormant application code; not a versioned or agent-facing contract. |
| Semantic snapshot and server registry | `semantic-snapshot.ts`, the LSP registry, discovery, and external server adapter are composed from the legacy Qdrant setup. The native CBM route does not build a semantic snapshot or acquire a server. | Bind external LSP queries to the indexed source snapshot and manage process lifetime. | Legacy-runtime support. |
| Tests and scripts | `lsp-semantic.contracts.test.ts`, `lsp-server-registry.contracts.test.ts`, TypeScript-LS tests, non-TS conformance and same-name E2E cover adapter behavior. The CBM/LSP delivery fixture uses the Qdrant context provider with a CBM candidate hint and a supplied semantic mock. | Preserve real adapter and negative-contract evidence while a required caller remains. These tests do not establish invocation by the native Gateway. | Provider/conformance evidence; several contracts are coupled to the legacy delivery path. |

## Normative requirements and provider capability

- `openspec/changes/003-unified-retrieval/specs/semantic-verification/spec.md`
  requires definitions, references, type information, and diagnostics through
  an approved semantic adapter. Its implementation tracker still leaves the
  provider comparison/approval open.
- Accepted `docs/references/ADR-004-ast-lsp-freshness.md` retains semantic
  accuracy, freshness, uncertainty, and provider-comparison principles. Its
  earlier provider-selection instructions predate the 2026-11-24 owner
  direction in issue #364; they do not decide whether the broader product
  requirement is still in scope.
- `docs/references/PRD-v1.0.md` lists semantic navigation (definition,
  references, types, diagnostics) as FR-03/P0. The current code-only Context
  RPC does not expose that capability.
- The retained native-CBM acceptance report records inspection of the pinned
  v0.12.1 implementation: `get_file_outline` returns `name`, `label`, `lines`,
  and qualified name (`qn`), with inclusive line spans. It does not return
  identifier selection columns or an exact definition target range. The
  upstream description of Hybrid LSP is type-aware call/reference graph
  resolution, not a full LSP protocol surface. See the [v0.12.1 outline
  encoder](https://github.com/DeusData/codebase-memory-mcp/blob/v0.12.1/src/mcp/mcp.c#L13806-L13864)
  and [Hybrid LSP description](https://github.com/DeusData/codebase-memory-mcp/blob/v0.12.1/README.md#hybrid-lsp).

Therefore CBM graph/type resolution cannot be relabeled as exact LSP
selection/definition evidence. Conversely, the absence of that evidence does
not make the code-only Gateway request incomplete: that request never asks for
LSP evidence, and ACE still validates the selected original source bytes.

## Disposition

The source audit found no independent external-LSP consumer in the current
agent-facing code-only Context RPC. It did find one real runtime consumer in
the still-reachable legacy Qdrant composition, plus an unresolved normative
semantic-navigation requirement in PRD/OpenSpec. That requirement cannot be
classified as historical from call-site evidence alone.

Before CBM-06 removes the external server and its contracts, the owner needs to
choose one of these scopes:

1. **Keep semantic navigation as a required ACE capability.** Identify the
   supported user-facing request path and retain the smallest provider needed
   for definition/reference/type/diagnostic semantics that CBM v0.12.1 does not
   expose as exact LSP results. Run the plan's same-name, alias/import,
   cross-file, UTF-8/UTF-16, changed-source, non-TypeScript, and outage matrix
   against the selected native interfaces before disposition.
2. **Withdraw semantic navigation from the current product contract.** Amend
   the relevant PRD/OpenSpec/ADR wording so code-only Context RPC requires only
   exact source-backed code evidence; keep CBM graph outputs as candidate
   discovery and retain fail-closed source/freshness guarantees. Then retire
   the legacy-only LSP runtime, dependencies, and redundant tests in CBM-06.

This review does not edit normative OpenSpec/ADR artifacts or choose between
those scopes. It does not claim CBM Hybrid LSP parity, provider approval,
agent-E2E acceptance, or production readiness. It does not block CBM-01/02/03
or make LSP a prerequisite for the separate vector-retirement decision in
CBM-05.

## Evidence examined

- ACE source at `f08fc8b5d79c00d96096c49b3cd4cca27bab820f`:
  `src/bin/ace-runtime.ts`, `src/adapters/qdrant-context-provider.ts`,
  `src/application/context-transform-service.ts`,
  `src/application/responses-projection-service.ts`,
  `src/application/context-commands.ts`, `src/application/ports.ts`,
  `src/application/lsp/*`, `src/application/semantic-snapshot.ts`, and
  `typespec/context-v3.tsp`.
- Normative and retained evidence: OpenSpec 003 semantic-verification,
  OpenSpec 003 task status, ADR-004, PRD FR-03, and
  `docs/reviews/2026-11-24-native-cbm-retrieval-acceptance.md`.
- Owner direction: [issue #364](https://github.com/chris-madsen/Hybrid-RAG/issues/364)
  and [execution-plan section CBM-04](https://github.com/chris-madsen/Hybrid-RAG/blob/codex/cbm-retire-obsolete-spike-and-cutover-plan/docs/plans/2026-11-25-native-cbm-cutover-and-legacy-retirement.md#cbm-04--independent-external-lsp-decision).

No source or test files were changed, and no tests were run for this static
consumer audit.
