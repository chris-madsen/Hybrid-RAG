# ACE TypeSpec v1 generation and contract verification

**Status:** implemented as a staged, owner-reviewed contract-first migration in PR #244. This is a runnable toolchain, not an automatic certification of every ACE public API. The staged design and G02 acceptance ledger are in `docs/plans/2026-11-14-typespec-migration-g02.md`.

## Prerequisites and local commands

Use Node 22 and npm with the repository checked out. TypeSpec's toolchain is intentionally isolated from the runtime package: source is `typespec/main.tsp` (Gateway v1) and `typespec/native-and-mcp.tsp` (candidate MCP/Hermes v1 message shapes). Run from the **repository root**:

```sh
npm ci --ignore-scripts
npm ci --prefix typespec --ignore-scripts
npm --prefix typespec run generate
npm --prefix typespec run check:sdk
npm --prefix typespec run check:compat
npm --prefix typespec run check:mcp-hermes
npm run check:public-contract-types
./node_modules/.bin/tsx --test test/gateway-projection-http.contracts.test.ts test/gateway-projection.contracts.test.ts test/gateway-schema.contracts.test.ts test/data-class-policy.contracts.test.ts test/bifrost-plugin.contracts.test.ts test/mcp-sdk-runtime.conformance.test.ts test/context-bridge.contracts.test.ts
git diff --exit-code -- typespec/package-lock.json typespec/generated src/generated/ace-gateway
```

Only commit generated artifacts after a real supported compiler/emitter run. **Do not manually edit generated code.** Generated source families:
- `typespec/generated/openapi.json` and `typespec/generated/schema/*.json`: official TypeSpec emitters;
- `typespec/generated/sdk/**`: pinned maintained OpenAPI-to-TypeScript generator;
- `src/generated/ace-gateway/v1/types.gen.ts`: byte-for-byte copy of generated SDK types consumed by the real Gateway HTTP boundary.

The generator cleans `typespec/generated` before compiling, so removed models cannot leave old definitions behind. The TypeSpec GitHub Actions workflow deliberately seeds an obsolete artifact, checks its removal, mutates a tracked generated schema to verify Git detects drift, restores it and performs actual contract and adapter tests.

## Source ownership and migration strategy

- OpenSpec: desired behavior and acceptance.
- ADR-019: Functional DDD and TypeSpec-first source language decision.
- TypeSpec: **new/migrated** public wire contracts and generated integration shell.
- Domain ADTs/policy: source of semantics, authorization, provenance, final send and current provider capability.
- Generated metadata: documentation only, not a security enforcement replacement.

Existing `contracts/ace-gateway/v1/*.schema.json` and Go DTOs are retained as compatibility baselines while the generated Gateway v1 boundary is adopted incrementally. A generated contract change is **not** allowed to silently change accepted existing wire variants. Unknown fields, missing/null, data class, enum and attestation negative cases must remain correct.

MCP uses the official SDK; Hermes uses its native JSONL bridge. Their emitted TypeSpec schemas are currently **candidate documentation and parity oracles**, not runtime replacements: the legacy SDK/bridge may accept extra fields, and enabling stricter generated decoders would be a behavior change requiring a separate versioned acceptance. There is no TypeSpec "native MCP emitter" claim.

Go/Bifrost real final provider egress and Hermes agent end-to-end are separate evidence requirements. The Gateway `record-delivery` endpoint remains 501 (not certified). Codegen does not make it functional or grant access to external providers.

## What to do when a TypeSpec check fails

Correct the source of the discrepancy (TypeSpec model, tracked v1 baseline, or explicitly approved versioned migration). Do not weaken generated-diff detection, use unpinned `npm install` in CI, or add a fake decoder/default to make the check pass. New public fields/enums must update all explicit mappings and pass negative fixtures. Review the exact source HEAD and CI merge commit for every PR. If a provider test is not run, record **NOT-RUN** rather than treating an SDK mock as a provider proof.
