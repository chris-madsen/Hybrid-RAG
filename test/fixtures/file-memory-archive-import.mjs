import { createHash } from 'node:crypto';
import { makeAsyncFileMemoryArchive } from '../../src/adapters/file-memory-archive.js';

const root = process.argv[2];
if (!root) process.exit(2);
const bytes = Buffer.from('immutable archive original: exact bytes after crash\n', 'utf8');
const archive = await makeAsyncFileMemoryArchive(root);
const imported = await archive.importEpisode({
  episodeId: 'ar04-crash-episode',
  workspaceId: 'ar04-workspace',
  sessionId: 'ar04-session',
  sourcePointer: 'codex://ar04/original/1',
  occurredAtMs: 100,
  importedAtMs: 101,
  contentDigest: createHash('sha256').update(bytes).digest('hex'),
  content: bytes,
  searchText: 'immutable archive original',
  tombstoned: false,
});
if (imported._tag === 'Err') {
  process.stderr.write(imported.error.code + '\n');
  process.exit(3);
}
process.stdout.write(JSON.stringify({ created: imported.value.created }) + '\n');
