# ACE plan-refinement evidence checklist

This checklist improves semantic review; it is **not** a second source of requirements, acceptance or task status.

## Architecture / feasibility
- Trace ingress, authentication, context projection, policy and final physical provider send. Include retries, mutations, stream cancellation, raw-body alternatives and zero-send on fail-closed paths.
- Check pinned Bifröst/upstream source, hook order, version, license and provider-native support. A mandatory unknown feasibility prerequisite should be tested before dependent implementation.
- Verify security, concurrency/crash, Effect orchestration, immutable domain transitions, TypeSpec wire and compatibility decisions. UNKNOWN is not an observed defect.

## Existing/upstream reuse
- Search current modules and named maintained library/provider primitives before proposing a new adapter, parser, retry loop, state machine or proxy.
- Record exact version, file/function, tests, behavior, license, suitability, cost of wrapping/porting and deprecated-code removal. A wrapper that retains the shadow old path is not replacement.

## Canonical vertical plan
- All spec IDs map to an owning G02 row, a canonical DAG task, an executable phase and positive/negative deterministic oracles.
- Check missing/cyclic/excessive dependencies, phases containing multiple incompatible trust boundaries, delayed feasibility and realistic source/test/other added+deleted LOC.
- New phases need vertical observable outcomes, not just horizontal "write types/tests" tasks.

## Executability / proof
- Identify confirmed paths/functions and proposed files separately. Give RED command + expected failure and GREEN command + expected success.
- Specify require/ensure/invariant/frame/exceptional outcomes; rollback/STOP, policy denial, replay/races/secret failure and real-provider/agent/Harbor conditions.
- Never promote mocks, a pinned library, generated SDK or test harness to real-provider/E2E certification.

## Cross-artifact and evidence
- Read all OpenSpec scenarios/design/tasks/phases, compare G02 statuses, transport compatibility, AC ownership, task dependencies, signatures and file maps.
- Recompute input hashes when design or specs change; mark descendants STALE. Do not create a second plan tracker.
- Every finding has source path:line@commit and a reproducible oracle or UNKNOWN. Document alternative trade-offs and a justified NO_CHANGE when appropriate.
