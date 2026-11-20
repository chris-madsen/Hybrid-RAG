#!/usr/bin/env bash
set -euo pipefail

: "${BIFROST_SOURCE_ROOT:?set BIFROST_SOURCE_ROOT to the exact Bifrost checkout}"
: "${BIFROST_COMMIT:=6baf302dc73a9858bb96da017a436ef2e60f82f1}"
: "${GO_BIN:=go}"
: "${OUTPUT:=integrations/bifrost/ace-connector/ace-gateway-projection.so}"
export GOWORK=off

root=$(git -C "$BIFROST_SOURCE_ROOT" rev-parse --show-toplevel)
actual=$(git -C "$root" rev-parse HEAD)
if [[ "$actual" != "$BIFROST_COMMIT" ]]; then
  printf 'Bifrost source mismatch: expected %s got %s\n' "$BIFROST_COMMIT" "$actual" >&2
  exit 2
fi
if [[ -n "$(git -C "$root" status --porcelain --untracked-files=all)" ]]; then
  echo "Bifrost source checkout must be clean before plugin compilation" >&2
  exit 2
fi

repo_root=$(git rev-parse --show-toplevel)
ace_commit=$(git -C "$repo_root" rev-parse HEAD)
if [[ -n "$(git -C "$repo_root" status --porcelain --untracked-files=all)" ]]; then
  echo "ACE source checkout must be clean before plugin compilation" >&2
  exit 2
fi
build_root=$(mktemp -d "${TMPDIR:-/tmp}/ace-bifrost-plugin.XXXXXX")
trap 'rm -rf "$build_root"' EXIT
cp integrations/bifrost/ace-connector/plugin/main.go "$build_root/main.go"
cp integrations/bifrost/ace-connector/plugin/main_test.go "$build_root/main_test.go"
cat > "$build_root/go.mod" <<EOF
module ace-gateway-projection-plugin

go 1.27.4

require (
  github.com/maximhq/bifrost/core v0.0.0
  github.com/chris-madsen/Mult-agent-AI-Orchestration/integrations/bifrost/ace-connector v0.0.0
)

replace github.com/maximhq/bifrost/core => $root/core
replace github.com/chris-madsen/Mult-agent-AI-Orchestration/integrations/bifrost/ace-connector => $repo_root/integrations/bifrost/ace-connector
EOF

if [[ "$OUTPUT" = /* ]]; then
  output_path="$OUTPUT"
else
  output_path="$repo_root/$OUTPUT"
fi
mkdir -p "$(dirname "$output_path")"
(cd "$build_root" && "$GO_BIN" mod tidy && "$GO_BIN" test -tags=bifrost_plugin -count=1 . && "$GO_BIN" build -tags=bifrost_plugin -buildmode=plugin -ldflags "-X main.aceSourceCommit=$ace_commit" -o "$output_path" .)
sha256sum "$output_path"
