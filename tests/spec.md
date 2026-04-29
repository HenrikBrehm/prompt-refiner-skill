# Behavior spec

A catalog of invariants the skill must satisfy. Use these when reviewing a behavior change or when manually verifying that a Claude Code session is invoking the skill correctly. Each spec is structured as **input → must-hold properties**.

The structural pieces (frontmatter present, output sections referenced) are checked automatically by `scripts/validate-skill.sh`. The semantic pieces below cannot be checked statically — they require running the skill and inspecting output.

---

## S-1. Language preservation (German)

**Input:** `mach mir ne liste mit ideen für nen blog post über ai`

**Must hold:**
- Refined prompt is in German.
- Refined prompt does not begin with `You are ...` / `Du bist ...` (no role-play preamble).
- Refined prompt does not contain `CONTEXT:`, `OBJECTIVE:`, `TONE:`, `AUDIENCE:`, or any framework-style label.
- Word count of refined prompt is within ±30 % of the original (light mode).

## S-2. Language preservation (English)

**Input:** `make me a list of blog post ideas about ai`

**Must hold:**
- Refined prompt is in English.
- Same anti-framework, anti-preamble checks as S-1.

## S-3. Already-clear prompt

**Input:** `Refactor auth/middleware.ts so the JWT verification is in its own module. Keep the public API of the file the same. Run the tests after.`

**Must hold:**
- Refined prompt is byte-identical (or nearly so) to the original.
- Word count is within ±10 % of the original.

## S-4. Strict mode budget

**Input:** Any prompt **+ `--strict`**.

**Must hold:**
- Refined-prompt word count is within ±10 % of the original.
- Only typos, grammatical defects, and true ambiguities are corrected. Cosmetic restructuring is not applied.

## S-5. Review mode

**Input:** Any prompt **+ `--review`**.

**Must hold:**
- The "Result" section does NOT contain output produced by executing the refined prompt.
- The "Result" section is a brief paragraph explaining the changes (or stating that no changes were made).
- The two-section response shape is preserved.

## S-6. Anti-framework rule

**Input:** `write me a tweet about claude code`

**Must hold:**
- Refined prompt does NOT contain a framework template (no `CONTEXT:`, `AUDIENCE: developers on Twitter`, `TONE:`, `RESPONSE FORMAT:`, etc.).
- Refined prompt is at most ~12 words (the original is 7 words; light mode budget is ±30 %, so ≤ 9 words; strict mode ≤ 8).

## S-7. Output shape

**Input:** Any prompt.

**Must hold:**
- Response begins with the literal heading `## Improved prompt` (no preamble before it).
- Response contains exactly one `## Result` heading.
- Response has no other top-level (`## `) headings.
- Response has no closing summary or meta-commentary after the "Result" content (except in `--review` mode, where the explanation IS the result).

## S-8. No unnecessary clarifying question

**Input:** `can you fix the function that does the date stuff its broken`

**Must hold:**
- The skill does NOT ask the user "which function?" or "which file?" — it makes a reasonable assumption (e.g., search the codebase) and proceeds.
- A clarifying question is acceptable only if the prompt cannot be acted on at all without one (rare).

## S-9. Tone preservation

**Input:** terse imperative such as `fix it.`

**Must hold:**
- Refined prompt remains terse and imperative.
- No motivational language is added (no "Please", no "Could you kindly", no "Let's").
