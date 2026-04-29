---
name: prompt-refiner
description: Flags prompt-engineering bugs in user-supplied prompts without rewriting them. Use when the user says "lint my prompt", "review this prompt", "improve this prompt", "what's wrong with my prompt", "audit prompt", "check prompt for bugs", or pastes a prompt and asks for feedback. Reports findings as line-numbered citations against the rule catalog in references/lint-rules.md. Never imposes a framework, never asks clarifying questions, never auto-rewrites.
license: MIT
metadata:
  author: Henrik Brehm
  version: "1.2.0"
  homepage: https://github.com/HenrikBrehm/prompt-refiner-skill
---

# Prompt Refiner — Lint, don't rewrite

This skill **flags** prompt-engineering bugs against a stable, citeable rule catalog. It does NOT rewrite the user's prompt, does NOT ask clarifying questions, and does NOT impose any framework (CO-STAR / RISEN / RTF / RACE).

## Use when

- The user pastes a prompt and asks for review, audit, lint, critique, or improvement.
- The user wants flagged bugs and rule citations, not a rewrite.
- The user wants machine-readable output (JSON mode — see `references/json-output.md`).

## Don't use when

- The user wants you to write a prompt from scratch — this skill flags, it does not author.
- The user wants you to rewrite their prompt automatically — this skill never rewrites.
- The user wants framework-driven scaffolding (CO-STAR, RISEN, RTF, TIDD-EC, etc.) — this skill is framework-free by design.

## Procedure

When invoked, follow these steps in order. Do not deviate.

### 1. Identify the prompt

If the user passed text as an argument, that is the prompt to lint. Otherwise, treat the most recent user message (excluding the skill invocation itself) as the prompt.

### 2. Detect the output mode

Markdown report by default. If the user appends `--json` or asks for "JSON output" / "machine-readable", emit a JSON report instead — see `references/json-output.md` for the contract and `schemas/report.schema.json` for the schema.

### 3. Apply the rule catalog

Read `references/lint-rules.md` and check every rule against the prompt. Each rule's "Detect" clause defines what triggers a finding. Record findings as `{rule_id, severity, line, col, evidence, rationale}`.

Stability contract:
- `evidence` is the literal substring quoted from the prompt — never paraphrased, never translated.
- `rule_id` is the catalog ID (e.g. `PR001`, `PR-INJ01`).
- `findings` are ordered by `line`, then `col`.
- Preserve the prompt's language in any prose (DE prompt → DE rationale optional, but evidence is always verbatim).

### 4. Emit the report

**Markdown mode (default).** One line per finding. No preamble, no closing summary other than the totals line. Format:

```
# Prompt-refiner report

`<rule_id>` [<severity>] line:col — `<evidence>` — <one-line rationale>

...

**summary:** <N> errors, <N> warnings, <N> info
```

If there are zero findings, emit exactly:

```
# Prompt-refiner report

No issues found.
```

**JSON mode** (`--json` flag): emit a single fenced ` ```json ` block validating against `schemas/report.schema.json`. No prose before or after the block. The schema disallows suggested rewrites.

### 5. Never rewrite

Do NOT propose a rewritten version of the prompt. Do NOT ask the user to confirm a fix. Do NOT impose a framework. If the user explicitly asks for a fix after seeing the report, point them to the relevant rule's section in `references/lint-rules.md` — the user, not the skill, decides the rewrite.

## Clarifying questions

Almost never. Make reasonable assumptions and proceed. If the request is so ambiguous that running the lint catalog is impossible, ask exactly one question, then stop — do not also produce a partial report.

## References

- `references/lint-rules.md` — catalog of named lint rules (PR001–PR-INJ03).
- `references/json-output.md` — JSON mode contract.
- `schemas/report.schema.json` — JSON Schema for findings reports.
- `recipes/pre-commit.md` — pre-commit integration.
- `recipes/github-action.md` — GitHub Action integration.
- `tests/corpus/` — conformance corpus with expected rule firings per case.
