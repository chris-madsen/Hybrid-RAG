# Tasks

- [x] Retire the optional model-invoked ACE transport and Hermes-native ACE delivery path (#246).
- [x] Require authenticated loopback projection HTTP and fail closed on missing/invalid credentials (#246).
- [x] Bind model/query and permitted additive rewrite to the exact provider body (#246).
- [x] Bind the normalized Bifröst provider attempt to receipt/model/provider/context and block fallback/retry reuse (#246).
- [x] Derive request/session identity from trusted Bifröst HTTP context instead of an unimplemented external ACE host bridge (#247).
- [x] Bind host attestation to exact request bytes and exact ACE/Bifröst source provenance (#247).
- [x] Compile the native plugin against the exact pinned Bifröst revision in PR/nightly CI (#247).
- [x] Keep the structural/process SDLC closure audit distinct from provider/agent acceptance (#247).
- [ ] Reauthorize every retry/fallback attempt before enabling those paths.
- [ ] Certify streaming/request variants only with provider-wire evidence.
- [ ] Run real coding-agent → Bifröst → ACE → authorized external-provider G11 acceptance at the exact delivered commit.
- [ ] Run paired Harbor quality/token/cost evaluation before any token-savings claim.
