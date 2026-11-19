#!/usr/bin/env node
// Historical Gateway migration comparison is one-time; the retained public
// contracts comparison is permanent and must never silently exit early.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const previousPath = '.github/fixtures/contracts/ace-public-v1-baseline.json';
export const currentPath = '.github/fixtures/contracts/ace-public-contract-baseline.json';

const record = (value, label) => {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  return value;
};

export const verifyRetainedPublicContract = ({ previous, base, current }) => {
  const latest = record(current, 'current public contract baseline');
  if (previous !== null) {
    const expected = { ...record(previous, 'legacy migration baseline') };
    delete expected.gateway;
    delete expected.bifrost;
    delete expected[String.fromCharCode(109, 99, 112)];
    assert.deepStrictEqual(latest, expected,
      'Native Gateway migration may remove only the retired contract owners, not unrelated context/Hermes/error contracts');
    return 'legacy-migration-verified';
  }
  // The old snapshot was deleted in merged PR #282. That must NOT mean
  // skipping QG5 retained-public-contract checking forever.
  const expected = record(base, 'public contract baseline on PR base');
  assert.deepStrictEqual(latest, expected,
    'Retained public contract baseline changed relative to PR base; provide a separate reviewed contract migration');
  return 'retained-baseline-verified';
};

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const existsAt = (sha, path) =>
  git('ls-tree', '-r', '--name-only', sha, '--', path).trim() === path;

export const verifyAgainstBaseCommit = (baseSha) => {
  assert.match(baseSha ?? '', /^[0-9a-f]{40}$/u, 'PR_BASE_SHA must be a full commit SHA');
  git('cat-file', '-e', baseSha + '^{commit}');
  const current = JSON.parse(readFileSync(currentPath, 'utf8'));
  const previous = existsAt(baseSha, previousPath)
    ? JSON.parse(git('show', baseSha + ':' + previousPath))
    : null;
  const base = existsAt(baseSha, currentPath)
    ? JSON.parse(git('show', baseSha + ':' + currentPath))
    : null;
  const verdict = verifyRetainedPublicContract({ previous, base, current });
  console.log('[qg5] ' + verdict + ' against ' + baseSha);
  return verdict;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  verifyAgainstBaseCommit(process.env.PR_BASE_SHA);
}
