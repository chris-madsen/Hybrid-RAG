import assert from 'node:assert/strict';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Effect } from 'effect';
import { makeFileDecisionHistory } from '../src/adapters/file-decision-history.js';
import { decisionStatesForEpisode, makeDecisionRecord, transitionDecision, type DecisionRecord } from '../src/domain/memory.js';
import { makeWorkspaceId } from '../src/domain/workspace.js';

test('local decision history preserves valid-time views for local memory hit enrichment', async () => {
  const workspace = makeWorkspaceId('graphiti-decision-workspace');
  const foreignWorkspace = makeWorkspaceId('graphiti-foreign-workspace');
  if (workspace._tag === 'Err' || foreignWorkspace._tag === 'Err') throw new Error('workspace fixture failed');
  const proposed = makeDecisionRecord({
    decisionId: 'decision-local' as never,
    workspaceId: workspace.value,
    subject: 'memory',
    proposal: 'keep Graphiti local',
    validFromMs: 100,
    sourceEpisodeIds: ['episode-decision' as never],
  });
  if (proposed._tag === 'Err') throw new Error(proposed.error.message);
  const accepted = transitionDecision(proposed.value, {
    type: 'confirm',
    atMs: 200,
    approvalIdentity: 'owner:test',
    sourceEpisodeIds: ['episode-decision' as never],
  });
  if (accepted._tag === 'Err') throw new Error(accepted.error.message);
  const foreign: DecisionRecord = {
    ...accepted.value,
    decisionId: 'decision-foreign' as never,
    workspaceId: foreignWorkspace.value,
  };
  const root = await mkdtemp(join(tmpdir(), 'ace-graphiti-decisions-'));
  const path = join(root, 'decisions.json');
  await writeFile(path, JSON.stringify([accepted.value, foreign]), 'utf8');
  const history = makeFileDecisionHistory(path);
  const loaded = await Effect.runPromise(history.list(workspace.value));
  assert.equal(loaded._tag, 'Ok');
  if (loaded._tag === 'Err') throw new Error(loaded.error.message);
  assert.equal(loaded.value.length, 1);
  assert.equal(decisionStatesForEpisode(
    'episode-decision' as never,
    workspace.value,
    150,
    loaded.value,
  )[0]?.state, 'Proposed');
  assert.equal(decisionStatesForEpisode(
    'episode-decision' as never,
    workspace.value,
    250,
    loaded.value,
  )[0]?.state, 'Accepted');
});

test('local decision history rejects an invalid successor graph instead of exposing fabricated history', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ace-graphiti-invalid-decisions-'));
  const path = join(root, 'decisions.json');
  await writeFile(path, JSON.stringify([{
    decisionId: 'cycle-a',
    workspaceId: 'workspace',
    subject: 'subject',
    proposal: 'a',
    state: 'Superseded',
    validFromMs: 1,
    sourceEpisodeIds: ['episode'],
    successorId: 'cycle-a',
    transitions: [{
      type: 'supersede',
      atMs: 2,
      successorId: 'cycle-a',
      approvalIdentity: 'owner:test',
      sourceEpisodeIds: ['episode'],
    }],
  }]), 'utf8');
  const result = await Effect.runPromise(makeFileDecisionHistory(path).list('workspace' as never));
  assert.equal(result._tag, 'Err');
  if (result._tag === 'Err') assert.equal(result.error.code, 'INVALID_MEMORY');
});
