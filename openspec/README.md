# OpenSpec state for ACE

OpenSpec records capability requirements and accepted change deltas. It does **not** override explicit owner decisions or Accepted ADRs. Current project context is in `openspec/config.yaml`.

**Current structural implementation note (2026-11-21):** PR #316 replaced runtime ast-grep and homemade RepoMap with native Codebase Memory v0.12.1. The currently wired code-retrieval mode still includes Qdrant dense/sparse alongside CBM's own semantic/BM25 search; removing Qdrant is an unverified architecture hypothesis, not implemented. [Current code/readiness](../docs/operations/current-architecture.md) and [CBM provider](../docs/operations/codebase-memory-provider.md). OpenSpec 014 tracks audit remediation; OpenSpec 013 tracks G11 provider/Hermes acceptance.

## Current integration authority

The repository owner selected **Bifröst Gateway-only ACE delivery** on 2026-11-14 and **native Responses-only Gateway traffic** for G11 C01 on 2026-11-18.

- Ownership contract: [010-gateway-only-ownership](changes/010-gateway-only-ownership/).
- Production-acceptance contract: [013-gateway-g11-production-acceptance](changes/013-gateway-g11-production-acceptance/).
- Bifröst is the sole agent-facing ACE context-delivery route.
- Native Responses v2 is the only supported provider protocol; provider dispatch remains fail-closed until independently certified.
- Model-invoked ACE context tools and the Hermes-native ACE ContextEngine delivery experiment are retired.
- Superseded integration changes 008 and 009 are preserved under [changes/archive/](changes/archive/) as historical evidence only.
- Native Responses v2 TypeSpec/codegen is installed; real provider/agent G11 evidence remains a distinct acceptance stage.

## Capability changes still retained in the active tree

Changes 001–007 contain the historical staged capability work for foundation, evaluation, retrieval, memory, routing, production retrieval acceptance and hybrid context. They predate the Gateway-only owner decision. Their retrieval/domain requirements remain useful where not superseded, but **any agent-facing transport statement that conflicts with changes 010/013, current Accepted ADRs or the owner decision is obsolete**.

In particular, an old mention of a model-invoked tool transport or Hermes-native context delivery must never be interpreted as permission to restore a second agent-facing path.

## Current change map

1. `001-foundation` — workspace, policy and foundational error/contracts history.
2. `002-harbor-evaluation` — Harbor evaluation and usage evidence.
3. `003-unified-retrieval` — unified retrieval/evidence.
4. `004-temporal-memory` — immutable session archive and derived temporal memory.
5. `005-adaptive-routing-spike` — experimental routing comparison.
6. `006-production-retrieval-vertical-slice` — real-provider/DBC acceptance history.
7. `007-hybrid-context-engine` — active hybrid retrieval/context semantics, now transport-neutral and Gateway-delivered.
8. `010-gateway-only-ownership` — agent-facing Gateway ownership and fail-closed delivery contract.
9. `013-gateway-g11-production-acceptance` — native Responses v2 and staged G11 production acceptance.

Archived:
- `008-hermes-context-integration` — superseded Hermes-native delivery experiment.
- `009-bifrost-hermes-ownership` — superseded dual-owner/old local-trust design.

## Validation

Use an exact OpenSpec CLI version selected for the environment; do not use an unpinned `@latest` invocation as retained evidence.

```bash
OPENSPEC_VERSION=<PINNED_VERSION>
openspec_pinned() {
  npm exec --yes --package="@fission-ai/openspec@${OPENSPEC_VERSION}" -- openspec "$@"
}
openspec_pinned --version
openspec_pinned list
openspec_pinned validate --all --strict --no-interactive --report full
```

For repository SDLC/structural closure also run:

```bash
npm run test:sdlc-closure
npm run check:sdlc-closure
npm run verify:pr
```

A structural/process PASS is not provider or real-agent certification. Keep evidence states separate: `contract-designed → adapter-implemented → provider-wire-tested → agent-E2E-tested → benchmark-evaluated → owner-approved`.
