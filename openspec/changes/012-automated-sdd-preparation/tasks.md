# Tasks

## 1. Define the one-agent planning entrypoint

- [x] 1.1 Add ace-sdd-prepare and explicit ace-sdlc routing; cover SDD-001, SDD-002, SDD-003, SDD-006, SDD-007 with a source-level regression test.
- [x] 1.2 Keep vendored Matt files byte-unchanged, preserve existing authority and one-agent policy; ensure no extra tracker or runner.
- [x] 1.3 Keep plan-only completion separate from the existing openspec-apply-change/implementation path.

## 2. Structural validation

- [x] 2.1 Add npm run check:sdd-prepare with T1/T2, OpenSpec change selection, path safety and honest review-only output; SDD-004, SDD-005, SDD-008.
- [x] 2.2 Add positive/negative isolated fixtures including missing artifacts, duplicate IDs, omitted design/task IDs, malformed T2 crosswalk, BLOCKED decisions and path traversal; run npm run test:sdd-prepare.
- [x] 2.3 Include focused check in existing verify:pr and verify:full without new dependencies.

## 3. Evidence and handoff

- [x] 3.1 Update canonical SDLC docs with invocation and planning boundary.
- [ ] 3.2 Run pinned strict OpenSpec and scoped PR CI on the exact PR SHA; record actual results.
- [ ] 3.3 Perform a separate live Hermes preparation trial (real skill invocation and resume). Until observed: NOT-RUN, never PASS.
- [ ] 3.4 Owner reviews G02 and decides any subsequent implementation separately.
