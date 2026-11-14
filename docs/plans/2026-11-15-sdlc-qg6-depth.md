# QG6 depth — CodeQL, targeted mutation and scheduled remote-link signal

**Date:** 2026-11-15  
**Tier:** T1 process/security hardening. No ACE runtime API or provider behavior changes.  
**Stacked base:** `codex/sdlc-finalization-2026-11-14@f08b26f141415c75dc18eb625c2116d4fdfe3ae4`.

## Why this exists

The current SDLC catalog marks QG6/G12 as PARTIAL ACTIVE: scheduled OSV and deterministic/property suites exist, while CodeQL and targeted mutation remain planned. The owner asked to finish the remaining SDLC refactor rather than leave those planned labels as permanent debt.

## Acceptance

| ID | Change | Oracle |
|---|---|---|
| QG6-01 | Pin GitHub CodeQL action to an exact commit and analyze maintained JavaScript/TypeScript (`src/`, `scripts/`) on relevant PRs plus schedule/manual runs | workflow security + actual CodeQL job + clean extraction |
| QG6-02 | Mutation pilot changes real security decisions in a temporary copy only; existing contract tests must fail against every mutant | `npm run test:mutation:critical` exits 0 only when all mutants are killed |
| QG6-03 | Mutation runner never edits the caller worktree and cleans temporary files | source tree copied to temp; root node_modules linked read-only by convention |
| QG6-04 | Remote Markdown links provide scheduled signal but never block PR/release because external websites are nondeterministic | scheduled/manual nonblocking Lychee step |
| QG6-05 | Closure audit recognizes QG6 only when CodeQL + mutation are committed, not merely documented | positive/negative source checks |
| QG6-06 | QG4 remains report-only by owner design and QG5 remains active; no unrelated promotion to blocking branch protection | docs truth + unchanged owner rule |
| QG6-07 | CodeQL result policy is explicit | extraction errors and security-severity ≥ 7 block; lower severity remains visible signal; SARIF gate has positive/high/extraction fixtures |

## Selected mutations

1. **Data-class authorization bypass:** mutate the policy's provider-specific allowed-data-class lookup so requested data classes are accepted. Existing `data-class-policy.contracts.test.ts` must fail.
2. **Gateway destination-policy bypass:** disable the `authorized.value.allowed` block in Gateway Projection. Existing `gateway-projection.contracts.test.ts` must fail.
3. **Gateway secret-context bypass:** disable the `containsLikelySecret` branch. Existing Gateway contract tests must fail.

The runner is intentionally narrow; it is not a generic mutation-score tool and does not justify a coverage percentage.

## Evidence boundary

QG6 static/mutation depth cannot certify real provider bytes, real-agent behavior, source freshness, retry/streaming, or benchmark economics. Those remain their existing G11/benchmark obligations.
