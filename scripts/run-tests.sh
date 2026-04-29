#!/usr/bin/env bash
# Conformance test runner for prompt-refiner-skill.
# Validates corpus structure: every file in tests/corpus/ has a frontmatter
# block with test_id, expected_rules, forbidden_rules, language, and a body.
# This runner does NOT execute the skill; it asserts the corpus is well-formed
# and that every expected_rules ID exists in references/lint-rules.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORPUS_DIR="$ROOT/tests/corpus"
RULES_FILE="$ROOT/references/lint-rules.md"

if [ ! -d "$CORPUS_DIR" ]; then
  echo "FAIL: $CORPUS_DIR missing" >&2
  exit 1
fi
if [ ! -f "$RULES_FILE" ]; then
  echo "FAIL: $RULES_FILE missing" >&2
  exit 1
fi

# Extract every defined rule ID from references/lint-rules.md.
DEFINED_RULES="$(grep -E '^### (PR[0-9]{3}|PR-INJ[0-9]{2,3})' "$RULES_FILE" \
  | awk '{print $2}' | sort -u)"

if [ -z "$DEFINED_RULES" ]; then
  echo "FAIL: no rule IDs parsed from $RULES_FILE" >&2
  exit 1
fi

PASS=0
FAIL=0
FAILED_FILES=""

# shellcheck disable=SC2044
for f in $(find "$CORPUS_DIR" -type f -name '*.md' | sort); do
  rel="${f#"$ROOT"/}"
  # frontmatter must be the first block delimited by ---
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
  if [ -z "$expected" ]; then
    echo "FAIL [$rel]: expected_rules is empty"
    FAIL=$((FAIL+1)); FAILED_FILES="$FAILED_FILES $rel"; continue
  fi
  if [ -z "$body" ]; then
    echo "FAIL [$rel]: empty body"
    FAIL=$((FAIL+1)); FAILED_FILES="$FAILED_FILES $rel"; continue
  fi

  # Every comma-separated expected rule must be defined.
  ok=1
  IFS=',' read -r -a arr <<< "$expected"
  for r in "${arr[@]}"; do
    rid="$(printf '%s' "$r" | tr -d '[:space:]')"
    if ! printf '%s\n' "$DEFINED_RULES" | grep -qx -- "$rid"; then
      echo "FAIL [$rel]: expected_rules contains undefined rule '$rid'"
      ok=0; break
    fi
  done
  if [ "$ok" -eq 0 ]; then
    FAIL=$((FAIL+1)); FAILED_FILES="$FAILED_FILES $rel"; continue
  fi

  # Forbidden rules (if any) must also be defined IDs (typo guard).
  if [ -n "$forbidden" ]; then
    IFS=',' read -r -a barr <<< "$forbidden"
    for r in "${barr[@]}"; do
      rid="$(printf '%s' "$r" | tr -d '[:space:]')"
      [ -z "$rid" ] && continue
      if ! printf '%s\n' "$DEFINED_RULES" | grep -qx -- "$rid"; then
        echo "FAIL [$rel]: forbidden_rules contains undefined rule '$rid'"
        ok=0; break
      fi
    done
  fi
  if [ "$ok" -eq 0 ]; then
    FAIL=$((FAIL+1)); FAILED_FILES="$FAILED_FILES $rel"; continue
  fi

  echo "PASS [$rel] test_id=$test_id lang=$lang expects=$expected"
  PASS=$((PASS+1))
done

echo
echo "RESULT: $PASS passed, $FAIL failed"
if [ "$FAIL" -ne 0 ]; then
  echo "Failed files:$FAILED_FILES" >&2
  exit 1
fi
