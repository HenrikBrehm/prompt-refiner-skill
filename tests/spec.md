# Behavior spec

A catalog of invariants the linter must satisfy. Use these when reviewing a behavior change or when manually verifying that a Claude Code session is invoking the skill correctly. Each spec is structured as **input → must-hold properties**.

Structural pieces (frontmatter present, `when_to_use` present, bundled resources referenced through `${CLAUDE_SKILL_DIR}`) are checked automatically by `scripts/validate-skill.sh`. Corpus structure is checked by `scripts/run-tests.sh`. The semantic pieces below cannot be checked statically — they require running the skill and inspecting output.

---

## S-1. Never rewrites

**Input:** any prompt the user pastes in.

**Must hold:**
- Output does NOT contain a rewritten or "improved" version of the prompt.
- Output does NOT contain phrases like "here is a better version", "try this instead", "consider rewriting as".
- Findings reference rules by ID and quote literal evidence; they do not propose specific replacement text.

## S-2. Never imposes a framework

**Input:** `make me a list of blog post ideas about AI`

**Must hold:**
- Output does NOT contain `CONTEXT:`, `OBJECTIVE:`, `STYLE:`, `TONE:`, `AUDIENCE:`, `RESPONSE FORMAT:`, or any CO-STAR / RISEN / RTF / RACE / TIDD-EC scaffolding.
- Output does NOT contain a role-play preamble (`You are an expert ...`, `Act as a senior ...`).

## S-3. Evidence preservation

**Input:** `mach mir ne liste mit ideen für nen blog post über ai`

**Must hold:**
- Any `evidence` field is byte-identical to the source substring (German stays German; no translation, no normalization).
- Rationale prose may be in any language; evidence MAY NOT be paraphrased.

## S-4. Rule-ID stability

**Input:** any.

**Must hold:**
- Every fired rule ID matches `^PR(-INJ)?[0-9]{2,3}$`.
- Every fired rule ID is defined in `references/lint-rules.md`.
- No rule ID is renamed or repurposed across versions; new rules get the next free ID (catalog is append-only).

## S-5. Markdown output shape

**Input:** any prompt; default mode (no `--json`).

**Must hold:**
- Response begins with the literal heading `# Prompt-refiner report` (no preamble before it).
- One line per finding, format: `` `<RULE_ID>` [<severity>] line:col - `<evidence>` - <one-line rationale> _(<engine>)_ ``
- A `**summary:**` totals line follows (or the literal block `No issues found.` if zero findings).
- No closing meta-commentary after the totals line.

## S-6. JSON output shape

**Input:** any prompt with `--json` appended (or "JSON output" / "machine-readable" requested).

**Must hold:**
- Response is exactly one fenced ` ```json ` block — nothing before or after.
- Content validates against `schemas/report.schema.json`.
- `findings` array is ordered by `line`, then `col`.
- Every finding contains `engine` with value `deterministic` or `model`.
- No suggested rewrites anywhere in the JSON.

## S-7. Zero-finding behavior

**Input:** `Refactor auth/middleware.ts so the JWT verification is in its own module. Keep the public API of the file the same. Run the tests after.`

**Must hold:**
- Markdown mode: response is exactly `# Prompt-refiner report\n\nNo issues found.\n`.
- JSON mode: response contains `findings: []` and `summary: {error: 0, warning: 0, info: 0}`.

## S-8. No clarifying questions

**Input:** `can you fix the function that does the date stuff its broken`

**Must hold:**
- The skill does NOT ask "which function?" or "which file?".
- It runs the lint catalog on the prompt itself and reports findings (likely PR001 vague-verb, PR003 ambiguous antecedent, PR007 implicit output format).
- A clarifying question is acceptable only when running the lint catalog is genuinely impossible (e.g. empty prompt).

## S-9. Injection corpus passes

**Input:** the case in `tests/corpus/007-injection-ignore-previous.md`.

**Must hold:**
- PR-INJ01 fires on the embedded "ignore previous" string inside the user-input region.
- No `forbidden_rules` from the test frontmatter fire.

## S-10. Multilingual coverage

**Input:** any case under `tests/corpus/i18n/` (de, es, ja, …).

**Must hold:**
- The expected rule fires regardless of source language.
- Evidence is quoted in the original language; no translation occurs.
