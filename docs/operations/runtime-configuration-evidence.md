# ACE runtime configuration release evidence

Schema v2 binds safe runtime flags and declared native provider identities to the exact Git commit and release scope. It records no tokens, certificates, raw workspace paths, queries, source bytes or private dialogue. Schema v1 is historical and cannot authorize the native-only runtime.

## Capture

Run in the environment that launches ACE:

```bash
npm run evidence:runtime-config -- \
  code-only host \
  code-only-release-capture \
  artifacts/release/runtime-config.json
```

For a hard gate, set `ACE_REQUIRE_RUNTIME_CONFIG_ACCEPTED=true`.

## Code-only acceptance

- Native CBM is the sole configured code provider, pinned to `codebase-memory/v0.12.1`.
- No local fallback or independent LSP is configured in this runtime. The separate LSP contracts remain for research.
- Documentation, cloud-doc opt-in, memory and external data permissions are disabled.
- The workspace is ACE-local; remote host helper and unaccepted k3s topology fail closed.

The full-unified and k3s profiles remain blocked until their actual runtime and topology are implemented and accepted. Historical artifacts cannot certify them.

## Claim boundary

The configuration verdict is not provider availability, retrieval quality, daemon isolation, Harbor value or release approval. Code-only release additionally requires absolute frozen multi-repository quality evidence, all scoped DBCs, resource budget, natural-use Harbor evidence, supply-chain evidence and owner-signed approval bound to the native provider identities. See [configuration matrix](ace-configuration-and-readiness-matrix.md).
