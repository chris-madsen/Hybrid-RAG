# V-05 — Security and privacy

**Governing viewpoint:** VP-05 · **Model kinds:** MK-06, MK-09 · **Concerns:** C-02, C-04, C-05, C-10.

## Trust boundaries and control model

| Asset / boundary | Risk | Control / intended invariant | Failure behavior |
| --- | --- | --- | --- |
| Agent → Bifröst → provider | Credential substitution, unexpected model/destination or replay | Hermes owns subscription authentication; Bifröst forwards original bearer; exact configured provider, model, route and destination | Deny unapproved route or policy; no alternate billing fallback |
| Bifröst → ACE context RPC | Unauthorized local request | Authenticated loopback RPC, high-entropy shared credential, workspace binding | Unauthorized or not-ready; no retrieval on an unauthorized request |
| Workspace → retrieval/index | Escape from root, stale or altered source | Canonical path containment, workspace identity, exact source digest/range and coverage validation | Reject or report explicit stale/partial/not-ready result |
| ACE → external documentation/model context | Disclosure of private or secret data | Data-class-specific egress authorization, approved provider/model/destination, secret guard, store:false for the native subscription path | Policy denial; no silent provider substitution |
| Prepared context → actual provider send | Final-body mutation, replay, unauthorized retry | Signed receipt and exact physical-attempt binding; consume authorization once; reauthorize each retry | Fail closed; no send permit inferred from preparation |
| Source/build/release evidence | Secret leakage, compromised workflow or unverifiable artifact | Pinned dependencies/tools, secret scanning, workflow security checks, SBOM/provenance and explicit signature evidence requirements | Report failure or missing evidence; do not claim promotion |

Local service credentials are not provider OAuth credentials. Provider readiness and permitted egress are distinct decisions. Source data classes and destination permissions are not inherited from the presence of a Vertex corpus or working vector index.

## Controls and evidence

- [ADR-007](../../references/ADR-007-security-failure-policy.md) and [ADR-021](../../references/ADR-021-bifrost-single-gateway-ace-context-service.md) provide decision rationale.
- [Policy model](../../../src/domain/policy.ts), [attempt service](../../../src/application/gateway-attempt-authorization-service.ts), [receipt implementation](../../../src/application/projection-receipt.ts), [data-class tests](../../../test/data-class-policy.contracts.test.ts) and [projection contracts](../../../test/responses-projection-service.contracts.test.ts) describe source/contract controls.
- [Security gates](../../operations/security-gates.md) and [supply-chain evidence](../../operations/supply-chain-release-evidence.md) distinguish actual checks from release requirements.

The listed controls are not a formal threat-model completion or a certification of live provider data handling, regulatory compliance or supply-chain signing. External acceptance and attack/failure observations must retain their own evidence. Correspondences CR-03, CR-05, CR-08 and CR-09 apply.
