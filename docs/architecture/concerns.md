# Stakeholders, perspectives, concerns and aspects

The following are architecture stakeholder roles, not a claim that named people or organizational teams have approved the description. One maintainer can occupy multiple roles. External providers and agents are represented by their integration responsibilities; actual operator, consumer and external assessor feedback remains to be gathered where relevant.

## Stakeholder register

| ID | Stakeholder role | Interest |
| --- | --- | --- |
| SH-01 | Product owner / maintainer | Value, scope, cost, architectural decisions and delivery |
| SH-02 | Coding agent user / integrator | Correct context, autonomy, compatibility, usable failure states |
| SH-03 | Software engineer / architecture reviewer | Maintainability, module boundaries, contracts and change impact |
| SH-04 | Platform operator | Deployment, dependency readiness, recovery and latency |
| SH-05 | Security/privacy reviewer | Data classification, identity, least privilege, source integrity and fail-closed behavior |
| SH-06 | Evaluation / quality engineer | Reproducible correctness, provider attribution and token/cost measurements |
| SH-07 | External technical assessor | Traceability, trustworthy evidence, limitations and supply-chain assurance |

## Stakeholder perspectives

A perspective groups interests across views; it is not itself a view or viewpoint.

| ID | Perspective | Stakeholders | Concerns |
| --- | --- | --- | --- |
| SP-01 | Product value and consumer experience | SH-01, SH-02, SH-06 | C-01, C-02, C-07, C-09 |
| SP-02 | Software structure and integration | SH-02, SH-03, SH-04 | C-01, C-03, C-05, C-06, C-08 |
| SP-03 | Security and operational control | SH-04, SH-05, SH-07 | C-02, C-04, C-05, C-06, C-10, C-11 |
| SP-04 | Evidence and governance | SH-01, SH-03, SH-06, SH-07 | C-07, C-08, C-09, C-10, C-11 |

## Concern register

IDs are stable within this AD; they do not replace OpenSpec requirement IDs.

| ID | Concern / desired outcome | Stakeholders | Priority | Addressed in views |
| --- | --- | --- | --- | --- |
| C-01 | Agent-neutral integration: context delivery does not replace agent reasoning, tools or model transport | SH-01, SH-02, SH-03 | High | V-01, V-02, V-04 |
| C-02 | Exact, fresh and losslessly accessible source context, with honest coverage | SH-02, SH-05 | Critical | V-03, V-04, V-05, V-07 |
| C-03 | Clear domain ownership, maintainable boundaries and contract compatibility | SH-03, SH-04 | High | V-02, V-04, V-08 |
| C-04 | Confidentiality, data-class policy and no unauthorized external transmission | SH-05, SH-04, SH-07 | Critical | V-01, V-03, V-04, V-05 |
| C-05 | Correct request, route, retry, streaming and physical-send identity | SH-02, SH-03, SH-04, SH-05 | Critical | V-01, V-04, V-05, V-07 |
| C-06 | Readiness, resource lifetime, crash recovery and failure isolation | SH-03, SH-04, SH-05 | High | V-02, V-03, V-04, V-06 |
| C-07 | Independently measured retrieval quality and accepted-task token/cost efficiency | SH-01, SH-02, SH-06 | High | V-03, V-07 |
| C-08 | Reuse, architectural evolution and avoidance of redundant providers | SH-01, SH-03 | High | V-02, V-03, V-08 |
| C-09 | Correctness across independent tests and comparable real-agent tasks | SH-01, SH-02, SH-06 | Critical | V-07, V-08 |
| C-10 | Reproducible supply-chain, configuration and operational evidence | SH-04, SH-05, SH-07 | High | V-05, V-06, V-07 |
| C-11 | Reviewable changes, decision traceability and honest readiness claims | SH-01, SH-03, SH-05, SH-07 | High | V-07, V-08 |

## Treatment of previous evaluations and limitations

The [October architecture failure review](../reviews/2026-10-18-architecture-failure-review.md) exposed the gap between typed ports and actual composition; C-06/C-09, V-02/V-07 and CR-06 address it. The [November independent audit](../reviews/2026-11-19-astra-independent-audit.md) prioritized one complete Hermes task, source freshness, publication/archive integrity and correct usage evidence; C-02/C-05/C-06/C-07 and CR-03 through CR-08 retain these concerns. The [remediation analysis](../reviews/2026-11-20-ace-remediation-engineering-decisions.md) informs side-effect ownership and reuse; the [engine comparison](../reviews/2026-11-20-code-intel-engine-bakeoff.md) is historical, not a current selection oracle. OpenSpec 013/014 own the corresponding acceptance criteria. Earlier defects are not asserted to remain in the current source without revalidation.

Stakeholder interests are represented by roles because ACE is a maintainer-led open-source project, not a separate operational or regulatory organization. Provider maintainers, source/data owners and affected users are represented through the integration, data handling and assurance boundaries in SH-02/SH-04/SH-05; no direct external consultation or approval is claimed. Limited resources and absence of authorized live trial execution in this change prevent a new external-wire, production deployment, independent task economics or regulatory/security assessment. These constraints leave operational and stakeholder validation open, as recorded in the views, correspondence register and [assessment](conformance.md). No concern is removed to manufacture a positive assessment.

## Architecture aspects

An aspect identifies a property of the architecture addressed by one or more views.

| ID | Aspect | Related concerns |
| --- | --- | --- |
| AS-01 | External relationships and responsibility | C-01, C-05 |
| AS-02 | Functional structure, contracts and behavior | C-01, C-03, C-06, C-08 |
| AS-03 | Information, source identity and lifecycle | C-02, C-04, C-06, C-07, C-08 |
| AS-04 | Runtime interaction and resource management | C-01, C-05, C-06 |
| AS-05 | Security, privacy and trust | C-02, C-04, C-05, C-10 |
| AS-06 | Deployment, operations and recoverability | C-06, C-10 |
| AS-07 | Quality, evaluation and assurance | C-02, C-05, C-07, C-09, C-10 |
| AS-08 | Evolution and architecture governance | C-03, C-08, C-09, C-11 |

View IDs and their governing viewpoints are defined in the [viewpoint catalog](viewpoints.md). The [correspondence register](correspondences.md) links concern outcomes to decisions, implementation and verification evidence.
