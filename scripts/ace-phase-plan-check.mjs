#!/usr/bin/env node
// Read-only structural/freshness check; never approves architecture or provider evidence.
import { createHash } from 'node:crypto';
import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const out = {
  schemaVersion: 'ace.phase-plan.structure.v1', change: null, phase: null, verdict: 'BLOCKED',
  g02: 'NOT_VERIFIED_BY_THIS_CHECK', ownerDecision: 'NOT_VERIFIED_BY_THIS_CHECK',
  sourceAndCommands: 'NOT_VERIFIED_BY_THIS_CHECK', realProvider: 'NOT_RUN_BY_THIS_CHECK', checks: [],
};
const record = (id, status, reason) => out.checks.push({ id, status, ...(reason ? { reason } : {}) });
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--') ? args[idx + 1] : null;
};
const fail = (message) => { throw new Error(message); };
const safeId = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{0,96}$/u.test(value);
const child = (parent, target) => target.startsWith(parent + sep);
const safePath = (root, relative) => {
  if (!relative || relative.split(/[\\/]/u).some((part) => !part || part === '..' || part === '.')) fail('unsafe path segment');
  const absolute = resolve(root, relative);
  if (!child(root, absolute)) fail('path escapes repository');
  let cursor = root;
  for (const segment of relative.split(/[\\/]/u)) {
    cursor = join(cursor, segment);
    if (lstatSync(cursor).isSymbolicLink()) fail('symlinked artifact path');
  }
  if (!child(root, realpathSync(absolute))) fail('artifact resolved outside repository');
  return absolute;
};
const read = (root, relative) => {
  if (typeof constants.O_NOFOLLOW !== 'number') fail('O_NOFOLLOW unavailable');
  const fd = openSync(safePath(root, relative), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 1024 * 1024) fail('artifact must be regular file <= 1 MiB');
    return readFileSync(fd, 'utf8');
  } finally { closeSync(fd); }
};
const blob = (content) => createHash('sha1').update('blob ' + Buffer.byteLength(content) + '\0').update(content).digest('hex');
const sha256 = (content) => createHash('sha256').update(content).digest('hex');
const specFiles = (root, home) => {
  const files = [];
  const walk = (relative) => {
    const path = safePath(root, relative);
    if (!lstatSync(path).isDirectory()) fail('specs is not a directory');
    for (const item of readdirSync(path, { withFileTypes: true })) {
      if (item.isSymbolicLink()) fail('symlinked spec');
      if (item.isDirectory()) walk(relative + '/' + item.name);
      else if (item.name === 'spec.md') files.push(relative + '/' + item.name);
    }
  };
  walk(home + '/specs');
  if (!files.length) fail('no spec.md sources');
  return files.sort();
};
const phasePattern = /^[A-Z][A-Z0-9-]{1,31}$/u;
const acPattern = /^[A-Z][A-Z0-9]*-\d{3}$/u;
const csv = (source, pattern, label, allowNone = false) => {
  const value = source.trim();
  if (allowNone && value === 'none') return [];
  const parts = value.split(',').map((part) => part.trim());
  if (parts.length === 0 || parts.some((part) => !pattern.test(part)) ||
      new Set(parts).size !== parts.length) fail('invalid ' + label + ': ' + value);
  return parts;
};
const parseAcceptanceIds = (source, label) => {
  const parts = source.split(',').map((part) => part.trim());
  let prefix = '';
  const result = parts.map((part) => {
    if (acPattern.test(part)) {
      prefix = part.slice(0, part.lastIndexOf('-') + 1);
      return part;
    }
    if (prefix && /^\d{3}$/u.test(part)) return prefix + part;
    fail('invalid ' + label + ': ' + part);
  });
  if (!result.length || new Set(result).size !== result.length) fail('missing or duplicate ' + label);
  return result;
};
const dependencyGraphFromTasks = (tasks) => {
  const lines = tasks.split('\n');
  const start = lines.indexOf('## Dependency DAG and LOC budget');
  if (start < 0) fail('canonical task dependency DAG is missing');
  const nextHeading = lines.findIndex((line, index) => index > start && /^##\s/u.test(line));
  const section = lines.slice(start + 1, nextHeading < 0 ? undefined : nextHeading);
  const header = section.findIndex((line) => /^\|\s*ID\s*\/\s*title\s*\|/iu.test(line));
  if (header < 0 || !/^\|\s*:?-+/u.test(section[header + 1] || '')) fail('canonical DAG table header or divider missing');
  const graph = new Map();
  for (const line of section.slice(header + 2)) {
    if (!line.startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 5) fail('malformed canonical dependency row/column count');
    const match = /^([A-Z][A-Z0-9-]{1,31})\s+—\s+\S/u.exec(cells[0]);
    if (!match) fail('malformed canonical phase ID/title: ' + cells[0]);
    const id = match[1];
    if (!phasePattern.test(id) || graph.has(id)) fail('invalid/duplicate canonical phase ID: ' + id);
    const dependencies = csv(cells[1], phasePattern, 'dependencies for ' + id, true);
    if (dependencies.includes(id)) fail('phase depends on itself: ' + id);
    const acceptanceIds = parseAcceptanceIds(cells[2], 'DAG acceptance IDs for ' + id);
    graph.set(id, { dependencies, acceptanceIds });
  }
  if (graph.size === 0) fail('canonical DAG has no phase rows');
  const checkboxes = new Map();
  for (const line of lines) {
    if (!/^-\s+\[[ x]\]\s+[A-Z][A-Z0-9-]{1,31}\s+—/u.test(line)) continue;
    const match = /^-\s+\[[ x]\]\s+([A-Z][A-Z0-9-]{1,31})\s+—\s+(.+)$/u.exec(line);
    if (!match) fail('malformed canonical phase checkbox');
    const [, id, rest] = match;
    if (checkboxes.has(id)) fail('duplicate task checkbox phase ' + id);
    if (!rest.includes('](phases/' + id + '.md)')) fail('phase checkbox missing exact own brief link: ' + id);
    checkboxes.set(id, rest);
  }
  if (checkboxes.size !== graph.size || [...graph.keys()].some((id) => !checkboxes.has(id))) {
    fail('canonical task checkboxes and dependency DAG phase IDs differ');
  }
  for (const [id, { dependencies }] of graph) {
    for (const dependency of dependencies) {
      if (!graph.has(dependency)) fail(id + ' references unknown dependency: ' + dependency);
    }
  }
  const visited = new Set(), active = new Set();
  const visit = (id) => {
    if (active.has(id)) fail('canonical dependency DAG contains cycle at ' + id);
    if (visited.has(id)) return;
    active.add(id);
    for (const dependency of graph.get(id).dependencies) visit(dependency);
    active.delete(id);
    visited.add(id);
  };
  for (const id of graph.keys()) visit(id);
  return graph;
};
const extract = (content, label, digits) => {
  const matches = [...content.matchAll(new RegExp('^\\*\\*' + label + ':\\*\\*\\s*([a-f0-9]{' + digits + '})\\s*$', 'gmu'))];
  if (matches.length !== 1) fail('exactly one valid ' + label + ' required');
  return matches[0][1];
};
const attempt = (id, fn) => {
  try { fn(); record(id, 'PASS'); }
  catch (e) { record(id, 'BLOCKED', e instanceof Error ? e.message : String(e)); }
};
const main = () => {
  const change = getArg('--change'), phase = getArg('--phase');
  out.change = change; out.phase = phase;
  if (!safeId(change) || !/^[a-z0-9][a-z0-9-]*$/u.test(change) || !safeId(phase)) {
    record('INPUT', 'BLOCKED', 'provide --change <safe-kebab-case> --phase <safe-id>');
    return;
  }
  const root = realpathSync(resolve(getArg('--root') || process.cwd()));
  const home = 'openspec/changes/' + change;
  let tasks = '', design = '', plan = '', specs = [], ids = [], graph = null;
  attempt('ARTIFACTS', () => {
    tasks = read(root, home + '/tasks.md');
    design = read(root, home + '/design.md');
    plan = read(root, home + '/phases/' + phase + '.md');
    read(root, home + '/.openspec.yaml');
    if (!/^# Tasks\b/mu.test(tasks) || !/^# Design\b/mu.test(design)) fail('canonical design/tasks files malformed');
  });
  attempt('SPECS', () => {
    specs = specFiles(root, home).map((p) => ({ path: p, content: read(root, p) }));
    const seen = new Set();
    for (const { content } of specs) {
      for (const m of content.matchAll(/^#### Scenario:\s+([A-Z][A-Z0-9]*-\d{3})(?:\s|$)/gmu)) {
        if (seen.has(m[1])) fail('duplicate spec AC: ' + m[1]);
        seen.add(m[1]);
      }
    }
    if (!seen.size) fail('no spec AC scenario IDs');
    ids = [...seen];
  });
  attempt('DEPENDENCIES', () => {
    if (!tasks || !plan) fail('tasks or phase file missing');
    graph = dependencyGraphFromTasks(tasks);
    const row = graph.get(phase);
    if (!row) fail('phase missing from canonical dependency DAG: ' + phase);
    const matches = [...plan.matchAll(/^\*\*Phase dependencies:\*\*\s*(.+)$/gmu)];
    if (matches.length !== 1) fail('exactly one Phase dependencies declaration required');
    const declared = csv(matches[0][1], phasePattern, 'phase dependencies', true);
    if (JSON.stringify([...declared].sort()) !== JSON.stringify([...row.dependencies].sort())) {
      fail('phase dependencies do not match canonical tasks: ' + phase);
    }
  });
  attempt('GRAPH_LINK', () => {
    if (!tasks || !plan || !graph || !ids.length) fail('tasks, specs or dependency DAG missing');
    if (!plan.includes('**Phase ID:** ' + phase)) fail('phase identity missing or mismatched');
    const row = graph.get(phase);
    if (!row) fail('phase missing from canonical DAG: ' + phase);
    const matches = [...plan.matchAll(/^\*\*Acceptance IDs:\*\*\s*(.+)$/gmu)];
    if (matches.length !== 1) fail('exactly one Acceptance IDs declaration required');
    const declared = parseAcceptanceIds(matches[0][1], 'phase acceptance IDs');
    if (JSON.stringify([...declared].sort()) !== JSON.stringify([...row.acceptanceIds].sort())) {
      fail('phase acceptance IDs differ from its canonical task DAG row: ' + phase);
    }
    const declaredSpecIds = new Set(ids);
    const used = new Set();
    for (const [id, entry] of graph) {
      for (const ac of entry.acceptanceIds) {
        if (!declaredSpecIds.has(ac)) fail('unrecognized spec AC in DAG ' + id + ': ' + ac);
        used.add(ac);
      }
    }
    for (const ac of declaredSpecIds) {
      if (!used.has(ac)) fail('spec AC is not assigned to any canonical phase: ' + ac);
    }
  });
  attempt('FRESH_INPUTS', () => {
    if (!design || !plan || !specs.length) fail('input evidence missing');
    if (extract(plan, 'Design blob SHA', 40) !== blob(design)) fail('STALE: design blob differs from plan input');
    const joined = specs.map(({ path, content }) => path + '\n' + content + '\n').join('');
    if (extract(plan, 'Specs SHA-256', 64) !== sha256(joined)) fail('STALE: spec fingerprint differs from plan input');
  });
  attempt('EXECUTABLE_STRUCTURE', () => {
    if (!plan) fail('phase content missing');
    const required = ['Identity', 'Objective', 'Requirements and invariants', 'Architecture contract',
      'File map', 'Task steps', 'Verification commands and expected proof', 'Gate review', 'Completion'];
    for (const heading of required) {
      if (!plan.split('\n').some((line) => line.trim() === '## ' + heading)) fail('missing section: ' + heading);
    }
    for (const contract of ['require', 'ensure', 'invariant', 'frame', 'exceptional']) {
      if (!new RegExp('\\b' + contract + '\\b', 'iu').test(plan)) fail('missing Meyer contract field: ' + contract);
    }
    if (!/RED/iu.test(plan) || !/GREEN/iu.test(plan) || !/rollback|STOP/iu.test(plan)) fail('missing test or rollback obligations');
    if (!/npm run |node |go test |npx |tsx |pytest |openssl /iu.test(plan)) fail('no concrete test/validation command');
    if (!/\|\s*(?:Modify|Create|Delete)\s*\|/iu.test(plan)) fail('file map needs one concrete owned change');
    if (/^\s*-\s*\[[ x]\]/mu.test(plan)) fail('phase file duplicates task tracker checkboxes');
    if (/\b(?:TBD|FIXME|PLACEHOLDER|TODO_REPLACE)\b/iu.test(plan)) fail('unresolved placeholder');
  });
  if (out.checks.every((entry) => entry.status === 'PASS')) out.verdict = 'READY_FOR_PHASE_REVIEW';
};
try { main(); }
catch (e) { record('EXECUTION', 'BLOCKED', e instanceof Error ? e.message : String(e)); }
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
if (out.verdict === 'BLOCKED') process.exitCode = 2;
