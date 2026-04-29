# Pre-commit recipe

Run the deterministic prompt-refiner detector against changed `*.prompt.md` files before each commit. This recipe does not require Claude; it uses the bundled zero-dependency Node script.

Add to your repo's `.pre-commit-config.yaml` and adjust `PROMPT_REFINER_LINT` to the copied script location:

```yaml
repos:
  - repo: local
    hooks:
      - id: prompt-refiner
        name: prompt-refiner
        language: system
        files: '\.prompt\.md$'
        entry: node skills/prompt-refiner/scripts/lint.js --fail-on=error
        pass_filenames: true
```

For JSON reports:

```yaml
repos:
  - repo: local
    hooks:
      - id: prompt-refiner-json
        name: prompt-refiner JSON report
        language: system
        files: '\.prompt\.md$'
        entry: node skills/prompt-refiner/scripts/lint.js --format=json --fail-on=none
        pass_filenames: true
```

The pre-commit hook is deterministic-only. Run the Claude skill itself when you also want model-semantic findings for `PR003`, `PR009`, and hybrid semantic cases.
