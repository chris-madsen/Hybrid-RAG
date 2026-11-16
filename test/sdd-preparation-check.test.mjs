import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const checker = resolve('scripts/sdd-preparation-check.mjs');
const realRoot = resolve('.');
const change = 'fixture-sdd';
const write = (root, relative, value) => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
};
const makeFixture = (fn) => {
  const root = mkdtempSync(join(tmpdir(), 'ace-sdd-prepare-'));
  const home = 'openspec/changes/' + change;
  try {
    write(root, home + '/.openspec.yaml', 'schema: spec-driven\n');
    write(root, home + '/proposal.md', '# Proposal\n## Why\nNeed it.\n## What Changes\nChange it.\n');
    write(root, home + '/design.md', '# Design\n## Decisions\nOwner decisions.\n\n## G02 crosswalk\n\n| AC | Owner | Decision | Interface/state | Phase | Deterministic oracle | Provider/agent oracle |\n| --- | --- | --- | --- | --- | --- | --- |\n| SDD-001 | owner | ACCEPTED: route | API | phase 1 | negative test | N/A |\n| SDD-002 | owner | ACCEPTED: scope | API | phase 2 | negative test | N/A |\n');
    write(root, home + '/tasks.md', '# Tasks\n- [ ] Implement SDD-001 and SDD-002\n');
    write(root, home + '/specs/demo/spec.md', '# Spec Delta\n## ADDED Requirements\n### Requirement: A\n#### Scenario: SDD-001 — positive\n- WHEN it happens\n- THEN success.\n### Requirement: B\n#### Scenario: SDD-002 — negative\n- WHEN it fails\n- THEN block.\n');
    fn(root, home);
  } finally { rmSync(root, { recursive: true, force: true }); }
};
const check = (root, tier = 'T2', id = change) => {
  const run = spawnSync(process.execPath, [checker, '--root', root, '--change', id, '--tier', tier, '--json'], { encoding: 'utf8' });
  return { code: run.status, data: JSON.parse(run.stdout), stderr: run.stderr };
};
const blocked = (result, id) => {
  assert.equal(result.code, 2, result.stderr);
  assert.equal(result.data.verdict, 'BLOCKED');
  assert.ok(result.data.checks.some((entry) => entry.id === id && entry.status === 'BLOCKED'), JSON.stringify(result.data.checks));
};

test('T2 complete specs get review-needed, never automatic G02 approval', () => makeFixture((root) => {
  const { code, data } = check(root);
  assert.equal(code, 0);
  assert.equal(data.verdict, 'READY_FOR_G02_REVIEW');
  assert.equal(data.g02, 'REVIEW_REQUIRED');
  assert.equal(data.ownerDecision, 'NOT_VERIFIED_BY_THIS_CHECK');
  assert.equal(data.liveAgentSkillInvocation, 'NOT_RUN_BY_THIS_CHECK');
  assert.equal(data.openspecValidation, 'RUN_SEPARATELY');
}));

test('T1 spec needs mapped acceptance but not G02 crosswalk', () => makeFixture((root, home) => {
  write(root, home + '/design.md', '# Design\n## Decisions\nRefer to SDD-001, SDD-002.\n');
  const { code, data } = check(root, 'T1');
  assert.equal(code, 0);
  assert.equal(data.verdict, 'READY_FOR_REVIEW');
  assert.equal(data.g02, 'NOT_APPLICABLE');
}));

test('a missing required artifact fails closed', () => makeFixture((root, home) => {
  rmSync(join(root, home, 'proposal.md'));
  blocked(check(root), 'ARTIFACTS');
}));

test('duplicate scenario IDs fail even when design and tasks mention them', () => makeFixture((root, home) => {
  write(root, home + '/specs/extra/spec.md', '# Spec Delta\n### Requirement: Duplicate\n#### Scenario: SDD-001 — repeated\n');
  blocked(check(root), 'SPEC_SCENARIOS');
}));

test('missing design or tasks acceptance mapping fails', () => makeFixture((root, home) => {
  write(root, home + '/tasks.md', '# Tasks\n- [ ] Implement SDD-001 only\n');
  blocked(check(root), 'ACCEPTANCE_TRACE');
}));

test('missing or malformed T2 G02 row is blocked', () => makeFixture((root, home) => {
  write(root, home + '/design.md', '# Design\n## Decisions\nSDD-001, SDD-002\n## G02 crosswalk\n| SDD-001 | owner | ACCEPTED | API | phase 1 | oracle | N/A |\n');
  blocked(check(root), 'G02_CROSSWALK');
}));

test('explicit unresolved G02 decision is not treated as accepted', () => makeFixture((root, home) => {
  write(root, home + '/design.md', '# Design\n## Decisions\nSDD-001 and SDD-002\n## G02 crosswalk\n| SDD-001 | owner | BLOCKED | API | phase 1 | oracle | N/A |\n| SDD-002 | owner | ACCEPTED | API | phase 2 | oracle | N/A |\n');
  blocked(check(root), 'G02_CROSSWALK');
}));

test('path traversal and invalid tier are not accepted', () => makeFixture((root) => {
  blocked(check(root, 'T2', '../../hidden'), 'INPUT');
  blocked(check(root, 'T3'), 'INPUT');
}));

test('symlinked spec directory does not escape repository root', () => makeFixture((root, home) => {
  const external = mkdtempSync(join(tmpdir(), 'ace-sdd-outside-'));
  try {
    rmSync(join(root, home, 'specs'), { recursive: true, force: true });
    symlinkSync(external, join(root, home, 'specs'), 'dir');
    blocked(check(root), 'SPEC_SCENARIOS');
  } finally { rmSync(external, { recursive: true, force: true }); }
}));

test('repository skill route is explicit and preserves planning boundary', () => {
  const parent = readFileSync(join(realRoot, '.agents/skills/ace-sdlc/SKILL.md'), 'utf8');
  const skill = readFileSync(join(realRoot, '.agents/skills/ace-sdd-prepare/SKILL.md'), 'utf8');
  assert.match(parent, /ace-sdd-prepare\/SKILL\.md/u);
  assert.match(skill, /grill-with-docs/u);
  assert.match(skill, /to-spec/u);
  assert.match(skill, /openspec-propose/u);
  assert.match(skill, /openspec-update-change/u);
  assert.match(skill, /three independent questions/u);
  assert.match(skill, /planning only/u);
  assert.match(skill, /never write on main/u);
  assert.match(skill, /not.*approve G02/iu);
});

test('current OpenSpec SDD change passes the structural contract only', () => {
  const { code, data } = check(realRoot, 'T2', '012-automated-sdd-preparation');
  assert.equal(code, 0, JSON.stringify(data));
  assert.equal(data.verdict, 'READY_FOR_G02_REVIEW');
  assert.ok(data.checks.every((entry) => entry.status === 'PASS'));
});
