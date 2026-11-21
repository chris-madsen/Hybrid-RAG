# Request-to-OpenSpec walkthrough: pinned helper skills

| Field | Value |
| --- | --- |
| Type | Observed current-task example, not a synthetic user transcript. |
| Baseline inspected | `origin/main@7f3fc5a0a91e48e9d2573f814dfae96d68415577` |
| Status | The owner request and review scope were sufficient to prepare this bounded change; this artifact does not claim a separate live model invocation. |

## Owner request and decision

The owner supplied a review of ACE SDLC conformance and explicitly directed that the skill-installation work happen before the remaining review actions. The review's P1-D finding identifies the candidate skills, pinned `v1.3.2` source, MIT attribution, preservation of OpenSpec skills, and prohibition on a second tracker/executor.

## Questioning checkpoint

No follow-up owner question was asked for this slice. Repository and upstream inspection answered the factual questions: the tag resolves to the recorded commit/tree, `grill-me` and `grill-with-docs` call the `grilling` skill, and the existing ACE policy requires one agent and OpenSpec. The user already supplied the priority; asking those facts again would be redundant.

For future material decisions, the compatibility policy permits at most three independent questions per round and two rounds per scoped task. It forbids re-asking answered/declined questions or asking the owner for facts retrievable from authorized sources. Unanswered decisions are recorded as `UNKNOWN`/`BLOCKED`; independent work continues.

## PRD-to-acceptance handoff

The request is translated into the canonical OpenSpec change `011-pinned-agent-skills` rather than a separate ticket/spec system. Its capability spec owns these stable acceptance IDs:

- `SKILL-001`: exact pinned upstream bytes and MIT attribution.
- `SKILL-002`: existing ACE/OpenSpec skill entrypoints are preserved.
- `SKILL-003`: no parallel agent executor or issue tracker is activated.
- `SKILL-004`: domain modeling and review follow ACE's existing conventions.
- `SKILL-005`: clarification is bounded to two rounds of three independent questions.
- `SKILL-006`: questions are neither repeated nor asked for tool-resolvable facts.
- `SKILL-007`: requests become OpenSpec acceptance without invented owner answers.

The imported skill files remain byte-identical to upstream; ACE-specific behavior is stated separately in `.agents/skills/ace-sdlc/references/matt-pocock-compatibility.md`.

## Limits

The manifest and tests can establish file provenance, repository-level discovery layout, and compatibility text. They cannot prove an LLM obeys those instructions, an independent review occurred, or any provider/agent/release gate passed.
