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
npm run gate:retrieval-quality -- <holdout.json> <native-run.json> <absolute-policy.json> <output.json>
```

Retain the actual request-bound trace and terminal receipts. Do not substitute mock ranks or label a development corpus release-grade. Historical embedding/reranker reports remain immutable evidence at their recorded commits; their executable selection gates were retired.

Harbor four-arm validation receives repository IDs through
`ACE_HARBOR_REPOSITORY_IDS`, for example `repo-a,repo-b`. Final multi-repository Harbor jobs and task environments belong to the external evidence workspace.
