# Native CBM container integration (CBM-03 partial)

Date: 2026-11-25. Scope: local code-only, zero model egress. Source baseline `1954013df800dba04f0a4c6eecbdb3105e2260c7` (stacked CBM work). The external LSP research decision remains open (#364); no LSP contract or dependency is removed.

## Deployment boundary

The existing `Dockerfile.ace` now shares one verified runtime base between an explicitly selected `native-cbm` target and the historical vector target. The native image installs the pinned upstream CBM 0.12.1 package and Git; no embedding Python environment or model cache is installed. It uses the existing compiled runtime, runs as node, and leaves RPC loopback-only. The underlying npm package still has the vector SDK until CBM-05. The old default image is not yet removed.

CI builds the native target using the resolved immutable Node 22.23.4 base digest, prints image identity and size, and executes the existing compiled projection/mutation/recovery/worktree/cancellation scenarios under Docker `--network none`. Only the source-evidence checkout is mounted read-only; each test creates its own local fixture. This is not a deployment of an operator's private host tree, nor a release signature or Bifröst provider-wire certificate. Actual CI results must be inspected before claiming success.

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

Harbor's existing runtime builder and probes still install/probe the vector stack. Migrate their single runtime bundle to the pinned native binary, preserve source-bound bundle provenance and task image identity, and run zero-egress container/task acceptance before live G11/Harbor trials. No claim that this first image slice completes CBM-03 or CBM-05.
