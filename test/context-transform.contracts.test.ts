import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect } from 'effect';
import {
  makeContextTransformService,
  type AceTransformRequest,
} from '../src/application/context-transform-service.js';
import { ok } from '../src/domain/result.js';
import { makeWorkspaceId, type WorkspaceRecord } from '../src/domain/workspace.js';
import type { ContextBundle } from '../src/domain/retrieval.js';
import type { ContextProvider } from '../src/application/ports.js';
import { resolveExplicitSourceRequirements } from '../src/domain/source-coverage.js';

const workspaceId = makeWorkspaceId('00000000-0000-4000-8000-000000000001');
if (workspaceId._tag === 'Err') throw new Error(workspaceId.error.message);

const workspace: WorkspaceRecord = {
  workspaceId: workspaceId.value,
  rootPath: '/workspace',
  observationEpoch: 1,
  createdAtMs: 1,
  lastObservation: {
    headRevision: 'a'.repeat(40),
    observationEpoch: 1,
    files: [],
    removedPaths: [],
    gitStatus: 'available',
  },
};

const request: AceTransformRequest = {
  schemaVersion: 1,
  requestId: 'request-1',
  sessionId: 'session-1',
  turnId: 'turn-1',
  workspaceId: workspaceId.value,
  query: 'find the context transform service',
  budgetTokens: 200,
  sourceObligations: { required: ['code'] },
};

const explicitPlan = resolveExplicitSourceRequirements({ required: ['code'] });
if (explicitPlan._tag === 'Err') throw new Error(explicitPlan.error.message);

const bundle = (overrides: Partial<ContextBundle> = {}): ContextBundle => ({
  requestId: 'request-1' as ContextBundle['requestId'],
  query: request.query,
  evidence: [{
    evidenceId: 'evidence-1' as ContextBundle['evidence'][number]['evidenceId'],
    source: 'code',
    citation: 'src/application/context-transform-service.ts:1-20',
    content: 'context transform service is available;',
    sourceDigest: 'b'.repeat(64) as ContextBundle['evidence'][number]['sourceDigest'],
    proofClass: 'direct',
    freshness: 'current',
  }],
  warnings: [],
  partialSources: [],
  complete: true,
  sourcePlan: explicitPlan.value,
  ...overrides,
});

const makePorts = (result: ContextBundle = bundle()) => ({
  ids: { newRequestId: () => 'request-generated' },
  store: { get: () => Effect.succeed(ok(workspace)) },
  context: {
    search: () => Effect.succeed(ok(result)),
  },
});

test('transforms a request into bounded source-attributed context without mutating history', async () => {
  const service = makeContextTransformService(makePorts());
  const result = await Effect.runPromise(service.transform(request));

  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.status, 'ready');
  assert.equal(result.value.tokenCountMode, 'character_estimate');
  assert.match(result.value.limitations.join(' '), /model-exact fit is unverified/u);
  assert.match(result.value.contextText, /context transform service/u);
  assert.deepEqual(result.value.selectedEvidenceIds, ['evidence-1']);
  assert.equal(result.value.sourceCommit, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.match(result.value.receiptId, /^ace-transform-/u);
});

test('AR02 model transform requests code-only and cannot pack an unrequested stale RepoMap', async () => {
  const code = bundle().evidence[0];
  assert.ok(code);
  const staleMap: ContextBundle['evidence'][number] = {
    ...code,
    evidenceId: 'stale-repo-map' as never,
    source: 'structural',
    citation: 'repo-map:unverified',
    content: 'SENSITIVE_STALE_MAP_TEXT',
    freshness: 'unknown',
    proofClass: 'derived',
  };
  let receivedPlan: Parameters<ContextProvider['search']>[0]['sourceRequirements'];
  const service = makeContextTransformService({
    ids: { newRequestId: () => 'request-generated' },
    store: { get: () => Effect.succeed(ok(workspace)) },
    context: { search: (input) => {
      receivedPlan = input.sourceRequirements;
      return Effect.succeed(ok(bundle({
        evidence: [code, staleMap], complete: true, warnings: [], partialSources: [],
      })));
    } },
  });
  const output = await Effect.runPromise(service.transform(request));
  assert.equal(receivedPlan?.code.requirement, 'required');
  assert.equal(receivedPlan?.structural.requirement, 'not_requested');
  assert.equal(receivedPlan?.documentation.requirement, 'not_requested');
  assert.equal(output._tag, 'Ok');
  if (output._tag === 'Err') return;
  assert.equal(output.value.status, 'ready');
  assert.deepEqual(output.value.evidence.map((item) => item.source), ['code']);
  assert.deepEqual(output.value.selectedEvidenceIds, [String(code.evidenceId)]);
  assert.equal(output.value.contextText.includes('SENSITIVE_STALE_MAP_TEXT'), false);
});

test('AR02 rejects a provider which silently overrides the explicit code-only source plan', async () => {
  const service = makeContextTransformService({
    ids: { newRequestId: () => 'request-generated' },
    store: { get: () => Effect.succeed(ok(workspace)) },
    context: { search: () => Effect.succeed(ok(bundle({
      sourcePlan: {
        code: { requirement: 'required', allowed: true },
        structural: { requirement: 'optional', allowed: true },
        documentation: { requirement: 'not_requested', allowed: true },
        memory: { requirement: 'not_requested', allowed: true },
      },
    }))) },
  });
  const output = await Effect.runPromise(service.transform(request));
  assert.equal(output._tag, 'Err');
  if (output._tag === 'Err') {
    assert.equal(output.error.code, 'NOT_READY');
    assert.equal(output.error.path, 'source_plan');
  }
});

test('AR02 refuses legacy provider output that omits the requested source plan', async () => {
  const withoutPlan = bundle({ sourcePlan: undefined });
  const output = await Effect.runPromise(makeContextTransformService(makePorts(withoutPlan)).transform(request));
  assert.equal(output._tag, 'Err');
  if (output._tag === 'Err') {
    assert.equal(output.error.code, 'NOT_READY');
    assert.equal(output.error.path, 'source_plan');
  }
});

test('rejects a non-positive token budget before provider search', async () => {
  let called = false;
  const ports = makePorts();
  ports.context.search = () => {
    called = true;
    return Effect.succeed(ok(bundle()));
  };
  const service = makeContextTransformService(ports);
  const result = await Effect.runPromise(service.transform({ ...request, budgetTokens: 0 }));

  assert.equal(result._tag, 'Err');
  if (result._tag === 'Ok') return;
  assert.equal(result.error.code, 'INVALID_INPUT');
  assert.equal(called, false);
});

test('returns partial status and preserves omitted evidence when the provider is incomplete', async () => {
  const incomplete = bundle({
    complete: false,
    partialSources: ['lsp'],
    warnings: ['lsp unavailable'],
  });
  const service = makeContextTransformService(makePorts(incomplete));
  const result = await Effect.runPromise(service.transform(request));

  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.status, 'partial');
  assert.deepEqual(result.value.limitations, [
    'lsp unavailable',
    'lsp: partial',
    'token budget is a character-based estimate; model-exact fit is unverified',
  ]);
});

test('does not report a successful transform when the provider returns no evidence', async () => {
  const empty = bundle({ evidence: [], complete: false, partialSources: ['code'] });
  const service = makeContextTransformService(makePorts(empty));
  const result = await Effect.runPromise(service.transform(request));

  assert.equal(result._tag, 'Err');
  if (result._tag === 'Ok') return;
  assert.equal(result.error.code, 'NOT_READY');
});

test('verified-empty code search requires explicit, satisfied required-source coverage', async () => {
  const current = bundle({
    evidence: [], complete: true, partialSources: [], warnings: [],
    sourceCoverage: [{ source: 'code', requirement: 'required', status: 'satisfied' }],
  });
  const approved = await Effect.runPromise(makeContextTransformService(makePorts(current)).transform(request));
  assert.equal(approved._tag, 'Ok');
  if (approved._tag === 'Ok') {
    assert.equal(approved.value.status, 'ready');
    assert.equal(approved.value.contextText, '');
    assert.deepEqual(approved.value.selectedEvidenceIds, []);
  }
  const indexWithFailedPath = bundle({
    evidence: [], complete: true,
    sourceCoverage: [{ source: 'code', requirement: 'required', status: 'satisfied' }],
    indexCoverage: {
      schemaVersion: 1,
      sourceSnapshotDigest: 'a'.repeat(64) as never,
      parserVersion: 'test',
      attemptedPaths: 1, indexedPaths: 0, policyExcludedPaths: 0,
      outOfScopePaths: 0, failedPaths: 1,
      failureCounts: {
        read_failed: 1, binary_source: 0, invalid_utf8: 0, digest_raced: 0,
        structural_failed: 0, digest_mismatch: 0, parser_partial: 0, unsupported_parser: 0,
      },
      failures: [{ repoPath: 'src/unreadable.ts' as never, kind: 'read_failed' }],
    },
  });
  const unsafeIndex = await Effect.runPromise(makeContextTransformService(makePorts(indexWithFailedPath))
    .transform(request));
  assert.equal(unsafeIndex._tag, 'Err', 'a failed in-scope source invalidates a superficially satisfied empty query');
  if (unsafeIndex._tag === 'Err') assert.equal(unsafeIndex.error.code, 'NOT_READY');

  for (const unverified of [
    bundle({ evidence: [], complete: true }),
    bundle({ evidence: [], complete: true, sourceCoverage: [] }),
    bundle({ evidence: [], complete: true, sourceCoverage: [
      { source: 'code', requirement: 'optional', status: 'satisfied' },
    ] }),
    bundle({ evidence: [], complete: true, sourceCoverage: [
      { source: 'code', requirement: 'required', status: 'empty' },
    ] }),
    bundle({ evidence: [], complete: true, sourceCoverage: [
      { source: 'code', requirement: 'required', status: 'unavailable' },
    ] }),
  ]) {
    const denied = await Effect.runPromise(makeContextTransformService(makePorts(unverified)).transform(request));
    assert.equal(denied._tag, 'Err', 'unverified empty must not prepare a native response');
    if (denied._tag === 'Err') assert.equal(denied.error.code, 'NOT_READY');
  }
});

test('host-provided model token counter improves measurement but is not a readiness gate', async () => {
  const service = makeContextTransformService({
    ...makePorts(),
    countTokens: (text: string): number => Array.from(text).length,
  });
  const result = await Effect.runPromise(service.transform(request));
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.status, 'ready');
  assert.equal(result.value.tokenCountMode, 'host_counter');
  assert.deepEqual(result.value.limitations, []);
  assert.equal(result.value.estimatedTokens, Array.from(result.value.contextText).length);
});

test('transform delivers reference-only evidence when native input already contains exact verified code', async () => {
  const original = bundle().evidence[0];
  assert.ok(original);
  const result = await Effect.runPromise(makeContextTransformService(makePorts()).transform({
    ...request, visibleNativeInputText: ['Hermes already saw:\n' + original.content],
  }));
  assert.equal(result._tag, 'Ok');
  if (result._tag === 'Err') return;
  assert.equal(result.value.status, 'ready');
  assert.deepEqual(result.value.selectedEvidenceIds, ['evidence-1']);
  assert.match(result.value.contextText, /src\/application\/context-transform-service\.ts:1-20/u);
  assert.doesNotMatch(result.value.contextText, /context transform service is available;/u);
  assert.match(result.value.contextText, /known source body/iu);
  assert.equal(result.value.evidence[0]?.reusedContentBytes, Buffer.byteLength(original.content));
  const normal = await Effect.runPromise(makeContextTransformService(makePorts()).transform(request));
  assert.equal(normal._tag, 'Ok');
  if (normal._tag === 'Ok') {
    assert.match(normal.value.contextText, /context transform service is available;/u);
    assert.ok(Buffer.byteLength(result.value.contextText) < Buffer.byteLength(normal.value.contextText),
      'the source reference must reduce model-visible context bytes for repeated code');
  }
});

test('AR07 Gateway provider labels follow resolved Rust/Python LSP, never TS default', async () => {
  let semantic = 'rust-analyzer:rust-analyzer/1.2.3';
  const service = makeContextTransformService({
    ...makePorts(), providerIdentities: () => ({ semantic }),
  });
  const rust = await Effect.runPromise(service.transform(request));
  assert.equal(rust._tag, 'Ok');
  if (rust._tag === 'Ok') {
    assert.equal(rust.value.providerIdentities.semantic, semantic);
    assert.doesNotMatch(JSON.stringify(rust.value.providerIdentities), /typescript-language-server/u);
  }
  semantic = 'pyright:pyright/1.1.0';
  const next = await Effect.runPromise(service.transform({ ...request, requestId: 'request-2' }));
  assert.equal(next._tag, 'Ok');
  if (next._tag === 'Ok') assert.equal(next.value.providerIdentities.semantic, semantic);
});
