# ACE plan-refinement semantic evidence checklist

This is a **decision checklist**, not a new OpenSpec acceptance authority or task tracker. Apply it to **A, B and synthesized C**. Every asserted code fact needs a source path:line@SHA; absent evidence means UNKNOWN.

## Architecture / feasibility
- Trace real ingress → authentication → projection → authorization → last physical provider send; include internal retries, mutations, stream cancellation and raw-body paths.
- Check exact pinned Bifröst/upstream source, hook order, models, credentials, license and native support. Put mandatory feasibility probes before dependent implementation, but do not block safe independent no-send preparation.
- Preserve accepted bounded contexts, Effect application boundary, immutable domain rules, TypeSpec public wire and historic compatibility. No hidden extra proxy or unapproved Chat fallback.

## Reuse and replacement
- Inventory existing ACE modules and named maintained library/provider-native primitives before proposing an adapter, parser, retry scheduler, token counter or custom persistence.
- Record version, exact function/test, license, compatibility, reason for reuse/rejection and negative diff deleting superseded code.
- A wrapper with still-reachable shadow behavior is not replacement.

## Vertical slices / prerequisites
- Match every spec scenario to one canonical phase owner and G02/proof crosswalk; allow cross-phase invariants without duplicate ownership.
- Detect DAG cycles, missing edges and unnecessary serialization; separate independent fail-closed work from uncertain external feasibility, and isolate policy/egress risk.
- Forecast added+deleted handwritten code/tests/other (~700–1,200 is flexible), never pad or treat a larger plan as inherently better.

## Executable briefs
- Identify verified existing files/functions versus proposed new ones; use exact RED failure assertion, GREEN pass command, negative cases, typed exceptions, rollback and STOP.
- Cover Meyer require/ensure/invariant/frame/exceptional; provider, agent and Harbor evidence remain separate.
- Never call a mock, pinned library, generated SDK or self-review actual final-wire/provider certification.

## Cross-artifact synthesis
- Compare A and B by **engineering decision**, not by file or paragraph; identify shared incorrect assumptions and allow THIRD/UNRESOLVED.
- Only C is canonical. Reconcile proposal/specs/design/tasks/phases, G02 decisions, TypeSpec versions, dependency edges, files and input fingerprints.
- Return corrections to S/A/P/X owner; mark descendants STALE when upstream changes. A justified NO_CHANGE is valid.
