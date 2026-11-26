# ACE configuration and readiness matrix

**Active runtime reference:** native-only cutover PR #378; earlier main baseline `49feabfe190cb5f3ab197cedad91a0fa1305278d` (#367–375) is historical. See [current architecture](current-architecture.md). Local native tests do not certify live provider traffic or token savings.

## Actual configured capability boundaries

| Source / mode | Runtime configuration | What may truthfully be claimed |
| --- | --- | --- |
| Code retrieval | Native CBM is mandatory in the supported runtime | No alternate vector mode; missing/unready native provider blocks required code retrieval |
| Native code retrieval | Pinned local CBM, authorized ACE-local workspace | Sole code runtime; exact source proof required; no provider-wire certification |
| Codebase Memory unavailable | Pinned native stdio server missing, protocol identity incompatible, session lost or index incomplete | Required native graph/source discovery is not_ready; a new session requires explicit reindex, never fallback to ast-grep runtime parser |
| LSP unavailable or not supported for language | No trustworthy native symbol/definition evidence | Do not claim LSP verification; exact source bytes may still be independently checked |
| Documentation | `ACE_ENABLE_VERTEX=true`, `ACE_CLOUD_DOCS_OPT_IN=true` + approved corpus/project and data class | Separate Vertex adapter for authorized `project_document`; native Responses projection requests code only |
| Temporal memory | `ACE_ENABLE_GRAPHITI=true` | **UNSUPPORTED / startup error**: `ace-runtime.ts` refuses the retired tool-server adapter; Gateway-native Graphiti is not configured. Archive CLI/reconciliation code exists separately, but full unified temporal retrieval is NOT_READY |
| Host worktree helper | Any configured `ACE_WORKTREE_HELPER_URL` | Native runtime refuses startup; remote topology decision and real containment tests remain open |
| Release | Exact source SHA + real provider, agent, privacy, quality and owner evidence | No unconditional READY from configuration flags |

A missing/unavailable/stale/partial/denied provider is not a successful empty source. Required-source coverage must be verified. `PREPARED` is not physical send authorization.

## Startup and source freshness

Invalid trust configuration, snapshot/source identity or mTLS may be fatal; transient provider failures can leave the process alive with `not_ready`/`degraded`. The current executable and receipts determine the precise failure state, **not** historical model-invoked `ace_workspace_status` documentation.

For code results ACE must reconcile the workspace manifest, including non-Git files and dirty worktree, and reread exact UTF-8 source bytes with SHA-256/range verification. CBM graph and LSP claims never override current original bytes. An explicit source obligation must not force an unapproved Vertex document egress.

## Code retrieval — current native Responses path

```text
Hermes subscription native Responses -> Bifröst /chatgpt_passthrough -> ACE internal context projection v3
      -> CBM index_repository/get_file_outline (Tree-sitter AST)
      -> CBM search_graph: semantic_query + BM25 + native graph edges/trace
      -> WorkspaceSync + ACE exact source verification and current manifest fence
      -> native code-only source plan (no external LSP evidence requested)
      -> verified source evidence + projection receipt
      -> separate Bifröst final physical-send authorization (NOT CERTIFIED)
```

Native CBM is the sole code search owner. External LSP remains a separate research question (#364). Native local configuration (also provide the RPC secret and workspace identity):

```bash
ACE_WORKSPACE_ROOT=/absolute/repo
ACE_ALLOWED_ROOTS=/absolute/allowed-parent
ACE_STATE_DIR=/absolute/state
ACE_WORKSPACE_ID=<registered-workspace>
# Install codebase-memory-mcp@0.12.1; optionally ACE_CBM_COMMAND points to native executable.
```

Legacy provider enablement is rejected; disabled legacy flags may be removed from existing configurations. The remote helper is not supported by native code retrieval. Use a dedicated native service identity, avoid unverified shared-cache topology, and keep the RPC loopback-only.

## Documentation / Vertex

Vertex is opt-in twice: the provider must be enabled and cloud document egress must be explicitly permitted. These settings configure the adapter, not combined delivery: `responses-projection-service.ts` requests only code and rejects non-code evidence.

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

**Historical helper configuration, not supported by the native-only runtime.** The current runtime rejects `ACE_WORKTREE_HELPER_URL`. The following retained settings describe the previous remote-worktree design; they must not be used as current startup instructions:

```bash
ACE_WORKTREE_HELPER_URL=https://<host-helper>:7443/v1/worktree
ACE_WORKSPACE_ID=<registered-workspace>
ACE_WORKTREE_HELPER_TLS_CA=/run/ace-helper/ca.crt
ACE_WORKTREE_HELPER_TLS_CERT=/run/ace-helper/client.crt
ACE_WORKTREE_HELPER_TLS_KEY=/run/ace-helper/client.key
```

The host owns `workspace_id -> canonical root`; callers never supply an absolute host root. The required real-k3s containment/restart/race checks are in `infra/k8s/ace-local/HOST-WORKTREE-HELPER.md`.

## Hermes Native Responses / Bifröst agent loop (C07)

The Harbor Hermes adapter uses Hermes's native `openai-codex` **subscription OAuth** Responses provider. For an ACE trial, it must receive an explicit `HERMES_CODEX_BASE_URL` pointing at the existing Bifröst **`/chatgpt_passthrough/backend-api/codex` SDK base endpoint** (NOT `/v1/responses`, a direct ChatGPT endpoint, or ACE's local context RPC) and a `bifrost_endpoint_sha256` that matches the frozen experiment's `bifrostEndpointSha256`. The digest covers the trimmed endpoint after trailing slashes are removed. The URL is passed through Hermes's supported Codex endpoint override. Default permitted hosts are local `localhost`, `127.0.0.1`, `::1`, `host.docker.internal`, `bifrost`, and `bifrost-gateway`; remote deployments need an explicit comma-separated `ACE_HERMES_ALLOWED_BIFROST_HOSTS` operator allowlist in the preflight and adapter environments. Direct `*.openai.com` and `*.chatgpt.com` hosts remain prohibited even if allowlisted. The digest pins configuration identity only: it does not prove the endpoint is Bifröst or authorize provider egress.

Both paired Harbor jobs must pin the same Bifröst subscriber endpoint digest, model, Hermes version and reasoning effort. `npm run preflight:feedback-loop` checks those bindings, but its full readiness still requires task verifier, registry and real task runtime evidence. Merged #376 replaces historical vector preflight probes with native bundle verification. Current bundle schema v2 requires the pinned native executable and byte-bound task images. **The owner already authorized limited C03–C05 provider probes** using the actual native subscription route, exact request/receipt and source data permission; do not invent a second OAuth validation/provenance gate. C06 real streaming, C07 real agent and C08 Harbor acceptance require their own evidence. A missing provider-native token counter or context-window value is **UNKNOWN telemetry**, not an ACE admission blocker or reason to invent a token limit. Verify actual Bifröst/ACE path before any release claim.

The Harbor trial's original `agent/hermes-session.jsonl` and `agent/hermes.txt` are private transcript artifacts and must remain outside the repository. The collector refuses a session export located inside the repository, hashes the original bytes, and excludes the raw session export, Hermes text log, projection body, context receipts and final-wire envelope from copied output. `agent-loop-evidence.json` retains only the digest, redacted event counts, tool-call/result ID hashes, Gateway request IDs and signature-checked receipt summaries. Caller session IDs are correlation only; when a same-session correlation is not observed, agent-loop evidence remains `NOT_RUN`. Hermes export alone cannot attest durable host history or compaction, and retrieval provider traces are not final LLM egress receipts.

Agent-loop evidence has only `NOT_RUN`, `BLOCKED` or `CANDIDATE` states. A signature checked with an operator-supplied public key proves envelope integrity, not signer identity; C05 receipts therefore remain candidates. No mock, normalized session fixture, projection receipt, Harbor reward or usage counter by itself is real-agent acceptance. **Real C03–C05 public synthetic subscriber probes are owner-authorized**, but were not run by this PR; full real C07 Hermes/Harbor trials and C08 release acceptance remain NOT_RUN, not automatically authorized by offline implementation.

## Selection and release gates

These commands prepare or evaluate evidence. Native code-only release requires schema-v2 runtime configuration and absolute frozen multi-repository retrieval-quality evidence with retained source artifacts. Independent semantic-provider research is separate; the full-unified gate remains blocked until the actual full runtime and topology are accepted.

```bash
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

Full unified production readiness requires the exact release commit, all 14 DBCs, native provider identities, independent semantic acceptance for the full scope, absolute frozen multi-repository retrieval quality evidence, natural-use Harbor evidence with complete cost telemetry, exact-commit runtime configuration and resource-budget evidence, real Graphiti/Vertex/k3s/operations/supply-chain evidence, and an owner-signed approval artifact verified against the configured trust-root public-key hash. A JSON field containing only `status: approved` is insufficient.

The historical 5× token-reduction target remains a product hypothesis. It is never inferred from a green preflight and is never backfilled from character counts or incomplete cost telemetry.
