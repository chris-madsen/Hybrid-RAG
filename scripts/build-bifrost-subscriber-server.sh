#!/usr/bin/env bash
set -euo pipefail

# Builds the REAL Bifröst HTTP subscriber route, not merely the ACE .so plugin.
# Exact source pin includes the reviewed checksum repair, required-plugin
# admission fixes, and subscription-only passthrough. Build is read-only; network access is governed by the
# operator's Go module settings. Build host and plugin together for deployment.
: "${BIFROST_SOURCE_ROOT:?set BIFROST_SOURCE_ROOT to the pinned Bifrost checkout}"
: "${BIFROST_COMMIT:=039f8964b3b8312170fbeb01d6fcbf7a556cdccd}"
: "${GO_BIN:=go}"
: "${OUTPUT:=${RUNNER_TEMP:-${TMPDIR:-$HOME/.cache/ace}}/bifrost-subscriber-server}"

root=$(git -C "$BIFROST_SOURCE_ROOT" rev-parse --show-toplevel)
actual=$(git -C "$root" rev-parse HEAD)
if [[ "$actual" != "$BIFROST_COMMIT" ]]; then
  printf 'Bifröst source mismatch: expected %s got %s\n' "$BIFROST_COMMIT" "$actual" >&2
  exit 2
fi
if [[ -n "$(git -C "$root" status --porcelain --untracked-files=all)" ]]; then
  echo "Pinned Bifröst checkout is not clean; refusing non-reproducible build" >&2
  exit 2
fi
if ! grep -Fqx 'github.com/go-openapi/runtime/server-middleware v0.30.0/go.mod h1:OYNT/TxNvB/VK5oe4htM2jDTwlEXuejVJmu0DVZfAMs=' "$root/transports/go.sum"; then
  echo "Pinned Bifröst source is missing its audited go.mod checksum" >&2
  exit 2
fi
version=$("$GO_BIN" version)
case "$version" in
  *"go1.27.4 "*) ;;
  *) printf 'Expected Go 1.27.4, got %s\n' "$version" >&2; exit 2 ;;
esac
if [[ "$OUTPUT" = /* ]]; then output_path="$OUTPUT"; else output_path="$(pwd)/$OUTPUT"; fi
mkdir -p "$(dirname "$output_path")"
# The pinned source ships UI sources, not prebuilt embedded assets.
# This follows the upstream ui/package.json build and copy-build contract.
(cd "$root/ui" && npm ci --no-audit --no-fund && npm run build)
test -s "$root/transports/bifrost-http/ui/index.html" || {
  echo 'Real UI output is required for the embedded HTTP server' >&2
  exit 2
}

# The pinned Bifröst checkout is a multi-module Go repository. Its published
# versions predate packages in core/streamusage and the routing plugin. The
# official LOCAL build uses a Go workspace with these packages.
# Generate that workspace OUTSIDE the checkout; never sync or tidy pinned mods.
workspace_dir=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/ace-bifrost-work.XXXXXX")
trap 'rm -rf "$workspace_dir"' EXIT
modules=("$root/core" "$root/framework" "$root/transports")
for plugin in "$root"/plugins/*; do
  if [[ -f "$plugin/go.mod" ]]; then modules+=("$plugin"); fi
done
# A Go shared object must use the same module graph, compiler and build tags
# as its host binary. The standalone plugin build is not an ABI proof.
build_tags=sqlite_static
if [[ -n "${ACE_PLUGIN_OUTPUT:-}" ]]; then
  ace_root=$(git rev-parse --show-toplevel)
  ace_commit=$(git -C "$ace_root" rev-parse HEAD)
  test -z "$(git -C "$ace_root" status --porcelain --untracked-files=all)"
  [[ "$ACE_PLUGIN_OUTPUT" = /* ]] || { echo 'ACE_PLUGIN_OUTPUT must be absolute' >&2; exit 2; }
  plugin_root="$workspace_dir/ace-plugin"
  mkdir -p "$plugin_root" "$(dirname "$ACE_PLUGIN_OUTPUT")"
  cp "$ace_root"/integrations/bifrost/ace-connector/plugin/*.go "$plugin_root/"
  printf 'module ace-bifrost-context-plugin\n\ngo 1.27.4\n' > "$plugin_root/go.mod"
  modules+=("$ace_root/integrations/bifrost/ace-connector" "$plugin_root")
  build_tags=sqlite_static,bifrost_plugin
fi
(cd "$workspace_dir" && GOWORK=off "$GO_BIN" work init "${modules[@]}")
# -mod=readonly enforces the pinned versions; workspace sums, if needed,
# remain inside a disposable directory.
(cd "$root/transports" && GOWORK="$workspace_dir/go.work" "$GO_BIN" build \
  -mod=readonly -tags "$build_tags" -o "$output_path" ./bifrost-http)
if [[ -n "${ACE_PLUGIN_OUTPUT:-}" ]]; then
  (cd "$plugin_root" && GOWORK="$workspace_dir/go.work" "$GO_BIN" test -mod=readonly -tags "$build_tags" -count=1 .)
  (cd "$plugin_root" && GOWORK="$workspace_dir/go.work" "$GO_BIN" build -mod=readonly -tags "$build_tags" \
    -buildmode=plugin -ldflags "-X main.aceSourceCommit=$ace_commit -X main.aceBifrostCommit=$actual" -o "$ACE_PLUGIN_OUTPUT" .)
  test -s "$ACE_PLUGIN_OUTPUT"
  test -z "$(git -C "$ace_root" status --porcelain --untracked-files=all)"
  sha256sum "$ACE_PLUGIN_OUTPUT"
fi
if [[ "${BIFROST_VERIFY_REQUIRED_GUARD:-true}" == true ]]; then
  (cd "$root/core" && GOWORK="$workspace_dir/go.work" "$GO_BIN" test -mod=readonly -tags "$build_tags" -count=1 \
    ./providers/utils -run '^TestOperationErrorPreservesPhysicalSendDenial
  (cd "$root/transports" && GOWORK="$workspace_dir/go.work" "$GO_BIN" test -mod=readonly -tags "$build_tags" -count=1 \
    ./bifrost-http/handlers -run '^TestTransportInterceptor(RequiresPhysicalSendPlugin|FailsClosedAfterPluginRemoval|RequiredGuardReadOnlyRoutes|RequiredGuardRejectsUpgradedRead|RequiredGuardLLMRemoval)$' -v)
  (cd "$root/transports" && GOWORK="$workspace_dir/go.work" "$GO_BIN" test -mod=readonly -tags "$build_tags" -count=1 \
    ./bifrost-http/integrations -run '^TestChatGPTPassthrough(SubscriptionOnlyRejectsNonCallerBearer|StreamsWithoutBodyFlag|ForwardsCodexModelList)$' -v)
fi
test -s "$output_path"
if [[ -n "$(git -C "$root" status --porcelain --untracked-files=all)" ]]; then
  echo 'Bifröst build modified tracked source files; refusing artifact' >&2
  exit 2
fi
printf 'bifrost=%s\n' "$actual"
sha256sum "$output_path"
 -v)
  (cd "$root/transports" && GOWORK="$workspace_dir/go.work" "$GO_BIN" test -mod=readonly -tags "$build_tags" -count=1 \
    ./bifrost-http/handlers -run '^TestTransportInterceptor(RequiresPhysicalSendPlugin|FailsClosedAfterPluginRemoval|RequiredGuardReadOnlyRoutes|RequiredGuardRejectsUpgradedRead|RequiredGuardLLMRemoval)$' -v)
  (cd "$root/transports" && GOWORK="$workspace_dir/go.work" "$GO_BIN" test -mod=readonly -tags "$build_tags" -count=1 \
    ./bifrost-http/integrations -run '^TestChatGPTPassthrough(SubscriptionOnlyRejectsNonCallerBearer|StreamsWithoutBodyFlag|ForwardsCodexModelList)$' -v)
fi
test -s "$output_path"
if [[ -n "$(git -C "$root" status --porcelain --untracked-files=all)" ]]; then
  echo 'Bifröst build modified tracked source files; refusing artifact' >&2
  exit 2
fi
printf 'bifrost=%s\n' "$actual"
sha256sum "$output_path"
