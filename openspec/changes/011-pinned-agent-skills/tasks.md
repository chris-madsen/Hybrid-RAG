# Tasks

## 1. Vendor and constrain the selected skills

- [x] 1.1 Copy the eight selected/required skill directories from the pinned upstream commit into `.agents/skills/`; verify every destination file's SHA-256 and Git blob against the source manifest, and confirm no other skill or script was added. **Evidence:** 8 directories / 20 files; source and destination bytes match; manifest test passes.
- [x] 1.2 Add the ACE compatibility overlay and route `ace-sdlc` through it; verify the two-round/three-question cap, no-repeat rule, one-agent rule, OpenSpec-only planning, and no-installer/no-tracker restrictions with focused tests. **Evidence:** focused vendor test passes 5/5.

## 2. Demonstrate the request-to-acceptance handoff

- [x] 2.1 Add a factual walkthrough of the current owner request to `SKILL-001`–`SKILL-007`, and update current SDLC docs that say the skills are pending; verify historical review artifacts remain unchanged. **Evidence:** the walkthrough uses the real request; the dated review file is unchanged.
- [x] 2.2 Verify project skill-file discovery without invoking a model; if the installed Codex diagnostic cannot show discovery safely, report that limitation rather than claiming runtime invocation was proven. **Evidence/limit:** file layout and Codex metadata are covered by tests; a local prompt diagnostic showed the `tdd` path/description but not its instruction body. The all-skill diagnostic was blocked before execution and was not retried; no model/provider was invoked.

## 3. Verify and deliver

- [x] 3.1 Run the vendor test and strict OpenSpec validation; run the bounded `npm run verify:pr` gate once and record its exact result. **Evidence:** focused vendor test 5/5; strict OpenSpec 1/1; `npm run verify:pr` exit 0, including typecheck, affected smoke tests (24/24), lint, architecture, SDLC preflight/closure, and the vendor test.
- [ ] 3.2 Create a focused commit, push the task branch, open a PR to `main`, and read back its head SHA, changed-file list, and check states.
