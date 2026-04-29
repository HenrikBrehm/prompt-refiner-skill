# GitHub Action recipe

Comment a prompt-refiner report on every pull request that changes a `*.prompt.md` file.

`.github/workflows/prompt-refiner.yml` in your repo:

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
      - name: Run prompt-refiner-skill
        if: steps.changed.outputs.files != ''
        run: |
          set -eu
          : > /tmp/report.md
          while IFS= read -r f; do
            [ -z "$f" ] && continue
            echo "## \`$f\`" >> /tmp/report.md
            claude --skill prompt-refiner-skill < "$f" >> /tmp/report.md || true
            echo >> /tmp/report.md
          done <<< "${{ steps.changed.outputs.files }}"
      - name: Post report as PR comment
        if: steps.changed.outputs.files != ''
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          path: /tmp/report.md
```

Replace the `claude --skill prompt-refiner-skill` line with whatever invocation your Claude Code CLI uses. The Action never rewrites prompt files; it surfaces the lint report inline on the PR.
