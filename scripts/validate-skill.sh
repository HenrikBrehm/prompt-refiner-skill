#!/usr/bin/env bash
# Validates the repo's plugin manifests, SKILL.md, and CHANGELOG version sync.
# Used by CI (.github/workflows/validate.yml) and runnable locally before opening a PR.
# Requires: bash, node (already on every CI runner and most dev machines).

set -euo pipefail

# cd to repo root regardless of where the script was invoked from
cd "$(dirname "$0")/.."

errors=0
err()  { echo "FAIL: $1" >&2; errors=$((errors+1)); }
ok()   { echo "ok:   $1"; }

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "FAIL: node is required (install Node.js, any LTS version)" >&2
    exit 1
  fi
}

# json_get FILE PATH — prints value at JSON path, or "" if missing.
# PATH is dot-notation (e.g. "name", "plugins.0.name", "author.url").
json_get() {
  node -e '
    const fs = require("fs");
    try {
      const obj = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const parts = process.argv[2].split(".");
      let v = obj;
      for (const p of parts) {
        if (v == null) { process.exit(0); }
        v = /^\d+$/.test(p) ? v[parseInt(p,10)] : v[p];
      }
      if (v == null) process.exit(0);
      process.stdout.write(typeof v === "string" ? v : JSON.stringify(v));
    } catch (e) { process.exit(2); }
  ' "$1" "$2" 2>/dev/null
}

# json_valid FILE — exit 0 iff FILE parses as JSON.
json_valid() {
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$1" 2>/dev/null
}

# 1. plugin.json — exists, valid JSON, has required fields.
check_plugin_json() {
  local f=.claude-plugin/plugin.json
  if [ ! -f "$f" ]; then err "$f missing"; return; fi
  if ! json_valid "$f"; then err "$f is not valid JSON"; return; fi
  for k in name description version license; do
    if [ -z "$(json_get "$f" "$k")" ]; then
      err "$f missing required field: $k"
    fi
  done
  ok "$f"
}

# 2. marketplace.json — exists, valid JSON, lists at least one plugin.
check_marketplace_json() {
  local f=.claude-plugin/marketplace.json
  if [ ! -f "$f" ]; then err "$f missing"; return; fi
  if ! json_valid "$f"; then err "$f is not valid JSON"; return; fi
  if [ -z "$(json_get "$f" "plugins.0.name")" ]; then
    err "$f plugins[0].name is missing"
  fi
  ok "$f"
}

# 3. SKILL.md — has frontmatter with name+description, and body references the
#    fixed two-section output format.
check_skill_md() {
  local f=skills/prompt-refiner/SKILL.md
  if [ ! -f "$f" ]; then err "$f missing"; return; fi
  if ! head -1 "$f" | grep -q '^---$'; then
    err "$f does not start with YAML frontmatter (---)"
    return
  fi
  for k in name description; do
    if ! grep -E "^${k}:" "$f" >/dev/null; then
      err "$f frontmatter missing required field: $k"
    fi
  done
  if ! grep -F '## Improved prompt' "$f" >/dev/null; then
    err "$f body must reference the '## Improved prompt' output section"
  fi
  if ! grep -F '## Result' "$f" >/dev/null; then
    err "$f body must reference the '## Result' output section"
  fi
  ok "$f"
}

# 4. CHANGELOG.md — has an entry matching the plugin.json version.
check_changelog() {
  local f=CHANGELOG.md
  local pj=.claude-plugin/plugin.json
  if [ ! -f "$f" ] || [ ! -f "$pj" ]; then return; fi
  local v
  v=$(json_get "$pj" "version")
  if [ -z "$v" ]; then return; fi
  if ! grep -F "[$v]" "$f" >/dev/null; then
    err "$f has no entry for plugin version $v"
  else
    ok "$f has entry for $v"
  fi
}

# 5. examples/ — exists and has at least one example file.
check_examples() {
  if [ ! -d examples ]; then err "examples/ directory missing"; return; fi
  if ! ls examples/*.md >/dev/null 2>&1; then
    err "examples/ contains no .md files"
    return
  fi
  ok "examples/"
}

require_node
check_plugin_json
check_marketplace_json
check_skill_md
check_changelog
check_examples

echo
if [ "$errors" -gt 0 ]; then
  echo "Validation failed with $errors error(s)."
  exit 1
fi
echo "All checks passed."
