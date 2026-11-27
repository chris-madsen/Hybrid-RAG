# Local Hermes task-runtime probe (G11 / #323)

This candidate replaces the permanently blocked **agent runtime** check with an executable, isolated check. It does not replace the independent provider-wire or task-outcome gates. The native projection check stays separate.

The experiment must use an immutable, locally available task image with the approved Hermes v0.22.3 source installation (commit `5b147ab036d6d19131bff8d20701b5001eab844a`) already installed by the existing Hermes/Harbor installation process. A base image that only has Node, Python and Git is not an installed agent image. Freeze the actual image digest and rebuild the ACE bundle for it. No automatic install or pull happens during preflight. The probe uses the native Hermes PM-selected dependency environment, verifies the source checkout, launcher digest, actual Responses transport and SDK 2.24.0, and verifies the actual upstream credential-pool route resolves to the configured Codex endpoint (without using credentials), then observes the native request using the SDK's terminal mock transport. It requires the complete Codex base URL from PR #384. No auth store, provider token, private task source or network is mounted into the probe.

Run the normal preflight with frozen experiment/job/bundle inputs. The same lower-level probe may be run independently:

```sh
node scripts/ace-container-runtime-smoke.mjs \
  --image "$PINNED_TASK_IMAGE" --bundle "$ACE_RUNTIME_BUNDLE" \
  --bundle-sha256 "$PINNED_BUNDLE_SHA256" \
  --hermes-endpoint-sha256 "$PINNED_ENDPOINT_SHA256" --hermes-model "$BARE_CODEX_MODEL" \
  --hermes-reasoning "$PINNED_REASONING_EFFORT"
```

A successful local receipt binds the checkout, bundle, image, Hermes commit/launcher/transport, SDK version, endpoint and bare wire model hashes, plus the observed reasoning effort. The Harbor adapter digest is checked against the current source, not the retired ContextEngine bridge. It has `providerWireCertified:false`. The Docker image must be trusted; a process in an arbitrary image can forge its own stdout. This is not a signed attestation of the deployed Bifröst listener, real OAuth, post-auth projection, protected physical send or ChatGPT response. Keep `taskRuntimeProbe` blocked until independently correlated real evidence is available. Keep all outputs local.

The feedback preflight includes a `taskRuntimeProbe.stages` summary. It binds the frozen task-image set, ACE bundle, native projection result and Hermes receipts to the current source, endpoint, model and effort. The Bifröst source/plugin integration, local no-egress chain, provider wire and independently accepted C07 task outcome are separate stages; they remain `not_run` unless their own evidence is supplied to their owning checks. The aggregate task-runtime check stays `not_ready` while provider wire or accepted task outcome is unverified. A separate local-chain E2E result does not promote this preflight or certify C07.

## Real local chain (no provider egress)

The pinned Bifröst build workflow exercises the actual installed Hermes SDK transport over loopback HTTP, the compiled Bifröst server with its required ACE plugin, and the compiled ACE Core with native CBM. The same Git-backed retrieval fixture is used. A synthetic, deliberately invalid bearer is only a routing fixture inside the isolated namespace. The destination allowlist is empty. A successful check requires the physical-send denial from ACE, a matching real projection receipt digest in the Core's terminal retrieval trace and policy audit, and native delivered evidence. The SDK ingress digest must equal the actual Core projection input digest, the complete trace and successful pinned CBM search must belong to the same retrieval request, the physical-attempt digest must equal the prepared-body digest for this native fixture, and the delivered fixture definition must match the current source digest. The local observation includes separate digests of the terminal trace receipt and physical-policy audit. No direct Core projection or fabricated receipt is used for this scenario. It is local integration, not a real Hermes agent loop, task-image deployment, signed provider acknowledgement, or C05/C07 certification. Keep the external task-runtime gate blocked.
