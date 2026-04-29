---
name: prompt-refiner
description: Flags prompt-engineering bugs in user-supplied prompts without rewriting them. Use when the user says "lint my prompt", "review this prompt", "improve this prompt", "what's wrong with my prompt", "audit prompt", "check prompt for bugs", or pastes a prompt and asks for feedback. Reports findings as line-numbered citations against the rule catalog in references/lint-rules.md. Hybrid engine: a deterministic Node detector (scripts/lint.js) covers 18 of 20 rules with reproducible output; the model layers semantic rules on top. Never imposes a framework, never asks clarifying questions, never auto-rewrites.
license: MIT
metadata:
  author: Henrik Brehm
  version: "1.4.0"
  homepage: https://github.com/HenrikBrehm/prompt-refiner-skill
---

# Prompt Refiner — Lint, don't rewrite

This skill **flags** prompt-engineering bugs against a stable, citeable rule catalog. It does NOT rewrite the user's prompt, does NOT ask clarifying questions, and does NOT impose any framework (CO-STAR / RISEN / RTF / RACE).

It runs a hybrid two-pass:
- **Deterministic pass** — `scripts/lint.js` (zero-dep Node) catches the basic case for **18 of 20 rules**: pure-deterministic `PR001`, `PR004`, `PR006`, `PR007`, `PR008`, `PR011`, `PR012`, `PR013`, `PR014`, `PR015`, `PR016`, `PR017`, `PR-INJ01`, `PR-INJ02`, `PR-INJ03`, plus the deterministic-basic-case for hybrid `PR002`, `PR005`, `PR010`. Same input → same findings, run-to-run.
- **Model pass** — you (the model) layer two pure-semantic rules on top: `PR003` (pronoun antecedent resolution), `PR009` (persona/domain comparison). For the three hybrid rules (`PR002`, `PR005`, `PR010`), add semantic findings the regex missed.

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

### 3. Run the deterministic pass

Pipe the prompt to the bundled detector and parse the JSON output:

```bash
node scripts/lint.js --format=json --fail-on=none /path/to/prompt-or-stdin
```

Each entry of `findings[]` becomes a finding tagged `engine: deterministic`. The line/col/evidence/rationale come from the detector verbatim.

If `node` is unavailable in the environment, skip this step and add a one-line footer to the report noting the deterministic pass did not run; proceed with the model pass alone.

### 4. Run the model pass

Read `references/lint-rules.md` and check the rules whose `Engine:` line contains `model` against the prompt. That covers two pure-model rules (`PR003`, `PR009`) and three hybrid rules where you add semantic cases on top of the deterministic basic case (`PR002`, `PR005`, `PR010`). Each rule's "Detect" clause defines what triggers a finding. Record findings as `{rule_id, severity, line, col, evidence, rationale, engine: "model"}`.

For the three hybrid rules, do NOT re-emit a finding the deterministic pass already produced (deduplicate by `(rule_id, line, evidence)`); only add semantic cases the regex missed.

Stability contract for model findings:
- `evidence` is the literal substring quoted from the prompt — never paraphrased, never translated.
- `rule_id` is the catalog ID (e.g. `PR002`).
- `line` and `col` are 1-based, computed against the original prompt text.
- Preserve the prompt's language in any prose (DE prompt → DE rationale optional, but evidence is always verbatim).

### 5. Merge and emit

Combine the deterministic findings and model findings into one list. Sort by `(line, col, rule_id)`. Emit:

**Markdown mode (default).** One line per finding. Tag each finding with its engine in parentheses. Format:

```
# Prompt-refiner report

`<rule_id>` [<severity>] line:col — `<evidence>` — <rationale> _(engine)_

...

**summary:** <N> errors, <N> warnings, <N> info
```

If there are zero findings (and the deterministic pass ran), emit exactly:

```
# Prompt-refiner report

No issues found.
```

**JSON mode** (`--json` flag): emit a single fenced ` ```json ` block validating against `schemas/report.schema.json`. Each finding may include an additional `engine` field with value `"deterministic"` or `"model"`. No prose before or after the block. The schema disallows suggested rewrites.

### 6. Never rewrite

Do NOT propose a rewritten version of the prompt. Do NOT ask the user to confirm a fix. Do NOT impose a framework. If the user explicitly asks for a fix after seeing the report, point them to the relevant rule's section in `references/lint-rules.md` — the user, not the skill, decides the rewrite.

## Clarifying questions

Almost never. Make reasonable assumptions and proceed. If the request is so ambiguous that running the lint catalog is impossible, ask exactly one question, then stop — do not also produce a partial report.

## CI / scripted use

The deterministic detector is independently runnable without the LLM:

```bash
# Block commits with errors:
node scripts/lint.js --fail-on=error path/to/prompt.md

# Lock current findings, fail only on new ones:
node scripts/lint.js --write-baseline=.prompt-refiner-baseline.json path/to/prompt.md
node scripts/lint.js --baseline=.prompt-refiner-baseline.json --fail-on=warning path/to/prompt.md
```

See `recipes/pre-commit.md` and `recipes/github-action.md` for full pipelines.

## Suppression

Inline HTML comments suppress findings in scripted runs:
- `<!-- prompt-refiner-disable PR001 -->` — file-wide.
- `<!-- prompt-refiner-disable-next-line PR001 -->` — only the following line.
- `<!-- prompt-refiner-disable-line PR001 -->` — only the line it appears on.

The model pass should also honor these comments when present in the input.

## References

- `references/lint-rules.md` — catalog of named lint rules (PR001–PR-INJ03), each tagged with its engine.
- `references/json-output.md` — JSON mode contract.
- `schemas/report.schema.json` — JSON Schema for findings reports.
- `scripts/lint.js` — deterministic detector (Node, zero deps).
- `recipes/pre-commit.md` — pre-commit integration.
- `recipes/github-action.md` — GitHub Action integration.
- `tests/corpus/` — conformance corpus with expected rule firings per case.
