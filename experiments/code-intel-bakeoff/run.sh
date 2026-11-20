#!/usr/bin/env bash
# Independent graph-engine bake-off. No ACE runtime or production adapter is modified.
set -uo pipefail
engine="$1"
snapshot="$(realpath "$2")"
out="$3"
mkdir -p "$out"
out="$(realpath "$out")"
expected="9464c4a4a420634ea39bd4ae57673a51fc88ed8f"
actual="$(git -C "$snapshot" rev-parse HEAD)"
if [ "$actual" != "$expected" ]; then
  echo "Refusing non-pinned source: $actual (expected $expected)" >&2
  exit 3
fi

# Exactly the same synthetic TS fixture is added to the SAME historical ACE snapshot
# in each isolated job. Positive and negative edges are specified in README.
cat > "$snapshot/src/__ace_bakeoff_alpha.ts" <<'TS'
export function collide(value: string): string {
  return "alpha:" + value;
}
TS
cat > "$snapshot/src/__ace_bakeoff_beta.ts" <<'TS'
export function collide(value: string): string {
  return "beta:" + value;
}
TS
cat > "$snapshot/src/__ace_bakeoff_consumer.ts" <<'TS'
import { collide as alpha } from './__ace_bakeoff_alpha.js';
import { collide as beta } from './__ace_bakeoff_beta.js';
export function dispatchCollide(value: string): string {
  return alpha(value);
}
export function unusedBetaAlias(): typeof beta {
  return beta;
}
TS

{
  printf 'engine=%s\nsource_commit=%s\n' "$engine" "$actual"
  printf 'tracked_ts_js_count=%s\n' "$(git -C "$snapshot" ls-files '*.ts' '*.tsx' '*.js' '*.jsx' | wc -l)"
  sha256sum "$snapshot"/src/__ace_bakeoff_*.ts
  git -C "$snapshot" status --short
} > "$out/manifest.txt"
(
 cd "$snapshot"
 git ls-files '*.ts' '*.tsx' '*.js' '*.jsx' '*.go' '*.rs' '*.py'
) > "$out/tracked-code-files.txt"
printf 'Benchmark mode: %s\nSource: %s\n' "$engine" "$actual"

run_case() {
  label="$1"
  shift
  printf '%s\n' "$*" > "$out/$label.command.txt"
  printf '\n>>> %s: %s\n' "$label" "$*"
  /usr/bin/time -f 'elapsed_seconds=%e\nmax_rss_kb=%M' -o "$out/$label.time" "$@" > "$out/$label.stdout" 2> "$out/$label.stderr"
  code="$?"
  printf '%s\n' "$code" > "$out/$label.exit"
  printf '%s status=%s\n' "$label" "$code"
  # A failed query must be retained as a failed query, never converted into proof.
  return 0
}

export CBM_CACHE_DIR="$RUNNER_TEMP/code-intel-cbm-cache"
export CBM_ALLOWED_ROOT="$snapshot"
export CBM_WORKERS=2
export HOME="$RUNNER_TEMP/code-intel-home"
mkdir -p "$HOME"

if [ "$engine" = cbm ]; then
  run_case version codebase-memory-mcp --version
  run_case cli-help codebase-memory-mcp cli --help
  run_case index-initial codebase-memory-mcp cli index_repository --repo-path "$snapshot"
  run_case projects codebase-memory-mcp cli list_projects
  # Default project name is the checkout directory; verify the projects output.
  project="$(basename "$snapshot")"
  run_case index-status codebase-memory-mcp cli index_status --project "$project"
  run_case symbol-real codebase-memory-mcp cli search_graph --project "$project" --name-pattern '.*compareStructuralAnalyses.*'
  run_case symbol-fixture codebase-memory-mcp cli search_graph --project "$project" --name-pattern '.*dispatchCollide.*'
  run_case graph-baseline codebase-memory-mcp cli query_graph --project "$project" --query "MATCH (f:Function)-[:CALLS]->(g) WHERE f.name = 'dispatchCollide' RETURN f.name,g.name LIMIT 30"
  run_case trace-baseline codebase-memory-mcp cli trace_path --project "$project" --function-name dispatchCollide --direction both
elif [ "$engine" = cgc-tree ] || [ "$engine" = cgc-scip ]; then
  run_case version cgc --version
  run_case doctor cgc doctor
  run_case index-initial cgc index "$snapshot"
  run_case stats cgc stats "$snapshot"
  run_case symbol-real cgc find name compareStructuralAnalyses --no-fuzzy
  run_case symbol-fixture cgc find name dispatchCollide --no-fuzzy
  run_case graph-baseline cgc query "MATCH (f:Function)-[:CALLS]->(g) WHERE f.name = 'dispatchCollide' RETURN f.name,g.name LIMIT 30"
  run_case calls-real cgc analyze calls compareStructuralAnalyses
  run_case calls-fixture cgc analyze calls dispatchCollide
else
  echo "Unknown engine: $engine" >&2
  exit 4
fi

# Same one-line edit for all runs: change alpha() to beta(), without a git commit.
python3 - "$snapshot/src/__ace_bakeoff_consumer.ts" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
old = p.read_text(encoding="utf-8")
assert 'return alpha(value);' in old
p.write_text(old.replace('return alpha(value);', 'return beta(value);'), encoding="utf-8")
PY
sha256sum "$snapshot/src/__ace_bakeoff_consumer.ts" > "$out/changed-fixture.sha256"

if [ "$engine" = cbm ]; then
  run_case index-after-edit codebase-memory-mcp cli index_repository --repo-path "$snapshot"
  run_case graph-after-edit codebase-memory-mcp cli query_graph --project "$(basename "$snapshot")" --query "MATCH (f:Function)-[:CALLS]->(g) WHERE f.name = 'dispatchCollide' RETURN f.name,g.name LIMIT 30"
  run_case trace-after-edit codebase-memory-mcp cli trace_path --project "$(basename "$snapshot")" --function-name dispatchCollide --direction both
else
  # This explicitly measures repeated indexing, NOT proof of a live watcher delta.
  run_case index-after-edit cgc index "$snapshot"
  run_case graph-after-edit cgc query "MATCH (f:Function)-[:CALLS]->(g) WHERE f.name = 'dispatchCollide' RETURN f.name,g.name LIMIT 30"
  run_case calls-after-edit cgc analyze calls dispatchCollide
fi

python3 - "$out" "$engine" <<'PY'
import json
import pathlib
import sys
out = pathlib.Path(sys.argv[1])
engine = sys.argv[2]
cases = {}
for f in sorted(out.glob("*.exit")):
    name = f.stem
    cases[name] = {
        "exit_code": int(f.read_text().strip()),
        "command": (out / (name + ".command.txt")).read_text().strip(),
        "stdout_sample": (out / (name + ".stdout")).read_text(errors="replace")[:3500],
        "stderr_sample": (out / (name + ".stderr")).read_text(errors="replace")[:1000],
        "timing": (out / (name + ".time")).read_text(errors="replace").strip(),
    }
report = {
    "engine": engine,
    "source_sha": "9464c4a4a420634ea39bd4ae57673a51fc88ed8f",
    "index_initial_succeeded": cases.get("index-initial", {}).get("exit_code") == 0,
    "index_after_edit_succeeded": cases.get("index-after-edit", {}).get("exit_code") == 0,
    "query_failures": [k for k, v in cases.items() if v["exit_code"] != 0],
    "cases": cases,
    "semantic_correctness": "UNASSESSED: inspect file-qualified edges and source provenance manually",
    "scip_executed": "UNASSESSED: verify actual indexer invocation in logs; flag alone is insufficient",
}
(out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({k: v for k, v in report.items() if k != "cases"}, indent=2))
PY
test "$(cat "$out/index-initial.exit")" = 0 && test "$(cat "$out/index-after-edit.exit")" = 0
