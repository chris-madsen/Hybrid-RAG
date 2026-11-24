# ACE architecture fitness — installed SDLC rules

**Active tool role:** the pinned npm development dependency `@ast-grep/cli` is used for syntax-based **architecture lint**, not runtime code AST/graph/retrieval. Codebase Memory v0.12.1 is the production candidate's native structural/graph/search engine. See [current architecture](current-architecture.md).

## Installed commands

```bash
npm run test:arch-rules
npm run check:arch
npm run check:gateway-only
npm run test:gateway-only-audit
```

The first two commands use native ast-grep syntax rules; the latter two are the separate Gateway-only contract/audit checks. A green syntax warning scan is not real provider-wire or Hermes acceptance.

## Actual rule files in `architecture/rules/`

- `ace-domain-no-adapter-import.yml`
- `ace-application-no-adapter-import.yml`
- `ace-domain-no-application-import.yml`
- `ace-domain-no-provider-io-import.yml`

`check:arch` scans only these installed rules. `test:arch-rules` uses `architecture/sgconfig.yml` fixtures. Consult the configured rule severity before asserting a policy violation. Retired optional-tool transport rules ACE-ARCH-002/003/004 described in older pilots are **not installed** in the current active rule directory.

For new blocking rules require valid/invalid/false-positive fixtures, source observations and owner approval. Do not restore a second ast-grep runtime code parser just because SDLC lint uses the CLI.
