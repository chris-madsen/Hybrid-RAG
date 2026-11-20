import { makeFileProjectionOutbox } from '../../src/adapters/file-projection-outbox.js';

const root = process.argv[2];
if (!root) process.exit(2);
const outbox = await makeFileProjectionOutbox(root);
const begun = await outbox.begin('ar05-killed-attempt', 'extractor-v1');
if (begun._tag === 'Err') process.exit(3);
const reserved = await outbox.startAttempt('ar05-killed-attempt', 'extractor-v1');
if (reserved._tag === 'Err') process.exit(4);
// The durable claim already exists; mimic a hard kill after the external
// attempt might have begun, but before any acknowledgement was persisted.
process.kill(process.pid, 'SIGKILL');
process.exit(5);
