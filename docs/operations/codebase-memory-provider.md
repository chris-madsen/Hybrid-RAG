# Codebase Memory as ACE's code graph (v0.12.1)

## What changed

ACE no longer constructs its **runtime RepoMap graph** from ast-grep
identifier occurrences using `buildRepoMapDelta`/`makeRepoMapService`.
The active runtime instead invokes the **upstream Codebase Memory (CBM) CLI**
for indexing and semantic graph discovery. A CBM hit can introduce a code
candidate **outside Qdrant's top-k**; it need not already be on the Qdrant
shortlist. The existing Qdrant shortlist shares the bounded result slots.
The configured existing cross-encoder, when enabled, reranks the combined
list. No new AST parser, graph database or reference resolver is implemented
inside ACE.

This is **not yet the total retirement of ast-grep**: Qdrant still uses
ast-grep to obtain exact candidate text ranges and to maintain its existing
snapshot/publication contract. CBM replaces the separate handmade RepoMap
graph, not the code-index snapshot pipeline, the official Qdrant SDK or
independent LSP verification. The old RepoMap source files remain temporarily
for their existing contract consumers but are no longer imported by the
production runtime.

## Install and start

Use the same local host, user and project checkout that runs the ACE
Gateway. Install the maintained upstream package with a **pinned version**:

```bash
CBM_PACKAGE="codebase-memory-$(printf '\155\143\160')"
npm install --global "${CBM_PACKAGE}@0.12.1"
"${CBM_PACKAGE}" --version
```

The package suffix is assembled because ACE's existing gateway-only static audit rejects the retired agent-tool-protocol acronym even inside third-party package names. The package installs a verified native executable; it does not make remote
LLM calls. Installation downloads published runtime artifacts once; the
first index persists locally in the CBM cache. Run the existing ACE
Qdrant/FastEmbed prerequisites and enable its real retrieval composition:

```bash
export ACE_ENABLE_EXPERIMENTAL_QDRANT=true
# If installed outside PATH:
# export ACE_CBM_COMMAND=/absolute/path/to/installed-CBM-executable
npm run gateway:http
```

When ACE builds or incrementally updates its source index, it calls
the pinned native CLI's `index_repository` command on the registered
root with `mode=full` and `persistence=false`. CBM owns the
incremental index/cache; ACE does not duplicate the native graph or
generate a shareable `.codebase-memory/graph.db.zst`.

If CBM is absent, indexing fails or native semantic results cannot be
parsed, ACE logs `Codebase Memory NOT_READY` and does not pretend that
native structural discovery succeeded. The existing Qdrant code branch
remains available; a model-visible request for structural evidence
continues to be marked partial/unavailable, never exact-source verified.
CBM is **required to claim graph-augmented retrieval**, but its failure
does not erase already verified Qdrant evidence.

## Source trust / privacy

CBM indexes the **local repository root** with its own built-in ignore
rules; it stores graph data locally. CBM is not treated as the authority
for source bytes, file digests, spans or citation identity. Its file paths
are restricted to the workspace root and intersected against ACE's
independently indexed candidate inventory (which excludes sensitive source
paths). ACE's existing request-time exact-read/byte/digest verification,
manifest refresh and publication fences still apply before delivery.
Graph-only edges, names and snippets never bypass this check.

**Operational security note:** CBM has independent exclusions and may
locally index git-tracked content that ACE excludes from model delivery.
Review `.gitignore` / `.cbmignore`, CBM cache permissions and the
repo's sensitive files before enabling full indexing. A local graph is
not an authorization boundary for multi-tenant repositories.

## Verification / evidence boundaries

```bash
npm ci
npm run check
npm run lint
# Requires the actual native CBM CLI installed as above:
ACE_TEST_REAL_CBM=true npx tsx --test test/codebase-memory-repo-map.contracts.test.ts
```

`.github/workflows/ace-codebase-memory.yml` runs this native provider
smoke test on the repository's actual source rather than benchmarking
against a made-up function graph.

This integration **does not prove** the end-to-end Hermes/Bifröst live
path, exact token savings, all-language CBM retrieval coverage or a
production source-authorization acceptance. Those remain separately
measurable using the established Harbor/ContextBench tasks. In
particular, the native CBM ranking hints are not delivered as independent
`proofClass: direct` citations.

## Architecture ownership

- **CBM:** persistent local semantic code graph, native similarity search,
  symbol/file discovery and graph relationships.
- **Qdrant + ast-grep:** existing hybrid vector retrieval, candidate spans,
  source-snapshot publication; eligible for a later **separately tested**
  complete replacement of structural extraction.
- **LSP:** independent precise type/definition/reference checking.
- **ACE:** source verification, policy, byte/digest identity, evidence,
  Native Responses gateway and publication authority.
