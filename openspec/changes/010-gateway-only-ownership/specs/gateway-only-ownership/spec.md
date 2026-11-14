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

### Requirement: Request-bound host identity

For a supported request the plugin SHALL bind ACE projection to Bifröst's actual request ID, resolved coding-harness session ID, configured workspace, exact inbound body digest and provider/model identity.

#### Scenario: missing Bifröst session or request ID
- **WHEN** Bifröst cannot establish request or session identity
- **THEN** projection returns a fail-closed error
- **AND** no provider attempt is authorized by ACE.

#### Scenario: legacy transcript field interpretation
- **WHEN** Gateway v1 emits `durableActiveTranscriptRevision` and `durableActiveTranscriptDigest`
- **THEN** on the Gateway-only Bifröst path they identify the exact Bifröst-visible request snapshot
- **AND** they do not assert access to the coding agent's private durable transcript store.

### Requirement: Protected additive projection

The currently certified Chat projection SHALL preserve the original provider body except for exactly one ACE verified-evidence system message.

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

### Requirement: Honest evidence stages

Repository structural/process closure SHALL remain distinct from real provider and agent acceptance.

#### Scenario: structural closure passes without external E2E
- **WHEN** SDLC/architecture gates and native plugin compilation pass but real agent/provider G11 evidence was not run
- **THEN** structural/process status may be PASS
- **AND** provider/agent E2E remains explicitly NOT-RUN rather than inferred.
