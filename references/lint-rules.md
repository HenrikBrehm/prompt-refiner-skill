# Prompt-Refiner Lint Rules

This catalog defines the named bugs the skill flags. The skill never rewrites a user's prompt — it reports findings as `<RULE_ID> [severity] line:col — quoted evidence — one-line rationale`. Each finding cites the rule by ID so users can suppress, customize, or argue with it.

Severity levels:
- `error` — almost always degrades model output; fix before shipping.
- `warning` — frequently degrades output; review.
- `info` — stylistic or context-dependent; surface once, do not nag.

Stability contract: rule IDs (`PR001`, `PR-INJ01`, etc.) are append-only. Renames are forbidden. New rules get the next free ID.

Engine: each rule below carries an `Engine:` line.
- `deterministic` — fired by `scripts/lint.js` (regex/string analysis, reproducible).
- `model` — fired by the LLM during the skill's procedure (semantic analysis required; not reproducible run-to-run).
- `hybrid` — basic cases caught deterministically; semantic cases caught by the model.

Rules currently detected deterministically: `PR001`, `PR004`, `PR006`, `PR007`, `PR008`, `PR-INJ01`, `PR-INJ02`, `PR-INJ03`. The remaining rules (`PR002`, `PR003`, `PR005`, `PR009`, `PR010`) require the model layer.

## Clarity & specificity

### PR001 — Vague action verb
Severity: warning
Engine: deterministic (regex; EN/DE/ES/JA verb lists)
Detect: a top-level imperative whose verb is one of `handle`, `process`, `manage`, `deal with`, `take care of`, `work on`, `look at`, `figure out` (EN); `kümmer(e) dich um`, `behandle`, `bearbeite`, `erledige`, `mach was/etwas mit` (DE); `encárgate de`, `ocúpate de`, `maneja`, `gestiona`, `lidia con` (ES); `処理して`, `対応して`, `対処して`, `なんとかして` (JA), and whose object is a noun phrase without a measurable outcome.
Flag: quote the verb phrase, ask user to substitute a verb that names the transformation (e.g. `extract`, `summarize`, `classify`, `translate`, `rewrite`, `score`).
Do NOT rewrite.
Example bad: `Handle the customer feedback.`
Example good: `Classify each customer-feedback row into {bug, feature_request, praise, other}.`
Note: `do` is intentionally excluded from the EN verb list — too overloaded (`do not`, `do you`, `do whatever`) to detect with high precision.

### PR002 — Mixed intent in single instruction
Severity: error
Engine: model (requires intent classification across imperatives)
Detect: a single sentence containing two or more top-level imperatives joined by `and`/`then`/`,` where the imperatives target different output artefacts (e.g. `summarize X and write a tweet about Y`).
Flag: quote the sentence; list the distinct intents detected; recommend splitting into separately scoped steps or a numbered list. Do NOT propose specific wording.

### PR003 — Pronoun with ambiguous antecedent
Severity: warning
Engine: model (antecedent resolution)
Detect: a pronoun (`it`, `they`, `this`, `that`, `these`, `those`) whose nearest plausible antecedent is more than one of (a) the user's input, (b) a prior model turn, (c) a named document, (d) the prompt's own preceding clause.
Flag: quote the pronoun in context; enumerate the candidate antecedents the linter detected; recommend replacing with the explicit noun phrase.

### PR004 — Scale conflict
Severity: error
Engine: deterministic (co-occurrence of length-max and length-min markers)
Detect: two or more numeric/scope constraints that contradict (`under 50 words` + `at least three paragraphs`; `concise` + `comprehensive`; `bullet list` + `prose`).
Flag: quote both constraints; mark which budget unit they disagree on (length, structure, depth).

### PR005 — Contradictory constraints
Severity: error
Engine: model (semantic equivalence check on `X` across both clauses)
Detect: a `do X` adjacent to a `do not X` for the same X within one prompt; or a positive instruction whose required output violates a stated prohibition (e.g. `output JSON` + `do not include curly braces`).
Flag: quote both clauses; do NOT propose a resolution.

### PR006 — Unbounded numeric request
Severity: warning
Engine: deterministic (quantifier near enumerable noun, no digit between)
Detect: words `some`, `several`, `a few`, `many`, `comprehensive`, `thorough`, `detailed`, `exhaustive` used as quantifiers without an explicit numeric bound when the output is enumerable (lists, examples, paragraphs, words, tokens).
Flag: quote the quantifier; ask user to supply a numeric bound or accept the linter's note that the model will pick.

### PR007 — Implicit output format
Severity: warning
Engine: deterministic (structural noun without nearby schema/example markers)
Detect: the prompt requests a structured artefact (table, list, JSON, CSV, code, diff) but does not specify (a) the column/key names, (b) the field types, or (c) an example row.
Flag: quote the structural noun; list which of {schema, types, example} are absent.

### PR008 — Placeholder leakage
Severity: error
Engine: deterministic (placeholder pattern regex)
Detect: literal placeholder tokens left in the prompt (`{{...}}`, `<...>`, `[INSERT ...]`, `TODO`, `FIXME`, `lorem ipsum`).
Flag: report each placeholder with line:col.

### PR009 — Conflicting persona / scope
Severity: warning
Engine: model (cross-clause persona/domain comparison)
Detect: two persona or domain assertions that disagree (`act as a child` + `use technical jargon`; `legal advice for California` + `general advice not tied to jurisdiction`).
Flag: quote both clauses.

### PR010 — Untestable success criterion
Severity: info
Engine: model (judgement on whether the criterion is operationally testable)
Detect: a success phrase (`good`, `high quality`, `useful`, `clear`, `engaging`, `professional`) without an operational definition (rubric, example, comparable artefact, automated check).
Flag: quote the phrase; recommend either deletion or attaching one operational criterion.

## Prompt-injection / role-confusion

### PR-INJ01 — Embedded "ignore previous" pattern
Severity: error
Engine: deterministic (phrase regex)
Detect: the user's prompt template substitutes untrusted text into a region that contains literal phrases matching `ignore (all|the|previous) (instructions|prompts|rules)`, `disregard (the )?above`, `you are now`, `system prompt:`.
Flag: quote the matched span; recommend wrapping untrusted content in an explicit delimiter and instructing the model to treat the delimited content as data.

### PR-INJ02 — Role-switching imperative
Severity: warning
Engine: deterministic (interpolation token followed by role-switch phrase within 200 chars)
Detect: the prompt instructs the model to assume a new role *after* user-supplied content has been concatenated (e.g. `${user_input}\n\nYou are now ...`).
Flag: quote the boundary; explain the ordering risk.

### PR-INJ03 — Unbounded tool/output authority
Severity: warning
Engine: deterministic (blanket-authority phrase without scoping clause in same paragraph)
Detect: blanket grants like `do whatever is needed`, `take any action`, `you may run any command`, when no scoping clause appears within the same paragraph.
Flag: quote the clause; recommend an explicit allowlist or a denial fallback.

## How the skill applies these rules

The skill runs a two-pass hybrid:

1. **Deterministic pass** — `scripts/lint.js` checks the input against the rules tagged `Engine: deterministic`. Same input → same findings, run-to-run. The detector is zero-dependency Node and is independently runnable in CI without an LLM.
2. **Model pass** — the skill, when invoked inside Claude Code (or another LLM host), checks the rules tagged `Engine: model` against the input and merges its findings with the deterministic ones. Each finding is tagged with which engine produced it.

The skill does NOT propose rewrites, does NOT ask follow-up questions, and does NOT impose any framework. If the user explicitly asks for a fix, the skill quotes the rule and points the user to the relevant section above; the user, not the skill, decides the rewrite.
