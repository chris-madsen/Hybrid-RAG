import { execFileSync } from 'node:child_process';

const routeLines = (output) => output.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);

const linkNames = (output) => output.split(/\r?\n/u).map((line) => {
  const match = /^\d+:\s+([^:]+):/u.exec(line.trim());
  return match?.[1]?.split('@', 1)[0] ?? null;
}).filter((name) => name !== null);

export const inspectLoopbackOnlyNetwork = ({ links, ipv4Routes, ipv6Routes }) => {
  const interfaces = linkNames(links);
  const routes = [...routeLines(ipv4Routes), ...routeLines(ipv6Routes)];
  const routeDevices = routes.map((route) => /(?:^|\s)dev\s+(\S+)/u.exec(route)?.[1] ?? 'unknown');
  const hasDefaultRoute = routes.some((route) => /(?:^|\s)default(?:\s|$)/u.test(route));
  const routesAreLoopbackOnly = !hasDefaultRoute && routeDevices.every((device) => device === 'lo');

  return {
    interfaces,
    routeDevices,
    isolated: interfaces.length === 1 && interfaces[0] === 'lo' && routesAreLoopbackOnly,
  };
};

const readIpOutput = (args) => {
  try {
    return execFileSync('ip', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    throw new Error('NETWORK_NAMESPACE_INSPECTION_UNAVAILABLE');
  }
};

export const assertLoopbackOnlyNetworkNamespace = () => {
  const evidence = inspectLoopbackOnlyNetwork({
    links: readIpOutput(['-o', 'link', 'show']),
    ipv4Routes: readIpOutput(['-4', 'route', 'show', 'table', 'main']),
    ipv6Routes: readIpOutput(['-6', 'route', 'show', 'table', 'main']),
  });
  if (!evidence.isolated) throw new Error('NETWORK_NAMESPACE_NOT_LOOPBACK_ONLY');
  return evidence;
};
