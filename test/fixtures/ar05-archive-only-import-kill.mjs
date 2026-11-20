import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { makeAsyncFileMemoryArchive } from '../../src/adapters/file-memory-archive.js';
import { makeFileProjectionOutbox } from '../../src/adapters/file-projection-outbox.js';
import { importMemoryEpisodes } from '../../src/application/memory-import.js';

const root = process.argv[2];
const failpoint = process.argv[3];
if (!root || !['before-original', 'after-original'].includes(failpoint)) process.exit(2);
const bytes = Buffer.from('ar05 shared original source bytes\n', 'utf8');
const episode = {
  episodeId: 'ar05-crash-episode',
  workspaceId: 'ar05-workspace',
  sessionId: 'ar05-session',
  sourcePointer: 'codex://ar05/original/1',
  occurredAtMs: 100,
  importedAtMs: 101,
  contentDigest: createHash('sha256').update(bytes).digest('hex'),
  content: bytes,
  searchText: 'ar05 shared original source bytes',
  memoryHint: 'archive_only',
  tombstoned: false,
};
const archive = await makeAsyncFileMemoryArchive(join(root, 'archive'));
const outbox = await makeFileProjectionOutbox(join(root, 'outbox'));
const injected = {
  ...archive,
  importEpisode: async (input) => {
    const proof = await outbox.isArchiveOnly(input.episodeId);
    if (proof._tag !== 'Ok' || !proof.value) {
      process.stderr.write('missing durable precommit archive-only proof\n');
      process.exit(3);
    }
    if (failpoint === 'before-original') process.kill(process.pid, 'SIGKILL');
    const stored = await archive.importEpisode(input);
    if (stored._tag === 'Err') {
      process.stderr.write(stored.error.code + '\n');
      process.exit(4);
    }
    process.kill(process.pid, 'SIGKILL');
    return stored;
  },
};
await importMemoryEpisodes({
  episodes: [episode], archive: injected, outbox,
  extractorVersion: 'ar05-v1',
  createProjection: async () => { throw new Error('archive-only must not instantiate Graphiti'); },
});
process.exit(5);
