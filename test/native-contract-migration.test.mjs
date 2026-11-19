import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyRetainedPublicContract } from '../scripts/verify-native-contract-migration.mjs';

const retained = {
  sourceCommit: 'source-id',
  context: { completeType: 'boolean', sourceKinds: ['code', 'memory'] },
  domainErrorCodes: ['INVALID_INPUT'],
  hermes: { bridgeHandshake: { type: 'bridge_ready' } },
};

test('before migration, removing only retired generation-contract owners is permitted', () => {
  const previous = {
    ...retained,
    gateway: { retired: true },
    bifrost: { retired: true },
    [String.fromCharCode(109, 99, 112)]: { retired: true },
  };
  assert.equal(verifyRetainedPublicContract({ previous, base: null, current: retained }), 'legacy-migration-verified');
  assert.throws(() => verifyRetainedPublicContract({
    previous, base: null, current: { ...retained, domainErrorCodes: [] },
  }), /may remove only/u);
});

test('after migration, every PR still checks retained public baseline against its base', () => {
  assert.equal(verifyRetainedPublicContract({ previous: null, base: retained, current: retained }), 'retained-baseline-verified');
  assert.throws(() => verifyRetainedPublicContract({
    previous: null, base: retained,
    current: { ...retained, hermes: { bridgeHandshake: { type: 'different' } } },
  }), /Retained public contract baseline changed/u);
  assert.throws(() => verifyRetainedPublicContract({
    previous: null, base: null, current: retained,
  }), /public contract baseline on PR base/u);
});
