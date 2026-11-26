# ACE — Tactical DDD: logical identities, consistency boundaries and invariants

> **Design model, not an implementation inventory.** This document reconciles the original logical design with the native CBM cutover and the single Bifröst boundary. Identifiers, proposed events and logical consistency boundaries do not imply that corresponding classes, tables or public operations exist. The [original record](https://github.com/chris-madsen/Hybrid-RAG/blob/d19b8ac04ce3861ee0b477fd5253c684edb5136f/docs/architecture/03-tactical-ddd.md) remains in Git history. Current implementation and acceptance are described in [current runtime architecture](../operations/current-architecture.md), the accepted ADRs and applicable OpenSpec.

**Modeling policy:** the owner selected functional DDD on 2026-11-05. Use readonly ADTs and pure invariant-preserving functions, with Effect for I/O and lifetime. The names and fields below describe the logical model, not a claim that identically named interfaces exist. See [ADR-019](../references/ADR-019-functional-ddd-typespec-contracts.md) and [Functional DDD + TypeSpec](../research/sdlc/ARCHITECTURE-FUNCTIONAL-DDD-TYPESPEC.md).

## 1. Conventions

An entity retains identity across changes; a value object is immutable and compared by value. An aggregate is a consistency/authorization boundary, not a mutable class or an entire repository/history. Domain functions implement decisions without provider I/O. Ports hide external DTOs. Eventual consistency is permissible only when current-source claims are fenced by verification.

## 2. BC-01 Workspace Truth

Logical Workspace boundary: workspaceId, authorized root, observed Git revision (possibly detached), observation identity, registration time and access scope. Working-tree identity includes uncommitted and relevant untracked files. TrackedFile is a separate observation/projection containing RepoPath, ContentDigest, range/state and observation time; it need not be a synchronous child of a giant aggregate.

Value objects: WorkspaceId, RepoPath, ContentDigest, GitRevision, WorkingTreeVersion, SafeRoot and ObservationTime. Root containment and symlink rules are mandatory. HEAD alone is not current source; removed or replaced paths cannot materialize stale evidence. Do not promise atomic filesystem snapshots. Commands such as RegisterWorkspace, ObserveChanges and DeactivateWorkspace name logical operations, not public API methods.

## 3. BC-02 Code Discovery

The historical IndexGeneration design contained ACE-owned vector generations, embedding profiles and atomic alias publication. That provider-specific design is retired. Native CBM owns its indexing, graph, semantic/lexical retrieval and cache. ACE owns its observed workspace manifest, publication validity and verified source binding, not a second index-generation database.

Logical candidate identity comprises workspace/path, provider identity, source digest, range and ranking evidence. A score is relative relevance, not probability of truth. Distinguish current observation, stale/unavailable provider state and verified source. A same-name collision is not a resolved symbol. Native index lifecycle and ACE observation lifecycle are distinct; provider loss, expiry or invalid source invalidates delivery eligibility. See [CBM provider](../operations/codebase-memory-provider.md).

## 4. BC-03 Semantic Intelligence

SymbolObservation and SemanticRelationObservation are useful logical evidence records: workspace/path, symbol identity, provider/method, digest, range, observation time, relationship kind and certainty. They need not own separate transactions. A static edge or line-level outline is not proof of exact identifier coordinates, full dynamic call coverage or runtime behavior.

Potential evidence classes include static-resolved, static-possible, runtime-observed and unknown. Runtime-observed requires actual appropriate traces/tests. Resolve source identity independently, report unavailable semantics honestly, and do not infer definitions from write accesses or name equality. CBM supplies native structural hints; independent language-service ports remain a separate capability under FR-03/#364, not a dependency of the current code-only route.

## 5. BC-04 Documentation Knowledge

Logical DocumentCorpus boundary: project/corpus identity, allowed data class, access policy and source/version metadata available from the provider. DocumentReference and DocumentCitation identify source URI, version/section and excerpt where supplied; do not fabricate missing checksums or document version information.

Vertex is the selected managed document retrieval adapter. An excerpt is a claim about a document, not automatically a current normative decision. Preserve conflicts with current source as separately attributed evidence. Authorization covers only approved project documents, not arbitrary source or private conversation upload. The current native Responses projection requests code only; combined delivery is target scope.

## 6. BC-05 Engineering Memory

Logical SessionArchive: source system, session/workspace identity, source digest, capture version, archive state and ordered immutable episode references. SessionEpisode preserves exact original content reference, byte digest, source pointer, sequence/time and available role metadata. Existing archive and Codex importer capabilities are distinct from generalized capture across clients.

Logical DecisionRecord: decision/project identity, proposition, status, approval evidence, status timeline, original episode references and optional superseding decision. KnowledgeClaim is a derived assertion with extraction version, provenance and temporal validity; it is not an accepted decision by default.

Value objects include EpisodePointer, OriginalDigest, TimeInterval, DecisionStatus, ClaimConfidence, ApprovalActor and DeletionScope. Preserve old decisions, verify source links and enforce authorized deletion across originals and derived references, without deleting content needed by surviving references. An immutable archive does not override deletion policy.

Graphiti/FalkorDB is the selected target for temporal indexing, not the current active gateway provider. Archive/temporal/extraction ports and authorization must remain independent; ingestion failure must not damage the archive.

## 7. BC-06 Context Orchestration (core)

Logical ContextRequest: request/workspace/session identity, intent, query, routing/coverage obligations, deadline, policy version, outcome, warnings and evidence references. Do not put large source bodies or entire histories inside a transactional root.

RetrievalAttempt describes source, status, timing, result references and failure. EvidenceLink describes candidate/source identity, method, range, digest and uncertainty. BundleSection describes evidence ordering and exact-source access, not an advertised agent-callable expansion API. Completeness is relative to required obligations. Candidate ranks, verified evidence, prepared context and delivery evidence are separate.

ACE's application plans retrieval, verifies and assembles evidence; the current native route requires code. The local TypeSpec v3 contract returns PREPARED or BLOCK. PREPARED binds the original/projected body and source-evidence identity; it is not permission to transmit. See [contracts and deployment](05-contracts-and-deployment.md).

## 8. BC-07 Trust & Policy

Logical ProjectDataPolicy: workspace/policy identity and version, data classes, provider/destination permissions, source scope, retention and cloud opt-in. AccessDecision records principal/operation where available, data class, destination, outcome, reason, policy version and time, without raw sensitive payloads.

The physical attempt binds attempt/request/group/session/workspace identity, actual provider/model/method/destination, final body digest, prepared digest, signed projection receipt and deadline. Verify current policy, consume attempts once, preserve store:false and reject mismatched or unauthorized attempts. Bifröst owns the final transport. ACE does not implement a second OAuth validator.

Policy denial is fail-closed, distinct from technical outage; no unapproved fallback or permission inheritance. Retrieved text cannot change policy.

## 9. BC-08 Evaluation

Logical EvaluationSuite: suite/version, frozen task manifests, holdout identity, rubric and environment/comparator rules. BenchmarkRun: run/task/config identity, base commit, environment fingerprint, state, usage ledger, independent outcome, artifacts and failure/time. UsageSample: provider, event/attempt identity, delta or cumulative counter semantics, input/cached/output/reasoning counts and cost or unknown. ComparisonReport: suite/run identities, metric method, quality gate, statistics, limitations and evidence reference.

Frozen suites change only through a new version. Preserve failed attempts; don't double-count subsets or cumulative snapshots. Unknown is not zero. Separate retrieval measurements from provider usage and accepted-task results.

## 10. Consistency boundaries

| Logical boundary | What it owns | What it cannot make atomic |
|---|---|---|
| Workspace | Identity, access scope, observed source version | Whole filesystem and Git history |
| Native index observation | ACE publication readiness and source binding | CBM internal cache, daemon and filesystem in one transaction |
| SessionArchive | Original episode identity and integrity | External extraction/indexing |
| DecisionRecord | Approval and temporal status | Rewriting original conversation |
| ProjectDataPolicy | Policy version and authorized decision | External provider side effects |
| ContextRequest | Evidence obligations, result and receipt | Entire workspace or provider transaction |
| EvaluationSuite | Frozen task identity and rubric | Execution of a Harbor task |
| BenchmarkRun | Outcome, usage and artifact identity | Host or provider state |

## 11. Cross-boundary invariants

WorkspaceChanged invalidates affected discovery observations; a synchronous source check at materialization/delivery remains necessary. Archive append is independent of derived graph indexing; retries never rewrite originals. External sending requires fresh authorization at the actual attempt boundary. A completed run without reliable usage remains incomplete for token economics. Evidence retrieved from a changed source must be reverified or rejected.

## 12. Avoid false DDD assumptions

Do not split deployments by bounded-context count, introduce event sourcing everywhere, build giant mutable roots, substitute graph hints for runtime knowledge, or create parallel provider implementations. Source access is lossless under ADR-006; relevance-driven projection is not a fixed truncation ceiling. Preserve source/decision authority and typed failures.

## 13. Mapping: Event Storming to ADTs and pure decisions

| Concept | Functional artifact |
|---|---|
| Actor/command | Validated immutable input with explicit authorization context |
| Domain event | Immutable fact only where a consumer/audit needs it |
| Policy | Pure decision/transition function in the owning context |
| Aggregate | Logical state identity/version and invariant-preserving transition |
| Hot spot | Typed error, concurrency case and property/negative test |
| Read model | Derived projection with original-source identity |
| External system | Effect port/adapter with typed failures and cancellation |

Document actual state/command/error ADTs, transitions, persistence boundary and TypeSpec mapping for material changes. Use accepted ADR/OpenSpec for new normative behavior. TypeSpec owns the versioned RPC shape, not domain state or source truth. The original vector-specific aggregate and port proposals remain available in the linked historical record; they are not current implementation instructions.
