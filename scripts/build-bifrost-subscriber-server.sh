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
# -mod=readonly is non-negotiable: no silent dependency updates or local
# checksum creation. The missing sum must be fixed in upstream source first.
(cd "$root/transports" && GOWORK=off "$GO_BIN" build -mod=readonly -o "$output_path" ./bifrost-http)
printf 'bifrost=%s\n' "$actual"
sha256sum "$output_path"
