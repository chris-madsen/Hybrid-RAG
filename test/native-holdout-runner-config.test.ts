import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNativeCandidateLimitEvidence, resolveNativeCandidateLimitConfig } from '../scripts/native-holdout-runner-config.mjs';

test('development candidate-limit override is passed explicitly to the child runtime', () => {
  assert.deepEqual(resolveNativeCandidateLimitConfig('--dev-candidate-limit=10', 'development_source_bound'), {
    candidateLimit: 10,
    childEnvironment: { ACE_CONTEXT_CANDIDATE_LIMIT: '10' },
  });
});

test('native holdout runs without an override keep the runtime default', () => {
  assert.deepEqual(resolveNativeCandidateLimitConfig(undefined, 'development_source_bound'), {
    candidateLimit: 6,
    childEnvironment: {},
  });
  assert.deepEqual(resolveNativeCandidateLimitConfig(undefined, 'frozen_multi_repository_holdout'), {
    candidateLimit: 6,
    childEnvironment: {},
  });
});

test('candidate-limit overrides are rejected for frozen release holdouts', () => {
  assert.throws(
    () => resolveNativeCandidateLimitConfig('--dev-candidate-limit=10', 'frozen_multi_repository_holdout'),
    /development_source_bound/u,
  );
});

test('candidate-limit overrides reject malformed and out-of-range values', () => {
  for (const option of [
    '--candidate-limit=10', '--dev-candidate-limit=0', '--dev-candidate-limit=21',
    '--dev-candidate-limit=1.5', '--dev-candidate-limit=10x',
  ]) {
    assert.throws(
      () => resolveNativeCandidateLimitConfig(option, 'development_source_bound'),
      /candidate-limit/u,
      option,
    );
  }
});

test('release projection evidence can only record the default candidate limit', () => {
  assert.doesNotThrow(() => assertNativeCandidateLimitEvidence(6, 'frozen_multi_repository_holdout'));
  assert.throws(
    () => assertNativeCandidateLimitEvidence(10, 'frozen_multi_repository_holdout'),
    /default candidate limit/u,
  );
  assert.doesNotThrow(() => assertNativeCandidateLimitEvidence(20, 'development_source_bound'));
  assert.throws(
    () => assertNativeCandidateLimitEvidence(21, 'development_source_bound'),
    /integer from 1 to 20/u,
  );
});
