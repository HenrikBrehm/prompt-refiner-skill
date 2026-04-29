# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-04-29

Polish pass: tooling, scaffolding, and portability — no skill-behavior changes.

### Added
- CI: `.github/workflows/validate.yml` runs `scripts/validate-skill.sh` on every push and PR.
- Validator: `scripts/validate-skill.sh` lints `plugin.json`, `marketplace.json`, `SKILL.md` (frontmatter + required output sections), `CHANGELOG.md` (version entry present), and `examples/` (non-empty).
- Behavior spec: `tests/spec.md` — 9-item invariant catalog for manual / AI verification.
- System-prompt adapter: `adapters/system-prompt.md` — portable rules for Cursor, Windsurf, ChatGPT, Gemini, Copilot Chat.
- Contribution scaffolding: `CONTRIBUTING.md`, issue templates (`bug_report.md`, `feature_request.md`, `config.yml`), pull request template.
- Repo hygiene: `.gitattributes` (LF normalization), `.editorconfig` (charset, indent, EOL).
- README enhancements: contents/TOC, FAQ, "Use it outside Claude Code" section, CI badge, contributing pointer.

### Changed
- README structure tightened around the new sections; no information removed.

---

## [1.0.0] - 2026-04-29

First public release.

### Added
- `prompt-refiner` skill at `skills/prompt-refiner/SKILL.md` — refines a user's prompt for clarity, precision, and structure, then executes the refined version.
- Three intensity modes: `light` (default, ±30 % word-count budget), `strict` (±10 %, fixes only genuine defects), `review` (analyze without executing).
- Hard guardrails: preserves original intent, tone, scope, and language; no framework rewrites; no clarifying questions unless truly necessary; fixed two-section output (`## Improved prompt` / `## Result`).
- Plugin packaging: `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` enable `/plugin install` and marketplace discovery.
- `examples/` gallery with five before/after pairs (German + English, varying complexity).
- MIT license.
