# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.3.0] - 2026-04-29

**Hybrid engine.** The skill stops being a pure LLM rubric and becomes a real linter for the rules where regex is enough. A zero-dep Node detector runs as a deterministic first pass; the model layers the semantic rules on top. Each finding is tagged with which engine produced it.

### Added
- `scripts/lint.js` — zero-dep Node detector. Implements `PR001`, `PR004`, `PR006`, `PR007`, `PR008`, `PR-INJ01`, `PR-INJ02`, `PR-INJ03` deterministically. Supports `--format=md|json|text`, `--fail-on=error|warning|info|none`, `--rules=ID,ID,...`, `--quiet`, `--version`. Reads from FILE or stdin.
- Suppression comments — `<!-- prompt-refiner-disable RULE -->` (file-wide), `<!-- prompt-refiner-disable-next-line RULE -->`, `<!-- prompt-refiner-disable-line RULE -->`. Honored by the detector and (per SKILL.md) by the model pass.
- Baseline mode — `--write-baseline=PATH` snapshots current findings; `--baseline=PATH` suppresses them on subsequent runs so CI fails only on *new* findings.
- New corpus cases: `008-unbounded-quantifier` (PR006), `009-implicit-json` (PR007), `010-role-switch-after-input` (PR-INJ02), `011-unbounded-authority` (PR-INJ03), `012-clean-prompt-no-findings` (negative — asserts no false positives across all 8 deterministic rules), `013-placeholder-todo` (PR008 TODO variant), `i18n/de-002-platzhalter` (DE placeholder).
- `references/lint-rules.md` — every rule now carries an `Engine: deterministic | model | hybrid` line plus a top-of-file legend explaining the split.

### Changed (BREAKING for output consumers)
- `scripts/run-tests.sh` rewritten: now actually executes `scripts/lint.js` against each corpus body and asserts `expected_rules` fire and `forbidden_rules` do not, instead of only validating frontmatter structure. 17/17 cases pass.
- `skills/prompt-refiner/SKILL.md` procedure restructured to two passes (deterministic via `scripts/lint.js`, then model layer for `PR002`/`PR003`/`PR005`/`PR009`/`PR010`). Output format gains an `_(engine)_` tag per finding.
- `README.md` reframed as "hybrid linter" with an explicit table of which rules are deterministic vs model. Drops badges/copy that overpromised pure-linter behavior; conformance badge now shows `17/17`.
- `PR001` EN verb list drops `do` (too overloaded — `do not`, `do you`, `do whatever`). Documented as an explicit exclusion in `references/lint-rules.md`. The remaining EN verbs (`handle`, `process`, `manage`, `deal with`, `take care of`, `work on`, `look at`, `figure out`) plus DE/ES/JA lists are unchanged.
- Plugin manifests (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`) bumped to `1.3.0`; descriptions updated to describe the hybrid engine; new keyword `hybrid-linter` added to the marketplace entry.

### Notes
- No npm dependencies introduced — the detector uses Node stdlib only. Node was already required by `scripts/validate-skill.sh`, so this is not a new install requirement.
- `schemas/report.schema.json` extended: each finding may now include an optional `engine` field (`"deterministic"` | `"model"`). The detector emits `engine: "deterministic"` on every finding. Reports without `engine` remain valid against the schema (the field is optional).
- Stability contract sharpens: for the 8 deterministic rules, same input → same `(rule_id, line, col, evidence)` across runs. For the 5 model rules, run-to-run drift is expected and the engine tag makes it visible.

---

## [1.2.0] - 2026-04-29

**Linter pivot.** The skill flips from refiner to linter: it now flags prompt-engineering bugs against a stable rule catalog (`PR001`–`PR-INJ03`) and never rewrites the user's prompt. The three intensity modes (`light` / `strict` / `review`) and the fixed two-section output (`## Improved prompt` / `## Result`) are removed.

### Added
- `references/lint-rules.md` — stable catalog of flag-only lint rules (PR001–PR010, PR-INJ01–PR-INJ03).
- `references/json-output.md` — JSON output variant contract.
- `schemas/report.schema.json` — JSON Schema (draft-07) for findings reports.
- `tests/corpus/*.md` — conformance corpus (7 English cases): vague-verb, mixed-intent, pronoun-ambiguity, scale-conflict, contradiction, placeholder-leak, prompt-injection.
- `tests/corpus/i18n/*.md` — multilingual conformance cases (de, es, ja).
- `scripts/run-tests.sh` — conformance runner; asserts every `expected_rules` ID exists in the rule catalog.
- `scripts/bench.sh` — dependency-free benchmark printing a Markdown table of corpus size and runner wall time.
- `recipes/pre-commit.md` — pre-commit hook recipe.
- `recipes/github-action.md` — GitHub Action recipe posting the report as a sticky PR comment.
- `assets/og-card.svg` — 1280×640 social preview card.
- `assets/demo.cast` — asciinema v2 terminal demo.
- `README.md` — shields badge row, "What it does (and doesn't)", "CI integration", "Cost & footprint" sections.

### Changed (BREAKING)
- `SKILL.md` rewritten for linter behavior. Description enumerates explicit trigger phrases ("lint my prompt", "review this prompt", "audit prompt", etc.); states the skill never imposes a framework, never asks clarifying questions, never auto-rewrites. Added "Use when / Don't use when" routing block and a References section.
- Removed `light` / `strict` / `review` intensity modes — the skill no longer accepts these flags.
- Removed fixed `## Improved prompt` + `## Result` two-section output. New output is a Markdown lint report (default) or, with `--json`, a JSON report validating against `schemas/report.schema.json`.
- `scripts/validate-skill.sh` updated: validates linter-style SKILL.md (must reference `references/lint-rules.md` and contain a `## Use when` section) instead of refiner output sections.
- Plugin manifests (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`) bumped to `1.2.0`; descriptions rewritten for linter pitch; keywords gain `prompt-linter`, `prompt-lint`, `linter`, `prompt-injection`.
- Repo description and topics on GitHub tightened for higher search relevance (subsumes the prior unreleased discoverability polish).

### Notes
- No frameworks added (no CO-STAR / RISEN / RTF / TIDD-EC).
- No role-play preambles.
- No interview / clarification flow.
- No npm / pip / Node / Python runtime dependencies introduced.
- **Inconsistencies flagged for follow-up**: `examples/README.md`, `tests/spec.md`, and `adapters/system-prompt.md` still describe refiner behavior. They are not auto-rewritten in this commit; rewrite is left as a deliberate user decision.

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
