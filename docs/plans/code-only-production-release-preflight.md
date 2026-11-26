# ACE code-only production release preflight

This profile is intentionally narrower than the full unified code + documentation + memory release gate.

A `READY_CODE_ONLY` verdict means only the ACE **code retrieval capability** is approved for the exact commit and deployment named in the evidence. It must never be presented as documentation readiness, memory readiness, full ACE production readiness, or proof of the 5× token-reduction hypothesis.

## Required evidence

The code-only gate requires:

1. PASS on the code-scope DBC set: DBC-01…09, DBC-12 and DBC-13.
2. Pinned native CBM provider identities; the retired embedding and semantic-provider election is no longer a code-only gate.
3. Exact-commit native retrieval quality on `frozen_multi_repository_holdout`, replayed from actual prepared bodies and retained receipts.
4. The independent LSP research is not claimed complete by the native code-only gate.
5. Natural-use Harbor evidence with non-inferior quality, request correlation and complete cost telemetry.
6. Exact-commit code-only resource-budget evidence (`evidence = resource-budget-accepted`) using an owner-approved budget policy.
7. Exact-commit runtime configuration evidence (`evidence = runtime-config-accepted`) proving docs/memory/cloud scope are disabled, native retrieval is pinned and fallback is off.
8. Supply-chain provenance evidence.
9. Exact-commit owner approval whose approved capability set is **exactly** `["code"]` and whose signed provider scope exactly matches the canonical provider/model/runtime identities from the native provider identities.
10. For `deployment: "k3s"`, real k3s live-worktree evidence is also mandatory.

DBC-10/11 belong to memory. DBC-14 requires documentation conflict evidence. They are not silently marked PASS by this profile; they are simply outside this narrower release claim.

## Policy

Example:

```json
{
  "schemaVersion": 2,
  "scope": "code-only",
  "deployment": "host",
  "ownerApproval": {
    "status": "pending",
    "releaseCommit": "<exact git sha>",
    "reference": "<approval record>",
    "approvedCapabilities": ["code"],
    "approvedProviderIdentities": ["<native provider identities>"]
  },
  "ownerApprovalTrustRoot": { "publicKeyPem": "<trusted public key>", "publicKeySha256": "<sha256>" },
  "artifacts": {
    "dbc": "artifacts/release/dbc-evidence.json",
    "retrievalQuality": "/trusted/external/evidence/retrieval-quality.json",
    "harborThreeArm": "artifacts/release/harbor-three-arm.json",
    "resourceBudget": "artifacts/release/resource-budget.json",
    "runtimeConfig": "artifacts/release/runtime-config.json"
  },
  "externalEvidence": [
    {
      "name": "supply-chain",
      "path": "artifacts/release/supply-chain.json"
    }
  ]
}
```

For a k3s deployment add:

```json
{
  "name": "k3s-worktree",
  "path": "artifacts/k3s-worktree/evidence.json"
}
```

## Run

Set `ACE_NATIVE_EVIDENCE_ROOT` to the dedicated external evidence directory containing the frozen holdout, run, absolute policy, capture files and quality verdict. This opt-in reader rejects files outside that directory and the repository, including symlink escapes; existing policy/DBC/semantic readers remain repository-contained. Never commit private benchmark captures. The example approval is pending and cannot authorize release.

```bash
npm run release:preflight-code -- \
  /path/to/code-release-policy.json \
  artifacts/release/code-preflight.json
```

Hard gate:

```bash
ACE_REQUIRE_CODE_RELEASE_READY=true npm run release:preflight-code -- ...
```

The command re-hashes every DBC artifact referenced by the supplied manifest before evaluating readiness.

## Claim boundary

Allowed when the gate is green:

> ACE code retrieval is production-approved for commit X under the host/k3s deployment profile recorded in the retained evidence.

Not allowed from this gate:

- “ACE code + docs + memory is production-ready.”
- “Graphiti/Vertex are production-ready.”
- “ACE saves 5× tokens.”
- any claim for a different commit or deployment target.

For the full product claim use `npm run release:preflight`; that gate remains strictly stronger and is not weakened by this profile.
