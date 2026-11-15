# ACE SDLC conformance and security rollout plan

- **Date:** 2026-11-15
- **Status:** Active execution plan; no scanner rollout or source-conformance completion is claimed here.
- **Audit basis:** [`docs/reviews/2026-11-15-ace-main-sdlc-conformance-review.md`](../reviews/2026-11-15-ace-main-sdlc-conformance-review.md), immutable source audit at `main@6413e7d6e6c483c6d28525151038914ac943874e`.
- **Plan owner:** ACE repository owner.
- **Governing process:** [`docs/operations/ai-assisted-sdlc.md`](../operations/ai-assisted-sdlc.md) and the complete applicable command in [`docs/research/sdlc/PROMPTS-ACE.md`](../research/sdlc/PROMPTS-ACE.md).

## 1. Purpose and boundaries

Bring the **current first-party ACE codebase** to evidence-backed conformance with accepted architecture, capability contracts, and operational SDLC controls. This is not a claim that every historical change was produced through today's process, and it is not a mandate for a big-bang rewrite or a manual line-by-line reading of every generated or vendored file.

The audit report remains historical evidence for its stated SHA. This plan owns sequencing and future implementation status. Reconcile every task against current code, current `origin/main`, open PRs, accepted ADRs/OpenSpec, and retained evidence before starting it. Plans and old unchecked tasks do not prove implementation state.

**Not covered by this plan:** promotion of any provider or agent route to production; a benchmark savings claim; mandatory GitHub branch protection; generic mutation testing; or creation of another agent runner, issue tracker, or specification authority.

## 2. Owner decisions and fixed constraints

- Keep the repository's **single-agent, client-independent** Research → Design → Plan → Implement process. BUILD / ARCH / SEC / PLAN remain distinct review passes by the same agent, not independent reviewers.
- Preserve the accepted functional DDD model: Event Storming when domain semantics change, immutable ADTs and pure domain functions, with Effect owning I/O and runtime composition. Do not mandate rich OO aggregates or a microservice per bounded context.
- TypeSpec is canonical for new and migrated public/versioned machine contracts; OpenSpec owns behavioral acceptance. The current contract inventory identifies Gateway v1 as the only live public wire surface. Do not regenerate retired agent-tool or Hermes-native delivery contracts, internal provider DTOs, or business decisions.
- Bifröst and the ACE Gateway Projection API remain the sole agent-facing context route. Real final-provider egress and production claims remain separate owner-controlled G11 gates.
- **No branch protection, required status checks, or mandatory PR approvals.** A failing CI job is visible evidence and must be reported honestly; it does not automatically prevent merge. Release readiness may still remain blocked by an unresolved applicable security risk.
- Keep the bounded PR loop separate from the full/nightly scope: use `npm run verify:pr` and affected checks for PRs; `npm run verify:full` is nightly or explicitly requested. Do not run the full provider suite for every documentation/configuration/source change, and do not silently promote a report-only check to a merge requirement.
- The owner approved the proposed Dependabot, Checkov, ZAP, conditional single image-scanner, and ACE-specific security work **as separate focused PRs**. Approval of the plan is not evidence that any tool is installed or has passed.
- Ragas is an **optional offline experiment**, not an SDLC, retrieval, Harbor, or release acceptance requirement.
- The curated Matt Pocock skill implementation is already tracked in **PR #252**. Do not open a duplicate vendor PR. At this plan snapshot #252 is open and proposes seven selected skills plus the required `grilling` dependency, pinned to v1.3.2, with an ACE compatibility overlay and OpenSpec change. Verify its exact current head and checks before claiming skills are installed or accepted.
- ZAP passive/safe scanning may be scheduled only against a disposable synthetic Gateway. Active scans are manual/explicitly dispatched, require an approved disposable target and allowlist, and must not reach production, a user's local service, or an external model provider. Do not create a recurring active-scan schedule until a safe pilot is observed and the owner separately approves that cadence.

## 3. Evidence baseline and status reconciliation

- The audit's CodeQL failure is bound to `6413e7d6e6c483c6d28525151038914ac943874e`. The current main observed while preparing this plan is `7f3fc5a0a91e48e9d2573f814dfae96d68415577`; no CodeQL result at that SHA was observed. Therefore the audited failure is historical evidence, while current-main CodeQL status is **UNKNOWN until rerun**—not presumed red or green.
- Reuse [`docs/plans/2026-11-15-sdlc-qg6-depth.md`](2026-11-15-sdlc-qg6-depth.md), especially QG6-01 and QG6-07, for the CodeQL task. Do not duplicate the report's P0-A and P0-SEC-A rows as separate fixes.
- The governing adoption plan already records a real T1 trial in PR #223 and a real T2/G02 trial in PR #246 (AC-SDLC-06..08). The T2 PR merged at `7c9178ddbfff09ee02f328b61356bdc6fc54b995`; PR #246 explicitly records that it was ready for code review, not production certified. Reconcile those retained artifacts; do not require a duplicate T2 trial merely because the audit table omitted them. Provider/agent G11 remains separate.
- PR #252 is the active skills-import workstream. Its source/skill verification and OpenSpec acceptance must be read back at the exact merged head; the audit's statement that skills were absent remains true only for its historical audited SHA.
- [`docs/research/sdlc/TYPESPEC-CODEGEN-COVERAGE.md`](../research/sdlc/TYPESPEC-CODEGEN-COVERAGE.md) records that Gateway v1 is the only live public contract root and the retired delivery planes are N/A. Do not create a migration task for retired transports or internal contracts. Recheck the inventory only when a new public interface is proposed.

## 4. Scope ledger and completion vocabulary

Create a source-linked ledger at a freshly recorded `origin/main` SHA. Enumerate and classify every tracked first-party area that can affect product behavior, security, developer workflow, or reproducibility:

- runtime/domain/application/adapters/transports across TypeScript, Go, Python, and native code;
- tests, fixtures, and benchmark harnesses that define an acceptance oracle;
- scripts, build/package manifests, lockfiles, CI workflows, deployment/IaC, and release tooling;
- TypeSpec source, generator configuration, generated contract artifacts, and compatibility checks;
- normative architecture, security, and operational instructions that can direct implementation.

No first-party tracked path may remain unassigned. Each row records path or justified file family, owner/bounded context, runtime or process role, public-contract/provider/security relevance, applicable ADR/OpenSpec contract, current tests/gates, evidence SHA, status, risk, and next action or explicit exclusion reason. Keep archived reviews and historical benchmark artifacts discoverable as evidence, not as current implementation instructions.

Classify special material rather than treating all bytes alike:

- **Generated files:** record the generator/source, verify deterministic regeneration and drift; do not manually re-review mechanical output line by line as domain logic.
- **Vendored/upstream files:** record exact upstream commit, license/provenance and local boundary; do not claim ACE owns or has semantically reimplemented upstream behavior.
- **Fixtures/test data:** identify the invariant/oracle they exercise and verify they cannot be mistaken for production behavior or secret-bearing samples.
- **Normative docs versus archives:** mark current authority and superseded material explicitly; preserve historical evidence.

Use distinct statuses: `UNASSESSED`, `MAPPED`, `STATIC_VERIFIED`, `BEHAVIOR_VERIFIED`, `PROVIDER_VERIFIED`, `BLOCKED`, `UNKNOWN`, and `NOT_APPLICABLE` with a reason. Not every file needs every evidence stage. An inventory count alone is not semantic conformance. No `FULLY_VERIFIED` or production-ready claim is allowed while any required scope or gate is `UNKNOWN`, `BLOCKED`, or `NOT-RUN`.

Deep semantic review is risk-based: prioritize authorization/data egress, source freshness/completeness, cross-workspace isolation, persistence/recovery, concurrency, public contracts, and provider boundaries. Fix only confirmed violations in small RED/GREEN slices; retain a negative diff showing superseded owners/paths were removed. Do not infer compliance from syntax rules, a green compiler, mocks, or historical process evidence.

## 5. Dependency-ordered work

These are plan tasks, not completed changes. Each implementation task gets a focused branch/PR, explicit acceptance IDs, one RED/GREEN or negative/positive oracle where practical, four separate review passes, exact source/tested SHA, and truthful `PASS / FAIL / UNKNOWN / NOT-RUN / N/A` evidence.

| ID | Order / dependency | Scope and acceptance |
|---|---|---|
| **ACE-BASE-01** | First; before each slice | Refresh `origin/main`, remote branches and open PRs. Reconcile every relevant review finding against current source and retained evidence. Record the exact baseline SHA; do not carry forward an old plan-marked status as a current fact. |
| **ACE-QG6-01** | After ACE-BASE-01; existing QG6 plan | Execute QG6-01/QG6-07 on current main. Individually disposition current CodeQL findings with source/entrypoint, attacker control, trust boundary and test oracle. Preserve the historical `6413e7d` result. Add a `push` run for `main` so default-branch CodeQL alerts can be observed, while retaining path-scoped PR and scheduled/manual scopes; this is not branch protection. Keep failures visible and do not disable the security-extended query set or apply broad suppressions. |
| **ACE-PROC-01** | Reconcile existing evidence; no duplicate dogfood by default | Read AC-SDLC-06..08, PR #223 and #246 artifacts at exact SHAs. Keep the existing T1/T2 process evidence if all acceptance mapping, RED/GREEN, four reviews and owner-decision evidence remain valid. Open a new T1/T2 trial only for a specific missing artifact or a changed process requirement. G11 provider certification is not part of this task. |
| **ACE-SCOPE-01** | After baseline reconciliation | Build and review the complete first-party scope ledger from §4. Acceptance: every tracked relevant path is mapped or has an explicit exclusion; unknown scope is visible; high-risk areas have named reviewers/oracles; generated, vendored, fixtures, and archives use their specific classification rules. |
| **ACE-CONF-01** | After ACE-SCOPE-01 | Convert confirmed findings into small, prioritized implementation PRs using the governing ADR/OpenSpec and named maintained upstream/provider primitives. Add the cheapest regression at the existing test owner. Remove superseded algorithms/owners and cite retained provider evidence. Do not perform a broad “architecture cleanup” without a confirmed invariant violation. |
| **ACE-SKILL-01** | Existing PR #252; do not duplicate | Reconcile the selected seven skills plus `grilling` dependency, pin, MIT notice, compatibility overlay, OpenSpec change and walkthrough against PR #252's current head. Mark installed only after merge and exact-path/source/CI readback. No setup scripts, second tracker, or multi-agent `implement-spec` activation. |
| **ACE-TYPE-01** | No new migration until a new live public contract exists | Keep TypeSpec Gateway v1 as the current authoritative public contract. For any proposed new public/versioned surface, inventory owner/consumers, add TypeSpec source and generated drift/compatibility/mapping tests, then remove duplicate authority only after compatibility proof. Retired planes and internal provider/domain DTOs are not migration targets. |
| **ACE-SEC-01** | Separate PR; inspect current manifests first | Add Dependabot only for actual supported repository ecosystems/directories. Weekly grouped version updates, security updates prioritized, no auto-merge. Validate configuration and observe a representative bot PR through normal focused checks. Repository-level alert settings must be read back separately. |
| **ACE-SEC-02** | Separate PR; changed IaC scope | Add a pinned Checkov invocation for actual k3s YAML, rendered Helm output and in-scope Dockerfiles. Include one intentionally unsafe and one compliant fixture; prove the scanner consumes rendered resources. Start full nightly output report-only; triage findings. A red job is not a merge prohibition under current owner policy. |
| **ACE-SEC-03** | Separate PR; disposable Gateway required | Drive ZAP from the generated TypeSpec OpenAPI contract against an isolated Gateway with fake Bifröst/provider endpoints and synthetic data. Safe/passive scan may run nightly in that environment. Active API scan is manual/explicitly dispatched with target allowlist, authorization, rate/time limits and cleanup evidence. Never run it against production, a user-local host, real provider URLs, or a mutating endpoint without a harmless stub. |
| **ACE-SEC-04** | Separate release-supply-chain PR; conditional | First inspect `release:preflight` and existing image scanning. If the actual built image digest has no vulnerability coverage, pilot exactly one pinned scanner (Trivy or Grype) with a vulnerable synthetic fixture and stale-feed failure semantics. Reuse SBOM/provenance; do not add a duplicate scanner. |
| **ACE-SEC-05** | Separate PR or focused existing-suite additions | Extend existing security/DbC tests only for uncovered ACE threats: injected repository instructions, denied egress/secrets, cross-workspace contamination, stale/mismatched source evidence, provider failure, replay/fallback authorization and path/route edge cases. Prove forbidden side effects did not occur; scanner PASS alone is insufficient. |
| **ACE-G11-01** | Separate owner-controlled capability/release gate | Keep final Bifröst → Gateway → final provider byte/receipt evidence, real-agent behavior, retry/streaming and external credentials outside SDLC adoption. Run only with destination-specific authorization and approved environment; report `NOT-RUN`/`BLOCKED` until actually evidenced. No production or benchmark promotion from this plan. |
| **ACE-RAGAS-01** | Optional; only if separately useful | A reproducible offline synthetic/public-corpus Ragas experiment may be proposed. It is not required for SDLC closure, source conformance, Harbor task success, provider acceptance, or release. |

## 6. Gate cadence and merge semantics

| Cadence | Scope | Status meaning |
|---|---|---|
| Focused PR | `npm run verify:pr`, affected deterministic tests, changed Markdown links, secret scan, changed-workflow analysis, applicable changed-IaC scan after installation | A workflow may fail and must be investigated; no branch protection or required-check setting is created. Unselected provider/full-suite tests are listed as not run. |
| Nightly / manual | `npm run verify:full`, scheduled CodeQL/OSV/Knip and full applicable Checkov; safe/passive ZAP only against the disposable service | Keep tool errors distinct from successful empty results. Retain reports, exact SHA, tool version, input digest, runtime and triage. |
| Explicit owner-triggered | Active ZAP pilot, real provider/agent E2E, k3s/Vertex/Graphiti/Harbor/release scope | Require authorization, exact target/provider identity, permission at send time and retained artifact. Do not silently convert this into a nightly job. |

No test or scan is promoted from report-only to release-blocking without an owner-approved criterion, positive/negative fixture, noise/runtime assessment and exact documented disposition. “Blocks PR” must not be used to imply GitHub prevents merging. Use “workflow failed,” “owner review required,” or “release gate not satisfied,” as applicable.

## 7. Completion criteria and reporting

The **current-source conformance** work is complete only when:

1. the §4 ledger covers all first-party tracked scope with no unassigned relevant paths;
2. each risk-relevant component has source-linked static and applicable behavioral evidence, while provider/E2E status remains separately `PASS`, `FAIL`, `NOT-RUN`, `UNKNOWN`, or `N/A`;
3. confirmed high-impact findings are repaired with regression evidence or remain explicitly blocked/owner-accepted for a named scope and expiry;
4. approved security-tool PRs have actual positive/negative fixtures, current-SHA checks and verified artifacts; proposed tools are not counted as installed;
5. existing T1/T2 SDLC evidence is reconciled without claiming retroactive process compliance;
6. G11, benchmark economics, and release approval remain separate and are not implicitly promoted.

Every progress/completion report states changed scope, invariant, exact commands and results, SHA, open PR/check state, provider/agent evidence obtained or not run, limitations, and remaining blockers. `npm run check:sdlc-closure` can support structural/process closure only; it cannot certify provider bytes, real-agent behavior, or benchmark economics.
