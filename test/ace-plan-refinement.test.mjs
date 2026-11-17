import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (p) => readFileSync(resolve(p), 'utf8');
const skill = read('.agents/skills/ace-plan-refinement/SKILL.md');
const checklist = read('.agents/skills/ace-plan-refinement/references/review-checklist.md');

test('new first-party skill is discoverable and routed from X without a new stage', () => {
  assert.match(skill, /^name: ace-plan-refinement$/mu);
  assert.match(read('.codex/skills/ace-plan-refinement/SKILL.md'), /\.agents\/skills\/ace-plan-refinement\/SKILL\.md/u);
  assert.match(read('.agents/skills/ace-plan-refinement/agents/openai.yaml'), /allow_implicit_invocation:\s*false/u);
  for (const p of [
    '.agents/skills/ace-sdlc/SKILL.md', '.agents/skills/ace-stage-handoff/SKILL.md',
    '.agents/skills/ace-phase-plan/SKILL.md', 'docs/operations/staged-sdlc-pipeline.md',
    'docs/operations/ai-assisted-sdlc.md',
  ]) assert.match(read(p), /ace-plan-refinement/u, p);
});

test('refinement covers five semantic axes and reuses existing design and planning skills', () => {
  for (const name of ['ace-architecture-design', 'codebase-design', 'ace-to-tickets', 'ace-phase-plan', 'ace-stage-handoff']) {
    assert.ok(skill.includes(name), name);
  }
  for (const heading of ['Architecture/feasibility', 'Reuse and deletion', 'Slices and ordering', 'Executable briefs', 'Cross-artifact consistency']) {
    assert.ok(skill.includes(heading), heading);
  }
  for (const term of ['Bifröst', 'TypeSpec', 'Effect', 'Harbor', 'RED', 'GREEN', 'source path:line', 'NO_CHANGE']) {
    assert.ok(skill.includes(term) || checklist.includes(term), term);
  }
});

test('refinement cannot silently create new authority or claim unobserved evidence', () => {
  assert.match(skill, /one-agent planning only/u);
  assert.match(skill, /critique first, no edits/u);
  assert.match(skill, /one full critique and one correction\/recheck/u);
  assert.match(skill, /ST[A]LE/u);
  assert.match(skill, /G02/u);
  assert.match(skill, /canonical/u);
  assert.match(skill, /No evidence means UNKNOWN/u);
  assert.match(skill, /Never create another issue queue/u);
  assert.match(skill, /not.*independent human review/iu);
  assert.match(skill, /openspec validate --all --strict --no-interactive/u);
  assert.match(skill, /npm run check:sdd-prepare/u);
  assert.match(skill, /npm run check:ace-phase-plan/u);
  assert.match(skill, /for every linked phase/u);
});
