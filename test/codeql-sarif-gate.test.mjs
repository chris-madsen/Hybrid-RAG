import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const gate = resolve('scripts/check-codeql-sarif.mjs');

const runFixture = (results = [], rules = [], document = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'ace-codeql-gate-'));
  try {
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'javascript.sarif'), JSON.stringify({
      version: '2.1.0',
      runs: [{
        tool: { driver: { name: 'CodeQL', rules } },
        results,
      }],
      ...document,
    }));
    const run = spawnSync(process.execPath, [gate, '--dir', root], { encoding: 'utf8' });
    const output = JSON.parse(run.stdout);
    return { run, output };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('CodeQL SARIF gate accepts clean and lower-severity signal', () => {
  const { run, output } = runFixture([
    { ruleId: 'js/example-medium', message: { text: 'medium' }, locations: [] },
  ], [
    { id: 'js/example-medium', properties: { 'security-severity': '5.0' } },
  ]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(output.verdict, 'PASS');
  assert.equal(output.lowerSeveritySignal.length, 1);
});

test('CodeQL SARIF gate blocks high or critical security findings', () => {
  const { run, output } = runFixture([
    {
      ruleId: 'js/example-high',
      message: { text: 'high security finding' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'src/example.ts' }, region: { startLine: 7 } } }],
    },
  ], [
    { id: 'js/example-high', properties: { 'security-severity': '8.1' } },
  ]);
  assert.equal(run.status, 1);
  assert.equal(output.verdict, 'HIGH_SECURITY_FINDINGS');
  assert.deepEqual(output.highOrCritical[0]?.uri, 'src/example.ts');
  assert.equal(output.highOrCritical[0]?.line, 7);
});

test('CodeQL SARIF gate reads rule severity from tool extension components', () => {
  const { run, output } = runFixture([], [], {
    runs: [{
      tool: {
        driver: { name: 'CodeQL', rules: [] },
        extensions: [{
          name: 'codeql/javascript-queries',
          rules: [{ id: 'js/example-extension-high', properties: { 'security-severity': '7.7' } }],
        }],
      },
      results: [{
        ruleId: 'js/example-extension-high',
        message: { text: 'extension rule high security finding' },
        locations: [],
      }],
    }],
  });
  assert.equal(run.status, 1);
  assert.equal(output.verdict, 'HIGH_SECURITY_FINDINGS');
  assert.equal(output.highOrCritical[0]?.securitySeverity, 7.7);
});

test('CodeQL SARIF gate rejects missing analysis runs', () => {
  const { run, output } = runFixture([], [], { runs: [] });
  assert.equal(run.status, 2);
  assert.equal(output.verdict, 'INVALID_ANALYSIS');
  assert.equal(output.codeqlRuns, 0);
});

test('CodeQL SARIF gate rejects results from an unexpected analysis driver', () => {
  const { run, output } = runFixture([], [], {
    runs: [{ tool: { driver: { name: 'Other scanner' } }, results: [] }],
  });
  assert.equal(run.status, 2);
  assert.equal(output.verdict, 'INVALID_ANALYSIS');
  assert.equal(output.malformedSarif.length, 1);
});

test('CodeQL SARIF gate rejects findings without a numeric security severity', () => {
  const { run, output } = runFixture([
    { ruleId: 'js/example-unclassified', message: { text: 'missing severity' }, locations: [] },
  ], [
    { id: 'js/example-unclassified', properties: { 'security-severity': '' } },
  ]);
  assert.equal(run.status, 2);
  assert.equal(output.verdict, 'UNCLASSIFIED_FINDINGS');
  assert.equal(output.unclassifiedFindings.length, 1);
});

test('CodeQL SARIF gate blocks extraction errors even when analysis action succeeds', () => {
  const { run, output } = runFixture([
    {
      ruleId: 'js/diagnostics/extraction-errors',
      message: { text: 'parse error' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'src/broken.ts' }, region: { startLine: 9 } } }],
    },
  ]);
  assert.equal(run.status, 2);
  assert.equal(output.verdict, 'EXTRACTION_FAILED');
  assert.equal(output.extractionErrors[0]?.uri, 'src/broken.ts');
});
