# AR03 — historical single-host Qdrant publication authority

**RETIRED:** #378 removed Qdrant code retrieval and its publication machinery. This record describes the former implementation, not a deployment procedure. Do not configure its environment variables or run its obsolete tests on current main. Native CBM lifecycle, cache ownership and source verification remain separate acceptance obligations; see [current runtime](current-architecture.md) and [#363](https://github.com/chris-madsen/Hybrid-RAG/issues/363).

## Deployment boundary

The former ACE implementation wrote directly to one Qdrant **stable collection** per workspace/provider fingerprint; the historical immutable-collection and `..._current` alias-switch runbook was superseded by stable-collection publication before the entire Qdrant path was retired. An acknowledged upsert or atomic alias switch does **not** implement cross-process compare-and-swap. Writers need an authority covering source observation, mutation/deletion, physical membership verification and commit.

AR03 implements conservative **single-Linux-host** fencing, not distributed consensus. Set the following environment variable to the **same shared, durable local directory for every writer of the same workspace**:

    ACE_QDRANT_WRITER_TOPOLOGY=single_host
    ACE_QDRANT_PUBLICATION_DIR=/var/lib/ace/qdrant-publication

Directory mode must be owner-private 0700; state/lock files must be 0600. The util-linux flock executable is required. Never use distinct per-process directories, private ephemeral container volumes, different users, or uncoordinated hosts. A multi-host / k3s multi-node writer topology remains NOT_READY pending G02 owner selection and a genuinely distributed fencing authority.

Missing/invalid directory, malformed state, lock timeout, unsupported OS, source race and membership failure fail closed. There is no fallback to unfenced delete or alias code. An old binary that writes the collection without acquiring this authority bypasses the fence; a coordinated all-writers rollout is required.

## Commit protocol

1. Under workspace-scoped kernel lock, reserve and fsync a strictly increasing safe-integer epoch **before** computing candidates. A crash never reuses the reservation. If the durable authority record is missing, the runtime first ensures the selected Qdrant collection and proves via official SDK exact workspace-scoped count that **zero physical points exist**. A nonempty workspace or failed count refuses bootstrap rather than resetting old epochs.
2. Build exact source candidates. Before any Qdrant mutation, reacquire the kernel lock and reject any epoch at or below the committed epoch.
3. Under that lock, re-observe the authoritative source manifest. Refuse any stale source or changed scope.
4. Run the existing official-SDK Qdrant upsert, changed-path cleanup and candidate verification. Re-observe the source afterward and verify the **complete physical workspace candidate membership**, not just changed paths.
5. Atomically fsync, rename and directory-sync the durable committed epoch/index key, then release the lock. On SIGKILL the kernel releases the file-description lock automatically. An uncommitted physical write is not recorded as published.

A reserves epoch 1 and pauses; B reserves epoch 2, publishes and commits; A resumes and is rejected before any upsert/delete/alias promotion callback. Equal-epoch reuse and committed-ticket replay are also rejected. Failed membership leaves committed state unchanged.

## Verification and limits

Deterministic two-OS-process and crash recovery tests are in test/qdrant-crash-runner.contracts.test.ts. Alias epoch/replay/membership tests are in test/qdrant-alias.contracts.test.ts. The runtime invokes the existing verifyQdrantSnapshotMembership against the whole expected candidate set under the same authority.

**Not yet acceptance evidence:** real local Qdrant multiprocess trials, restart/membership/performance proof, cross-host topology choice and operator G02 sign-off remain separate tasks. No LLM egress is added by this phase. The historical alias crash runbook describes a retired model-invoked path and is not current stable-collection proof.

## Rollback

Never roll back to a binary that can write unfenced into the same live collection. Stop all ACE writers for an authorized rollback/migration. Do not delete or reset the durable publication record merely to regain readiness; a reset could reauthorize an old writer. Restore a known-good record only under an explicitly reviewed maintenance process.
