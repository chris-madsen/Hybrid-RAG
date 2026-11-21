#!/usr/bin/env node
// All maintained text documentation must use reviewable PR terminology.
// This is a read-only repo audit: no dependency on a hosted GitHub session.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0').filter(Boolean);
const documentation = files.filter((file) => /\.(?:md|mdx|rst|txt)$/iu.test(file));
const forbidden = /\bdraft(?:s|ed|ing)?\b|чернов/iu;
const violations = [];
for (const path of documentation) {
  const bytes = readFileSync(path);
  if (bytes.includes(0)) continue; // Do not parse binary Git fixtures as prose.
  const lines = bytes.toString('utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (forbidden.test(lines[i])) violations.push({ path, line: i + 1 });
  }
}
process.stdout.write(JSON.stringify({
  schemaVersion: 'ace.reviewable-pr-docs-audit.v1',
  checkedFiles: documentation.length,
  violations,
  verdict: violations.length === 0 ? 'PASS' : 'FAIL',
}) + '\n');
if (violations.length) process.exitCode = 1;
