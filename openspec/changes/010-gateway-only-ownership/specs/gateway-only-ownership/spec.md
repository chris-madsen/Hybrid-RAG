# gateway-only-ownership specification

## ADDED Requirements

### Requirement: Sole agent-facing delivery path

ACE context SHALL reach participating coding agents only through automatic Bifröst Gateway projection. A model-invoked ACE tool transport or native agent-specific ACE context bridge SHALL NOT be an alternative or fallback delivery path.

#### Scenario: missing Gateway projection
- **WHEN** a supported model request has no valid ACE APPLY receipt
- **THEN** the provider attempt is blocked
- **AND** the request is not silently forwarded through another ACE path.

### Requirement: Authenticated local projection

The ACE projection HTTP endpoint SHALL bind only to loopback and SHALL authenticate the Bifröst connector process using an out-of-band credential.

#### Scenario: missing or wrong projection credential
- **WHEN** the projection service has no configured shared secret or the caller presents the wrong secret
- **THEN** projection is unavailable or unauthorized
- **AND** private request/source context is not returned.

### Requirement: Request-bound physical identity and session correlation

For a supported request the plugin SHALL bind ACE projection to a fresh server-minted physical
request ID, normalized coding-harness session correlation, configured workspace, exact inbound
body digest and provider/model identity. Caller-supplied request/session headers SHALL NOT be
treated as authenticated identity.

#### Scenario: transport hook precedes Bifröst Core context population
- **WHEN** the post-auth HTTP transport hook runs before `ConvertToBifrostContext`
- **THEN** the plugin SHALL mint its physical request ID without depending on `BifrostContextKeyRequestID`
- **AND** SHALL resolve session correlation from the supported request headers
- **AND** PreLLM SHALL later cross-check that correlation against Bifröst Core's resolved session.

#### Scenario: missing session correlation or physical-ID entropy
- **WHEN** no valid supported coding-harness session correlation exists or the plugin cannot mint its physical request ID
- **THEN** projection returns a fail-closed error
- **AND** no provider attempt is authorized by ACE.

#### Scenario: Bifröst has no coding-host transcript proof
- **WHEN** Gateway v2 binds durable-transcript fields but Bifröst observed only the provider-compatible HTTP request
- **THEN** the connector sets `hostTranscriptAttested=false` and `hostCompactionEpoch="unknown"`
- **AND** any request digest/revision marker is non-authoritative for the coding agent's durable transcript
- **AND** ACE SHALL NOT infer exclusive host-context or no-compaction ownership from those fields.

#### Scenario: additive delivery with unattested host history
- **WHEN** the exact Bifröst-visible Responses request is bound, provider-managed history is visible, and host transcript state is explicitly unattested
- **THEN** Gateway MAY add the verified ACE evidence message
- **AND** the receipt preserves the unknown host-compaction state
- **AND** no token-savings or exclusive-context claim is implied.

#### Scenario: strict host ownership claim
- **WHEN** a trusted host-side attestor sets `hostTranscriptAttested=true`
- **THEN** active compaction or an unknown compaction epoch blocks the request
- **AND** only separately retained G11/benchmark evidence may support an exclusive-context claim.

### Requirement: Destination authorization before private-source projection

Gateway SHALL know and authorize the exact LLM provider before retrieving or injecting private source context. Automatic provider routing SHALL NOT satisfy this requirement.

#### Scenario: provider is not explicitly identified
- **WHEN** a Gateway Responses request uses an unprefixed model whose provider would be selected later
- **THEN** the connector rejects the request
- **AND** ACE does not retrieve private source evidence for that request.

#### Scenario: provider or cloud data class is not authorized
- **WHEN** the explicit provider is absent from the configured Gateway provider allowlist, cloud opt-in is false, or `private_source` is denied by project policy
- **THEN** Gateway returns a BLOCK decision before retrieval
- **AND** no private ACE context is appended.

#### Scenario: caller declares a lower data class
- **WHEN** the request declares `public` or another class that is less restrictive than the repository code ACE will retrieve
- **THEN** Gateway still authorizes `private_source` for the retrieved evidence
- **AND** the caller declaration cannot downgrade repository evidence classification.

#### Scenario: selected context contains likely secret material
- **WHEN** retrieved context matches the repository secret-content guard
- **THEN** Gateway blocks before constructing the provider-bound projected body.

#### Scenario: original agent request contains likely secret material
- **WHEN** the Bifröst-visible provider request already contains likely secret material
- **THEN** Gateway blocks before retrieval
- **AND** the secret-bearing request is not authorized for external LLM egress by ACE.

#### Scenario: request references hidden provider-managed continuation state
- **WHEN** the provider body contains a known continuation/thread identifier such as `previous_response_id`, `conversation`, `conversation_id`, or `thread_id`
- **THEN** Gateway returns `PROVIDER_MANAGED_STATE_UNKNOWN` before retrieval
- **AND** the connector does not claim that the full context is visible.

### Requirement: Protected additive projection

The native Responses projection SHALL preserve the original provider body except for exactly one ACE verified-evidence developer item.

#### Scenario: protected field mutation
- **WHEN** a projected body changes the model, tools, stream setting, unknown field, or any original message
- **THEN** the connector rejects the projection
- **AND** no provider attempt is authorized.

### Requirement: Provider attempt binding

The first normalized Bifröst provider attempt SHALL match the ACE-authorized normalized model, explicit provider when present, and inserted context. A fallback or repeated attempt SHALL NOT reuse the original admission.

#### Scenario: provider or model drift
- **WHEN** the normalized provider attempt selects a different explicitly requested provider or model
- **THEN** PreLLM short-circuits with fallbacks disabled.

#### Scenario: retry or fallback
- **WHEN** PreLLM is invoked again for the same ingress projection
- **THEN** the attempt is blocked pending fresh ACE authorization.

### Requirement: Terminal custom provider guard

A production-certified Bifröst deployment SHALL place the ACE plugin after every other custom
plugin that can mutate the provider-bound request. Repository compile/contract checks SHALL NOT
be treated as proof of live plugin ordering or final upstream bytes.

#### Scenario: later custom mutator is not ruled out
- **WHEN** the loaded Bifröst plugin order and final provider wire have not been observed
- **THEN** structural Gateway checks may pass
- **AND** final provider-wire G11 remains `NOT-RUN` or fails
- **AND** no claim is made that ACE was the last mutating hook.

### Requirement: Honest evidence stages

Repository structural/process closure SHALL remain distinct from real provider and agent acceptance.

#### Scenario: structural closure passes without external E2E
- **WHEN** SDLC/architecture gates and native plugin compilation pass but real agent/provider G11 evidence was not run
- **THEN** structural/process status may be PASS
- **AND** provider/agent E2E remains explicitly NOT-RUN rather than inferred.
