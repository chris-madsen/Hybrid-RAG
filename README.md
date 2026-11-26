# Adaptive Context Engine (ACE)

**Open-source context engineering infrastructure for AI coding agents.**

ACE combines hybrid retrieval, code intelligence and source verification to supply relevant, compact evidence directly to native LLM requests. It is designed to improve coding-agent task quality and token efficiency while preserving agent autonomy, exact source access and data privacy.

Unlike a standalone vector search or an agent-specific retrieval plugin, ACE integrates at the LLM gateway boundary. Coding agents retain their own reasoning and tool workflows while the context engine handles evidence retrieval, verification and delivery.

**TypeScript · Effect · Go · Python · Codebase Memory · LSP · TypeSpec · Docker/k3s**

## Key capabilities

- **Hybrid code intelligence:** native CBM AST, dependency graph, semantic and BM25 retrieval; ACE verifies original source. CBM is the only code retrieval engine; independent LSP research is deferred.
- **Source-grounded context:** exact current-file verification, SHA-256 digests, UTF-8 source spans, workspace reconciliation and lossless access to authorized originals.
- **Agent-neutral integration:** additive context projection into native Responses requests through a Bifröst plugin, with signed receipts and per-attempt source/data-policy authorization.
- **Privacy-aware data architecture:** local code indexing and immutable archival storage, explicit authorization for external document retrieval and model egress.
- **Evidence-driven engineering:** typed contracts, functional domain modeling, automated architecture/security checks, reproducible builds and independent retrieval/agent benchmark methodology.

[Architecture](#architecture) · [Retrieval and memory](#retrieval-and-memory) · [Development roadmap](#development-roadmap) · [Local development](#local-development) · [Verification](#verification-and-release)

## Architecture

The [Architecture Description](docs/architecture/README.md) organizes ACE's stakeholder concerns, architecture views, decisions and traceability around ISO/IEC/IEEE 42010:2022. It separates the implemented system from target capabilities and acceptance evidence; the [clause-by-clause assessment](docs/architecture/conformance.md) records the review scope and limitations.


```text
Hermes (own ChatGPT/Codex subscription OAuth)
  | native Responses
  v
Bifröst — sole agent-facing LLM Gateway
  | POST /chatgpt_passthrough/backend-api/codex/responses
  | post-auth Go ACE plugin
  +---- authenticated loopback context RPC ----> ACE Core (TypeScript + Effect)
  |                                              | code: native CBM
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

See [ADR-021: single Bifröst Gateway](docs/references/ADR-021-bifrost-single-gateway-ace-context-service.md), [ADR-020: native Responses](docs/references/ADR-020-native-responses-only.md), [current architecture](docs/operations/current-architecture.md) and the [Go connector](integrations/bifrost/ace-connector/README.md).

## Retrieval and memory

| Component | Role | Current boundary |
| --- | --- | --- |
| Codebase Memory (CBM) v0.12.1 | Native AST, code graph, semantic and SQLite FTS5/BM25 discovery | Active structural/graph engine; persistent application-owned stdio RPC; retrieval tools remain internal and are never exposed to the agent |
| External LSP | Independent symbol/definition verification | Independent exact-symbol contracts and implementation retained for research (#364); not requested by native code-only RPC |
| Vertex AI RAG | Authorized project documentation | Explicit cloud opt-in and corpus/IAM configuration; not a private-code destination |
| Local immutable archive | Content-addressed originals, replay, tombstones and lifecycle/reconciliation | Implemented separately; archive availability is not live temporal recall |
| Graphiti / FalkorDB | Target for temporal/project memory | NOT_READY: no active context RPC memory provider; enabling the retired adapter fails startup |

Native CBM is the sole code retrieval owner (#363). It supplies structural, graph, semantic and lexical discovery; ACE verifies the current original bytes, authorization, and coverage. The former separate vector index, embedding workers, and reranker are retired in the native cutover. Independent external LSP is retained for research (#364). Vertex and temporal memory remain separate. The development-only ast-grep CLI enforces architectural fitness, not runtime parsing. Final acceptance of the cutover requires absolute quality, scale and safety evidence.

ACE validates workspace identity and path containment, reconciles tracked, untracked and removed files, rereads original source bytes and verifies SHA-256 and UTF-8 ranges. Current verified source outranks stale index payloads, documentation and derived memory. Required-source coverage, freshness and uncertainty determine completeness. Large originals remain losslessly accessible under authorization; partial results, failed providers and unknown usage are reported explicitly. Private source and conversations remain local by default; each external provider and data class requires separate authorization.

See [CBM provider](docs/operations/codebase-memory-provider.md), [configuration/readiness matrix](docs/operations/ace-configuration-and-readiness-matrix.md) and [ADR-014: hybrid context engine](docs/references/ADR-014-hybrid-context-engine.md).

## Development roadmap

ACE has implemented the core context engine, native Responses projection, local hybrid retrieval and source-policy contracts. Development is focused on end-to-end acceptance, native CBM retirement acceptance, temporal memory integration and independently measured agent economics. Production release remains evidence-gated.

The target is a 5× reduction in total tokens per accepted task, measured against a matched agent baseline with independent correctness checks. This is an evaluation target, not a measured achievement.

The following snapshot summarizes active work; OpenSpec remains the canonical acceptance tracker.

| Workstream | Status as of 2026-11-24 |
| --- | --- |
| Single Bifröst context integration | TypeSpec context RPC v3, native Bifröst hooks and exact-request policy; see [integration change #328](https://github.com/chris-madsen/Hybrid-RAG/pull/328). |
| C01–C02 native contracts and lossless projection | Implemented and accepted at their documented local contract scope. |
| C03–C07 physical-send guard, route, streaming, Hermes loop | Implementation in place; live subscriber final-wire, streaming/cancellation and long agent-loop acceptance are the next milestones. |
| C08 Harbor task quality and economics | Independent paired trials and release decision remain open; no certified 5× improvement. |
| AR01–AR10 reliability | Source coverage, publication authority, archive durability, ranking/trace integrity, worker lifecycle and Harbor usage binding. Acceptance tracked per phase. |
| Retrieval architecture evaluation | Native CBM cutover: verify absolute quality/scale and topology, validate the retired-vector-free composition; independent LSP research deferred. No production certificate. |
| Full unified memory | Blocked by the missing active Graphiti context provider; do not infer temporal recall from archive tests. |

**Recent evidence and remediation (21 November 2026):**

- [PR #321](https://github.com/chris-madsen/Hybrid-RAG/pull/321) replaced repeated CBM CLI startup with a persistent local process.
- [PR #322](https://github.com/chris-madsen/Hybrid-RAG/pull/322) repaired typed readiness diagnostics, pinned Bifröst server/UI build and Harbor Hermes OAuth routing. The pinned server build passed on its recorded source SHA; actual deployment and subscriber traffic were not tested by that build.
- [PR #325](https://github.com/chris-madsen/Hybrid-RAG/pull/325) addressed timed-out embedding workers and late-result isolation. [PR #326](https://github.com/chris-madsen/Hybrid-RAG/pull/326) tightened Harbor task/provider/attempt usage correlation and failure accounting.
- [PR #327](https://github.com/chris-madsen/Hybrid-RAG/pull/327) fixed source-span mismatches caused by trimming provider content. The documented local rerun returned `PREPARED` on synthetic and Git-backed fixtures; the latter took 16.56 s with one CBM process start. The deliberate Qdrant outage returned `BLOCK / NOT_READY`. These mock-policy local runs did not start Bifröst or contact a model.

The [Hermes E2E recovery runbook](docs/operations/2026-11-21-hermes-e2e-repair-runbook.md) records commands, exact evidence identities, limitations and the ordered live acceptance procedure. The canonical active acceptance trackers are [OpenSpec 013 (C01–C08)](openspec/changes/013-gateway-g11-production-acceptance/tasks.md) and [OpenSpec 014 (AR01–AR10)](openspec/changes/014-ace-audit-reliability-remediation/tasks.md). Historical plans and benchmarks are not an alternate implementation queue.

## Local development

Node.js/TypeScript and Effect implement the core modular monolith using functional DDD; Go is the Bifröst integration boundary. Python remains available for independent memory, HTTP and evaluation tooling. Docker/k3s provide local deployment infrastructure.

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
npm install --global codebase-memory-mcp@0.12.1
codebase-memory-mcp --version
```

Use the [configuration matrix](docs/operations/ace-configuration-and-readiness-matrix.md) for the native local path. No external embedding worker, Qdrant service or LSP is needed for native code-only projection.

### Local context RPC and hybrid retrieval

Start the local context engine with the configured retrieval providers:

```bash
export ACE_WORKSPACE_ROOT=/absolute/path/to/repo
export ACE_ALLOWED_ROOTS=/absolute/path/to
# Optional ACE_CBM_COMMAND: absolute path to the pinned native executable.
# Supply ACE_CONTEXT_RPC_SHARED_SECRET securely, outside version control.
npm run context:rpc
```

The native runtime is the default and only code retrieval path. It requires an ACE-local authorized workspace, rejects remote helper and legacy provider enablement, and never falls back to another code engine. By default the internal RPC listens on loopback port 8765. Configure the colocated Bifröst plugin with `ACE_CONTEXT_RPC_URL=http://127.0.0.1:8765/internal/ace-context/v3/project`, matching `ACE_CONTEXT_RPC_TOKEN` and the registered workspace/single-workspace tenancy configuration. A missing secret leaves projection unavailable; incorrect bearer credentials are rejected. Hermes must target Bifröst's `/chatgpt_passthrough/backend-api/codex` SDK base prefix, never the ACE RPC or a direct provider endpoint.

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
| Local code retrieval | `ACE_REAL_PROJECTION_NATIVE_CBM=true npm run test:real-projection`; see native CI for fault scenarios | Real local retrieval and source/failure behavior, not model egress |
| Archive and LSP | `npm run test:memory-process`, `npm run test:real-same-name`, `npm run test:real-non-ts-lsp` | Archive/process and symbol verification within their respective scopes |
| Container | `npm run test:ace-container-runtime -- --image <pinned>@sha256:<digest> --bundle <dir>` | Compiled context service liveness |
| Real subscription / Hermes / Harbor | [Acceptance runbook](docs/operations/2026-11-21-hermes-e2e-repair-runbook.md) | Separate exact-route, physical provider wire, SSE, multi-turn tools and independently scored tasks |
| Release | `npm run release:preflight -- ...` | Evidence-gated release evaluation, not an override for missing proofs |

Evaluate retrieval independently with upstream Agent Retrieval Bench, ContextBench and CodeGraph Bench; evaluate end-to-end agent behavior and economics with Harbor using matched frozen tasks, model/effort, tools and source budgets. Count retries, failed attempts and total usage; unknown telemetry is not zero. Require independent task correctness before drawing accepted-task token conclusions. Use the [testing strategy](docs/operations/testing-strategy.md) and [current Harbor acceptance specification](openspec/changes/013-gateway-g11-production-acceptance/phases/C08.md).

Previously retired transport-specific E2E runners do not count as current acceptance; equivalent real context-path restart, multi-writer, interrupted-publish, scale and holdout evidence must be re-established where required. A green build, mock wire test, local `PREPARED`, or historical benchmark cannot certify live model delivery. No environment flag grants production readiness.

## AI-assisted SDLC and contribution

Read [AGENTS.md](AGENTS.md) before editing. The repository uses risk-based T0/T1/T2 routing, OpenSpec behavioral contracts, functional DDD/Event Storming, TypeSpec code generation, Meyer Design by Contract and explicit evidence gates. The harness-neutral R/S/A/P/X/I/V process starts at the requested stage and reuses verified prior artifacts, rather than restarting research on every session. New unresolved material T2 architecture choices require owner G02 review; code/CI evidence cannot substitute for that decision.

Use the [ACE SDLC skill](.agents/skills/ace-sdlc/SKILL.md) and the [local agent trial](docs/operations/local-agent-sdlc-trial.md):

```bash
npm run test:sdlc-preflight
npm run sdlc:preflight -- --tier T0 --stage research --json
```

For implementation, supply the explicit task ID, existing plan and applicable G02 evidence. Follow the [operational SDLC](docs/operations/ai-assisted-sdlc.md) and [stage entry/resume](docs/operations/implementation-entry-resume.md). Publish reviewable PRs targeting main and report actual check/evidence states; merge remains the owner's decision. Do not turn deterministic checks into production certification.

## License

ACE is available under the [Apache License 2.0](LICENSE).
