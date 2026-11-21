#!/usr/bin/env bash
set -euo pipefail

# Builds the REAL Bifröst HTTP subscriber route, not merely the ACE .so plugin.
# The exact source pin includes only the reviewed go.sum checksum repair atop
# the previously approved 6baf302d source. Build is read-only and network
# access is governed by the operator's Go module settings.
: "${BIFROST_SOURCE_ROOT:?set BIFROST_SOURCE_ROOT to the pinned Bifrost checkout}"
: "${BIFROST_COMMIT:=72f03b4b0d4a93b08e9fc0e5ebfe3447248af2a0}"
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
(cd "$workspace_dir" && GOWORK=off "$GO_BIN" work init "${modules[@]}")
# -mod=readonly enforces the pinned versions; workspace sums, if needed,
# remain inside a disposable directory.
(cd "$root/transports" && GOWORK="$workspace_dir/go.work" "$GO_BIN" build \
  -mod=readonly -tags sqlite_static -o "$output_path" ./bifrost-http)
test -s "$output_path"
if [[ -n "$(git -C "$root" status --porcelain --untracked-files=all)" ]]; then
  echo 'Bifröst build modified tracked source files; refusing artifact' >&2
  exit 2
fi
printf 'bifrost=%s\n' "$actual"
sha256sum "$output_path"
