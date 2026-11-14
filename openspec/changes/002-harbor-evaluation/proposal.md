# Proposal — Harbor evaluation and causal ACE evidence

## Why

ACE performance claims require paired agent tasks with matched model/runtime identity, independent quality checks and real evidence that ACE actually participated in the model-bound path. A token difference without a successful Gateway projection is not attributable to ACE.

## What changes

Use Harbor for reproducible paired tasks. Keep a strong unmodified/native baseline and a matched ACE arm configured through Bifröst Gateway. Preserve exact agent/model/reasoning/task/source identities, failures, provider usage and ACE projection receipts. Evaluate correctness before cost/token claims.

## Non-goals

- claiming savings from retrieval metrics alone;
- forcing trivial ACE use to manufacture attribution;
- treating missing usage as zero;
- requiring one particular coding-agent brand as permanent architecture.
