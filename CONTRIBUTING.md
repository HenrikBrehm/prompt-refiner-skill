# Contributing

Thanks for considering a contribution. This project is small on purpose — a single Claude Code skill plus the polish around it. The bar for additions is high: each change should make the skill *more reliable* or *more discoverable* without bloating it.

## What kinds of contributions are welcome

- **Bug reports** — the skill produced output that violates one of the [behavior guarantees](README.md#behavior-guarantees). Please include the original prompt, the intensity flag (if any), and what you expected vs. what you got.
- **Behavior fixes** — tighten a rule in `skills/prompt-refiner/SKILL.md` so the skill is more reliable. Pair with an example or test-spec entry that demonstrates the fix.
- **More examples** — real before/after pairs, especially in languages or domains not yet covered. Add to `examples/README.md`.
- **Adapter coverage** — if you've made the skill work cleanly in a non-Claude tool (Cursor, Windsurf, ChatGPT, …), contribute the adapter under `adapters/`.
- **Validator improvements** — make `scripts/validate-skill.sh` catch more real failures.

## What is NOT in scope

- New prompt-engineering frameworks (CO-STAR, RISEN, RACE, etc.). Those belong in framework-based refiners — see [`prompt-architect`](https://github.com/ckelsoe/prompt-architect). This skill is the *anti*-framework refiner; adding frameworks here would invert its purpose.
- Heavy runtime dependencies (npm packages, Python evaluators, etc.). The skill is a single Markdown file — keep it that way.
- README expansion past ~10 KB. We are intentionally lean.

## Local checks before opening a PR

```bash
bash scripts/validate-skill.sh
```

This validates `plugin.json`, `marketplace.json`, and the `SKILL.md` frontmatter and required sections. CI runs the same script on every push and PR.

## Commit conventions

- Subject line: imperative, < 72 chars (`Add --quiet flag`, `Fix word-budget overrun in strict mode`).
- Body (optional): explain *why*, not *what*. The diff already shows what.
- One logical change per commit.

## Versioning and CHANGELOG

This project follows [Semantic Versioning](https://semver.org/). When you change behavior:

- Bump `version` in `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and the `metadata.version` field in `skills/prompt-refiner/SKILL.md`.
- Add a `## [x.y.z] - YYYY-MM-DD` entry to `CHANGELOG.md`.

The validator checks that the plugin version has a matching CHANGELOG entry.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
