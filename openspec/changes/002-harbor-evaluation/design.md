# Design — Harbor paired agent evaluation

## Comparison identity

Harbor owns isolated task execution and retained run evidence. A comparison MUST pin the same coding agent/version where applicable, model/provider/reasoning, task, repository revision, permissions and environment across matched arms.

The baseline runs without ACE model-bound projection. The ACE arm routes the same supported model request through Bifröst with Gateway projection enabled. A Bifröst-passive arm may be added to measure gateway overhead, but it is not ACE-used evidence.

## Causal attribution

An ACE arm counts as ACE-applied only when retained evidence binds the run to a valid Gateway APPLY receipt and the applicable provider attempt. Fewer tokens with no valid ACE projection may be reported as an observed difference but not attributed to ACE.

## Usage and cost

Provider/agent/Harbor exported usage is authoritative when available. Input/output/cached/reasoning subsets are reconciled without double counting. Missing counters remain UNKNOWN. External embedding, documentation, memory-extraction and indexing costs are reported separately where attributable.

## Quality

Task correctness/regression gates are independent of token counts. A cheaper incorrect result is not an accepted task and cannot support the 5× hypothesis.

## Evidence

Retain exact source/task/runtime identities, raw trial artifacts, failures/timeouts, projection/request IDs, provider usage, quality result and limitations. Real-agent/provider evidence is capability-specific G11 and is not inferred from unit tests.
