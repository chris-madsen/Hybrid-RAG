import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import {
  bindNativeResponsesFinalWireReceiptToContext,
  evaluateNativeResponsesFinalWireEvidence,
  evaluateProviderTraceReceipt,
} from '../src/domain/provider-trace-receipt.js';
import { verifyFinalWireEvidenceEnvelope } from './real-provider-evidence.mjs';
import type { VerifiedFinalWireReceipt } from './real-provider-evidence.mjs';
import type { SourceCoverage } from '../src/domain/source-coverage.js';

const containedPath = (input: string): string => {
  const absolute = resolve(input);
  const rel = relative(process.cwd(), absolute);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || rel.length === 0) {
    throw new Error(`trace receipt path must be repository-contained: ${input}`);
  }
  return rel.split('\\').join('/');
};

const [bundleArg, traceArg, outputArg, ...evidenceArgs] = process.argv.slice(2);
if (bundleArg === undefined || traceArg === undefined || outputArg === undefined) {
  throw new Error('Usage: tsx scripts/provider-trace-receipt.ts <context-bundle.json> <provider-trace.jsonl> <output.json>');
}
if (evidenceArgs.length !== 0 && (evidenceArgs.length !== 4
  || evidenceArgs[0] !== '--final-wire'
  || evidenceArgs[2] !== '--verification-public-key')) {
  throw new Error('Optional final-wire arguments must be --final-wire <manifest.json> --verification-public-key <public-key.pem>');
}

const bundlePath = containedPath(bundleArg);
const tracePath = containedPath(traceArg);
const [bundleBytes, traceBytes] = await Promise.all([
  readFile(bundlePath),
  readFile(tracePath),
]);

const bundleRaw = JSON.parse(bundleBytes.toString('utf8')) as unknown;
if (typeof bundleRaw !== 'object' || bundleRaw === null || Array.isArray(bundleRaw)) {
  throw new Error('ContextBundle evidence input must be an object');
}
const bundle = bundleRaw as Record<string, unknown>;
if (typeof bundle.requestId !== 'string' || !Array.isArray(bundle.sourceCoverage)) {
  throw new Error('ContextBundle evidence input requires requestId and sourceCoverage');
}

const events: unknown[] = [];
for (const [index, line] of traceBytes.toString('utf8').split('\n').entries()) {
  if (line.trim().length === 0) continue;
  try {
    events.push(JSON.parse(line) as unknown);
  } catch {
    throw new Error(`provider trace line ${index + 1} is invalid JSON`);
  }
}

const receipt = evaluateProviderTraceReceipt(
  bundle.requestId,
  bundle.sourceCoverage as SourceCoverage[],
  events,
);
if (receipt._tag === 'Err') {
  throw new Error(`${receipt.error.code}: ${receipt.error.path}: ${receipt.error.message}`);
}

let finalWireEvidence:
  | {
      readonly manifestPath: string;
      readonly manifestSha256: string;
      readonly signerKeySha256?: string;
      readonly receipt: VerifiedFinalWireReceipt;
    }
  | undefined;
if (evidenceArgs.length === 4) {
  const manifestPath = containedPath(evidenceArgs[1] as string);
  const verificationPublicKeyPath = resolve(evidenceArgs[3] as string);
  const [manifestBytes, verificationPublicKeyBytes] = await Promise.all([
    readFile(manifestPath), readFile(verificationPublicKeyPath),
  ]);
  let envelope: unknown;
  try {
    envelope = JSON.parse(manifestBytes.toString('utf8')) as unknown;
  } catch {
    throw new Error('final-wire evidence manifest is invalid JSON');
  }
  const verified = verifyFinalWireEvidenceEnvelope(
    envelope,
    verificationPublicKeyBytes.toString('utf8'),
    evaluateNativeResponsesFinalWireEvidence,
  );
  const finalWireReceipt = bindNativeResponsesFinalWireReceiptToContext(
    verified.receipt, bundle.requestId,
  );
  finalWireEvidence = {
    manifestPath,
    manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    ...(verified.proof.kind === 'signed-provider-capture' && verified.proof.signerKeySha256 !== undefined
      ? { signerKeySha256: verified.proof.signerKeySha256 }
      : {}),
    receipt: finalWireReceipt,
  };
}

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  bundle: {
    path: bundlePath,
    sha256: createHash('sha256').update(bundleBytes).digest('hex'),
  },
  trace: {
    path: tracePath,
    sha256: createHash('sha256').update(traceBytes).digest('hex'),
  },
  receipt: receipt.value,
  finalWireEvidence: finalWireEvidence ?? { status: 'NOT_RUN' },
};
await writeFile(resolve(outputArg), JSON.stringify(output, null, 2) + '\n', 'utf8');
process.stdout.write(JSON.stringify({
  output: outputArg,
  requestId: receipt.value.requestId,
  receipt: receipt.value.receipt,
  failures: receipt.value.failures,
  finalWireStatus: finalWireEvidence === undefined
    ? 'NOT_RUN'
    : finalWireEvidence.receipt.status,
}) + '\n');

if (process.env.ACE_REQUIRE_TRACE_RECEIPT_COMPLETE === 'true'
  && receipt.value.receipt !== 'provider-trace-complete') {
  process.exitCode = 2;
}
