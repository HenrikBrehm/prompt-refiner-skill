# Prompt-Refiner Lint Rules

This catalog defines the named bugs the skill flags. The skill never rewrites a user's prompt - it reports findings as `<RULE_ID> [severity] line:col - quoted evidence - one-line rationale _(engine)_`. Each finding cites the rule by ID so users can suppress, customize, or argue with it.

Severity levels:
- `error` — almost always degrades model output; fix before shipping.
- `warning` — frequently degrades output; review.
- `info` — stylistic or context-dependent; surface once, do not nag.

Stability contract: rule IDs (`PR001`, `PR-INJ01`, etc.) are append-only. Renames are forbidden. New rules get the next free ID.

Engine: each rule below carries an `Engine:` line.
- `deterministic` — fired by `scripts/lint.js` (regex/string analysis, reproducible).
- `model` — fired by the LLM during the skill's procedure (semantic analysis required; not reproducible run-to-run).
- `hybrid` — basic cases caught deterministically; semantic cases caught by the model.

Rules currently detected by the deterministic engine:
- **Pure deterministic** (no model overlap): `PR001`, `PR004`, `PR006`, `PR007`, `PR008`, `PR011`, `PR012`, `PR013`, `PR014`, `PR015`, `PR016`, `PR017`, `PR018`, `PR019`, `PR020`, `PR-INJ01`, `PR-INJ02`, `PR-INJ03`.
- **Hybrid** (deterministic basic case + model semantic case): `PR002`, `PR005`, `PR010`.
- **Pure model** (no reliable regex possible): `PR003` (antecedent resolution), `PR009` (persona/domain comparison).

Run-to-run drift on the model layer is bounded to `PR003` and `PR009`. Everything else is reproducible against fixed input.

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
Engine: hybrid (deterministic basic case via known imperative-verb vocabulary; model handles semantic cases the regex misses)
Detect: a single sentence containing two or more top-level imperatives joined by `and`/`then`/`,` where the imperatives target different output artefacts (e.g. `summarize X and write a tweet about Y`).
Flag: quote the sentence; list the distinct intents detected; recommend splitting into separately scoped steps or a numbered list. Do NOT propose specific wording.
Deterministic note: matches when two distinct imperatives from a known vocabulary (write/summarize/classify/translate/extract/...) appear in one sentence joined by and/then. Different verb stems are required so `summarize and refine` is not flagged.

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
Engine: hybrid (deterministic catches a curated list of known contradiction pairs within one paragraph; model catches the rest via semantic equivalence)
Detect: a `do X` adjacent to a `do not X` for the same X within one prompt; or a positive instruction whose required output violates a stated prohibition (e.g. `output JSON` + `do not include curly braces`).
Flag: quote both clauses; do NOT propose a resolution.
Deterministic pairs include: JSON ↔ no braces / plain text only; formal tone ↔ casual tone; bullet points ↔ prose-only; markdown ↔ plain text only; code-only ↔ explain; English-only ↔ another named language. The model layer adds semantic contradictions outside this list.

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
Engine: hybrid (deterministic flags vague-quality adjectives in instructional context; model judges whether an adjacent operational definition redeems the phrase)
Detect: a success phrase (`good`, `high quality`, `useful`, `clear`, `engaging`, `professional`) without an operational definition (rubric, example, comparable artefact, automated check).
Flag: quote the phrase; recommend either deletion or attaching one operational criterion.
Deterministic basic case: a vague-quality adjective (good/great/professional/engaging/high-quality/...) sandwiched between an instructional verb (write/make/create/...) and an output noun (response/article/email/...). The model layer handles cases where the criterion appears in adjacent prose.

## Output hygiene & ergonomics

### PR011 — Stale or unanchored relative date
Severity: warning
Engine: deterministic (relative-date phrase + no absolute date elsewhere in prompt)
Detect: a relative date reference (`yesterday`, `today`, `last week`, `this quarter`, `most recent`, `latest`, `up-to-date`, etc.) when the prompt contains no absolute date (ISO `YYYY-MM-DD`, slashed `M/D/YYYY`, named-month with day, or `Q<n> YYYY`).
Flag: quote the relative phrase; recommend attaching the absolute date so the model does not have to guess from training-data cutoff.
Why it matters: models cannot resolve relative dates without an anchor and may interpret `recently` against stale knowledge.

### PR012 — Politeness padding
Severity: info
Engine: deterministic (phrase regex covering EN/DE/ES politeness markers)
Detect: filler phrases that add tokens but no instructional signal: `please`, `kindly`, `if you could`, `would you mind`, `I'd appreciate`, `thanks in advance`, `bitte`, `por favor`, etc.
Flag: quote each occurrence; note that the phrase is removable without changing model behavior.
Why it matters: tokens cost money; politeness padding occasionally trains hedged or apologetic outputs. Not severe — emitted as info, surface-once.

### PR013 — Untrusted content introduced without delimiter
Severity: warning
Engine: deterministic (intro phrase ending with `:` followed within ~3 lines by content lacking a delimiter)
Detect: phrases like `the following text:`, `here is the content:`, `process this input:` immediately preceding content that is NOT wrapped in a recognizable delimiter (triple backticks, triple quotes, `<tag>`, `[TAG]`, or `---`).
Flag: quote the intro phrase; recommend wrapping the input in an explicit delimiter so the model can distinguish instruction text from data.
Why it matters: undelimited user input is the most common prompt-injection vector; the model cannot tell where the trusted instruction ends and the untrusted data begins.

### PR014 — Reasoning-then-answer without output delimiter
Severity: info
Engine: deterministic (reasoning verb + connector + answer noun, with no delimiter hint within ±200 chars)
Detect: requests like `think step by step then give the answer`, `explain your reasoning and then provide the final response` without specifying a parsable structure (a tag, JSON envelope, code fence, or explicit "begin/end with ..." marker).
Flag: quote the matched span; recommend specifying the answer envelope (e.g. `<answer>...</answer>` or `Final answer: ...`).
Why it matters: downstream code cannot reliably split reasoning from answer if the prompt does not specify the boundary.

### PR015 — Rating / confidence requested without scale
Severity: info
Engine: deterministic (rating-verb + score-target + no scale anchor within ±200 chars)
Detect: phrases like `rate your confidence`, `give a probability`, `score the relevance` without an explicit scale (e.g. `0-1`, `1-10`, `percent`, Likert anchors `low/medium/high`).
Flag: quote the request; recommend attaching a numeric range or anchor set.
Why it matters: without a scale the model picks one and outputs differ run-to-run, breaking downstream parsing or comparisons.

### PR016 — Open-ended creative output without length bound
Severity: info
Engine: deterministic (creative-format noun after generation verb, with no length marker within ±100 chars)
Detect: prompts like `write an essay about X`, `compose a story`, `draft an email` with no length hint (word count, paragraph count, `brief`, `short`, `concise`, `detailed`, etc.).
Flag: quote the generation noun; recommend either accepting the model's default (~150–300 words) or specifying a length.
Why it matters: users are routinely surprised by either too-short or too-long output when no length is specified.

### PR017 — Negation-only prompt
Severity: info
Engine: deterministic (≥3 negations and no positive imperative verb anywhere in prompt)
Detect: prompts containing three or more negation patterns (`don't`, `do not`, `never`, `avoid`, `must not`, ...) without a single positive instructional verb (`write`, `summarize`, `classify`, `produce`, ...).
Flag: quote the first negation; report the count.
Why it matters: telling the model what NOT to do without a positive direction often produces ~the forbidden content (the "don't think of a pink elephant" effect). Pair every prohibition with an explicit positive instruction.

### PR018 — Output language not specified
Severity: info
Engine: deterministic (generation-verb match + absence of any explicit language marker in the whole prompt)
Detect: the prompt contains a generation verb (`write`, `draft`, `compose`, `summarize`, `translate` and EN/DE/ES lemmas) AND no explicit output-language marker appears anywhere in the prompt. Markers include `in <Lang>`, `to <Lang>`, `into <Lang>`, `auf <Lang>`, `en <Lang>`, `respond in <Lang>`, `output in <Lang>`, `language: <Lang>` for a bounded list of named languages (English, German, Spanish, French, Italian, Portuguese, Japanese, Chinese, Korean, Russian, Dutch, Polish, Turkish, Hebrew, Arabic, Hindi, Vietnamese, Swedish, Norwegian, Danish, Finnish, Greek, Czech, Ukrainian — and EN/DE/ES translations of each).
Flag: quote the generation verb; recommend stating the response language explicitly so the model doesn't default-guess from prompt language.
Note: prompts under 3 words (e.g. `Yes thanks`) are skipped — defaults are reliable on trivial inputs.
Why it matters: when no language is named, the model heuristically picks one based on the prompt's own language. That default is fine in many cases but invisible to downstream code expecting a specific language and a frequent silent-defect source for international teams.
Example bad: `Write me a summary of the Q3 strategy doc and post it on the channel.`
Example good: `Write me a summary of the Q3 strategy doc in English and post it on the channel.`

### PR019 — Missing role / context definition
Severity: warning
Engine: deterministic (>50-word prompt + domain-noun heuristic + absence of role anchor)
Detect: a prompt longer than 50 words that uses domain-specific terminology — defined as ≥1 acronym of 3+ uppercase letters (e.g. `API`, `JWT`, `K8S`, `OAuth2`) OR ≥2 capitalized non-sentence-start tokens (proper nouns mid-sentence, e.g. `Stripe`, `Kubernetes`, `Postgres`) — without a role anchor. Role anchors include `you are a/an/the`, `act as a/an/the`, `as a/an <noun>`, `your role is`, `playing the role`, `du bist ein/eine/...`, `agiere als`, `verhalte dich wie`, `actúa como`, `compórtate como`, `tú eres un/una`, `agis comme/en tant que`. Common false-positive acronyms (`I`, `OK`, `TODO`, `NULL`, `TRUE`, ...) and proper nouns (`I`, `Mr`, weekday/month names, German pronouns) are excluded.
Flag: quote the earliest domain marker; recommend prepending an explicit role/context line so the model anchors its expertise and tone.
Why it matters: long, domain-heavy prompts without a role often get generic, hedge-y answers because the model has not been told what expert posture to adopt. A one-line role anchor steers vocabulary, depth, and assumed background.
Example bad: `We need to migrate the OAuth2 layer from Auth0 to Keycloak while keeping JWT signing keys rotated through Vault. Document the Postgres schema changes and the Kubernetes ingress path. Include a rollback plan.`
Example good: `You are a senior platform engineer. We need to migrate the OAuth2 layer from Auth0 to Keycloak ...`

### PR020 — Few-shot with uneven example structure
Severity: warning
Engine: deterministic (≥2 example blocks, mismatched field-label sets per block)
Detect: ≥2 example blocks marked with `Example:`, `Beispiel:`, `Ejemplo:`, `Sample:` (optionally numbered, e.g. `Example 1:`), OR — when no explicit block markers are present — ≥2 occurrences of `Input:`/`Eingabe:`/`Entrada:`/`Frage:`/`Question:`/`Pregunta:`/`Prompt:`/`User:` each starting a new block. Each block is then scanned for field labels: `Input`, `Output`, `Question`, `Answer`, `Response`, `Reply`, `Prompt`, `User`, `Assistant`, plus DE (`Eingabe`, `Ausgabe`, `Frage`, `Antwort`) and ES (`Entrada`, `Salida`, `Pregunta`, `Respuesta`) equivalents. Fires when the field-label set differs across blocks (block 1 has `Input` + `Output`, block 2 has only `Output`; or block 1 uses `Input`/`Output` and block 2 uses `Question`/`Answer`).
Flag: quote the marker line of the smallest/divergent block; recommend normalizing every example block to expose the same labels.
Why it matters: few-shot models infer the output schema from the example structure. Inconsistent fields confuse the inference — the model may copy the smallest block's structure or hallucinate a missing field.
Example bad:
```
Example 1:
Input: I love this product
Output: positive

Example 2:
Output: negative
```
Example good:
```
Example 1:
Input: I love this product
Output: positive

Example 2:
Input: This was awful
Output: negative
```

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
2. **Model pass** — the skill, when invoked inside Claude Code (or another LLM host), checks the rules tagged `Engine: model` and adds semantic cases for rules tagged `Engine: hybrid`. It merges those findings with the deterministic ones and tags every finding with the engine that produced it.

The skill does NOT propose rewrites, does NOT ask follow-up questions, and does NOT impose any framework. If the user explicitly asks for a fix, the skill quotes the rule and points the user to the relevant section above; the user, not the skill, decides the rewrite.
