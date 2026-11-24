**Active testing strategy** for the [current CBM + Qdrant runtime](current-architecture.md). Older historical runbooks are not executable gates unless their scripts still exist in `package.json`.

# ACE testing strategy

This document describes the operational test loop. Normative capability acceptance still lives in OpenSpec and the architecture fitness contracts.

## Goals

- Keep the development feedback loop short without weakening PR/release confidence.
- Run the **smallest test that can prove the changed invariant**.
- Keep the test suite curated: regression coverage may be consolidated or deleted when it is redundant.
- Separate deterministic developer/PR verification from expensive provider, scale and release evidence.

## Commands

| Command | Purpose | Normal use |
| --- | --- | --- |
| `npm run test:affected` | Select deterministic TypeScript tests affected by the current diff | Inner development loop |
| `npm run test:affected -- --dry-run` | Show selection without executing it | Inspect/debug impact selection |
| `npm run test:affected -- --base origin/main` | Select tests affected by the entire branch | Optional branch-wide check before full verification |
| `npm run test:fast` | Alias for the affected deterministic TypeScript tests | Inner development loop |
| `npm run check` | TypeScript strict typecheck only | Explicit type gate |
| `npm run build` | Emit `dist/`; incremental state is reused locally | Runtime/E2E preparation |
| `npm run verify:pr` | Typecheck + selected affected/limited smoke TS tests + lint + architecture + SDLC preflight | Fast PR/handoff; **not a full acceptance claim** |
| `npm run verify:pr:affected` | Compatibility alias to the bounded `verify:pr` | Legacy local invocations |
| `npm run verify:full` | All deterministic TS/Hermes, lint, build/source provenance, architecture, SDLC and Gateway property tests | Scheduled nightly/manual; not every PR |

A clean CI worker installs dependencies once with:

```bash
npm ci --ignore-scripts
```

Do not run `npm ci` repeatedly inside an already-installed development workspace. It is a clean-install command, not a build command.

## Affected-test selection

`scripts/run-affected-tests.mjs`:

1. compares staged, unstaged and untracked work against `HEAD` by default, keeping the edit loop narrow; use `--base origin/main` when you explicitly want branch-wide impact;
2. includes staged, unstaged and untracked files;
3. uses the installed TypeScript parser to build a reverse graph of relative runtime imports across `src/` and `test/`, excluding imports/exports that are entirely type-only;
4. walks that graph from changed source files to dependent tests;
5. selects directly changed test files;
6. for `scripts/` changes, selects tests that directly reference the changed script/name;
7. for broad build/test configuration edits (package, lockfiles or TS/ESLint config), adds a **small explicit smoke set** and any affected tests; never silently invokes the entire suite. This does not assert full transitive dependency coverage.
8. when zero tests are selected, prints an explicit `NO MATCHING TESTS` limitation; typecheck/lint and the next nightly full run are independent signals, not proof that the changed behavior is tested.

Type-only dependency edges are owned by the TypeScript gate rather than runtime tests. Documentation-only changes normally select no TypeScript tests, and CI checks their diff without installing Node dependencies.

The selector has a small built-in self-check:

```bash
npm run test:impact:self
```

## Test portfolio rules

Before adding a test for a defect:

1. identify the invariant that failed;
2. search for the existing test that owns that invariant;
3. add a focused case/table row there when possible;
4. add a new test file only when it owns a genuinely new contract/subsystem;
5. keep high-level/E2E coverage only for behavior that cannot be proven below that layer.

The same edge case should not normally be repeated at unit, contract, process, provider and agent levels. A higher layer should prove its **unique boundary/wiring**, not replay every lower-level input permutation.

It is acceptable for a PR to remove more tests than it adds when equivalent or stronger protection remains.

## Expensive evidence

Real-provider and acceptance commands are not part of the edit-by-edit loop. Run them when the corresponding capability changed or when refreshing acceptance/release evidence.

Typical mapping:

- Native CBM structural/search/graph: run the pinned real-binary tests in `.github/workflows/ace-codebase-memory.yml` (set `ACE_TEST_REAL_CBM=true` locally with CBM v0.12.1 installed).
- Current local Qdrant + embeddings + source/failure integration: `npm run test:real-projection`, `test:real-projection-race`, `test:real-projection-outage`, and `test:real-projection-hard-outage` when local infrastructure permits; `npm run probe:retrieval-rank -- ...` against frozen holdout.
- Exact external LSP verification: `npm run test:real-same-name` and `npm run test:real-non-ts-lsp` if supported language servers are available.
- Gateway local/container runtime: `npm run test:ace-container-runtime -- ...` and TypeSpec/native Responses Go/TS contract tests. These do **not** certify a physical provider send.
- Graphiti / retained memory / outbox: `test:real-graphiti-lifecycle`, `test:real-graphiti-crash`.
- Vertex documentation path: `test:real-vertex-conflict`.
- Harbor / DBC / release: run the relevant gates only for acceptance or release evidence, not after ordinary edits.

Several expensive commands against unchanged source should reuse the same emitted build. TypeScript incremental compilation is enabled so repeated `npm run build` calls do not intentionally perform a clean rebuild.

## Independent benchmark evidence (separate from deterministic regression)

Use upstream Agent Retrieval Bench and ContextBench to score *real retrieval outputs*, CodeGraph Bench to evaluate native graph quality, and Harbor's supported Hermes adapter for end-to-end coding tasks. Freeze task sets, source SHA, model, context budget and agent configuration; report all failures and complete provider usage. Compare CBM-only vs CBM+Qdrant only through matched independent evaluation. Do not invent a custom scorer, report a mock as E2E, or claim 5× without verified accepted-task economics. Provider-wire trials remain gated by OpenSpec 013 C03–C08. See [current architecture](current-architecture.md).

## CI policy

There are **two automatic execution scopes**, with optional manual full verification.

**PR minimal/focused** (`pull_request`, not every push to `main`):

1. Classify changed paths using NUL-delimited Git diff against the actual PR base/head; no silent full-suite fallback.
2. Docs-only: `git diff --check` and offline changed-Markdown link check; no npm installation.
3. Source/test/toolchain: `npm ci --ignore-scripts` **once**, `ACE_TEST_BASE=<PR base SHA> npm run verify:pr`: typecheck, affected TS tests and a bounded smoke set for broad config changes, lint, architecture and preflight.
4. Go/Bifröst changes: only Go `test`/`vet` on changed Go scope. Hermes plugin changes: only its Python tests. Shared public-contract fixture changes trigger all three applicable language gates.
5. Keep scoped secret scanning and actionlint/zizmor on changed workflows. These security checks are fast and independent; do not disable them to save minutes.
6. No full Qdrant/FastEmbed, non-TS rust-analyzer, Harbor, TypeScript-wide `npm test`, Knip or OSV scans on an ordinary PR. A green fast PR is **not** a provider/release/whole-repo certification.

**Nightly full** (`schedule`, plus manual `workflow_dispatch`):

1. `npm run verify:full` for all deterministic TS/Hermes tests, build/provenance, architecture, preflight and Gateway property checks.
2. Real Qdrant provider/restart/two-writer/crash and real rust-analyzer conformance with retained logs.
3. Go/Bifröst tests and vet; Knip and OSV via the separate scheduled dependency workflow.
4. Failures stay failures. Do not rerun or weaken expensive oracles merely to get a green status; report sources, provider identity, source/tested SHA and any environment-induced uncertainty.

**Repository policy (owner decision 2026-11-24):** protect `main` with mandatory pull requests and required scoped CI. This supersedes the previous no-protection policy. Independent G02 architectural decisions, source correctness and relevant provider/release evidence are still required by their accepted contracts.

## Main branch protection

Configure the following baseline in GitHub Settings → Branches (classic rule for `main`), or an equivalent active ruleset. These are intended hosted settings, not a claim that a rule is already active. Verify the actual configuration after saving it.

- Require a pull request before merging; keep required reviewer approvals at zero for the solo maintainer.
- Require the following named GitHub Actions job checks to pass, with the branch up to date before merging. Select the GitHub Actions source where available.
- Apply the rule to administrators; prohibit force pushes and deletion. Do not configure an actor bypass for ordinary merges.

| Required check (exact job name) | Scope |
| --- | --- |
| `no-optional-agent-tools` | Repository-wide retired-protocol regression audit |
| `bifrost-only` | Single-gateway/context RPC boundary |
| `reviewable-pr` | Reviewable PR and maintained documentation policy |
| `pr-secret-scan` | Changed commit-range secret detection |
| `workflow-security` | Scoped workflow security checks |
| `Select affected PR language checks` | Explicit changed-path classification |
| `Focused TypeScript and contracts` | Required Node verification when applicable |
| `docs-links` | Changed Markdown links |
| `bifrost-connector` | Go connector tests and vet when applicable |
| `Build pinned Bifröst ACE plugin` | Pinned Go plugin build when applicable |

The architecture audits run on every PR. The other listed jobs belong to workflows that run on every ordinary PR; language-specific jobs use job-level conditions and may legitimately be skipped when the successful scope classifier determines they are irrelevant. A skipped job is not evidence that its tests ran. A failed scope classifier must block merging.

Do not add a workflow-level path-filtered check as an unconditional required check: a missing status can prevent unrelated PRs from merging. The dedicated native CBM regression, provider E2E, scheduled/manual full and advisory workflows retain their existing scopes. Their applicable failures must be resolved or explicitly reported; they are not part of this initial hosted required-check list. Do not weaken these workflows to obtain a passing merge status.

Record the actual branch protection status and required checks separately from the repository policy. No setting grants production approval or replaces real acceptance evidence.

To run the full scope locally when it is useful, call `npm run verify:full` explicitly. Do not make agent prompts or workflow defaults run it for every PR.
