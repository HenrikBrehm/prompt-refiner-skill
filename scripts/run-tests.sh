#!/usr/bin/env bash
# Conformance test runner for prompt-refiner-skill.
#
# For every file in tests/corpus/*.md (and tests/corpus/i18n/*.md):
#   1. Parse YAML-ish frontmatter for: test_id, expected_rules, forbidden_rules, language.
#   2. Strip frontmatter and pipe the body to scripts/lint.js (JSON output).
#   3. Assert: every expected_rules ID FIRES (>=1 finding with that rule_id).
#   4. Assert: every forbidden_rules ID does NOT fire (0 findings with that rule_id).
#   5. Assert: every expected_rules ID exists in references/lint-rules.md.
#
# Behavioral checks only run for rules the deterministic engine handles.
# That now includes the original 8 plus PR011-PR017 (new) and the
# graduated hybrids PR002, PR005, PR010 (deterministic basic case).
# For pure model-only rules (PR003, PR009), the runner verifies catalog
# membership but does not assert firing.
#
# Requires: bash, node (already required by validate-skill.sh).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORPUS_DIR="$ROOT/tests/corpus"
RULES_FILE="$ROOT/references/lint-rules.md"
LINT="$ROOT/scripts/lint.js"

[ -d "$CORPUS_DIR" ] || { echo "FAIL: $CORPUS_DIR missing" >&2; exit 1; }
[ -f "$RULES_FILE" ] || { echo "FAIL: $RULES_FILE missing" >&2; exit 1; }
[ -f "$LINT"       ] || { echo "FAIL: $LINT missing"       >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "FAIL: node is required" >&2; exit 1; }

DEFINED_RULES="$(grep -E '^### (PR[0-9]{3}|PR-INJ[0-9]{2,3})' "$RULES_FILE" \
  | awk '{print $2}' | sort -u)"
[ -n "$DEFINED_RULES" ] || { echo "FAIL: no rule IDs parsed from $RULES_FILE" >&2; exit 1; }

PASS=0
FAIL=0
FAILED_FILES=""

DETERMINISTIC="PR001 PR002 PR004 PR005 PR006 PR007 PR008 PR010 PR011 PR012 PR013 PR014 PR015 PR016 PR017 PR-INJ01 PR-INJ02 PR-INJ03"

is_deterministic() {
  local r="$1"
  for d in $DETERMINISTIC; do [ "$d" = "$r" ] && return 0; done
  return 1
}

extract_rule_ids() {
  node -e '
    let buf="";
    process.stdin.on("data", d => buf += d);
    process.stdin.on("end", () => {
      try {
        const obj = JSON.parse(buf);
        for (const f of (obj.findings || [])) console.log(f.rule_id);
      } catch (e) {
        process.stderr.write("bad json from lint.js: " + e.message + "\n");
        process.exit(2);
      }
    });
  '
}

while IFS= read -r f; do
  rel="${f#"$ROOT"/}"

  if ! head -n 1 "$f" | grep -qx -- '---'; then
    echo "FAIL [$rel]: missing leading ---"
    FAIL=$((FAIL+1)); FAILED_FILES="$FAILED_FILES $rel"; continue
  fi

  fm="$(awk 'NR==1 && /^---$/ {flag=1; next} /^---$/ && flag {exit} flag' "$f")"
  test_id="$(printf '%s\n' "$fm" | awk -F': *' '/^test_id:/ {print $2; exit}')"
  expected="$(printf '%s\n' "$fm" | awk -F': *' '/^expected_rules:/ {print $2; exit}')"
  forbidden="$(printf '%s\n' "$fm" | awk -F': *' '/^forbidden_rules:/ {print $2; exit}')"
  lang="$(printf '%s\n' "$fm" | awk -F': *' '/^language:/ {print $2; exit}')"
  body="$(awk 'BEGIN{n=0} /^---$/ {n++; next} n>=2 {print}' "$f")"

  if [ -z "$test_id" ] || [ -z "$lang" ]; then
    echo "FAIL [$rel]: missing test_id or language"
    FAIL=$((FAIL+1)); FAILED_FILES="$FAILED_FILES $rel"; continue
  fi
  if [ -z "$body" ]; then
    echo "FAIL [$rel]: empty body"
    FAIL=$((FAIL+1)); FAILED_FILES="$FAILED_FILES $rel"; continue
  fi

  ok=1

  # 1) catalog check: expected and forbidden rule IDs must be defined.
  for kind in expected forbidden; do
    val=""
    [ "$kind" = "expected" ] && val="$expected"
    [ "$kind" = "forbidden" ] && val="$forbidden"
    [ -z "$val" ] && continue
    IFS=',' read -r -a arr <<< "$val"
    for r in "${arr[@]}"; do
      rid="$(printf '%s' "$r" | tr -d '[:space:]')"
      [ -z "$rid" ] && continue
      if ! printf '%s\n' "$DEFINED_RULES" | grep -qx -- "$rid"; then
        echo "FAIL [$rel]: ${kind}_rules contains undefined rule '$rid'"
        ok=0
      fi
    done
  done
  if [ "$ok" -eq 0 ]; then
    FAIL=$((FAIL+1)); FAILED_FILES="$FAILED_FILES $rel"; continue
  fi

  # 2) behavioral check: run the detector on the body.
  json="$(printf '%s\n' "$body" | node "$LINT" --format=json --fail-on=none -)"
  fired_ids="$(printf '%s' "$json" | extract_rule_ids | sort -u)"

  # Every deterministic expected rule must fire.
  if [ -n "$expected" ]; then
    IFS=',' read -r -a exp_arr <<< "$expected"
    for r in "${exp_arr[@]}"; do
      rid="$(printf '%s' "$r" | tr -d '[:space:]')"
      [ -z "$rid" ] && continue
      if is_deterministic "$rid"; then
        if ! printf '%s\n' "$fired_ids" | grep -qx -- "$rid"; then
          echo "FAIL [$rel]: expected rule '$rid' did not fire"
          ok=0
        fi
      fi
    done
  fi

  # No deterministic forbidden rule may fire.
  if [ -n "$forbidden" ]; then
    IFS=',' read -r -a fb_arr <<< "$forbidden"
    for r in "${fb_arr[@]}"; do
      rid="$(printf '%s' "$r" | tr -d '[:space:]')"
      [ -z "$rid" ] && continue
      if is_deterministic "$rid"; then
        if printf '%s\n' "$fired_ids" | grep -qx -- "$rid"; then
          echo "FAIL [$rel]: forbidden rule '$rid' fired"
          ok=0
        fi
      fi
    done
  fi

  if [ "$ok" -eq 0 ]; then
    FAIL=$((FAIL+1)); FAILED_FILES="$FAILED_FILES $rel"; continue
  fi

  fired_csv="$(printf '%s' "$fired_ids" | tr '\n' ',' | sed 's/,$//')"
  echo "PASS [$rel] test_id=$test_id lang=$lang fired=${fired_csv:-none}"
  PASS=$((PASS+1))
done < <(find "$CORPUS_DIR" -type f -name '*.md' | sort)

echo
echo "RESULT: $PASS passed, $FAIL failed"
if [ "$FAIL" -ne 0 ]; then
  echo "Failed files:$FAILED_FILES" >&2
  exit 1
fi
