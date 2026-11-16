import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(repositoryRoot, '.agents', 'matt-pocock-skills-v1.3.2-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const expectedSkills = [
  'code-review',
  'domain-modeling',
  'grill-me',
  'grill-with-docs',
  'grilling',
  'tdd',
  'to-spec',
  'to-tickets',
];
const existingOpenSpecSkills = [
  'openspec-archive-change',
  'openspec-apply-change',
  'openspec-explore',
  'openspec-propose',
  'openspec-sync-specs',
  'openspec-update-change',
  'openspec-verify-change',
];

const readRepoFile = (relativePath) => readFileSync(join(repositoryRoot, relativePath));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBlobOid = (bytes) => createHash('sha1')
  .update(`blob ${bytes.byteLength}\0`)
  .update(bytes)
  .digest('hex');

const walkFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolutePath = join(directory, entry.name);
  assert.equal(entry.isSymbolicLink(), false, `vendored skill must not contain symlinks: ${absolutePath}`);
  return entry.isDirectory() ? walkFiles(absolutePath) : [absolutePath];
});

test('Matt skill vendor manifest pins the upstream release and MIT notice', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.sourceTag, 'v1.3.2');
  assert.equal(manifest.sourceCommit, 'd1478fcb140db0b93c0c8df17bcfd311844749d0');
  assert.equal(manifest.sourceTree, '42b57b23ac2979fce601ce1d4b4d6c1d46471bbe');
  assert.equal(manifest.license.sha256, sha256(readRepoFile(manifest.license.path)));
  assert.match(readRepoFile(manifest.license.path).toString('utf8'), /MIT License[\s\S]*Copyright \(c\) 2026 Matt Pocock/u);
});

test('all vendored files match their recorded Git blob and SHA-256 identities', () => {
  assert.deepEqual(manifest.skills.map(({ name }) => name).sort(), expectedSkills);
  assert.equal(manifest.files.length, 20);

  for (const file of manifest.files) {
    const skillRoot = resolve(repositoryRoot, '.agents', 'skills', file.skill);
    const absolutePath = resolve(repositoryRoot, file.path);
    assert.ok(absolutePath.startsWith(`${skillRoot}/`), `manifest path escapes its skill: ${file.path}`);
    const bytes = readFileSync(absolutePath);
    assert.equal(sha256(bytes), file.sha256, `SHA-256 mismatch: ${file.path}`);
    assert.equal(gitBlobOid(bytes), file.gitBlob, `Git blob mismatch: ${file.path}`);
  }

  for (const skill of manifest.skills) {
    const skillRoot = join(repositoryRoot, '.agents', 'skills', skill.name);
    const listed = manifest.files
      .filter((file) => file.skill === skill.name)
      .map((file) => resolve(repositoryRoot, file.path))
      .sort();
    assert.ok(listed.some((path) => path === join(skillRoot, 'SKILL.md')), `missing SKILL.md: ${skill.name}`);
    assert.ok(listed.some((path) => path === join(skillRoot, 'agents', 'openai.yaml')), `missing Codex metadata: ${skill.name}`);
    assert.deepEqual(walkFiles(skillRoot).sort(), listed, `unexpected or missing files: ${skill.name}`);
  }
});

test('repository skill discovery preserves ACE/OpenSpec skills and installs only approved helpers', () => {
  for (const name of existingOpenSpecSkills) {
    assert.ok(existsSync(join(repositoryRoot, '.agents', 'skills', name, 'SKILL.md')), `missing existing skill: ${name}`);
  }
  assert.equal(existsSync(join(repositoryRoot, '.agents', 'skills', 'implement-spec')), false);
  assert.equal(existsSync(join(repositoryRoot, '.agents', 'skills', 'setup-matt-pocock-skills')), false);

  const grillMe = readRepoFile('.agents/skills/grill-me/SKILL.md').toString('utf8');
  const grillWithDocs = readRepoFile('.agents/skills/grill-with-docs/SKILL.md').toString('utf8');
  assert.match(grillMe, /grilling/u);
  assert.match(grillWithDocs, /grilling/u);
  assert.match(grillWithDocs, /domain-modeling/u);

  for (const explicitSkill of ['grill-me', 'grill-with-docs', 'to-spec', 'to-tickets']) {
    const metadata = readRepoFile(`.agents/skills/${explicitSkill}/agents/openai.yaml`).toString('utf8');
    assert.match(metadata, /allow_implicit_invocation:\s*false/u, `${explicitSkill} must remain explicit-invocation`);
  }
});

test('vendored Markdown references resolve within the selected skill set', () => {
  for (const file of manifest.files.filter(({ path }) => path.endsWith('.md'))) {
    const source = readRepoFile(file.path).toString('utf8');
    const nonExampleMarkdown = source.replace(/```[\s\S]*?```/gu, '');
    const links = [...nonExampleMarkdown.matchAll(/\]\(([^)]+)\)/gu)].map((match) => match[1]);
    for (const link of links) {
      if (/^(?:https?:|mailto:|#)/iu.test(link)) continue;
      const localPath = decodeURIComponent(link.split('#', 1)[0]);
      if (localPath.length === 0) continue;
      const resolvedPath = resolve(dirname(join(repositoryRoot, file.path)), localPath);
      assert.ok(existsSync(resolvedPath), `broken local reference in ${file.path}: ${link}`);
    }
  }
});

test('ACE overlay bounds questions and prevents parallel-agent or tracker side effects', () => {
  const overlay = readRepoFile('.agents/skills/ace-sdlc/references/matt-pocock-compatibility.md').toString('utf8');
  assert.match(overlay, /at most \*\*three independent decision questions in one round\*\*/u);
  assert.match(overlay, /at most \*\*two rounds per scoped task\*\*/u);
  assert.match(overlay, /Never repeat a question/u);
  assert.match(overlay, /one agent/u);
  assert.match(overlay, /publish tracker tickets/u);
  assert.match(overlay, /parallel-subagent procedure conflicts with ACE policy/u);

  const spec = readRepoFile('openspec/changes/011-pinned-agent-skills/specs/agent-sdlc-skills/spec.md').toString('utf8');
  const example = readRepoFile('docs/research/sdlc/examples/matt-skills-prd-to-openspec.md').toString('utf8');
  for (const id of Array.from({ length: 7 }, (_, index) => `SKILL-${String(index + 1).padStart(3, '0')}`)) {
    assert.ok(spec.includes(id), `missing acceptance ID: ${id}`);
    assert.ok(example.includes(id), `walkthrough omits acceptance ID: ${id}`);
  }
  assert.match(example, /No follow-up owner question was asked/u);
  assert.match(example, /not a synthetic user transcript/u);
});

test('ACE To Tickets uses automatic ~1000-line sizing without changing pinned upstream', () => {
  const skill = readRepoFile('.agents/skills/ace-to-tickets/SKILL.md').toString('utf8');
  const alias = readRepoFile('.codex/skills/ace-to-tickets/SKILL.md').toString('utf8');
  const metadata = readRepoFile('.agents/skills/ace-to-tickets/agents/openai.yaml').toString('utf8');
  const overlay = readRepoFile('.agents/skills/ace-sdlc/references/matt-pocock-compatibility.md').toString('utf8');
  const parent = readRepoFile('.agents/skills/ace-sdlc/SKILL.md').toString('utf8');
  const sdd = readRepoFile('.agents/skills/ace-sdd-prepare/SKILL.md').toString('utf8');
  const operations = readRepoFile('docs/operations/ai-assisted-sdlc.md').toString('utf8');
  const prompts = readRepoFile('docs/research/sdlc/PROMPTS-ACE.md').toString('utf8');

  assert.match(skill, /^name: ace-to-tickets$/mu);
  assert.match(skill, /\.agents\/skills\/to-tickets\/SKILL\.md/u);
  assert.match(skill, /1,000 changed lines/u);
  assert.match(skill, /700–1,200/u);
  assert.match(skill, /above \*\*~1,500\*\*/u);
  assert.match(skill, /including tests/u);
  assert.match(skill, /Do not ask the owner whether tasks are too large\/small/u);
  assert.match(skill, /acceptance-ID/u);
  assert.match(skill, /Blocked by/u);
  assert.match(skill, /RED/u);
  assert.match(skill, /GREEN/u);
  assert.match(skill, /G02/u);
  assert.match(skill, /Harbor/u);
  assert.match(skill, /do not implement source code/iu);
  assert.match(skill, /no fixed number of chunks is mandated/iu);
  assert.match(alias, /\.agents\/skills\/ace-to-tickets\/SKILL\.md/u);
  assert.match(metadata, /allow_implicit_invocation:\s*false/u);
  assert.match(parent, /ace-to-tickets\/SKILL\.md/u);
  assert.match(sdd, /ace-to-tickets\/SKILL\.md/u);
  assert.match(operations, /ACE To Tickets/u);
  assert.match(prompts, /ace-to-tickets\/SKILL\.md/u);
  assert.match(overlay, /automatic ACE to-tickets sizing/iu);
  assert.match(overlay, /Do not ask a routine question about granularity/u);
  assert.match(overlay, /OpenSpec `tasks\.md`/u);
});
