# Adaptive Context Engine (ACE)

**Agent-neutral hybrid context/RAG engine for coding agents.** ACE retrieves and verifies relevant code, documentation and retained knowledge, then supplies compact evidence to a native model request. Its goal is to improve task quality and reduce the total tokens spent per successfully completed task, without sacrificing exact source access, privacy or agent autonomy.

**Development status:** experimental integration, not a production release. The current work focuses on the single-Bifröst integration, real Hermes subscription acceptance, retrieval reliability and independently measured agent economics. A 5× reduction in accepted-task tokens is a hypothesis, not an achieved result.

## Architecture

```text
Hermes (own ChatGPT/Codex subscription OAuth)
  | native Responses
  v
Bifröst — sole agent-facing LLM Gateway
  | POST /chatgpt_passthrough/backend-api/codex/responses
  | post-auth Go ACE plugin
  +---- authenticated loopback context RPC ----> ACE Core (TypeScript + Effect)
  |                                              | code: CBM + Qdrant + LSP
  |                                              | docs: authorized Vertex AI RAG
  |                                              | memory: archive; Graphiti target
  |                                              v
  |<--- verified additive context + signed receipt
  |
  | per-physical-send source/data-policy authorization
  v
ChatGPT/Codex native Responses provider
  (Bifröst owns bearer forwarding, retries, streaming and response accounting)
```

ACE is neither an agent scheduler nor a second model proxy. Hermes owns its subscription OAuth; Bifröst forwards the bearer on its existing native subscription route. ACE never authenticates to ChatGPT on the agent's behalf, chooses billing credentials, generates model responses, or exposes retrieval tools for discretionary model invocation. No API-key or legacy Chat/Completions fallback is permitted for the subscription path.

The ACE internal interface is TypeSpec-defined `ace.context.v3` HTTP/JSON RPC, with generated TypeScript, OpenAPI, JSON Schema and SDK artifacts. Its four operations are:

| Method | Internal path (prefix: `/internal/ace-context/v3`) |
| --- | --- |
| GET | `/health` |
| GET | `/capabilities` |
| POST | `/project` |
| POST | `/authorize-attempt` |

The Go plugin applies context to the **same** native Responses request. Projection preserves the original input items and opaque fields, and adds verified evidence rather than replacing the agent's history. `PREPARED` is not permission to send: each physical attempt requires a fresh, single-use authorization bound to the protected final request, route, model and source/data policy. Unknown or denied attempts fail closed.

See [ADR-021: single Bifröst Gateway](docs/docs/references/ADR-021-bifrost-single-gateway-ace-context-service.md), [ADR-020: native Responses](docs/docs/references/ADR-020-native-responses-only.md), [current architecture](docs/operations/current-architecture.md) and the [Go connector](integrations/bifrost/ace-connector/README.md).

## Retrieval and memory

| Component | Role | Current boundary |
| --- | --- | --- |
| Codebase Memory (CBM) v0.12.1 | Native AST, code graph, semantic and SQLite FTS5/BM25 discovery | Active structural/graph engine; persistent application-owned stdio RPC, not agent-facing MCP |
| Qdrant | Dense/sparse code retrieval and native RRF | Currently required by the experimental code runtime; necessity versus CBM-only is unproven |
| External LSP | Independent symbol/definition verification | Maintained language servers; production selection and non-overlapping value require evidence |
| Vertex AI RAG | Authorized project documentation | Explicit cloud opt-in and corpus/IAM configuration; not a private-code destination |
| Local immutable archive | Content-addressed originals, replay, tombstones and lifecycle/reconciliation | Implemented separately; archive availability is not live temporal recall |
| Graphiti / FalkorDB | Target for temporal/project memory | NOT_READY: no active context RPC memory provider; enabling the retired adapter fails startup |

The experimental retrieval path includes pinned embedding workers and optional reranking. CBM and Qdrant overlap in code discovery; the decision to retain or remove Qdrant must follow matched independent benchmarks, not architectural preference. Qdrant is not the selected documentation or memory store. The independent LSP verification is not vector search. The ast-grep CLI is used for architecture linting, not runtime parsing.

ACE validates workspace identity and path containment, reconciles tracked, untracked and removed files, rereads original source bytes and verifies SHA-256 and UTF-8 ranges. Current verified source outranks stale index payloads, documentation and derived memory. Required-source coverage, freshness and uncertainty determine completeness. Large originals remain losslessly accessible under authorization; partial results, failed providers and unknown usage are reported explicitly. Private source and conversations remain local by default; each external provider and data class requires separate authorization.

See [CBM provider](docs/operations/codebase-memory-provider.md), [configuration/readiness matrix](docs/operations/ace-configuration-and-readiness-matrix.md) and [ADR-014: hybrid context engine](docs/docs/references/ADR-014-hybrid-context-engine.md).

## What is being worked on

The following is a dated evidence summary, not an alternative task ledger. Recheck the canonical trackers and exact source/configuration before relying on it.

| Workstream | Status as of 2026-11-24 |
| --- | --- |
| Single Bifröst context integration | RPC v3 migration in [PR #328](https://github.com/chris-madsen/Hybrid-RAG/pull/328); ACE has no agent-facing model endpoint or delivery-accounting stub. Upgrade the engine and plugin together. |
| C01–C02 native contracts and lossless projection | Accepted at their documented local scope; C02's pre-code G02 deviation is recorded. This does not certify provider traffic. |
| C03–C07 physical-send guard, route, streaming, Hermes loop | Implementation candidates exist; actual subscriber final-wire acknowledgement, streaming/cancellation and long agent-loop acceptance remain open. |
| C08 Harbor task quality and economics | Independent paired trials and release decision remain open; no certified 5× improvement. |
| AR01–AR10 reliability | Implementation work spans source coverage, publication authority, archive durability, ranking/trace integrity, worker timeouts and Harbor usage binding. Some fixes are merged; unchecked phases are not proof of missing implementation, and merged code is not accepted evidence. |
| Retrieval architecture evaluation | Compare CBM-only versus CBM + Qdrant and independent LSP value using matched inputs and upstream evaluators; no production CBM-only fallback exists today. |
| Full unified memory | Blocked by the missing active Graphiti context provider; do not infer temporal recall from archive tests. |

**Recent evidence and remediation (21 November 2026):**

- [PR #321](https://github.com/chris-madsen/Hybrid-RAG/pull/321) replaced repeated CBM CLI startup with a persistent local process.
- [PR #322](https://github.com/chris-madsen/Hybrid-RAG/pull/322) repaired typed readiness diagnostics, pinned Bifröst server/UI build and Harbor Hermes OAuth routing. The pinned server build passed on its recorded source SHA; actual deployment and subscriber traffic were not tested by that build.
- [PR #325](https://github.com/chris-madsen/Hybrid-RAG/pull/325) addressed timed-out embedding workers and late-result isolation. [PR #326](https://github.com/chris-madsen/Hybrid-RAG/pull/326) tightened Harbor task/provider/attempt usage correlation and failure accounting.
- [PR #327](https://github.com/chris-madsen/Hybrid-RAG/pull/327) fixed source-span mismatches caused by trimming provider content. The documented local rerun returned `PREPARED` on synthetic and Git-backed fixtures; the latter took 16.56 s with one CBM process start. The deliberate Qdrant outage returned `BLOCK / NOT_READY`. These mock-policy local runs did not start Bifröst or contact a model.

The [Hermes E2E recovery runbook](docs/operations/2026-11-21-hermes-e2e-repair-runbook.md) records commands, exact evidence identities, limitations and the ordered live acceptance procedure. The canonical active acceptance trackers are [OpenSpec 013 (C01–C08)](openspec/changes/013-gateway-g11-production-acceptance/tasks.md) and [OpenSpec 014 (AR01–AR10)](openspec/changes/014-ace-audit-reliability-remediation/tasks.md). Historical plans and benchmarks are not an alternate implementation queue.

## Local development

Node.js/TypeScript and Effect implement the core modular monolith using functional DDD; Go is the Bifröst integration boundary. Python workers are used for embedding/reranking and selected evaluation tooling. Docker/k3s provide local deployment infrastructure.

```bash
npm ci
npm run check
npm run lint
npm run test:affected
npm run verify:pr
# Full deterministic verification (scheduled/manual scope)
npm run verify:full
# Read-only provider/environment probe
npm run probe:providers
# Local Qdrant (localhost-only)
make qdrant-up
```

Install pinned CBM and the required embedding/LSP dependencies according to the [configuration matrix](docs/operations/ace-configuration-and-readiness-matrix.md). `make install-python-providers` provides optional provider tooling; consult the matrix for the actual embedding worker environment. Do not treat a successful install as provider acceptance.

### Experimental local context RPC

The following is a development entry point, not an unrestricted generation configuration:

```bash
export ACE_WORKSPACE_ROOT=/absolute/path/to/repo
export ACE_ENABLE_EXPERIMENTAL_QDRANT=true
export ACE_QDRANT_URL=http://127.0.0.1:6333
export ACE_EMBEDDING_WORKER="$PWD/scripts/fastembed-worker.sh"
export ACE_SPARSE_EMBEDDING_WORKER="$PWD/scripts/fastembed-sparse-worker.sh"
# Install CBM v0.12.1; optionally set ACE_CBM_COMMAND to its executable.
export ACE_LSP_COMMAND="$PWD/node_modules/.bin/typescript-language-server"
export ACE_RETRIEVAL_STRATEGY=hybrid_rrf
# Supply ACE_CONTEXT_RPC_SHARED_SECRET securely, outside version control.
npm run context:rpc
```

By default the internal RPC listens on loopback port 8765. Configure the colocated Bifröst plugin with `ACE_CONTEXT_RPC_URL=http://127.0.0.1:8765/internal/ace-context/v3/project`, matching `ACE_CONTEXT_RPC_TOKEN` and the registered workspace/single-workspace tenancy configuration. A missing secret leaves projection unavailable; incorrect bearer credentials are rejected. Hermes must target Bifröst's `/chatgpt_passthrough` base prefix, never the ACE RPC or a direct provider endpoint.

Use the [subscription OAuth runbook](docs/operations/gateway-subscription-oauth.md) for exact pinned build, route, workspace and data-policy configuration. The v3 endpoint, generated types and plugin must be deployed atomically; there is no compatibility alias or silent provider fallback. Without real required retrieval providers, the service reports not-ready rather than simulating production search.

Vertex requires both `ACE_ENABLE_VERTEX=true` and `ACE_CLOUD_DOCS_OPT_IN=true`, with `ACE_VERTEX_PROJECT`, `ACE_VERTEX_CORPUS_ID` and the applicable location (default `europe-west4`). Permission covers authorized `project_document` only. `ACE_ENABLE_GRAPHITI=true` intentionally fails startup until an active context RPC memory provider exists.

### Source-verified Docker image

```bash
make ace-image ACE_NODE_IMAGE='node:22-bookworm-slim@sha256:<verified-64-hex>' ACE_IMAGE_TAG=ace:local
```

Build from a clean Git checkout. The Make target compiles ACE before building the image; `dist/runtime-provenance.json` binds the source manifest and runtime executable. The Docker context excludes `.git`; stale or missing provenance fails packaging. This establishes build identity, not live provider delivery.

## Verification and release

| Scope | Entry point | What it establishes |
| --- | --- | --- |
| Deterministic PR | `npm run verify:pr` | Typecheck, affected tests, lint, architecture and SDLC checks |
| Full local | `npm run verify:full` | Full deterministic suite, build and property tests; not live E2E |
| Bifröst boundary | `npm run check:bifrost-context` | Single model gateway and internal context RPC architecture |
| Native CBM | [Pinned real-CBM CI](.github/workflows/ace-codebase-memory.yml) | Real structural/graph provider integration |
| Local code retrieval | `npm run test:real-projection` and `-race`, `-outage`, `-hard-outage` variants of that script name | Real local retrieval and source/failure behavior, not model egress |
| Archive and LSP | `npm run test:memory-process`, `npm run test:real-same-name`, `npm run test:real-non-ts-lsp` | Archive/process and symbol verification within their respective scopes |
| Container | `npm run test:ace-container-runtime -- --image <pinned>@sha256:<digest> --bundle <dir>` | Compiled context service liveness |
| Real subscription / Hermes / Harbor | [Acceptance runbook](docs/operations/2026-11-21-hermes-e2e-repair-runbook.md) | Separate exact-route, physical provider wire, SSE, multi-turn tools and independently scored tasks |
| Release | `npm run release:preflight -- ...` | Evidence-gated release evaluation, not an override for missing proofs |

Evaluate retrieval independently with upstream Agent Retrieval Bench, ContextBench and CodeGraph Bench; evaluate end-to-end agent behavior and economics with Harbor using matched frozen tasks, model/effort, tools and source budgets. Count retries, failed attempts and total usage; unknown telemetry is not zero. Require independent task correctness before drawing accepted-task token conclusions. Use the [testing strategy](docs/operations/testing-strategy.md) and [token economics](docs/operations/ace-token-savings.md).

Previously retired transport-specific E2E runners do not count as current acceptance; equivalent real context-path restart, multi-writer, interrupted-publish, scale and holdout evidence must be re-established where required. A green build, mock wire test, local `PREPARED`, or historical benchmark cannot certify live model delivery. No environment flag grants production readiness.

## AI-assisted SDLC and contribution

Read [AGENTS.md](AGENTS.md) before editing. The repository uses risk-based T0/T1/T2 routing, OpenSpec behavioral contracts, functional DDD/Event Storming, TypeSpec code generation, Meyer Design by Contract and explicit evidence gates. The harness-neutral R/S/A/P/X/I/V process starts at the requested stage and reuses verified prior artifacts, rather than restarting research on every session. New unresolved material T2 architecture choices require owner G02 review; code/CI evidence cannot substitute for that decision.

Use the [ACE SDLC skill](.agents/skills/ace-sdlc/SKILL.md) and the [local agent trial](docs/operations/local-agent-sdlc-trial.md):

```bash
npm run test:sdlc-preflight
npm run sdlc:preflight -- --tier T0 --stage research --json
```

For implementation, supply the explicit task ID, existing plan and applicable G02 evidence. Follow the [operational SDLC](docs/operations/ai-assisted-sdlc.md) and [stage entry/resume](docs/operations/implementation-entry-resume.md). Publish reviewable PRs targeting main and report actual check/evidence states; merge remains the owner's decision. Do not turn deterministic checks into production certification.

The parent Consilium repository is outside ACE's implementation scope. See [LICENSE](LICENSE).
