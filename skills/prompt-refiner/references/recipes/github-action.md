# GitHub Action recipe

Run the deterministic prompt-refiner detector on every pull request that changes a `*.prompt.md` file. This recipe does not require Claude; it uses the bundled zero-dependency Node script.

`.github/workflows/prompt-refiner.yml`:

```yaml
name: prompt-refiner
on:
  pull_request:
    paths:
      - '**/*.prompt.md'
permissions:
  contents: read
  pull-requests: write
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Identify changed prompt files
        id: changed
        run: |
          {
            echo 'files<<EOF'
            git diff --name-only "origin/${{ github.base_ref }}"...HEAD -- '*.prompt.md'
            echo 'EOF'
          } >> "$GITHUB_OUTPUT"
      - name: Run prompt-refiner
        if: steps.changed.outputs.files != ''
        run: |
          set -eu
          : > /tmp/report.md
          fail=0
          while IFS= read -r f; do
            [ -z "$f" ] && continue
            echo "## \`$f\`" >> /tmp/report.md
            if ! node skills/prompt-refiner/scripts/lint.js --fail-on=error "$f" >> /tmp/report.md; then
              fail=1
            fi
            echo >> /tmp/report.md
          done <<< "${{ steps.changed.outputs.files }}"
          exit "$fail"
      - name: Upload prompt-refiner report
        if: always() && steps.changed.outputs.files != ''
        uses: actions/upload-artifact@v4
        with:
          name: prompt-refiner-report
          path: /tmp/report.md
```

The Action is deterministic-only. Run the Claude skill itself when you also want model-semantic findings for `PR003`, `PR009`, and hybrid semantic cases.
