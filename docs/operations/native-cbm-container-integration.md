# Native CBM container integration (CBM-03 partial)

Date: 2026-11-25. Scope: local code-only, zero model egress. Source baseline `1954013df800dba04f0a4c6eecbdb3105e2260c7` (stacked CBM work). The external LSP research decision remains open (#364); no LSP contract or dependency is removed.

## Deployment boundary

The existing `Dockerfile.ace` now shares one verified runtime base between an explicitly selected `native-cbm` target and the historical vector target. The native image installs the pinned upstream CBM 0.12.1 package and Git; no embedding Python environment or model cache is installed. It uses the existing compiled runtime, runs as node, and leaves RPC loopback-only. The underlying npm package still has the vector SDK until CBM-05. The old default image is not yet removed.

CI builds the native target using the resolved immutable Node 22.23.4 base digest, prints image identity and size, and executes the existing compiled projection/mutation/recovery/worktree/cancellation scenarios under Docker `--network none`. Only the source-evidence checkout is mounted read-only; each test creates its own local fixture. This is not a deployment of an operator's private host tree, nor a release signature or Bifröst provider-wire certificate. Host and Docker native tests passed at #375, including deadline, restart and non-Git edits. See the [container job](https://github.com/chris-madsen/Hybrid-RAG/runs/139407146480).

## Local reproduction

With a clean source checkout, Node 22.23.4, Docker and an approved base digest:

```sh
npm ci
npm run build
docker build --target native-cbm --build-arg "ACE_NODE_IMAGE=$ACE_NODE_IMAGE" -f Dockerfile.ace -t ace-native-local .
docker run --rm --network none --entrypoint codebase-memory-mcp ace-native-local --version
```

Run the `native-container` CI steps or the same commands locally for actual projection evidence. The image does not authorize any external LLM route.

## Remaining deployment decisions

The accepted host-worktree helper contract deliberately avoids mounting the live host workspace inside a pod. Native mode currently rejects the remote helper because CBM needs access to the exact local workspace. Do not bypass mTLS or create a private-source shadow copy. Investigate colocating ACE/CBM and Bifröst on the authorized source host versus extending the existing authenticated host boundary to invoke pinned CBM there. This requires an actual topology decision and real tests. The current native container target is local-workspace-only.

PR #376 replaces Harbor's vector bundle with pinned native CBM, schema v2 and byte-bound task images; the three task containers passed actual network-isolated projection/mutation at head `81831723cba7bb6e090be245ef6e291019bd432c` ([job](https://github.com/chris-madsen/Hybrid-RAG/runs/139410524225)). Final regression at the corrected head is required before merge. This is not actual Hermes task or G11 acceptance. No claim that this first image slice completes CBM-03 or CBM-05.

## Actual-source development scale observations

The scale scenario reuses the compiled RPC E2E runner with a Git archive of the exact built ACE `src` tree, a frozen set of four symbol/behavior queries and 20 warm observations, plus a new source symbol refresh. It records the corpus tree/commit, native index and startup durations, p50/p95, refresh, misses, cgroup memory peak/CPU and isolated native-home disk bytes. This container measurement includes the runner and any native background processes, not just ACE RSS. Missing counters are unknown, not zero. The scenario does not certify an external RepoBench-R holdout or supply the owner-approved resource budget required by [resource budget evidence](resource-budget-evidence.md).
