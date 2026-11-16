import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repo = resolve('.');
const file = (path) => readFileSync(join(repo, path), 'utf8');
const gitBlob = (content) => createHash('sha1').update('blob ' + Buffer.byteLength(content) + '\0').update(content).digest('hex');
const sha256 = (content) => createHash('sha256').update(content).digest('hex');
const manifest = JSON.parse(file('.agents/codebase-design-v1.3.2-manifest.json'));

test('new pinned codebase-design files are byte-exact and original 8-skill vendor is untouched', () => {
  assert.equal(manifest.sourceTag, 'v1.3.2');
  assert.equal(manifest.sourceCommit, 'd1478fcb140db0b93c0c8df17bcfd311844749d0');
  assert.equal(manifest.license.spdx, 'MIT');
  assert.match(file(manifest.license.path), /MIT License[\s\S]*Copyright \(c\) 2026 Matt Pocock/u);
  assert.equal(manifest.files.length, 4);
  for (const entry of manifest.files) {
    assert.equal(gitBlob(file(entry.path)), entry.gitBlob, entry.path);
  }
  const source = file('.agents/skills/codebase-design/SKILL.md');
  assert.match(source, /deep modules/iu);
  assert.match(source, /DESIGN-IT-TWICE\.md/u);
  const overlay = file('.agents/skills/ace-sdlc/references/matt-pocock-compatibility.md');
  assert.match(overlay, /codebase-design/u);
  assert.match(overlay, /single.agent|one agent/iu);
});

test('one-agent ACE skills are discoverable, routed and keep G02 separate', () => {
  const parent = file('.agents/skills/ace-sdlc/SKILL.md');
  const ops = file('docs/operations/ai-assisted-sdlc.md');
  const handoff = file('docs/operations/staged-sdlc-pipeline.md');
  const preparation = file('.agents/skills/ace-sdd-prepare/SKILL.md');
  const toTickets = file('.agents/skills/ace-to-tickets/SKILL.md');
  for (const name of ['ace-architecture-design', 'ace-phase-plan', 'ace-stage-handoff']) {
    const skill = file('.agents/skills/' + name + '/SKILL.md');
    const alias = file('.codex/skills/' + name + '/SKILL.md');
    const metadata = file('.agents/skills/' + name + '/agents/openai.yaml');
    assert.match(skill, new RegExp('name: ' + name, 'u'));
    assert.match(alias, new RegExp(name + '/SKILL\\.md', 'u'));
    assert.match(metadata, /allow_implicit_invocation:\s*false/u);
    assert.match(parent, new RegExp(name + '/SKILL\\.md', 'u'));
    assert.match(handoff, new RegExp(name, 'u'));
    assert.match(skill, /G02/u);
    assert.match(skill, /Draft/u);
  }
  assert.match(preparation, /ace-architecture-design/u);
  assert.match(toTickets, /ace-phase-plan/u);
  assert.match(ops, /staged-sdlc-pipeline/u);
  assert.match(handoff, /STALE/u);
  assert.match(handoff, /stacked/u);
  assert.match(handoff, /no automatic merge|never.*auto.merge/iu);
});

const home = 'openspec/changes/check-fixture';
const phase = 'C01';
const put = (root, path, content) => {
  const where = join(root, path);
  mkdirSync(dirname(where), { recursive: true });
  writeFileSync(where, content);
};
const makeFixture = (mutate) => {
  const root = mkdtempSync(join(tmpdir(), 'ace-phase-plan-'));
  try {
    const specPath = home + '/specs/gateway/spec.md';
    const spec = '# gateway\n## ADDED Requirements\n### Requirement: Example\n#### Scenario: DEMO-001 — valid\n- WHEN valid\n- THEN success\n';
    const design = '# Design\n## Decisions\nWe keep current adapter and DEMO-001.\n';
    const tasks = '# Tasks\n- [ ] C01 handles DEMO-001; executable plan: [C01](phases/C01.md)\n';
    const headings = ['Identity', 'Objective', 'Requirements and invariants', 'Architecture contract',
      'File map', 'Task steps', 'Verification commands and expected proof', 'Gate review', 'Completion'];
    const content = [
      '# Executable phase C01',
      '**Phase ID:** C01',
      '**Acceptance IDs:** DEMO-001',
      '**Design blob SHA:** ' + gitBlob(design),
      '**Specs SHA-256:** ' + sha256(specPath + '\n' + spec + '\n'),
      ...headings.map((heading) => '## ' + heading + '\n' + (
        heading === 'File map' ? '| Action | File | Role | Test owner |\n| --- | --- | --- | --- |\n| Modify | src/a.ts | behavior | test/a.ts |'
          : heading === 'Task steps' ? '1. Write RED regression in test/a.ts; run node test/a.ts. 2. Implement GREEN in src/a.ts.'
            : heading === 'Verification commands and expected proof' ? 'Run: node test/a.ts; expected exit 0.'
              : heading === 'Gate review' ? 'BUILD/ARCH/SEC/PLAN checked separately. STOP on failure; rollback changes.'
                : 'Existing invariant and evidence.')),
      '',
    ].join('\n');
    put(root, home + '/.openspec.yaml', 'schema: spec-driven\n');
    put(root, home + '/design.md', design);
    put(root, home + '/tasks.md', tasks);
    put(root, specPath, spec);
    put(root, home + '/phases/' + phase + '.md', content);
    mutate?.(root, { specPath, spec, design, tasks, content });
    const p = spawnSync(process.execPath,
      [join(repo, 'scripts/ace-phase-plan-check.mjs'), '--root', root, '--change', 'check-fixture', '--phase', phase, '--json'],
      { encoding: 'utf8' });
    return { exit: p.status, data: JSON.parse(p.stdout), stderr: p.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};
const blocked = (result, id) => {
  assert.equal(result.exit, 2, result.stderr);
  assert.equal(result.data.verdict, 'BLOCKED');
  assert.ok(result.data.checks.some((check) => check.id === id && check.status === 'BLOCKED'), JSON.stringify(result.data.checks));
};

test('valid phase structure is only reviewable, never architecturally or externally approved', () => {
  const r = makeFixture();
  assert.equal(r.exit, 0, JSON.stringify(r.data));
  assert.equal(r.data.verdict, 'READY_FOR_PHASE_REVIEW');
  assert.equal(r.data.g02, 'NOT_VERIFIED_BY_THIS_CHECK');
  assert.equal(r.data.realProvider, 'NOT_RUN_BY_THIS_CHECK');
});
test('changed architecture SHA invalidates dependent phase', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/design.md', ctx.design + 'new decision\n')), 'FRESH_INPUTS');
});
test('changed OpenSpec scenario body invalidates dependent phase', () => {
  blocked(makeFixture((root, ctx) => put(root, ctx.specPath, ctx.spec + '- AND additional requirement\n')), 'FRESH_INPUTS');
});
test('phase is rejected when not linked from canonical tasks', () => {
  blocked(makeFixture((root) => put(root, home + '/tasks.md', '# Tasks\n- [ ] C01 handles DEMO-001\n')), 'GRAPH_LINK');
});
test('unrecognized acceptance ID is rejected', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/phases/C01.md', ctx.content.replace('**Acceptance IDs:** DEMO-001', '**Acceptance IDs:** FAKE-999'))), 'GRAPH_LINK');
});
test('missing executable section is rejected', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/phases/C01.md', ctx.content.replace('## Verification commands and expected proof', '## Wrong heading'))), 'EXECUTABLE_STRUCTURE');
});
test('phase plan cannot become second OpenSpec checkbox tracker', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/phases/C01.md', ctx.content + '- [ ] duplicate task\n')), 'EXECUTABLE_STRUCTURE');
});
test('symlinked phase plan is rejected (no traversal through related locations)', () => {
  blocked(makeFixture((root, ctx) => {
    const target = join(root, home, 'phases', 'C01.md');
    rmSync(target);
    symlinkSync(join(root, home, 'tasks.md'), target);
  }), 'ARTIFACTS');
});
