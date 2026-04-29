# Prompt-Refiner Lint Rules

This catalog defines the named bugs the skill flags. The skill never rewrites a user's prompt — it reports findings as `<RULE_ID> [severity] line:col — quoted evidence — one-line rationale`. Each finding cites the rule by ID so users can suppress, customize, or argue with it.

Severity levels:
- `error` — almost always degrades model output; fix before shipping.
- `warning` — frequently degrades output; review.
- `info` — stylistic or context-dependent; surface once, do not nag.

Stability contract: rule IDs (`PR001`, `PR-INJ01`, etc.) are append-only. Renames are forbidden. New rules get the next free ID.

## Clarity & specificity

### PR001 — Vague action verb
Severity: warning
Detect: a top-level imperative whose verb is one of `do`, `handle`, `process`, `manage`, `deal with`, `take care of`, `work on`, `look at`, `figure out` and whose object is a noun phrase without a measurable outcome.
Flag: quote the verb phrase, ask user to substitute a verb that names the transformation (e.g. `extract`, `summarize`, `classify`, `translate`, `rewrite`, `score`).
Do NOT rewrite.
Example bad: `Handle the customer feedback.`
Example good: `Classify each customer-feedback row into {bug, feature_request, praise, other}.`

### PR002 — Mixed intent in single instruction
Severity: error
Detect: a single sentence containing two or more top-level imperatives joined by `and`/`then`/`,` where the imperatives target different output artefacts (e.g. `summarize X and write a tweet about Y`).
Flag: quote the sentence; list the distinct intents detected; recommend splitting into separately scoped steps or a numbered list. Do NOT propose specific wording.

### PR003 — Pronoun with ambiguous antecedent
Severity: warning
Detect: a pronoun (`it`, `they`, `this`, `that`, `these`, `those`) whose nearest plausible antecedent is more than one of (a) the user's input, (b) a prior model turn, (c) a named document, (d) the prompt's own preceding clause.
Flag: quote the pronoun in context; enumerate the candidate antecedents the linter detected; recommend replacing with the explicit noun phrase.

### PR004 — Scale conflict
Severity: error
Detect: two or more numeric/scope constraints that contradict (`under 50 words` + `at least three paragraphs`; `concise` + `comprehensive`; `bullet list` + `prose`).
Flag: quote both constraints; mark which budget unit they disagree on (length, structure, depth).

### PR005 — Contradictory constraints
Severity: error
Detect: a `do X` adjacent to a `do not X` for the same X within one prompt; or a positive instruction whose required output violates a stated prohibition (e.g. `output JSON` + `do not include curly braces`).
Flag: quote both clauses; do NOT propose a resolution.

### PR006 — Unbounded numeric request
Severity: warning
Detect: words `some`, `several`, `a few`, `many`, `comprehensive`, `thorough`, `detailed`, `exhaustive` used as quantifiers without an explicit numeric bound when the output is enumerable (lists, examples, paragraphs, words, tokens).
Flag: quote the quantifier; ask user to supply a numeric bound or accept the linter's note that the model will pick.

### PR007 — Implicit output format
Severity: warning
Detect: the prompt requests a structured artefact (table, list, JSON, CSV, code, diff) but does not specify (a) the column/key names, (b) the field types, or (c) an example row.
Flag: quote the structural noun; list which of {schema, types, example} are absent.

### PR008 — Placeholder leakage
Severity: error
Detect: literal placeholder tokens left in the prompt (`{{...}}`, `<...>`, `[INSERT ...]`, `TODO`, `FIXME`, `lorem ipsum`).
Flag: report each placeholder with line:col.

### PR009 — Conflicting persona / scope
Severity: warning
Detect: two persona or domain assertions that disagree (`act as a child` + `use technical jargon`; `legal advice for California` + `general advice not tied to jurisdiction`).
Flag: quote both clauses.

### PR010 — Untestable success criterion
Severity: info
Detect: a success phrase (`good`, `high quality`, `useful`, `clear`, `engaging`, `professional`) without an operational definition (rubric, example, comparable artefact, automated check).
Flag: quote the phrase; recommend either deletion or attaching one operational criterion.

## Prompt-injection / role-confusion

### PR-INJ01 — Embedded "ignore previous" pattern
Severity: error
Detect: the user's prompt template substitutes untrusted text into a region that contains literal phrases matching `ignore (all|the|previous) (instructions|prompts|rules)`, `disregard (the )?above`, `you are now`, `system prompt:`.
Flag: quote the matched span; recommend wrapping untrusted content in an explicit delimiter and instructing the model to treat the delimited content as data.

### PR-INJ02 — Role-switching imperative
Severity: warning
Detect: the prompt instructs the model to assume a new role *after* user-supplied content has been concatenated (e.g. `${user_input}\n\nYou are now ...`).
Flag: quote the boundary; explain the ordering risk.

### PR-INJ03 — Unbounded tool/output authority
Severity: warning
Detect: blanket grants like `do whatever is needed`, `take any action`, `you may run any command`, when no scoping clause appears within the same paragraph.
Flag: quote the clause; recommend an explicit allowlist or a denial fallback.

## How the skill applies these rules

The skill, when invoked, reads the user's prompt and produces a Markdown report with one section per fired rule. It does NOT propose rewrites, does NOT ask follow-up questions, and does NOT impose any framework. If the user explicitly asks for a fix, the skill quotes the rule and points the user to the relevant section above; the user, not the skill, decides the rewrite.
