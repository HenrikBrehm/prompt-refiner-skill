# Pre-commit recipe

Run the prompt-refiner-skill against changed `*.prompt.md` files before each commit. Requires only a POSIX shell and a Claude Code installation that exposes the skill.

Add to your repo's `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: prompt-refiner
        name: prompt-refiner-skill
        language: system
        files: '\.prompt\.md$'
        entry: bash -c 'for f in "$@"; do claude --skill prompt-refiner-skill --json < "$f" > "$f.refiner.json"; done' --
        pass_filenames: true
```

The `--skill` invocation is illustrative; substitute whatever invocation your Claude Code version exposes. The hook never modifies the prompt file — it writes a sibling `.refiner.json` report.

To block the commit on any `error`-severity finding:

```yaml
        entry: bash -c 'fail=0; for f in "$@"; do r=$(claude --skill prompt-refiner-skill --json < "$f"); echo "$r" > "$f.refiner.json"; echo "$r" | grep -q "\"severity\": \"error\"" && fail=1; done; exit $fail' --
```
