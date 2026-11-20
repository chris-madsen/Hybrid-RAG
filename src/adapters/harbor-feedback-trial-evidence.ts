import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  readHarborFourArmTrialDirectories,
  readHarborFourArmTrialObservations,
} from './harbor-four-arm-trial-evidence.js';
import type { HarborFourArmTrialObservation } from '../domain/harbor-four-arm-evidence.js';
import {
  validateNativeResponsesStreamReceipt,
  type NativeResponsesStreamReceipt,
} from '../domain/native-responses-stream-receipt.js';

/** The two arms used by the real feedback-loop experiment. */
export type HarborFeedbackArm = 'native' | 'ace_optional';

export interface HarborFeedbackTrialObservation extends Omit<HarborFourArmTrialObservation,
'arm' | 'observedAceCalls' | 'successfulAceCalls'> {
  readonly arm: HarborFeedbackArm;
  /** Explicit ACE tool calls; automatic Gateway projections are recorded separately. */
  readonly observedAceCalls: number;
  /** Legacy model-invoked context calls; the supported Responses route does not use these tools. */
  readonly observedAceContextCalls: number;
  /** Provider-confirmed applied calls; this adapter leaves them zero until final-wire proof is accepted. */
  readonly successfulAceCalls: number;
  readonly nativeResponsesStreamReceipts: readonly NativeResponsesStreamReceipt[];
}

const readJsonl = async (path: string): Promise<readonly unknown[]> => {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  const values: unknown[] = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (line.trim().length === 0) continue;
    try {
      values.push(JSON.parse(line) as unknown);
    } catch {
      throw new Error(`BLOCKED: malformed receipt JSON at ${path}:${index + 1}`);
    }
  }
  return values;
};

const readStreamReceipts = async (path: string): Promise<readonly NativeResponsesStreamReceipt[]> => {
  const receipts: NativeResponsesStreamReceipt[] = [];
  for (const [index, raw] of (await readJsonl(path)).entries()) {
    const checked = validateNativeResponsesStreamReceipt(raw);
    if (checked._tag === 'Err') {
      throw new Error(`BLOCKED: invalid stream receipt at ${path}:${index + 1}: ${checked.error.path}: ${checked.error.message}`);
    }
    receipts.push(checked.value);
  }
  return receipts;
};

/**
 * Read ordinary Harbor result.json trial directories without exposing the
 * historical four-arm names to the feedback-loop collector.
 */
export const readHarborFeedbackTrialObservations = async (
  arm: HarborFeedbackArm,
  aggregatePath: string,
): Promise<readonly HarborFeedbackTrialObservation[]> => {
  const observations = await readHarborFourArmTrialObservations(arm === 'native' ? 'native' : 'dense', aggregatePath);
  const directories = await readHarborFourArmTrialDirectories(aggregatePath);
  if (observations.length !== directories.length) throw new Error('BLOCKED: feedback trial list changed while evidence was read');
  return Promise.all(observations.map(async (observation, index) => {
    const directory = directories[index];
    if (directory === undefined) throw new Error('BLOCKED: feedback trial directory is missing');
    const result = JSON.parse(await readFile(join(directory, 'result.json'), 'utf8')) as Record<string, unknown>;
    const currentTrialId = typeof result.trial_id === 'string' && result.trial_id.trim().length > 0
      ? result.trial_id : basename(directory);
    if (currentTrialId !== observation.trialId) {
      throw new Error('BLOCKED: feedback trial identity changed while receipts were being read');
    }
    const streamReceipts = await readStreamReceipts(join(directory, 'agent', 'ace-native-responses-stream-receipts.jsonl'));
    const projectionRequestIds = new Set(observation.gatewayProjectionRequestIds ?? []);
    if (arm === 'native' && streamReceipts.length > 0) {
      throw new Error('BLOCKED: native baseline contains ACE stream receipts');
    }
    if (streamReceipts.some((receipt) => !projectionRequestIds.has(receipt.requestId))) {
      throw new Error('BLOCKED: stream receipt is not bound to a retained Gateway projection request');
    }
    return {
      ...observation,
      arm,
      observedAceContextCalls: 0,
      observedAceCalls: observation.observedAceToolCalls ?? 0,
      successfulAceCalls: observation.successfulAceToolCalls ?? observation.successfulAceCalls,
      gatewayProjectionRequestIds: observation.gatewayProjectionRequestIds ?? [],
      nativeResponsesStreamReceipts: streamReceipts,
    };
  }));
};
