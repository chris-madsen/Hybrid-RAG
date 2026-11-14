#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const root = resolve(rootIndex >= 0 && args[rootIndex + 1] ? args[rootIndex + 1] : process.cwd());
const openspecOnly = args.includes('--openspec-only');
const architectureOnly = args.includes('--architecture-only');
const contractsOnly = args.includes('--contracts-only');

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
    contains: [
      'newPhysicalRequestID',
      'schemas.HarnessSessionHeaders',
      'schemas.NormalizeSessionID',
      'BifrostContextKeySessionID',
      'receipt.RequestID != physicalRequestID',
      'resolvedSession != sessionCorrelation',
      'durableActiveTranscriptDigest',
      'ACE Gateway requires an explicit Bifrost provider/model route',
    ],
    excludes: [
      'ace.session_id',
      'ace.attempt_group_id',
      'ace.host_attestation',
      'bifrost:auto',
      'ctx.Value(schemas.BifrostContextKeyRequestID)',
    ],
  },
  {
    id: 'GATEWAY_EGRESS_POLICY',
    file: 'src/application/gateway-projection-service.ts',
    contains: [
      'authorizeAndAudit',
      'allowedProviders',
      "destination: 'other_external'",
      'security.audit.append',
      'containsLikelySecret(JSON.stringify(body.value))',
      'providerManagedContinuationPresent',
      'gatewayDataClasses',
      "'private_source'",
    ],
  },
  {
    id: 'GATEWAY_EGRESS_CONFIG',
    file: 'src/bin/ace-runtime.ts',
    contains: ['ACE_GATEWAY_EXTERNAL_LLM_OPT_IN', 'ACE_GATEWAY_ALLOWED_LLM_PROVIDERS_JSON', 'allowedCloudDataClassesByProvider', 'gateway-policy-audit.jsonl'],
  },
  {
    id: 'OPENSPEC_STRICT_VALIDATION',
    file: '.github/workflows/ace-openspec.yml',
    contains: ['@fission-ai/openspec@1.17.0', 'openspec validate --all --strict --no-interactive', 'Prove strict validation rejects an invalid scenario'],
  },
  {
    id: 'OPENSPEC_GATEWAY_AUTHORITY',
    file: 'openspec/config.yaml',
    contains: ['Bifröst LLM Gateway is the sole supported ACE context delivery path', 'active change 010-gateway-only-ownership'],
    excludes: ['Hermes ContextEngine request-time transformation', 'retired optional tool-call protocol facade'],
  },
];

const results = [];

const activeOpenSpecGuard = async () => {
  const changesRoot = resolve(root, 'openspec/changes');
  const forbiddenDirs = new Set(['008-hermes-context-integration', '009-bifrost-hermes-ownership']);
  const forbiddenText = [
    'retired optional tool-call protocol',
    '`ace_context`',
    '`ace_expand`',
    'Hermes ContextEngine',
    'Hermes native ContextEngine',
    'bifrost:auto',
  ];
  const violations = [];
  const forbiddenActiveDirs = [];
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (directory === changesRoot && entry.isDirectory()) {
        if (entry.name === 'archive') continue;
        if (forbiddenDirs.has(entry.name)) forbiddenActiveDirs.push(entry.name);
      }
      const full = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (directory === changesRoot && entry.name === 'archive') continue;
        await walk(full);
        continue;
      }
      if (!entry.isFile() || !['proposal.md', 'design.md', 'spec.md'].includes(entry.name)) continue;
      const text = await readFile(full, 'utf8');
      const found = forbiddenText.filter((needle) => text.includes(needle));
      if (found.length) violations.push({ file: full.slice(root.length + 1), forbidden: found });
    }
  };
  try {
    await walk(changesRoot);
  } catch {
    return { id: 'OPENSPEC_ACTIVE_GATEWAY_ONLY', status: 'FAIL', reason: 'missing_changes_tree' };
  }
  return {
    id: 'OPENSPEC_ACTIVE_GATEWAY_ONLY',
    status: forbiddenActiveDirs.length === 0 && violations.length === 0 ? 'PASS' : 'FAIL',
    ...(forbiddenActiveDirs.length ? { forbiddenActiveDirs } : {}),
    ...(violations.length ? { violations } : {}),
  };
};

if (!openspecOnly && !architectureOnly && !contractsOnly) for (const requirement of requirements) {
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

const publicContractAuthorityGuard = async () => {
  const contractsRoot = resolve(root, 'contracts');
  const files = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        files.push(full.slice(root.length + 1).replaceAll('\\', '/'));
      }
    }
  };
  try {
    await walk(contractsRoot);
  } catch {
    return { id: 'PUBLIC_CONTRACT_TYPESPEC_AUTHORITY', status: 'FAIL', reason: 'missing_contracts_tree' };
  }
  const unexpected = files.filter((file) => !file.startsWith('contracts/ace-gateway/v1/'));
  const required = [
    'contracts/ace-gateway/v1/projection-request.schema.json',
    'contracts/ace-gateway/v1/projection-decision.schema.json',
  ].filter((file) => !files.includes(file));
  let typeSpecMissing = [];
  try {
    const source = await readFile(resolve(root, 'typespec/main.tsp'), 'utf8');
    for (const needle of ['namespace AceGatewayV1', 'model ProjectionRequest', 'model ProjectionDecision', '@route("/internal/ace-gateway/v1/project")']) {
      if (!source.includes(needle)) typeSpecMissing.push(needle);
    }
  } catch {
    typeSpecMissing = ['typespec/main.tsp'];
  }
  return {
    id: 'PUBLIC_CONTRACT_TYPESPEC_AUTHORITY',
    status: unexpected.length === 0 && required.length === 0 && typeSpecMissing.length === 0 ? 'PASS' : 'FAIL',
    ...(unexpected.length ? { unexpected } : {}),
    ...(required.length ? { missing: required } : {}),
    ...(typeSpecMissing.length ? { typeSpecMissing } : {}),
  };
};

const architectureAuthorityGuard = async () => {
  const files = [
    'docs/docs/architecture/01-strategic-ddd.md',
    'docs/docs/architecture/02-event-storming.md',
    'docs/docs/architecture/03-tactical-ddd.md',
    'docs/docs/architecture/04-fsm-workflows.md',
    'docs/docs/architecture/05-contracts-and-deployment.md',
    'docs/docs/architecture/06-traceability-and-review.md',
    'docs/docs/architecture/07-architecture-fitness-contracts.md',
  ];
  const forbiddenText = [
    'retired optional tool-call protocol',
    '`ace_context`',
    '`ace_expand`',
    'Hermes ContextEngine',
    'Hermes native ContextEngine',
    'planned Bifrost',
  ];
  const violations = [];
  const missing = [];
  for (const file of files) {
    try {
      const value = await readFile(resolve(root, file), 'utf8');
      const found = forbiddenText.filter((needle) => value.includes(needle));
      if (found.length) violations.push({ file, forbidden: found });
    } catch {
      missing.push(file);
    }
  }
  const required = [
    ['docs/docs/architecture/01-strategic-ddd.md', 'Bifröst Gateway projection adapter'],
    ['docs/docs/architecture/05-contracts-and-deployment.md', 'Gateway Projection Surface — sole agent-facing delivery'],
    ['docs/docs/architecture/07-architecture-fitness-contracts.md', 'DBC-09 Gateway/connector conformance'],
  ];
  const missingAuthority = [];
  for (const [file, needle] of required) {
    try {
      const value = await readFile(resolve(root, file), 'utf8');
      if (!value.includes(needle)) missingAuthority.push({ file, needle });
    } catch {
      // already reported as missing
    }
  }
  return {
    id: 'ARCHITECTURE_GATEWAY_AUTHORITY',
    status: missing.length === 0 && violations.length === 0 && missingAuthority.length === 0 ? 'PASS' : 'FAIL',
    ...(missing.length ? { missing } : {}),
    ...(violations.length ? { violations } : {}),
    ...(missingAuthority.length ? { missingAuthority } : {}),
  };
};

if (!architectureOnly && !contractsOnly) results.push(await activeOpenSpecGuard());
if (!openspecOnly && !contractsOnly) results.push(await architectureAuthorityGuard());
if (!openspecOnly && !architectureOnly) results.push(await publicContractAuthorityGuard());

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
