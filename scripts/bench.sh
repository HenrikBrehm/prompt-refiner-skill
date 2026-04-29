#!/usr/bin/env bash
# Reproducible micro-benchmark for the prompt-refiner-skill corpus.
# Reports per-file char/word counts and total wall time of run-tests.sh.
# No external deps beyond coreutils + awk.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORPUS_DIR="$ROOT/tests/corpus"
RUNNER="$ROOT/scripts/run-tests.sh"

if [ ! -d "$CORPUS_DIR" ]; then
  echo "ERROR: $CORPUS_DIR missing" >&2; exit 1
fi
if [ ! -x "$RUNNER" ]; then
  echo "ERROR: $RUNNER not executable" >&2; exit 1
fi

total_chars=0
total_words=0
files=0

printf '| File | chars | words |\n'
printf '| --- | ---: | ---: |\n'
# shellcheck disable=SC2044
for f in $(find "$CORPUS_DIR" -type f -name '*.md' | sort); do
  rel="${f#"$ROOT"/}"
  c="$(wc -c < "$f" | tr -d ' ')"
  w="$(wc -w < "$f" | tr -d ' ')"
  printf '| %s | %s | %s |\n' "$rel" "$c" "$w"
  total_chars=$((total_chars + c))
  total_words=$((total_words + w))
  files=$((files + 1))
done
printf '| **total (%s files)** | **%s** | **%s** |\n' "$files" "$total_chars" "$total_words"

# Time the runner.
start="$(date +%s)"
"$RUNNER" >/dev/null
end="$(date +%s)"
elapsed=$((end - start))

printf '\nrunner: scripts/run-tests.sh\nelapsed_seconds: %s\nfiles: %s\n' "$elapsed" "$files"
