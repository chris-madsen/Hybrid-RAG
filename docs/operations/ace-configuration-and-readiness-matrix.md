# ACE configuration and readiness matrix

**Active runtime reference, source-inspected at `main@8591adc9da77f8eb395df43ea7a51eea16e78062`.** Read [current architecture](current-architecture.md). This does not certify any live provider. A process starting or a unit test passing cannot authorize model egress or imply accepted-task token savings.

## Actual configured capability boundaries

| Source / mode | Runtime configuration | What may truthfully be claimed |
| --- | --- | --- |
| Code retrieval off | `ACE_ENABLE_EXPERIMENTAL_QDRANT` absent/false | No real code-retrieval runtime; **CBM-only is not an active production fallback** |
| Code retrieval on | `ACE_ENABLE_EXPERIMENTAL_QDRANT=true` + local Qdrant + embedding workers + pinned CBM + maintained LSP | CBM structural/graph/semantic/BM25 discovery **and** Qdrant dense/sparse retrieval; ready only with verified current indexed source, not merely environment variables |
| Codebase Memory unavailable | Native index CLI not installed, timed out or returned invalid data | Required code retrieval unavailable/not_ready; no fallback to ast-grep runtime parser |
| Qdrant / embedding unavailable | Search, worker or publication failed | Required code retrieval not_ready; no undocumented CBM-only production fallback |
| LSP unavailable or not supported for language | No trustworthy native symbol/definition evidence | Do not claim LSP verification; exact source bytes may still be independently checked |
| Documentation | `ACE_ENABLE_VERTEX=true`, `ACE_CLOUD_DOCS_OPT_IN=true` + approved corpus/project and data class | Vertex AI RAG for authorized `project_document`, not a Qdrant documentation corpus |
| Temporal memory | `ACE_ENABLE_GRAPHITI=true` | **UNSUPPORTED / startup error**: `ace-runtime.ts` refuses the retired tool-server adapter; Gateway-native Graphiti is not configured. Archive CLI/reconciliation code exists separately, but full unified temporal retrieval is NOT_READY |
| Host worktree helper | Registered workspace + mTLS where required | Read-only scoped source evidence, separately gated k3s containment |
| Release | Exact source SHA + real provider, agent, privacy, quality and owner evidence | No unconditional READY from configuration flags |

A missing/unavailable/stale/partial/denied provider is not a successful empty source. Required-source coverage must be verified. `PREPARED` is not physical send authorization.

## Startup and source freshness

Invalid trust configuration, snapshot/source identity or mTLS may be fatal; transient provider failures can leave the process alive with `not_ready`/`degraded`. The current executable and receipts determine the precise failure state, **not** historical model-invoked `ace_workspace_status` documentation.

For code results ACE must reconcile the workspace manifest, including non-Git files and dirty worktree, and reread exact UTF-8 source bytes with SHA-256/range verification. CBM graph, Qdrant vectors and LSP claims never override current original bytes. An explicit source obligation must not force an unapproved Vertex document egress.

## Code retrieval — current native Responses path

```text
Hermes native /v1/responses -> Bifröst -> ACE Gateway projection v2
      -> CBM index_repository/get_file_outline (Tree-sitter AST)
      -> CBM search_graph: semantic_query + BM25 + native graph edges/trace
      -> Qdrant SDK dense/sparse hybrid candidate search (also active)
      -> ACE bounded candidate combination + current workspace reread
      -> optional external LSP documentSymbols/definition confirmation
      -> verified source evidence + projection receipt
      -> separate Bifröst final physical-send authorization (NOT CERTIFIED)
```

CBM's own semantic/BM25 code search **overlaps** with the Qdrant index. Qdrant is not the source for documentation (Vertex AI RAG) or project memory (Graphiti/archive). CBM-only vs CBM+Qdrant and external-LSP necessity require independent matched retrieval/real-agent benchmarks before an architectural removal.

Minimal local configuration, subject to separate policy/identity prerequisites:

```bash
ACE_WORKSPACE_ROOT=/absolute/repo
ACE_ALLOWED_ROOTS=/absolute/allowed-parent
ACE_STATE_DIR=/absolute/state
ACE_WORKSPACE_ID=<registered-workspace>
ACE_ENABLE_EXPERIMENTAL_QDRANT=true
ACE_QDRANT_URL=http://127.0.0.1:6333
ACE_EMBEDDING_WORKER=$PWD/scripts/fastembed-worker.sh
ACE_SPARSE_EMBEDDING_WORKER=$PWD/scripts/fastembed-sparse-worker.sh
# Install codebase-memory-mcp@0.12.1; optional:
# ACE_CBM_COMMAND=/absolute/path/to/codebase-memory-mcp
# Optional maintained language server override (default TypeScript):
ACE_LSP_COMMAND=$PWD/node_modules/.bin/typescript-language-server
ACE_LSP_ARGS='["--stdio"]'
ACE_LSP_SERVER=typescript-language-server
# Stable collection, coordinated single-host writer fencing:
ACE_QDRANT_WRITER_TOPOLOGY=single_host
ACE_QDRANT_PUBLICATION_DIR=/var/lib/ace/qdrant-publication
```

Invalid JSON for `ACE_LSP_ARGS` / `ACE_LSP_LANGUAGE_IDS`, bad effective provider identity, missing current source or invalid authorization fail closed. For release-quality studies `ACE_REQUIRE_PINNED_EMBEDDING=true` requires an effective pinned embedding identity, not a claimed environment label.

### Current Qdrant publication — stable collection

[AR03 single-host authority](qdrant-single-writer-authority.md) describes durable epoch reservations, shared `flock` state and complete SDK membership verification. The **old** content-addressed collection / `..._current` atomic-alias switching procedure is retired in current runtime. Multi-host writers without coordinated fencing are unsupported. Real local cross-process Qdrant acceptance is **not** inferred from deterministic crash tests.

## Documentation / Vertex

Vertex is opt-in twice: the provider must be enabled and cloud document egress must be explicitly permitted.

```bash
ACE_ENABLE_VERTEX=true
ACE_CLOUD_DOCS_OPT_IN=true
ACE_VERTEX_PROJECT=<project>
ACE_VERTEX_CORPUS_ID=<approved-corpus>
ACE_VERTEX_LOCATION=europe-west4
```

The runtime obtains a short-lived `gcloud auth print-access-token` token at the boundary. Secret-like retrieval queries are denied before HTTP.

Cloud authorization is **provider + data-class scoped**, not merely provider-scoped. The built-in Vertex runtime policy permits only `project_document` for the `vertex` destination when `ACE_CLOUD_DOCS_OPT_IN=true`. `private_source`, `private_conversation` and `secret` are not inherited from that permission. A different external provider (for example the optional Jev experiment) requires its own explicit allowed data-class mapping.

Enabling Vertex therefore does not authorize source-code or private-dialogue upload. The approved synthetic/public fixture scope and any broader data scope are separate owner decisions.

## Temporal memory / Graphiti

**Current runtime blocker:** setting `ACE_ENABLE_GRAPHITI=true` makes `src/bin/ace-runtime.ts` throw before startup: the old agent-tool adapter was retired, and no Gateway-native temporal-memory provider is wired. **There is no supported environment-variable recipe to enable Graphiti in the current Gateway.** Historical examples using `ACE_GRAPHITI_COMMAND` and `ACE_GRAPHITI_ARGS_JSON` are not current instructions. A full-unified release is BLOCKED, even if a standalone runtime-configuration evidence validator accepts its declared flags.

The immutable archive, memory CLI and projection outbox exist separately; their verification is not a Gateway-native Graphiti integration test. In the independently supported archive CLI, manual repair is invoked with:

```bash
npm run memory:sync -- repair <episode-id>
```

Real Graphiti extraction, temporal recall, purge/recovery and local inference economics must still be retained as acceptance evidence before memory is production-approved.

## Host worktree helper / local k3s

When ACE runs away from the host process that owns the live worktree, use the authenticated helper rather than a writable hostPath:

```bash
ACE_WORKTREE_HELPER_URL=https://<host-helper>:7443/v1/worktree
ACE_WORKSPACE_ID=<registered-workspace>
ACE_WORKTREE_HELPER_TLS_CA=/run/ace-helper/ca.crt
ACE_WORKTREE_HELPER_TLS_CERT=/run/ace-helper/client.crt
ACE_WORKTREE_HELPER_TLS_KEY=/run/ace-helper/client.key
```

The host owns `workspace_id -> canonical root`; callers never supply an absolute host root. The required real-k3s containment/restart/race checks are in `infra/k8s/ace-local/HOST-WORKTREE-HELPER.md`.

## Hermes Native Responses / Bifröst agent loop (C07)

The Harbor Hermes adapter uses Hermes's native `openai-codex` Responses provider. For an ACE trial, it must receive an explicit `HERMES_CODEX_BASE_URL` pointing at the selected Bifröst endpoint and a `bifrost_endpoint_sha256` that matches the frozen experiment's `bifrostEndpointSha256`. The digest covers the trimmed endpoint after trailing slashes are removed. The URL is passed through Hermes's supported Codex endpoint override. Default permitted hosts are local `localhost`, `127.0.0.1`, `::1`, `host.docker.internal`, `bifrost`, and `bifrost-gateway`; remote deployments need an explicit comma-separated `ACE_HERMES_ALLOWED_BIFROST_HOSTS` operator allowlist in the preflight and adapter environments. Direct `*.openai.com` and `*.chatgpt.com` hosts remain prohibited even if allowlisted. The digest pins configuration identity only: it does not prove the endpoint is Bifröst or authorize provider egress.

Both paired Harbor jobs must pin the same Bifröst endpoint digest, model, Hermes version and reasoning effort. `npm run preflight:feedback-loop` checks those bindings, but its full readiness procedure also queries the configured task-verifier endpoint, Harbor registry and Qdrant. Do not run that full procedure as an offline C07 check without separate external-probe authorization. Real provider/agent execution remains blocked by actual C03–C06 final-send, policy and route gates and their specific authorization. **Do not create an ACE-invented token counter/window gate or block source delivery solely because exact model token accounting is unavailable**; preserve unknown token metrics and do not claim measured savings (see `ace-token-savings.md`).

The Harbor trial's original `agent/hermes-session.jsonl` and `agent/hermes.txt` are private transcript artifacts and must remain outside the repository. The collector refuses a session export located inside the repository, hashes the original bytes, and excludes the raw session export, Hermes text log, projection body, context receipts and final-wire envelope from copied output. `agent-loop-evidence.json` retains only the digest, redacted event counts, tool-call/result ID hashes, Gateway request IDs and signature-checked receipt summaries. Caller session IDs are correlation only; when a same-session correlation is not observed, agent-loop evidence remains `NOT_RUN`. Hermes export alone cannot attest durable host history or compaction, and retrieval provider traces are not final LLM egress receipts.

Agent-loop evidence has only `NOT_RUN`, `BLOCKED` or `CANDIDATE` states. A signature checked with an operator-supplied public key proves envelope integrity, not signer identity; C05 receipts therefore remain candidates. No mock, normalized session fixture, projection receipt, Harbor reward or usage counter by itself is real-agent acceptance. The owner authorized offline C07 implementation only; real Hermes/provider/Harbor trials remain unauthorized and are `NOT_RUN`.

## Selection and release gates

These commands prepare or evaluate evidence; none should be replaced by an assertion in documentation:

```bash
npm run compare:embeddings
npm run gate:embedding-selection -- ...
npm run compare:semantic-tsls
npm run test:real-non-ts-lsp
npm run gate:semantic-selection -- ...
npm run report:retrieval-quality -- ...
npm run gate:retrieval-quality -- ...
npm run gate:harbor-three-arm -- ...
npm run evidence:runtime-config -- ...
npm run evidence:resource-budget -- ...
npm run evidence:dbc -- ...
npm run release:preflight -- ...
```

The release preflight is fail-closed. For a hard release check:

```bash
ACE_REQUIRE_RELEASE_READY=true npm run release:preflight -- <policy.json> <evidence.json>
```

Full unified production readiness requires the exact release commit, all 14 DBCs, approved embedding and semantic choices, frozen retrieval quality evidence, natural-use Harbor evidence with complete cost telemetry, exact-commit runtime configuration and resource-budget evidence, real Graphiti/Vertex/k3s/operations/supply-chain evidence, and an owner-signed approval artifact verified against the configured trust-root public-key hash. A JSON field containing only `status: approved` is insufficient.

The historical 5× token-reduction target remains a product hypothesis. It is never inferred from a green preflight and is never backfilled from character counts or incomplete cost telemetry.
