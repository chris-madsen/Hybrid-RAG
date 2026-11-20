import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { evaluateNativeResponsesStreamEvidence } from '../src/domain/native-responses-stream-receipt.js';

const [inputArgument, outputArgument, ...extraArguments] = process.argv.slice(2);
if (inputArgument === undefined || outputArgument === undefined || extraArguments.length > 0) {
  throw new Error('Usage: tsx scripts/native-responses-stream-receipt.ts <redacted-stream-evidence.json> <receipt.json>');
}

const inputPath = resolve(inputArgument);
const outputPath = resolve(outputArgument);
if (inputPath === outputPath) throw new Error('stream receipt output must not overwrite the source evidence');
const maximumInputBytes = 16 * 1024 * 1024;
// Open once by descriptor, without following a symlink. Size, content and
// final stat all belong to the same inode, so swapping the path during the
// read cannot substitute an unrelated private file.
const inputHandle = await open(inputPath, constants.O_RDONLY | constants.O_NOFOLLOW);
let inputBytes: Buffer;
try {
  const initialStat = await inputHandle.stat();
  if (!initialStat.isFile() || initialStat.size > maximumInputBytes) {
    throw new Error('stream evidence input must be a regular file no larger than 16 MiB');
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  while (totalBytes <= maximumInputBytes) {
    const chunk = Buffer.alloc(Math.min(64 * 1024, maximumInputBytes + 1 - totalBytes));
    const { bytesRead } = await inputHandle.read(chunk, 0, chunk.length, totalBytes);
    if (bytesRead === 0) break;
    totalBytes += bytesRead;
    if (totalBytes > maximumInputBytes) throw new Error('stream evidence input exceeds the 16 MiB bound');
    chunks.push(chunk.subarray(0, bytesRead));
  }
  const finalStat = await inputHandle.stat();
  if (initialStat.dev !== finalStat.dev || initialStat.ino !== finalStat.ino
    || initialStat.size !== finalStat.size || initialStat.mtimeMs !== finalStat.mtimeMs
    || initialStat.ctimeMs !== finalStat.ctimeMs) {
    throw new Error('stream evidence input changed while being read');
  }
  inputBytes = Buffer.concat(chunks, totalBytes);
} finally {
  await inputHandle.close();
}
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
// A distinct pathname alone is not sufficient: output could be a symlink
// or hardlink alias of the input. Exclusive create refuses preexisting paths,
// and O_NOFOLLOW blocks a symlink at the creation boundary. Never truncate
// any original evidence or unrelated sensitive file.
const receiptHandle = await open(outputPath,
  constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
try {
  await receiptHandle.writeFile(JSON.stringify(evaluated.value, null, 2) + '\n', 'utf8');
  await receiptHandle.sync();
} finally {
  await receiptHandle.close();
}
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
