import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateRuntimeConfigEvidence,
  validateRuntimeConfigEvidenceDocument,
  type RuntimeConfigEvidenceInput,
} from '../src/domain/runtime-config-evidence.js';

const commit = 'a'.repeat(40);
const digest = 'b'.repeat(64);

const codeInput = (deployment: 'host' | 'k3s' = 'host'): RuntimeConfigEvidenceInput => ({
  schemaVersion: 2,
  scope: 'code-only',
  deployment,
  sourceCommit: commit,
  generatedAt: '2026-10-20T00:00:00.000Z',
  captureReference: 'fixture-runtime-capture',
  workspaceIdHash: digest,
  codeRetrieval: {
    enabled: true,
    localFallbackAllowed: false,
    codeProviderIdentity: 'codebase-memory/v0.12.1',
    semanticProvider: 'not_configured',
  },
  documentation: { enabled: false, cloudDocsOptIn: false },
  memory: { enabled: false, localOnly: true },
  worktree: {
    hostHelperEnabled: deployment === 'k3s',
    mtlsRequired: deployment === 'k3s',
  },
  cloudPermissions: [],
});

const fullInput = (): RuntimeConfigEvidenceInput => ({
  ...codeInput('k3s'),
  scope: 'full-unified',
  documentation: { enabled: true, cloudDocsOptIn: true },
  memory: { enabled: true, localOnly: true },
  cloudPermissions: [{ provider: 'vertex', dataClasses: ['project_document'] }],
});

const finalized = (input: RuntimeConfigEvidenceInput) => {
  const result = evaluateRuntimeConfigEvidence(input, commit);
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') throw new Error(result.error.message);
  return {
    ...input,
    currentCommit: commit,
    evidence: result.value.evidence,
    verdict: result.value,
  };
};

test('native code-only runtime accepts only ACE-local host configuration', () => {
  for (const deployment of ['host', 'k3s'] as const) {
    const result = evaluateRuntimeConfigEvidence(codeInput(deployment), commit);
    assert.equal(result._tag, 'Ok');
    if (result._tag === 'Err') throw new Error(result.error.message);
    assert.equal(result.value.evidence, deployment === 'host' ? 'runtime-config-accepted' : 'runtime-config-incomplete');
    if (deployment === 'host') assert.deepEqual(result.value.failures, []);
    else assert.ok(result.value.failures.includes('native_k3s_topology_not_accepted'));
  }
});

test('code-only runtime fails closed when cloud/docs/memory or lexical fallback leaks into the scope', () => {
  const input = codeInput();
  const result = evaluateRuntimeConfigEvidence({
    ...input,
    codeRetrieval: { ...input.codeRetrieval, localFallbackAllowed: true },
    documentation: { enabled: true, cloudDocsOptIn: true },
    memory: { enabled: true, localOnly: true },
    cloudPermissions: [{ provider: 'vertex', dataClasses: ['project_document'] }],
  }, commit);
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') throw new Error(result.error.message);
  for (const failure of [
    'local_fallback_enabled',
    'documentation_enabled_outside_scope',
    'cloud_docs_opt_in_outside_scope',
    'memory_enabled_outside_scope',
    'cloud_permissions_present_outside_scope',
  ]) assert.ok(result.value.failures.includes(failure), failure);
});

test('full unified runtime requires k3s+mTLS, docs opt-in, local memory and Vertex project_document only', () => {
  const accepted = evaluateRuntimeConfigEvidence(fullInput(), commit);
  assert.equal(accepted._tag, 'Ok');
  if (accepted._tag === 'Err') throw new Error(accepted.error.message);
  assert.equal(accepted.value.evidence, 'runtime-config-incomplete');
  assert.ok(accepted.value.failures.includes('full_unified_native_runtime_not_implemented'));

  const input = fullInput();
  const denied = evaluateRuntimeConfigEvidence({
    ...input,
    deployment: 'host',
    worktree: { hostHelperEnabled: false, mtlsRequired: false },
    cloudPermissions: [{ provider: 'vertex', dataClasses: ['project_document', 'private_source'] }],
  }, commit);
  assert.equal(denied._tag, 'Ok');
  if (denied._tag === 'Err') throw new Error(denied.error.message);
  assert.ok(denied.value.failures.includes('full_unified_requires_k3s_profile'));
  assert.ok(denied.value.failures.includes('vertex_data_scope_not_project_document_only'));
  assert.ok(denied.value.failures.includes('private_data_cloud_egress_enabled'));
});

test('finalized runtime document is exact-commit/scope/deployment bound and internally re-evaluated', () => {
  const document = finalized(codeInput('host'));
  const accepted = validateRuntimeConfigEvidenceDocument(document, commit, 'code-only', 'host');
  assert.equal(accepted._tag, 'Ok');

  const wrongCommit = validateRuntimeConfigEvidenceDocument(document, 'c'.repeat(40), 'code-only', 'k3s');
  assert.equal(wrongCommit._tag, 'Err');

  const wrongDeployment = validateRuntimeConfigEvidenceDocument(document, commit, 'code-only', 'k3s');
  assert.equal(wrongDeployment._tag, 'Err');

  const forged = validateRuntimeConfigEvidenceDocument({
    ...document,
    codeRetrieval: { ...document.codeRetrieval, localFallbackAllowed: true },
  }, commit, 'code-only', 'host');
  assert.equal(forged._tag, 'Err');
});

test('runtime evidence rejects duplicate/unknown cloud permission shape and unsafe metadata', () => {
  const duplicate = evaluateRuntimeConfigEvidence({
    ...fullInput(),
    cloudPermissions: [
      { provider: 'vertex', dataClasses: ['project_document'] },
      { provider: 'vertex', dataClasses: ['public'] },
    ],
  }, commit);
  assert.equal(duplicate._tag, 'Err');

  const unsafe = evaluateRuntimeConfigEvidence({
    ...codeInput(),
    captureReference: 'authorization=Bearer-secret',
  }, commit);
  assert.equal(unsafe._tag, 'Err');
});
