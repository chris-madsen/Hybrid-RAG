import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (p) => readFileSync(resolve(p), 'utf8');
const skill = read('.agents/skills/ace-plan-refinement/SKILL.md');
const checklist = read('.agents/skills/ace-plan-refinement/references/review-checklist.md');
const contract = read('.agents/skills/ace-plan-refinement/references/synthesis-contract.md');

test('same first-party skill is routed at shared-input preparation and post-X synthesis', () => {
  assert.match(skill, /^name: ace-plan-refinement$/mu);
  assert.match(read('.codex/skills/ace-plan-refinement/SKILL.md'), /\.agents\/skills\/ace-plan-refinement\/SKILL\.md/u);
  assert.match(read('.agents/skills/ace-plan-refinement/agents/openai.yaml'), /allow_implicit_invocation:\s*false/u);
  for (const p of [
    '.agents/skills/ace-sdlc/SKILL.md', '.agents/skills/ace-stage-handoff/SKILL.md',
    '.agents/skills/ace-phase-plan/SKILL.md', 'docs/operations/staged-sdlc-pipeline.md',
    'docs/operations/ai-assisted-sdlc.md',
  ]) assert.match(read(p), /ace-plan-refinement/u, p);
  assert.match(skill, /PREPARE after R\/S/iu);
  assert.match(skill, /SYNTHESIZE after B/iu);
  assert.match(skill, /not.*a sixth stage/iu);
});

test('independent free and skills candidates use the same pinned inputs, without model context leakage', () => {
  assert.match(skill, /A — Free Planning/u);
  assert.match(skill, /B — Skills Planning/u);
  assert.match(skill, /two sessions \*\*sequentially\*\*/u);
  assert.match(skill, /Two passes in one continuing model context are NOT independent/u);
  assert.match(skill, /same neutral bundle/u);
  assert.match(skill, /Freeze A with an exact artifact digest/u);
  assert.match(skill, /Freeze B's exact Git blob\/tree identities/u);
  assert.match(skill, /INDEPENDENCE_NOT_ATTESTED/u);
  assert.match(skill, /Skill invocation: NOT_OBSERVED/u);
  assert.match(skill, /No candidate, no false merge/u);
  assert.match(contract, /same neutral input fingerprint/u);
});

test('synthesis merges semantic decisions with evidence and permits a third option or no change', () => {
  for (const name of ['ace-architecture-design', 'codebase-design', 'ace-to-tickets', 'ace-phase-plan', 'ace-stage-handoff']) {
    assert.ok(skill.includes(name), name);
  }
  for (const term of ['Architecture/feasibility', 'Reuse and deletion', 'Slices and ordering', 'Executable briefs', 'Cross-artifact consistency']) {
    assert.ok(skill.includes(term), term);
  }
  for (const term of ['HYBRID', 'THIRD', 'UNRESOLVED', 'NO_CHANGE', 'RED', 'GREEN', 'Bifröst', 'TypeSpec', 'Effect', 'Harbor']) {
    assert.ok(skill.includes(term) || contract.includes(term) || checklist.includes(term), term);
  }
  assert.match(skill, /not file merge/iu);
  assert.match(skill, /both may share a wrong assumption/iu);
  assert.match(skill, /Decision ID \| affected ACs/u);
});

test('only one canonical OpenSpec plan survives; owner gates and reconciliation cannot be bypassed', () => {
  assert.match(skill, /one canonical OpenSpec/u);
  assert.match(skill, /one tasks\.md/u);
  assert.match(skill, /ST[A]LE/u);
  assert.match(skill, /G02/u);
  assert.match(skill, /OWNER_DECISION/u);
  assert.match(skill, /path:line@SHA/u);
  assert.match(skill, /No evidence means UNKNOWN|distinguish proven defect, plausible risk and UNKNOWN/iu);
  assert.match(skill, /not an independent human review/u);
  assert.match(skill, /one bounded critique and correction\/recheck/u);
  assert.match(skill, /openspec validate --all --strict --no-interactive/u);
  assert.match(skill, /npm run check:sdd-prepare/u);
  assert.match(skill, /npm run check:ace-phase-plan/u);
  assert.match(skill, /for every linked phase/u);
  assert.match(skill, /Do not auto-merge/u);
});

test('T0 stays lightweight and T1 dual-plan generation is not mandatory', () => {
  assert.match(skill, /For T0 do not run dual planning/u);
  assert.match(skill, /for T1 use it only if explicitly requested/u);
  assert.match(read('docs/operations/staged-sdlc-pipeline.md'), /T2.*dual-plan/iu);
});
