---
name: prompt-refiner
description: Lightly refines the user's prompt before executing it — clearer, more precise, better structured — without changing intent, tone, scope, or language, then carries out the refined version. The anti-bloat refiner: no framework rewrites, no clarifying questions unless truly necessary, fixed two-section output ("Improved prompt" + "Result"). Use whenever the user asks to refine-and-run a prompt, or invokes this skill explicitly.
license: MIT
metadata:
  author: Henrik Brehm
  version: "1.1.0"
  homepage: https://github.com/HenrikBrehm/prompt-refiner-skill
---

# Prompt Refiner

When this skill is invoked, follow these steps in order. Do not deviate.

## 1. Identify the original prompt and the intensity

**Original prompt:** if the user passed text as an argument, that is the original prompt. Otherwise, treat the most recent user message (excluding the skill invocation itself) as the original prompt.

**Intensity:** the user may suffix `--light`, `--strict`, or `--review` to set the refinement mode. If no flag is given, default to **light**.

| Mode | Behavior |
|------|----------|
| `light` (default) | Refine for clarity, precision, structure. Stay within ±30 % of original word count. Then execute. |
| `strict` | Only fix genuine defects (typos, broken grammar, true ambiguities). Otherwise pass the prompt through verbatim. Stay within ±10 % of original word count. Then execute. |
| `review` | Produce the refined prompt only. Do **not** execute. The "Result" section becomes a brief explanation of what (if anything) was changed and why. |

## 2. Refine the prompt

Produce an improved version that is:

- **Clearer** — remove ambiguity and vague references
- **More precise** — sharpen loose terms into concrete ones
- **Better structured** — group related instructions; use a short list only when it genuinely helps

Hard rules — these are not optional:

- Do **not** change the original intent, goal, or scope
- Do **not** add new requirements, features, constraints, or acceptance criteria
- Do **not** impose a prompt-engineering framework (CO-STAR, RISEN, RTF, RACE, etc.) — this skill is the *anti-framework* refiner. Frameworks are excellent for *new* prompts written from scratch; they are wrong for *refining* a user's existing prompt because they smuggle in scope the user did not ask for.
- Do **not** add filler, scaffolding, role-play preambles ("You are an expert..."), or motivational language
- Preserve the user's **language** (German stays German, English stays English, mixed stays mixed)
- Preserve the user's **tone** (casual stays casual, formal stays formal, terse stays terse)
- Respect the **word-count budget** of the chosen intensity. Going over is a failure.

If the original is already clear and well-structured, return it essentially unchanged. A near-identical refinement is the correct output when no real improvement is possible — say so by returning the prompt verbatim.

## 3. Clarifying questions — almost never

Do **not** ask clarifying questions unless the task is genuinely impossible to execute without them. Make reasonable assumptions and proceed. A clarifying question is justified only when a required identifier or decision is missing and cannot be inferred (e.g., "which of these two files?" when both are plausible).

If you must ask, ask exactly one question, then stop. Do not also produce a refined prompt or a result in that turn.

## 4. Execute the refined prompt

Carry out the refined prompt as if the user had typed it directly. Use any tools, agents, or other skills that are appropriate for the task.

In `review` mode, skip this step — go straight to formatting with a brief change explanation in place of a result.

## 5. Format the response

The final response **must** contain exactly these two top-level sections, in this order, and nothing else above or below them:

```markdown
## Improved prompt
<the refined version of the prompt, verbatim>

## Result
<the result of executing the refined prompt — or, in review mode, a one-paragraph explanation of what was changed and why>
```

No preamble, no closing summary, no extra headings, no meta-commentary about what was changed (except in `review` mode, where the "Result" *is* the explanation).
