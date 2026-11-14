#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const dirIndex = args.indexOf('--dir');
const root = resolve(dirIndex >= 0 && args[dirIndex + 1] ? args[dirIndex + 1] : process.env.CODEQL_SARIF_DIR ?? 'codeql-results');

const files = [];
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile() && entry.name.endsWith('.sarif')) files.push(full);
  }
};

try {
  await walk(root);
} catch {
  process.stderr.write(`[codeql-gate] SARIF directory is missing: ${root}\n`);
  process.exit(2);
}
if (files.length === 0) {
  process.stderr.write(`[codeql-gate] no SARIF files under ${root}\n`);
  process.exit(2);
}

const findings = [];
const extractionErrors = [];
for (const file of files) {
  const sarif = JSON.parse(await readFile(file, 'utf8'));
  for (const run of sarif.runs ?? []) {
    const rules = new Map((run.tool?.driver?.rules ?? []).map((rule) => [rule.id, rule]));
    for (const result of run.results ?? []) {
      const ruleId = result.ruleId ?? 'unknown';
      const location = result.locations?.[0]?.physicalLocation;
      const uri = location?.artifactLocation?.uri ?? 'unknown';
      const line = location?.region?.startLine ?? null;
      const message = result.message?.text ?? '';
      if (ruleId.includes('diagnostics/extraction-errors')) {
        extractionErrors.push({ ruleId, uri, line, message });
        continue;
      }
      const rule = rules.get(ruleId);
      const rawSeverity = rule?.properties?.['security-severity'];
      const securitySeverity = rawSeverity === undefined ? null : Number(rawSeverity);
      if (securitySeverity !== null && Number.isFinite(securitySeverity)) {
        findings.push({ ruleId, securitySeverity, uri, line, message });
      }
    }
  }
}

const high = findings.filter(({ securitySeverity }) => securitySeverity >= 7);
const summary = {
  schemaVersion: 'ace.codeql-gate.v1',
  sarifFiles: files.length,
  extractionErrors,
  highOrCritical: high,
  lowerSeveritySignal: findings.filter(({ securitySeverity }) => securitySeverity < 7),
  verdict: extractionErrors.length > 0 ? 'EXTRACTION_FAILED' : high.length > 0 ? 'HIGH_SECURITY_FINDINGS' : 'PASS',
};
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');

if (extractionErrors.length > 0) process.exitCode = 2;
else if (high.length > 0) process.exitCode = 1;
