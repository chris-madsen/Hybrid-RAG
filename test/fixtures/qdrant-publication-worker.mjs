// Separate real OS process for AR03 publication authority regression.
// No live Qdrant or provider request: this exercises the same persistent
// writer admission used around the runtime's actual Qdrant mutation.
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { makeLocalQdrantPublicationAuthority } from '../../src/adapters/qdrant-publication-authority.js';
import { makeWorkspaceId } from '../../src/domain/workspace.js';
import { ok } from '../../src/domain/result.js';

const [mode, directory, physicalFile, identity] = process.argv.slice(2);
if (!mode || !directory || !physicalFile || !identity) process.exit(2);
const workspace = makeWorkspaceId(identity);
if (workspace._tag === 'Err') process.exit(3);
const authority = makeLocalQdrantPublicationAuthority({
  workspaceId: workspace.value,
  directory,
});
const indexKey = createHash('sha256').update('candidate-' + mode).digest('hex');

const publish = async (ticket) => authority.publish({
  ticket, indexKey, collection: 'ace_ar03_shared_workspace',
  verifySource: async () => ok(true),
  write: async () => {
    await writeFile(physicalFile, JSON.stringify({ epoch: ticket.epoch, indexKey }));
    return ok(true);
  },
  verifyMembership: async () => ok(true),
});

const reserve = async () => {
  const ticket = await authority.reserve();
  if (ticket._tag === 'Err') throw Error(ticket.error.message);
  return ticket.value;
};

if (mode === 'pause') {
  const ticket = await reserve();
  process.stdout.write('READY ' + ticket.epoch + '\n');
  await new Promise((resolve) => process.stdin.once('data', resolve));
  const result = await publish(ticket);
  process.stdout.write(result._tag + ' '
    + (result._tag === 'Err' ? result.error.code : ticket.epoch) + '\n');
} else if (mode === 'publish') {
  const ticket = await reserve();
  const result = await publish(ticket);
  process.stdout.write(result._tag + ' '
    + (result._tag === 'Err' ? result.error.code : ticket.epoch) + '\n');
} else if (mode === 'hold') {
  const ticket = await reserve();
  await authority.publish({
    ticket, indexKey, collection: 'ace_ar03_shared_workspace',
    verifySource: async () => ok(true),
    write: async () => {
      process.stdout.write('LOCK_HELD\n');
      await new Promise(() => {});
      return ok(true);
    },
    verifyMembership: async () => ok(true),
  });
} else {
  process.exit(4);
}
