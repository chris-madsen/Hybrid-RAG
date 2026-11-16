#!/usr/bin/env node
// Structural SDD handoff verifier. Does not invoke an agent or approve G02.
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';

const output = {
  schemaVersion: 'ace.sdd-structure.v1',
  change: null,
  tier: null,
  verdict: 'BLOCKED',
  g02: 'NOT_APPLICABLE',
  ownerDecision: 'NOT_VERIFIED_BY_THIS_CHECK',
  liveAgentSkillInvocation: 'NOT_RUN_BY_THIS_CHECK',
  openspecValidation: 'RUN_SEPARATELY',
  checks: [],
};
const add = (id, status, reason) => output.checks.push({ id, status, ...(reason ? { reason } : {}) });
const fail = (message) => { throw new Error(message); };
const option = (args, key) => {
  const index = args.indexOf(key);
  if (index < 0 || index + 1 >= args.length || args[index + 1].startsWith('--')) return null;
  return args[index + 1];
};
const inside = (parent, child) => child === parent || child.startsWith(parent + sep);
const allPathsAreSafe = (root, relative) => {
  if (relative.split(/[\/\\]/u).some((piece) => piece === '..' || piece === '.' || piece === '')) fail('unsafe path segment');
  const absolute = resolve(root, relative);
  if (!inside(root, absolute)) fail('path escaped repository root');
  let cursor = root;
  for (const piece of relative.split(/[\/\\]/u)) {
    cursor = join(cursor, piece);
    const info = lstatSync(cursor);
    if (info.isSymbolicLink()) fail('symlinked SDD path');
  }
  if (!inside(root, realpathSync(absolute))) fail('path resolves outside repository root');
  return absolute;
};
const read = (root, relative) => {
  const file = allPathsAreSafe(root, relative);
  const info = lstatSync(file);
  if (!info.isFile() || info.size > 524288) fail('not a regular text artifact or exceeds 512 KiB');
  return readFileSync(file, 'utf8');
};
const matchId = (text, id) => new RegExp('(^|[^A-Z0-9-])' + id + '(?![A-Z0-9-])', 'mu').test(text);
const scenarioPattern = /^#### Scenario:\s+([A-Z][A-Z0-9]*-\d{3})(?:\s|$)/gmu;

const main = () => {
  const args = process.argv.slice(2);
  const change = option(args, '--change');
  const tier = option(args, '--tier');
  const rootArg = option(args, '--root') || process.cwd();
  output.change = change;
  output.tier = tier;
  output.g02 = tier === 'T2' ? 'REVIEW_REQUIRED' : 'NOT_APPLICABLE';
  if (!change || !/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/u.test(change) || !['T1', 'T2'].includes(tier)) {
    add('INPUT', 'BLOCKED', 'use --change <safe-kebab-case-name> --tier T1|T2');
    return;
  }
  const root = realpathSync(resolve(rootArg));
  const home = 'openspec/changes/' + change;
  const attempt = (id, fn) => {
    try { fn(); add(id, 'PASS'); }
    catch (error) { add(id, 'BLOCKED', error instanceof Error ? error.message : String(error)); }
  };
  let proposal = '', design = '', tasks = '', scenarios = [];
  attempt('ARTIFACTS', () => {
    proposal = read(root, home + '/proposal.md');
    design = read(root, home + '/design.md');
    tasks = read(root, home + '/tasks.md');
    read(root, home + '/.openspec.yaml');
    if (!/^# Proposal\b/mu.test(proposal) || !/^## Why\b/mu.test(proposal) || !/^## What Changes\b/mu.test(proposal)) fail('proposal is missing essential sections');
    if (!/^# Design\b/mu.test(design) || !/^## Decisions\b/mu.test(design)) fail('design lacks decisions');
    if (!/^# Tasks\b/mu.test(tasks) || !/^-\s+\[[ x]\]/mu.test(tasks)) fail('tasks lack phases/checklist');
  });
  attempt('SPEC_SCENARIOS', () => {
    const specsRoot = home + '/specs';
    const collected = [];
    const walk = (relative) => {
      const absolute = allPathsAreSafe(root, relative);
      const dir = lstatSync(absolute);
      if (!dir.isDirectory()) fail('specs path is not a directory');
      for (const item of readdirSync(absolute, { withFileTypes: true })) {
        if (item.isSymbolicLink()) fail('symlink in specs tree');
        if (item.isDirectory()) walk(relative + '/' + item.name);
        else if (item.name === 'spec.md') collected.push(relative + '/' + item.name);
      }
    };
    walk(specsRoot);
    if (collected.length === 0) fail('no OpenSpec capability spec.md files');
    const seen = new Set();
    for (const file of collected) {
      const content = read(root, file);
      if (!/^### Requirement:/mu.test(content)) fail('capability spec lacks requirements: ' + file);
      const ids = [...content.matchAll(scenarioPattern)].map((hit) => hit[1]);
      if (!ids.length) fail('capability spec lacks identified scenarios: ' + file);
      for (const id of ids) {
        if (seen.has(id)) fail('duplicate acceptance ID: ' + id);
        seen.add(id);
      }
    }
    scenarios = [...seen];
  });
  attempt('ACCEPTANCE_TRACE', () => {
    if (!scenarios.length || !design || !tasks) fail('required artifacts or scenario IDs unavailable');
    for (const id of scenarios) {
      if (!matchId(design, id)) fail('design omits acceptance ID: ' + id);
      if (!matchId(tasks, id)) fail('tasks omit acceptance ID: ' + id);
    }
  });
  attempt('OWNER_DECISIONS', () => {
    if (!design) fail('design cannot be inspected for unresolved decisions');
    // Only explicit, machine-readable status declarations are checked. A
    // semantic owner approval can never be inferred from missing markers.
    if (/^\s*(?:[-*]\s*)?(?:Owner decision|Decision status)\s*:\s*(?:BLOCKED|UNKNOWN|PENDING|PROPOSED)\b/imu.test(design)) {
      fail('explicit unresolved owner decision');
    }
  });
  if (tier === 'T2') attempt('G02_CROSSWALK', () => {
    if (!scenarios.length || !design) fail('cannot inspect G02 before artifacts and specs');
    if (!/^## G02 crosswalk\s*$/mu.test(design)) fail('T2 design lacks G02 crosswalk heading');
    const header = design.split('\n').find((line) => /^\|\s*AC\s*\|/u.test(line));
    const expectedHeader = ['AC', 'Owner', 'Decision', 'Interface/state', 'Phase', 'Deterministic oracle', 'Provider/agent oracle'];
    if (!header || JSON.stringify(header.split('|').slice(1, -1).map((cell) => cell.trim().toLowerCase()))
      !== JSON.stringify(expectedHeader.map((cell) => cell.toLowerCase()))) {
      fail('T2 G02 columns do not match the accepted crosswalk contract');
    }
    const lines = design.split('\n').filter((line) => /^\|\s*[A-Z][A-Z0-9]*-\d{3}\s*\|/u.test(line));
    const rows = new Map();
    for (const line of lines) {
      const parts = line.split('|').slice(1, -1).map((cell) => cell.trim());
      if (parts.length !== 7 || parts.some((cell) => !cell)) fail('G02 row must contain seven nonempty cells');
      const id = parts[0];
      if (!scenarios.includes(id)) fail('G02 contains unrecognized acceptance ID: ' + id);
      if (rows.has(id)) fail('duplicate G02 row: ' + id);
      if (/\b(BLOCKED|UNKNOWN|PENDING|PROPOSED|UNDECIDED)\b/iu.test(parts[2])) fail('unresolved owner decision for ' + id);
      rows.set(id, parts);
    }
    for (const id of scenarios) if (!rows.has(id)) fail('missing G02 row: ' + id);
  });
  if (output.checks.every((check) => check.status === 'PASS')) {
    output.verdict = tier === 'T2' ? 'READY_FOR_G02_REVIEW' : 'READY_FOR_REVIEW';
  }
};
try { main(); }
catch (error) { add('EXECUTION', 'BLOCKED', error instanceof Error ? error.message : String(error)); }
process.stdout.write(JSON.stringify(output, null, 2) + '\n');
if (output.verdict === 'BLOCKED') process.exitCode = 2;
