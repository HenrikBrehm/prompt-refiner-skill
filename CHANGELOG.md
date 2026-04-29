# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
