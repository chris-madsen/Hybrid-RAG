import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const audit = resolve('scripts/sdlc-closure-audit.mjs');

test('SDLC closure audit passes the repository and labels external E2E honestly', () => {
  const run = spawnSync(process.execPath, [audit], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const result = JSON.parse(run.stdout);
  assert.equal(result.structuralVerdict, 'PASS');
  assert.equal(result.providerAgentE2E, 'NOT_RUN_BY_THIS_GATE');
  assert.ok(result.results.every((entry) => entry.status === 'PASS'));
});

test('SDLC closure audit fails closed when active-gate evidence is absent', () => {
  const root = mkdtempSync(join(tmpdir(), 'ace-sdlc-closure-negative-'));
  try {
    const run = spawnSync(process.execPath, [audit, '--root', root], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    const result = JSON.parse(run.stdout);
    assert.equal(result.structuralVerdict, 'FAIL');
    assert.ok(result.results.some((entry) => entry.reason === 'missing_file'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
