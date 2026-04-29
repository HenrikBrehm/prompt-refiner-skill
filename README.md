# prompt-refiner-skill

> Flags prompt-engineering bugs in your prompt against a stable rule catalog. **Lint, don't rewrite.** No framework imposition. No interview flow. No language switching.

[![Anti-bloat](https://img.shields.io/badge/anti--bloat-strict-ff7a59)](references/lint-rules.md)
[![No frameworks](https://img.shields.io/badge/frameworks-none-0b1020)](#what-it-does-and-doesnt)
[![Lint, don't rewrite](https://img.shields.io/badge/mode-lint--only-ffd166)](references/lint-rules.md)
[![Conformance](https://img.shields.io/badge/conformance-bash-2a3358)](scripts/run-tests.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](CHANGELOG.md)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-skill-d97757)](https://claude.com/claude-code)
[![CI](https://github.com/HenrikBrehm/prompt-refiner-skill/actions/workflows/validate.yml/badge.svg)](https://github.com/HenrikBrehm/prompt-refiner-skill/actions/workflows/validate.yml)

---

## Contents

- [What it does (and doesn't)](#what-it-does-and-doesnt)
- [Install](#install)
- [Usage](#usage)
- [Example](#example)
- [When NOT to use this skill](#when-not-to-use-this-skill)
- [How it compares to framework-based prompt tools](#how-it-compares-to-framework-based-prompt-tools)
- [CI integration](#ci-integration)
- [Cost & footprint](#cost--footprint)
- [Star history](#star-history)
- [Contributing](#contributing)
- [License & changelog](#license--changelog)

---

## What it does (and doesn't)

This skill **flags** prompt-engineering bugs against a stable, citeable rule catalog ([`references/lint-rules.md`](references/lint-rules.md)). It does **not** rewrite your prompt, does **not** ask clarifying questions, and does **not** impose a framework. You stay in control of the words; the skill points at the bugs.

Output is Markdown by default. Append `--json` (or ask for "JSON output") to get a report that validates against [`schemas/report.schema.json`](schemas/report.schema.json).

The catalog ships 13 rules across two families:

- **Clarity & specificity** — `PR001` vague verb, `PR002` mixed intent, `PR003` ambiguous pronoun, `PR004` scale conflict, `PR005` contradictory constraints, `PR006` unbounded numeric, `PR007` implicit format, `PR008` placeholder leakage, `PR009` conflicting persona, `PR010` untestable success criterion.
- **Prompt injection / role confusion** — `PR-INJ01` "ignore previous" pattern, `PR-INJ02` post-input role switch, `PR-INJ03` unbounded tool authority.

## Install

### Option 1 — As a Claude Code plugin (recommended)

```bash
/plugin marketplace add HenrikBrehm/prompt-refiner-skill
/plugin install prompt-refiner@prompt-refiner-marketplace
```

### Option 2 — Manual copy (per project)

```bash
git clone https://github.com/HenrikBrehm/prompt-refiner-skill.git /tmp/prompt-refiner-skill
mkdir -p .claude/skills
cp -r /tmp/prompt-refiner-skill/skills/prompt-refiner .claude/skills/
```

### Option 3 — Manual copy (user-level, all projects)

```bash
git clone https://github.com/HenrikBrehm/prompt-refiner-skill.git /tmp/prompt-refiner-skill
mkdir -p ~/.claude/skills
cp -r /tmp/prompt-refiner-skill/skills/prompt-refiner ~/.claude/skills/
```

## Usage

Invoke the skill with any of these phrasings — auto-routing picks it up via the trigger keywords in `SKILL.md`:

- *"Lint this prompt: \<your prompt\>"*
- *"Review my prompt for bugs: \<your prompt\>"*
- *"Audit prompt: \<your prompt\>"*
- Append `--json` for machine-readable output: *"lint --json: \<your prompt\>"*

The skill reads your prompt, applies the [rule catalog](references/lint-rules.md), and emits a Markdown report (or JSON, with `--json`) — one finding per rule that fired, with line:col citations and quoted evidence.

## Example

**Prompt:**

> Handle the customer feedback we got last week and write a tweet about it.

**Skill output:**

```markdown
# Prompt-refiner report

`PR001` [warning] 1:1 — `Handle` — vague action verb; name the transformation (e.g. classify, summarize).
`PR002` [error] 1:1 — `Handle ... and write a tweet ...` — two distinct intents in one instruction; split into separate steps.
`PR003` [warning] 1:60 — `it` — ambiguous antecedent (feedback or tweet?).

**summary:** 1 error, 2 warnings, 0 info
```

The skill quotes literal evidence, cites the rule by ID, and stops. It does not propose a rewrite — that decision stays with you.

## When NOT to use this skill

- **You're writing a brand-new prompt from scratch.** Reach for a framework-based skill instead — for example [`prompt-architect`](https://github.com/ckelsoe/prompt-architect) (27 frameworks: CO-STAR, RISEN, RTF, RACE, …). It's the right shape for "I have an idea, help me prompt it well."
- **You want the AI to rewrite the prompt for you.** This skill flags; it does not author. Copy the rule rationale and edit by hand, or use a framework-based refiner for a rewrite.
- **You want the AI to interview you.** This skill is silent until it has a prompt to lint.

## How it compares to framework-based prompt tools

| | `prompt-refiner` (this skill) | Framework refiners (e.g. [`prompt-architect`](https://github.com/ckelsoe/prompt-architect), CO-STAR / RISEN / RTF builders) |
|---|---|---|
| **Best for** | Auditing a prompt you already wrote | Authoring a new prompt from scratch |
| **Output** | Lint report (rule citations + evidence) | A rewritten prompt, often 5–10× longer |
| **Frameworks (CO-STAR / RISEN / RTF / RACE)** | Never imposed — explicitly forbidden | Core feature |
| **Language handling** | Preserves original (DE → DE, JP → JP, mixed → mixed) | Often switches to English |
| **Clarifying questions** | Almost never | Often (interview-style) |
| **Output shape** | Markdown lint report or JSON (`--json`) | Variable, framework-shaped |
| **Behavior on a clean prompt** | Reports zero findings | Still imposes structure |

These tools complement each other: use `prompt-architect` to **write** a prompt, `prompt-refiner` to **audit** it before you ship.

## CI integration

Drop-in recipes for invoking the skill from your own pipeline:

- [`recipes/pre-commit.md`](recipes/pre-commit.md) — block commits with `error`-severity findings.
- [`recipes/github-action.md`](recipes/github-action.md) — comment the report on every PR that touches `*.prompt.md`.

## Cost & footprint

The skill loads the lint catalog plus frontmatter on activation (≈ a few KB of Markdown). It calls no external APIs, ships no binaries, and adds no runtime dependencies beyond a POSIX shell. The conformance suite ([`scripts/run-tests.sh`](scripts/run-tests.sh)) finishes in under one second on the shipped corpus; see [`scripts/bench.sh`](scripts/bench.sh) to reproduce.

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=HenrikBrehm/prompt-refiner-skill&type=Date)](https://star-history.com/#HenrikBrehm/prompt-refiner-skill&Date)

If this skill saves you from prompt-bloat, a star is the cheapest way to help others find it.

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The bar is high: each change should make the skill *more reliable* or *more discoverable* without bloating it. Structural validation lives in [`scripts/validate-skill.sh`](scripts/validate-skill.sh) and runs on every push and PR via GitHub Actions; conformance lives in [`scripts/run-tests.sh`](scripts/run-tests.sh) and [`tests/corpus/`](tests/corpus/).

## License & changelog

- License: [MIT](LICENSE) © 2026 Henrik Brehm
- Release notes: [CHANGELOG.md](CHANGELOG.md)

---

![og card](assets/og-card.svg)
