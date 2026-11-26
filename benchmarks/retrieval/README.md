> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# External retrieval holdouts

Release-grade multi-repository holdouts are evidence artifacts, not ACE source
fixtures. Keep their source specifications, repository checkouts, manifests,
cases, scored runs and reports in an external evidence directory.

The freezer accepts explicit repository mappings and refuses to write its
holdout or manifests inside the ACE checkout:

```bash
npm run freeze:retrieval-holdout -- \
  <external-evidence>/source-spec.json \
  <external-evidence>/frozen/holdout.json \
  <external-evidence>/frozen/manifests \
  repo-a=<external-checkout-a> \
  repo-b=<external-checkout-b>
```

Every checkout must already be at the exact revision declared by the external
source specification. The freezer records deterministic path, size and
SHA-256 entries, derives canonical candidate IDs from repository identity and
source ranges, and refuses to overwrite a frozen holdout.

Use the resulting external holdout with real native CBM projection observations and the generic retrieval evaluator. The release gate accepts only the native_cbm strategy and the pinned native provider identities for the exact ACE source commit. It requires frozen multi-repository labels and an absolute quality policy, not a competing vector strategy or reranker.

```bash
npm run merge:retrieval-runs -- <holdout.json> <external-output-dir> <repo-a-native-run.json> <repo-b-native-run.json>
npm run gate:retrieval-quality -- <holdout.json> <external-output-dir>/native_cbm.json <absolute-policy.json> <external-output.json>
```

Retain the actual request-bound trace and terminal receipts. Do not substitute mock ranks or label a development corpus release-grade. Historical embedding/reranker reports remain immutable evidence at their recorded commits; their executable selection gates were retired.

Harbor four-arm validation receives repository IDs through
`ACE_HARBOR_REPOSITORY_IDS`, for example `repo-a,repo-b`. Final multi-repository Harbor jobs and task environments belong to the external evidence workspace.

Native run merging requires one exact, complete repository partition per run, the same ACE commit/runner identity, the pinned providers, and explicit non-applicability of retired stages. The gate no longer accepts a competing vector baseline. Keep output outside the checkout; it cannot overwrite prior evidence. These validation commands consume observations from the real projection runner; they do not create measurements or certify provider wire behavior.

## Native projection holdout collection

Run each frozen repository on a clean Linux checkout in a dedicated account or network-isolated container, with no unrelated CBM daemon for that account. Use the same pinned compiled ACE commit and native executable for both partitions. The isolation flag is an operator assertion, not a sandbox; do not run against a shared production daemon. Set `ACE_CBM_COMMAND` to the absolute pinned executable and `ACE_CBM_HOLDOUT_ISOLATED=true`. Build from the clean ACE checkout first. The runner does not inherit provider credentials or configure physical-send routes.

```bash
npm run build
npm run run:native-retrieval-holdout -- <holdout.json> <manifest-ace.json> ace <frozen-ace-checkout> <new-external-ace-output-dir>
npm run run:native-retrieval-holdout -- <holdout.json> <manifest-chess.json> chess <frozen-chess-checkout> <new-external-chess-output-dir>
npm run merge:retrieval-runs -- <holdout.json> <new-external-merged-dir> <ace-output>/native-run.json <chess-output>/native-run.json
npm run gate:retrieval-quality -- <holdout.json> <merged-dir>/native_cbm.json <predeclared-absolute-policy.json> <external-quality.json>
```

Use separate isolated daemon sessions for the two runs (or a dedicated canonical cache with a verified clean lifecycle). Never kill a shared daemon. Run results and projected bodies contain potentially private source; directories are created privately and must remain outside Git, with restricted access. Do not publish them to PRs. Each case runs the actual native projection RPC; BLOCK is a miss, a known-reference marker is not newly delivered source. No oracle labels or focus hints are inserted into queries. A working-context case therefore measures stateless projection behavior only. The runner verifies exact source spans against the frozen checkout before retaining evidence. Merge, quality gate and release preflight independently rederive ordered ranks from captured bodies, manifest, trace, runtime projection binding and receipt claims. The production HMAC key remains ephemeral and is not exported; offline replay validates consistency of trusted local evidence rather than independently authenticating a live HMAC signature. Owner-signed release evidence remains required. No actual model egress or agent-task success is claimed.
