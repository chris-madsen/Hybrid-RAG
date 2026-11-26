import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectLoopbackOnlyNetwork } from '../scripts/network-namespace-evidence.mjs';

test('accepts a netlink snapshot with only loopback and no external routes', () => {
  const evidence = inspectLoopbackOnlyNetwork({
    links: '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default\n',
    ipv4Routes: '',
    ipv6Routes: 'local ::1 dev lo proto kernel metric 0 pref medium\n',
  });

  assert.equal(evidence.isolated, true);
  assert.deepEqual(evidence.interfaces, ['lo']);
});

test('rejects non-loopback interfaces reported by the current network namespace', () => {
  const evidence = inspectLoopbackOnlyNetwork({
    links: [
      '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default',
      '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default',
    ].join('\n'),
    ipv4Routes: '',
    ipv6Routes: '',
  });

  assert.equal(evidence.isolated, false);
  assert.deepEqual(evidence.interfaces, ['lo', 'eth0']);
});

test('rejects default or non-loopback routes even when loopback is present', () => {
  const evidence = inspectLoopbackOnlyNetwork({
    links: '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default\n',
    ipv4Routes: 'default via 172.18.0.1 dev eth0 proto dhcp metric 100\n',
    ipv6Routes: '',
  });

  assert.equal(evidence.isolated, false);
  assert.deepEqual(evidence.routeDevices, ['eth0']);
});
