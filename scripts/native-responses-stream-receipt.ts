import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { evaluateNativeResponsesStreamEvidence } from '../src/domain/native-responses-stream-receipt.js';

const [inputArgument, outputArgument, ...extraArguments] = process.argv.slice(2);
if (inputArgument === undefined || outputArgument === undefined || extraArguments.length > 0) {
  throw new Error('Usage: tsx scripts/native-responses-stream-receipt.ts <redacted-stream-evidence.json> <receipt.json>');
}

const inputPath = resolve(inputArgument);
const outputPath = resolve(outputArgument);
if (inputPath === outputPath) throw new Error('stream receipt output must not overwrite the source evidence');
const inputStat = await stat(inputPath);
if (inputStat.size > 16 * 1024 * 1024) throw new Error('stream evidence input exceeds the 16 MiB bound');
const inputBytes = await readFile(inputPath);
if (inputBytes.length > 16 * 1024 * 1024) throw new Error('stream evidence input exceeds the 16 MiB bound');
let raw: unknown;
try {
  raw = JSON.parse(inputBytes.toString('utf8')) as unknown;
} catch {
  throw new Error('stream evidence input is invalid JSON');
}
const evaluated = evaluateNativeResponsesStreamEvidence(raw);
if (evaluated._tag === 'Err') {
  throw new Error(`${evaluated.error.code}: ${evaluated.error.path}: ${evaluated.error.message}`);
}
await writeFile(outputPath, JSON.stringify(evaluated.value, null, 2) + '\n', 'utf8');
process.stdout.write(JSON.stringify({
  evidenceStatus: evaluated.value.evidenceStatus,
  streamStatus: evaluated.value.streamStatus,
  requestId: evaluated.value.requestId,
  attemptId: evaluated.value.attemptId,
  eventCount: evaluated.value.eventCount,
  usageStatus: evaluated.value.usage.status,
  limitation: evaluated.value.trustLimitation,
}) + '\n');

if (process.env.ACE_REQUIRE_NATIVE_RESPONSES_STREAM_COMPLETED === 'true'
  && evaluated.value.streamStatus !== 'completed') {
  process.exitCode = 2;
}
