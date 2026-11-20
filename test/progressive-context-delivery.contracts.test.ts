import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { contextTransportText, projectContextForDelivery, resolveDeliveryIntent } from '../src/domain/context-delivery.js';
import type { ContextBundle, RetrievalEvidence } from '../src/domain/retrieval.js';

const bodies = [
  'export function correctHandler() {\n  return true;\n}',
  'export function relatedHandler() {\n  return false;\n}',
  ...Array.from({ length: 4 }, (_, i) => `export function other${i}() {\n${'  const data = new Uint8Array(100);\n'.repeat(100)}  return data;\n}`),
];
const evidence: RetrievalEvidence[] = bodies.map((content, i) => ({
  evidenceId: `evidence-${i}` as RetrievalEvidence['evidenceId'],
  source: 'code',
  citation: `src/module-${i}.ts:1-104`,
  content,
  sourceDigest: createHash('sha256').update(content).digest('hex') as never,
  freshness: 'current',
  proofClass: 'direct',
  structuralKind: 'function',
  structuralName: i < 2 ? ['correctHandler', 'relatedHandler'][i] : `other${i - 2}`,
  structuralLanguage: 'typescript',
  structuralExported: true,
  expansionHandle: `exact-original-handle-${i}`,
}));
const bundle: ContextBundle = {
  requestId: 'progressive-request' as ContextBundle['requestId'],
  query: 'find the correct handler',
  evidence,
  warnings: [],
  partialSources: [],
  complete: true,
};

test('locate mode progressively delivers source map instead of six complete bodies', () => {
  const projected = projectContextForDelivery(bundle, resolveDeliveryIntent(undefined));
  assert.equal(projected.complete, true);
  assert.equal(projected.evidence.length, 6);
  assert.equal(projected.evidence[0]?.content, bodies[0]);
  assert.equal(projected.evidence[1]?.content, bodies[1]);
  for (const [i, item] of projected.evidence.entries()) {
    assert.equal(item.expansionHandle, `exact-original-handle-${i}`);
    assert.equal(item.freshness, 'current');
    assert.equal(item.proofClass, 'direct');
    if (i >= 2) {
      assert.equal(item.contentDelivery, 'expand');
      assert.equal(item.content, `exported function other${i - 2} [typescript]`);
      assert.ok(item.originalSpanLines && item.originalSpanLines > 40);
    }
  }
  const originalBytes = Buffer.byteLength(JSON.stringify(bundle));
  const projectedBytes = Buffer.byteLength(JSON.stringify(projected));
  assert.ok(projectedBytes < originalBytes / 3, `expected substantial reduction; got ${projectedBytes} / ${originalBytes}`);
  assert.ok((projected.deliveryMetrics?.structuredContentBytes ?? Number.MAX_SAFE_INTEGER) < originalBytes / 3);
  assert.ok((projected.deliveryMetrics?.duplicateContentBytes ?? -1) >= 0);
  assert.equal(projected.deliveryMetrics?.expansionHandleCount, 6);
  assert.ok((projected.deliveryMetrics?.projectionBytesAvoided ?? -1) > 0);
  assert.ok(
    Buffer.byteLength(projected.evidence[2]?.content ?? '') < Buffer.byteLength(bodies[2] ?? ''),
    'ast-grep outline metadata must be cheaper than resending the verified body',
  );
});

test('inspect mode preserves the exact verified snippet bodies and original file handles', () => {
  const inspected = projectContextForDelivery(bundle, resolveDeliveryIntent('inspect'));
  assert.deepEqual(inspected.evidence, bundle.evidence);
  assert.equal(inspected.deliveryMetrics?.initialEvidenceBytes, bodies.reduce((total, body) => total + Buffer.byteLength(body), 0));
  assert.equal(inspected.evidence[3]?.content, bodies[3]);
  assert.equal(inspected.deliveryMetrics?.projectionBytesAvoided, 0);
});

test('delivery metrics do not call distinct same-file spans duplicates', () => {
  const sharedDigest = createHash('sha256').update('complete-file').digest('hex') as never;
  const firstSpan = { ...evidence[0] as RetrievalEvidence, sourceDigest: sharedDigest, citation: 'src/shared.ts:1-3' };
  const secondSpan = { ...evidence[1] as RetrievalEvidence, sourceDigest: sharedDigest, citation: 'src/shared.ts:5-7' };
  const delivered = projectContextForDelivery({ ...bundle, evidence: [firstSpan, secondSpan] }, 'inspect');
  assert.equal(delivered.deliveryMetrics?.duplicateContentBytes, 0);
  assert.equal(
    delivered.deliveryMetrics?.uniqueContentBytes,
    Buffer.byteLength(firstSpan.content) + Buffer.byteLength(secondSpan.content),
  );
});

test('delivery metrics count only exact repeated bodies as in-bundle duplicates', () => {
  const repeated = {
    ...evidence[0] as RetrievalEvidence,
    evidenceId: 'repeated' as RetrievalEvidence['evidenceId'],
    citation: 'src/module-0.ts:200-202',
  };
  const delivered = projectContextForDelivery({ ...bundle, evidence: [evidence[0] as RetrievalEvidence, repeated] }, 'inspect');
  assert.equal(delivered.deliveryMetrics?.uniqueContentBytes, Buffer.byteLength(repeated.content));
  assert.equal(delivered.deliveryMetrics?.duplicateContentBytes, Buffer.byteLength(repeated.content));
  assert.equal(delivered.deliveryMetrics?.reusedContextBytes, 0);
  assert.equal(delivered.deliveryMetrics?.projectionBytesAvoided, 0);
});

test('long first-ranked functions use explicit on-demand delivery, never silent truncation', () => {
  const longFirst: ContextBundle = {
    ...bundle,
    evidence: [{ ...evidence[2] as RetrievalEvidence, expansionCursor: '123', expansionMaxBytes: 2048 }],
  };
  const projected = projectContextForDelivery(longFirst, 'locate');
  assert.equal(projected.evidence[0]?.contentDelivery, 'expand');
  assert.equal(projected.evidence[0]?.expansionHandle, 'exact-original-handle-2');
  assert.equal(projected.evidence[0]?.originalSpanLines, bodies[2]?.split('\n').length);
  assert.equal(projected.evidence[0]?.expansionCursor, '123');
  assert.equal(projected.evidence[0]?.expansionMaxBytes, 2048);
});

test('stable evidence receipts suppress unchanged bodies without hidden server state', () => {
  const first = projectContextForDelivery(bundle, 'inspect', { receiptScope: 'stable-test-workspace' });
  assert.match(first.bundleId ?? '', /^[a-f0-9]{64}$/u);
  const repeated = projectContextForDelivery(
    { ...bundle, requestId: 'another-request' as ContextBundle['requestId'] },
    'inspect',
    {
      knownBundleId: first.bundleId,
      receiptScope: 'stable-test-workspace',
      knownEvidenceIds: [String(first.evidence[0]?.evidenceId), String(first.evidence[3]?.evidenceId)],
    },
  );
  assert.equal(repeated.bundleId, first.bundleId, 'bundle identity must not depend on request id');
  assert.equal(repeated.supersedesBundleId, first.bundleId);
  assert.equal(repeated.evidence[0]?.content, '');
  assert.equal(repeated.evidence[0]?.contentDelivery, 'known_reference');
  assert.equal(repeated.evidence[3]?.content, '');
  assert.equal(repeated.evidence[3]?.contentDelivery, 'known_reference');
  assert.equal(repeated.evidence[1]?.content, bodies[1]);
  const expectedReused = Buffer.byteLength(bodies[0] ?? '') + Buffer.byteLength(bodies[3] ?? '');
  assert.equal(repeated.deliveryMetrics?.reusedContextBytes, expectedReused);
  assert.equal(repeated.deliveryMetrics?.duplicateContextBytesAvoided, expectedReused);
  assert.equal(repeated.deliveryMetrics?.newContextBytes,
    bodies.reduce((total, body, index) => total + ([0, 3].includes(index) ? 0 : Buffer.byteLength(body)), 0));
  assert.equal(repeated.deliveryMetrics?.uniqueEvidenceCount, evidence.length);
  assert.equal(repeated.deliveryMetrics?.initialEvidenceBytes,
    bodies.reduce((total, body) => total + Buffer.byteLength(body), 0));
});

test('unknown evidence receipts do not suppress any verified body', () => {
  const delivered = projectContextForDelivery(bundle, 'inspect', {
    knownEvidenceIds: ['not-present'],
  });
  assert.deepEqual(delivered.evidence.map((item) => item.content), bodies);
  assert.equal(delivered.deliveryMetrics?.reusedContextBytes, 0);
});


test('source-aware delivery collapses duplicate code spans but preserves independent cross-source provenance', () => {
  const canonical = evidence[0] as RetrievalEvidence;
  const uncertainDuplicate: RetrievalEvidence = {
    ...canonical,
    evidenceId: 'duplicate-code-hit' as RetrievalEvidence['evidenceId'],
    proofClass: 'uncertain',
    expansionHandle: undefined,
  };
  const documentation: RetrievalEvidence = {
    evidenceId: 'matching-doc' as RetrievalEvidence['evidenceId'],
    source: 'documentation',
    citation: 'docs/handler.md',
    content: canonical.content,
    sourceDigest: canonical.sourceDigest,
    freshness: 'current',
    proofClass: 'derived',
  };
  const delivered = projectContextForDelivery({
    ...bundle,
    evidence: [uncertainDuplicate, canonical, documentation],
  }, 'inspect');

  assert.equal(delivered.evidence.length, 2);
  assert.equal(delivered.evidence[0]?.evidenceId, canonical.evidenceId);
  assert.equal(delivered.evidence[0]?.proofClass, 'direct');
  assert.equal(delivered.evidence[0]?.expansionHandle, canonical.expansionHandle);
  assert.equal(delivered.evidence[1]?.source, 'documentation');
  assert.equal(delivered.evidence[1]?.content, canonical.content);
  assert.equal(delivered.deliveryMetrics?.uniqueEvidenceCount, 2);
});

test('Native Responses-visible exact code is referenced instead of copied, retaining source receipts', () => {
  const original = evidence[0] as RetrievalEvidence;
  const projected = projectContextForDelivery(bundle, 'inspect', {
    visibleNativeInputText: ['function seen elsewhere() {}', original.content],
    receiptScope: 'workspace-1',
  });
  assert.equal(projected.evidence[0]?.content, '');
  assert.equal(projected.evidence[0]?.contentDelivery, 'known_reference');
  assert.equal(projected.evidence[0]?.citation, original.citation);
  assert.equal(projected.evidence[0]?.sourceDigest, original.sourceDigest);
  assert.ok(projected.evidence[0]?.receiptId);
  assert.equal(projected.evidence[1]?.content, evidence[1]?.content);
  assert.equal(projected.deliveryMetrics?.reusedContextBytes, Buffer.byteLength(original.content));
  assert.equal(projected.deliveryMetrics?.duplicateContextBytesAvoided, Buffer.byteLength(original.content));
  assert.equal(projectContextForDelivery(bundle, 'inspect').evidence[0]?.content, original.content,
    'native comparison must be optional and cannot mutate fixture evidence');
});

test('Native visible suppression is exact and restricted to fresh directly proven code', () => {
  const verified = evidence[0] as RetrievalEvidence;
  const variants: RetrievalEvidence[] = [
    { ...verified, evidenceId: 'uncertain' as never, proofClass: 'uncertain' },
    { ...verified, evidenceId: 'derived' as never, proofClass: 'derived' },
    { ...verified, evidenceId: 'without-digest' as never, sourceDigest: undefined },
    { ...verified, evidenceId: 'documentation' as never, source: 'documentation' },
  ];
  for (const item of variants) {
    const projected = projectContextForDelivery({ ...bundle, evidence: [item] }, 'inspect', {
      visibleNativeInputText: [verified.content],
    });
    assert.equal(projected.evidence[0]?.content, verified.content, item.evidenceId);
  }
  const onlyPartial = projectContextForDelivery(bundle, 'inspect', {
    visibleNativeInputText: [verified.content.slice(0, -1)],
  });
  assert.equal(onlyPartial.evidence[0]?.content, verified.content);
  const splitSegments = projectContextForDelivery(bundle, 'inspect', {
    visibleNativeInputText: [verified.content.slice(0, 12), verified.content.slice(12)],
  });
  assert.equal(splitSegments.evidence[0]?.content, verified.content, 'no stitching across unrelated model messages');
});

test('short exact snippets are not replaced with longer reference markers', () => {
  const short: RetrievalEvidence = {
    ...(evidence[0] as RetrievalEvidence),
    content: 'ok',
  };
  const result = projectContextForDelivery({ ...bundle, evidence: [short] }, 'inspect', {
    visibleNativeInputText: ['ok'],
  });
  assert.equal(result.evidence[0]?.content, 'ok');
  assert.equal(result.deliveryMetrics?.reusedContextBytes, 0);
});

test('AR06 without a callable expansion handle a long verified snippet stays lossless', () => {
  const long = { ...evidence[2]!, expansionHandle: undefined, expansionCursor: undefined, expansionMaxBytes: undefined };
  const projected = projectContextForDelivery({ ...bundle, evidence: [long] }, 'locate');
  assert.equal(projected.evidence[0]?.content, long.content, 'no unresolvable source reference may replace exact bytes');
  assert.equal(projected.evidence[0]?.contentDelivery, undefined);
  assert.equal(projected.evidence[0]?.expansionHandle, undefined);
  assert.equal(projected.deliveryMetrics?.projectionBytesAvoided, 0);
});

test('AR06 Native Responses source map never promises the retired model-invoked expansion command', () => {
  const locate = projectContextForDelivery(bundle, 'locate');
  const text = contextTransportText(locate as unknown as Readonly<Record<string, unknown>>);
  assert.doesNotMatch(text, /ace_expand|context_expand/u);
  assert.match(text, /structuredContent/u);
  const reused = projectContextForDelivery(bundle, 'inspect', {
    knownEvidenceIds: ['any'], receiptScope: 'workspace-1',
  });
  assert.doesNotMatch(contextTransportText(reused as unknown as Readonly<Record<string, unknown>>), /ace_expand/u);
});
