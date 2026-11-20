import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { HarborFourArmName } from '../domain/harbor-four-arm.js';
import type { HarborFourArmTrialObservation } from '../domain/harbor-four-arm-evidence.js';

// The Gateway-only adapter intentionally reads native projection decisions,
// not optional model-selected tool events. Projection is NOT proof of final model
// egress; successfulAceCalls stays zero until a separately verified final-send
// correlation schema is supported. No fake acceptance metrics are generated.
type JsonRecord = Readonly<Record<string, unknown>>;

const object = (value: unknown): JsonRecord | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : undefined;

const nonEmpty = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const integer = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

const readJson = async (path: string): Promise<JsonRecord> => {
  const value = object(JSON.parse(await readFile(path, 'utf8')) as unknown);
  if (value === undefined) throw new Error(`BLOCKED: Harbor JSON must be an object: ${path}`);
  return value;
};

const trialDirs = async (aggregatePath: string): Promise<readonly string[]> => {
  const aggregate = await readJson(aggregatePath);
  const count = integer(aggregate.n_total_trials ?? aggregate.nTotalTrials);
  if (count === null || count < 1) throw new Error('BLOCKED: aggregate trial count missing or invalid');
  const parent = dirname(resolve(aggregatePath));
  const entries = await readdir(parent, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => join(parent, entry.name)).sort();
  if (dirs.length !== count) throw new Error('BLOCKED: trial directories do not match aggregate count');
  const start = await Promise.all(dirs.map(async (path) => {
    const data = await readJson(join(path, 'result.json'));
    return { path, time: typeof data.started_at === 'string' ? Date.parse(data.started_at) : NaN };
  }));
  if (start.every((entry) => Number.isFinite(entry.time))) {
    start.sort((left, right) => left.time - right.time);
    if (start.some((entry, i) => i > 0 && entry.time === start[i - 1]?.time)) {
      throw new Error('BLOCKED: ambiguous trial timestamp ordering');
    }
    return start.map((entry) => entry.path);
  }
  return dirs;
};

const readResponsesProjections = async (
  arm: HarborFourArmName,
  directory: string,
): Promise<readonly JsonRecord[]> => {
  const path = join(directory, 'agent', 'ace-responses-projection.jsonl');
  if (!existsSync(path)) {
    if (arm === 'native') return [];
    throw new Error(`BLOCKED: missing native Responses projection evidence at ${path}; do not infer ACE delivery`);
  }
  const lines = (await readFile(path, 'utf8')).split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (arm === 'native' && lines.length > 0) {
    throw new Error('BLOCKED: native baseline contains ACE projection evidence');
  }
  const requests = new Set<string>();
  return lines.map((line, index) => {
    const parsed = object(JSON.parse(line) as unknown);
    const decision = object(parsed?.decision) ?? parsed;
    const kind = decision?.kind;
    const requestId = nonEmpty(parsed?.requestId);
    if (!parsed || parsed.schemaVersion !== 'ace.gateway.v2'
      || !decision || !['PREPARED', 'BLOCK'].includes(String(kind)) || requestId === undefined) {
      throw new Error(`BLOCKED: malformed native Responses projection evidence ${index + 1}`);
    }
    if (requests.has(requestId)) throw new Error('BLOCKED: duplicate native Responses projection request identity');
    requests.add(requestId);
    return parsed;
  });
};

const readTrial = async (
  arm: HarborFourArmName,
  directory: string,
): Promise<HarborFourArmTrialObservation> => {
  const file = join(directory, 'result.json');
  const record = await readJson(file);
  const taskName = nonEmpty(record.task_name ?? record.trial_name);
  if (taskName === undefined) throw new Error('BLOCKED: missing Harbor trial task name');
  const verifier = object(record.verifier_result);
  const rewards = object(verifier?.rewards);
  const reward = rewards?.reward;
  if (typeof reward !== 'number' || !Number.isFinite(reward)) {
    throw new Error('BLOCKED: raw verifier reward is missing');
  }
  const exception = object(record.exception_info);
  if (exception?.type === 'VerifierTimeoutError' || record.timed_out === true) {
    throw new Error('BLOCKED: Harbor trial timed out');
  }
  const agent = object(record.agent_result);
  const began = typeof record.started_at === 'string' ? Date.parse(record.started_at) : NaN;
  const finished = typeof record.finished_at === 'string' ? Date.parse(record.finished_at) : NaN;
  const projections = await readResponsesProjections(arm, directory);
  return {
    arm,
    trialId: nonEmpty(record.trial_id) ?? basename(directory),
    taskName,
    success: (record.exception_info === null || record.exception_info === undefined) && reward === 1,
    timedOut: typeof record.timed_out === 'boolean' ? record.timed_out : null,
    // Gateway projection requests are not model-invoked ACE calls and cannot
    // establish that a provider actually received the rewritten request.
    observedAceCalls: 0,
    successfulAceCalls: 0,
    observedAceToolCalls: 0,
    successfulAceToolCalls: 0,
    gatewayProjectionRequestIds: projections.map((projection) => String(projection.requestId)),
    rawInputTokens: integer(agent?.n_input_tokens),
    rawOutputTokens: integer(agent?.n_output_tokens),
    cachedInputTokens: integer(agent?.n_cache_tokens),
    nativeFileReads: null,
    uniqueContextBytes: null,
    newContextBytes: null,
    reusedContextBytes: null,
    duplicateContextAvoided: null,
    latencyMs: Number.isFinite(began) && Number.isFinite(finished) && finished >= began ? finished - began : null,
    successfulRequestIds: [],
    evidenceReceiptIds: [],
    reusedReceiptIds: [],
  };
};

export const readHarborFourArmTrialObservations = async (
  arm: HarborFourArmName,
  aggregatePath: string,
): Promise<readonly HarborFourArmTrialObservation[]> =>
  Promise.all((await trialDirs(aggregatePath)).map((directory) => readTrial(arm, directory)));
