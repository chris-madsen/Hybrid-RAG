#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const root = resolve(rootIndex >= 0 && args[rootIndex + 1] ? args[rootIndex + 1] : process.cwd());

const requirements = [
  {
    id: 'QG0_DOC_LINKS',
    file: '.github/workflows/ace-contracts.yml',
    contains: ['lycheeverse/lychee-action@', 'Negative fixture must be rejected', 'Offline Markdown link verification'],
  },
  {
    id: 'QG1_SECURITY',
    file: '.github/workflows/ace-security.yml',
    contains: ['Betterleaks', 'actionlint', 'zizmor', 'Blocking PR-range secret scan'],
  },
  {
    id: 'QG2_ARCHITECTURE',
    file: 'package.json',
    contains: ['"test:arch-rules"', '"check:arch"'],
  },
  {
    id: 'QG4_DEPENDENCY_ADVISORY',
    file: '.github/workflows/ace-dependency-usage.yml',
    contains: ['Knip non-blocking nightly report', 'osv-scanner-action', 'fail-on-vuln: false'],
  },
  {
    id: 'QG5_CONTRACT_COMPAT',
    file: '.github/workflows/ace-contracts.yml',
    contains: ['Reject in-place rewrite of accepted public v1 contracts', '[qg5] BLOCKED'],
  },
  {
    id: 'QG6_NIGHTLY',
    file: '.github/workflows/ace-contracts.yml',
    contains: ['Full nightly deterministic TypeScript, architecture, build and property suite', 'npm run verify:full'],
  },
  {
    id: 'GATEWAY_ONLY',
    file: 'package.json',
    contains: ['"test:gateway-only-audit"', '"check:gateway-only"'],
  },
  {
    id: 'TYPESPEC_GATEWAY_V1',
    file: '.github/workflows/ace-typespec-codegen.yml',
    contains: ['Compile TypeSpec and generate maintained TypeScript SDK', 'Prove strict Gateway v1 runtime schema compatibility'],
  },
  {
    id: 'BIFROST_PLUGIN_BUILD',
    file: '.github/workflows/ace-contracts.yml',
    contains: ['Build pinned Bifröst ACE plugin', 'fe7634a6c828927d05ffdd57c62be0aaab04193f'],
  },
  {
    id: 'BIFROST_REQUEST_BOUND_HOST',
    file: 'integrations/bifrost/ace-connector/plugin/main.go',
    contains: ['BifrostContextKeyRequestID', 'BifrostContextKeySessionID', 'durableActiveTranscriptDigest', 'bifrost:auto'],
    excludes: ['ace.session_id', 'ace.attempt_group_id', 'ace.host_attestation'],
  },
];

const results = [];
for (const requirement of requirements) {
  let text;
  try {
    text = await readFile(resolve(root, requirement.file), 'utf8');
  } catch {
    results.push({ id: requirement.id, status: 'FAIL', reason: 'missing_file', file: requirement.file });
    continue;
  }
  const missing = requirement.contains.filter((needle) => !text.includes(needle));
  const forbidden = (requirement.excludes ?? []).filter((needle) => text.includes(needle));
  results.push({
    id: requirement.id,
    status: missing.length === 0 && forbidden.length === 0 ? 'PASS' : 'FAIL',
    file: requirement.file,
    ...(missing.length ? { missing } : {}),
    ...(forbidden.length ? { forbidden } : {}),
  });
}

const summary = {
  schemaVersion: 'ace.sdlc-closure.v1',
  root,
  structuralVerdict: results.every(({ status }) => status === 'PASS') ? 'PASS' : 'FAIL',
  providerAgentE2E: 'NOT_RUN_BY_THIS_GATE',
  note: 'Structural/process closure cannot certify real provider bytes, retry/streaming behavior, or task-quality economics.',
  results,
};
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
if (summary.structuralVerdict !== 'PASS') process.exitCode = 1;
