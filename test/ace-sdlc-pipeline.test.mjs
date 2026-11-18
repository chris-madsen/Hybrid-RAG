import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
  assert.match(overlay, /one approved, unblocked canonical phase per implementation pass/iu);
  assert.match(overlay, /loop until all tasks are done/iu);
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
const makeFixture = (mutate, requestedPhase = phase) => {
  const root = mkdtempSync(join(tmpdir(), 'ace-phase-plan-'));
  try {
    const specPath = home + '/specs/gateway/spec.md';
    const spec = '# gateway\n## ADDED Requirements\n### Requirement: Example\n#### Scenario: DEMO-001 — valid\n- WHEN valid\n- THEN success\n';
    const design = '# Design\n## Decisions\nWe keep current adapter and DEMO-001.\n';
    const tasks = [
      '# Tasks',
      '',
      '## Dependency DAG and LOC budget',
      '',
      '| ID / title | Blocked by | Acceptance IDs | Source / tests / other = total forecast | Observable result |',
      '|---|---|---|---:|---|',
      '| C01 — Example | none | DEMO-001 | 0 / 0 / 0 = **0** | fixture |',
      '',
      '- [ ] C01 — Example; executable plan: [C01](phases/C01.md)',
      '',
    ].join('\n');
    const headings = ['Identity', 'Objective', 'Requirements and invariants', 'Architecture contract',
      'File map', 'Task steps', 'Verification commands and expected proof', 'Gate review', 'Completion'];
    const content = [
      '# Executable phase C01',
      '**Phase ID:** C01',
      '**Phase dependencies:** none',
      '- Depends on: none',
      '**Acceptance IDs:** DEMO-001',
      '**Design blob SHA:** ' + gitBlob(design),
      '**Specs SHA-256:** ' + sha256(specPath + '\n' + spec + '\n'),
      ...headings.map((heading) => '## ' + heading + '\n' + (
        heading === 'File map' ? '| Action | File | Role | Test owner |\n| --- | --- | --- | --- |\n| Modify | src/a.ts | behavior | test/a.ts |'
          : heading === 'Task steps' ? '1. Write RED regression in test/a.ts; run node test/a.ts. 2. Implement GREEN in src/a.ts.'
            : heading === 'Verification commands and expected proof' ? 'Run: node test/a.ts; expected exit 0.'
              : heading === 'Gate review' ? 'BUILD/ARCH/SEC/PLAN checked separately. STOP on failure; rollback changes.'
                : 'Meyer require: valid input; ensure: matching output; invariant: no unauthorized egress; frame: user worktree unchanged; exceptional: typed denial.')),
      '',
    ].join('\n');
    put(root, home + '/.openspec.yaml', 'schema: spec-driven\n');
    put(root, home + '/design.md', design);
    put(root, home + '/tasks.md', tasks);
    put(root, specPath, spec);
    put(root, home + '/phases/' + phase + '.md', content);
    mutate?.(root, { specPath, spec, design, tasks, content });
    const p = spawnSync(process.execPath,
      [join(repo, 'scripts/ace-phase-plan-check.mjs'), '--root', root, '--change', 'check-fixture', '--phase', requestedPhase, '--json'],
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
  blocked(makeFixture((root, ctx) => put(root, home + '/tasks.md', ctx.tasks.replace('[C01](phases/C01.md)', 'C01'))), 'DEPENDENCIES');
});
test('unrecognized acceptance ID is rejected', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/phases/C01.md', ctx.content.replace('**Acceptance IDs:** DEMO-001', '**Acceptance IDs:** FAKE-999'))), 'GRAPH_LINK');
});
test('missing executable section is rejected', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/phases/C01.md', ctx.content.replace('## Verification commands and expected proof', '## Wrong heading'))), 'EXECUTABLE_STRUCTURE');
});
test('phase without Meyer exceptional contract remains blocked', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/phases/C01.md',
    ctx.content.replaceAll('exceptional: typed denial.', 'missing failure contract.'))), 'EXECUTABLE_STRUCTURE');
});
test('phase plan cannot become second OpenSpec checkbox tracker', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/phases/C01.md', ctx.content + '- [ ] duplicate task\n')), 'EXECUTABLE_STRUCTURE');
});
test('phase is blocked when the canonical dependency graph references a missing phase', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/tasks.md',
    ctx.tasks.replace('| C01 — Example | none |', '| C01 — Example | C99 |'))), 'DEPENDENCIES');
});
test('phase is blocked when its declared dependencies disagree with canonical tasks', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/phases/C01.md',
    ctx.content.replace('**Phase dependencies:** none', '**Phase dependencies:** C99'))), 'DEPENDENCIES');
});
test('canonical dependency graph rejects cycles before a phase is reviewable', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/tasks.md', ctx.tasks
    .replace('| C01 — Example | none |', '| C01 — Example | C02 |')
    .replace('\n\n- [ ] C01 — Example', '\n| C02 — Example | C01 | DEMO-001 | 0 / 0 / 0 = **0** | fixture |\n- [ ] C02 — Example; executable plan: [C02](phases/C02.md)\n\n- [ ] C01 — Example'))), 'DEPENDENCIES');
});
test('malformed C100 dependency is not silently ignored', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/tasks.md',
    ctx.tasks.replace('| C01 — Example | none |', '| C01 — Example | C100 |'))), 'DEPENDENCIES');
});
test('DAG and brief agree on wrong acceptance ID but the spec rejects it', () => {
  blocked(makeFixture((root, ctx) => {
    put(root, home + '/tasks.md', ctx.tasks.replace('| DEMO-001 |', '| FAKE-999 |'));
    put(root, home + '/phases/C01.md', ctx.content.replace('**Acceptance IDs:** DEMO-001', '**Acceptance IDs:** FAKE-999'));
  }), 'GRAPH_LINK');
});
test('phase AC must belong to its own canonical DAG row, not anywhere in tasks', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/phases/C01.md',
    ctx.content.replace('**Acceptance IDs:** DEMO-001', '**Acceptance IDs:** DEMO-001, DEMO-002'))), 'GRAPH_LINK');
});
test('all spec scenario IDs must have a canonical phase owner', () => {
  blocked(makeFixture((root, ctx) => put(root, ctx.specPath, ctx.spec +
    '#### Scenario: DEMO-002 — uncovered\n- WHEN new\n- THEN denied\n')), 'GRAPH_LINK');
});
test('alternate ID P01 works; no hard-coded Cxx phase namespace', () => {
  const r = makeFixture((root, ctx) => {
    const alt = 'P01';
    put(root, home + '/tasks.md', ctx.tasks.replaceAll('C01', alt));
    put(root, home + '/phases/' + alt + '.md',
      ctx.content.replaceAll('C01', alt));
  }, 'P01');
  assert.equal(r.exit, 0, JSON.stringify(r.data));
  assert.equal(r.data.verdict, 'READY_FOR_PHASE_REVIEW');
});
test('DAG row containing unexpected natural-language gate is rejected', () => {
  blocked(makeFixture((root, ctx) => put(root, home + '/tasks.md',
    ctx.tasks.replace('| C01 — Example | none |', '| C01 — Example | C01; owner G02 |'))), 'DEPENDENCIES');
});
test('symlinked phase plan is rejected (no traversal through related locations)', () => {
  blocked(makeFixture((root, ctx) => {
    const target = join(root, home, 'phases', 'C01.md');
    rmSync(target);
    symlinkSync(join(root, home, 'tasks.md'), target);
  }), 'ARTIFACTS');
});


const phaseInventory = (root, change) => {
  const base = join(root, 'openspec/changes', change);
  const tasks = readFileSync(join(base, 'tasks.md'), 'utf8');
  const linked = [...tasks.matchAll(/^- \[[ x]\] ([A-Z][A-Z0-9-]{1,31}) — [^\n]*?\]\(phases\/([A-Z][A-Z0-9-]{1,31})\.md\)/gmu)];
  assert.ok(linked.length > 0, change + ': phase directory exists without canonical task links');
  for (const match of linked) {
    assert.equal(match[1], match[2], change + ': checkbox and linked phase ID mismatch');
  }
  const expected = linked.map((match) => match[1]).sort();
  assert.equal(new Set(expected).size, expected.length, change + ': duplicate phase task link');

  const folder = join(base, 'phases');
  const entries = readdirSync(folder, { withFileTypes: true });
  for (const entry of entries) {
    assert.ok(entry.isFile() && /^[A-Z][A-Z0-9-]{1,31}\.md$/u.test(entry.name),
      change + ': orphan, invalid or non-file phase entry: ' + entry.name);
  }
  const actual = entries.map((entry) => entry.name.slice(0, -3)).sort();
  assert.deepEqual(actual, expected, change + ': missing or orphan phase plan relative to canonical tasks');
  return actual;
};

test('phase inventory detects missing and orphan linked briefs rather than passing on an empty scan', () => {
  const root = mkdtempSync(join(tmpdir(), 'ace-phase-inventory-negative-'));
  const tempChange = 'negative-inventory';
  const tasksPath = 'openspec/changes/' + tempChange + '/tasks.md';
  try {
    put(root, tasksPath, '# Tasks\n- [ ] C01 — first — [phase brief](phases/C01.md)\n- [ ] C02 — second — [phase brief](phases/C02.md)\n');
    put(root, 'openspec/changes/' + tempChange + '/phases/C01.md', '# C01\n');
    assert.throws(() => phaseInventory(root, tempChange), /missing or orphan phase plan/u);

    put(root, 'openspec/changes/' + tempChange + '/phases/C02.md', '# C02\n');
    assert.deepEqual(phaseInventory(root, tempChange), ['C01', 'C02']);
    put(root, 'openspec/changes/' + tempChange + '/phases/C03.md', '# Orphan\n');
    assert.throws(() => phaseInventory(root, tempChange), /missing or orphan phase plan/u);

    rmSync(join(root, 'openspec/changes/' + tempChange + '/phases'), { recursive: true, force: true });
    assert.throws(() => phaseInventory(root, tempChange), /ENOENT/u);
    mkdirSync(join(root, 'openspec/changes/' + tempChange + '/phases'), { recursive: true });
    assert.throws(() => phaseInventory(root, tempChange), /missing or orphan phase plan/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('all declared OpenSpec executable phase files are present and pass exact current-input checker', () => {
  const changesDir = join(repo, 'openspec/changes');
  const changes = readdirSync(changesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  let inspected = 0;
  for (const change of changes) {
    const folder = join(changesDir, change, 'phases');
    const tasksPath = join(changesDir, change, 'tasks.md');
    const hasPhaseLinks = existsSync(tasksPath)
      && /\]\(phases\/[A-Z][A-Z0-9-]{1,31}\.md\)/u.test(readFileSync(tasksPath, 'utf8'));
    if (!hasPhaseLinks && !existsSync(folder)) continue;
    assert.ok(existsSync(folder), change + ': canonical tasks link phase briefs but directory is missing');
    const phases = phaseInventory(repo, change);
    for (const phaseId of phases) {
      const proc = spawnSync(process.execPath, [
        join(repo, 'scripts/ace-phase-plan-check.mjs'),
        '--root', repo, '--change', change, '--phase', phaseId, '--json',
      ], { encoding: 'utf8' });
      assert.equal(proc.status, 0, change + '/' + phaseId + '\n' + proc.stdout + '\n' + proc.stderr);
      assert.equal(JSON.parse(proc.stdout).verdict, 'READY_FOR_PHASE_REVIEW');
      inspected += 1;
    }
  }
  // Active G11 must have every canonical brief; the number of chunks is chosen
  // by ace-to-tickets and MUST NOT be hardcoded to the old Chat-first plan.
  const g11 = '013-gateway-g11-production-acceptance';
  const g11TasksPath = join(changesDir, g11, 'tasks.md');
  if (existsSync(g11TasksPath)) {
    const canonical = readFileSync(g11TasksPath, 'utf8');
    const linked = [...canonical.matchAll(/\]\(phases\/[A-Z][A-Z0-9-]{1,31}\.md\)/gmu)];
    assert.ok(linked.length > 0, 'active G11 task ledger has no linked executable plans');
    assert.ok(existsSync(join(changesDir, g11, 'phases')), 'G11 phase directory missing');
    const actualPhaseCount = phaseInventory(repo, g11).length;
    assert.equal(actualPhaseCount, linked.length, 'the active G11 inventory must equal canonical links');
    assert.ok(inspected >= actualPhaseCount, 'not all linked G11 phase plans were inspected');
  }
});

test('G11 planning contract has native Responses acceptance and rejects a Chat-first target', () => {
  const change = '013-gateway-g11-production-acceptance';
  const design = file('openspec/changes/' + change + '/design.md');
  const tasks = file('openspec/changes/' + change + '/tasks.md');
  const newSpec = file('openspec/changes/' + change + '/specs/gateway-native-responses/spec.md');
  assert.match(design, /Hermes[^\n]*Bifröst[^\n]*\/v1\/responses/u);
  assert.match(design, /G02 status: REVIEW_REQUIRED/u);
  assert.doesNotMatch(design, /First validate the existing[^\n]*Chat Completions/iu);
  assert.match(tasks, /## Dependency DAG and LOC budget/u);
  assert.match(tasks, /provider-native Responses/iu);
  assert.match(newSpec, /RESP-001 — Native Responses only, no Chat fallback/u);
  assert.match(newSpec, /RESP-008 — Quality-gated Harbor and owner release/u);
  const ids = [...newSpec.matchAll(/^#### Scenario: (RESP-\d{3})/gmu)].map((match) => match[1]);
  assert.deepEqual(ids, Array.from({ length: 8 }, (_, i) => 'RESP-' + String(i + 1).padStart(3, '0')));
});

test('Harness-neutral SDLC enters any selected stage and reuses prepared phase without bypassing gates', () => {
  const rules = file('AGENTS.md');
  const router = file('.agents/skills/ace-sdlc/SKILL.md');
  const handoff = file('.agents/skills/ace-stage-handoff/SKILL.md');
  const ops = file('docs/operations/ai-assisted-sdlc.md');
  const procedure = file('docs/operations/implementation-entry-resume.md');
  const implement = file('docs/research/sdlc/source/commands/implement_backend.md');
  const trial = file('docs/operations/sdlc-e2e-trial.md');
  for (const content of [rules, router, handoff, ops, procedure, implement]) {
    assert.match(content, /implement|имплементируй/iu);
    assert.match(content, /do not (automatically |start at |restart |rerun |replay |regenerate )|не /iu);
    assert.match(content, /G02/u);
  }
  assert.match(router, /## Harness-neutral intent-first stage entry[\s\S]*## Staged pipeline route/u, 'intent route must precede default staged planning');
  assert.match(router, /Harness-neutral intent-first stage entry/u);
  assert.ok(router.indexOf('## Harness-neutral intent-first stage entry') < router.indexOf('1. Read repository-root'), 'intent routing must precede numbered Research-first steps');
  assert.match(procedure, /RESUME_STAGE/u);
  assert.match(procedure, /BLOCKED_G02/u);
  assert.match(procedure, /REPAIR_OWNING_STAGE/u);
  assert.match(procedure, /check:ace-phase-plan/u);
  assert.match(procedure, /--stage implement/u);
  assert.match(procedure, /openspec instructions apply/u);
  assert.match(procedure, /one ACE phase/u);
  assert.match(procedure, /not by itself approve/u);
  assert.match(handoff, /do not start at R/u);
  assert.match(implement, /not a new R stage/u);
  assert.match(trial, /Live result: NOT RUN/u);
  assert.match(trial, /zero source edits/u);
});

test('all seven SDLC stages can be selected or resumed by a compatible coding harness', () => {
  const source = file('docs/operations/implementation-entry-resume.md');
  const router = file('.agents/skills/ace-sdlc/SKILL.md');
  const staged = file('.agents/skills/ace-stage-handoff/SKILL.md');
  const root = file('AGENTS.md');
  const checkpoint = file('docs/research/sdlc/source/templates/progress-checkpoint.md');
  for (const stage of ['R', 'S', 'A', 'P', 'X', 'I', 'V']) {
    assert.match(source, new RegExp('\\*\\*' + stage + ' — ', 'u'), 'missing stage ' + stage);
    assert.match(source, new RegExp('ENTER_STAGE\\(R\\|S\\|A\\|P\\|X\\|I\\|V\\)', 'u'));
    assert.match(router, new RegExp('\\b' + stage + '\\b', 'u'));
  }
  assert.match(source, /RESUME_STAGE\(R\|S\|A\|P\|X\|I\|V\)/u);
  assert.match(source, /Resume any stage/u);
  assert.match(source, /G02 is \*\*not a blanket prerequisite/u);
  assert.match(source, /R → research, S\/A → design, P\/X → plan, I → implement, V → review/u);
  assert.match(source, /not a Hermes-specific adapter/u);
  assert.match(staged, /any requested stage/u);
  assert.match(root, /Harness-neutral intent-first entry/u);
  assert.match(checkpoint, /RESUME_STAGE/u);
  assert.match(file('docs/operations/sdlc-e2e-trial.md'), /Resume matrix/u);
  assert.match(file('.codex/skills/ace-sdlc/SKILL.md'), /R\/S\/A\/P\/X\/I\/V/u);
});
