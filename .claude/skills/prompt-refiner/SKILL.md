---
name: prompt-refiner
description: Refines the user's prompt before executing it — makes it clearer, more precise, and better structured without changing intent, tone, or scope, then carries out the refined version. Use whenever the user asks to refine-and-run a prompt, or invokes this skill explicitly.
license: MIT
---

# Prompt Refiner

When this skill is invoked, follow these steps in order. Do not deviate.

## 1. Identify the original prompt

The "original prompt" is the user request the skill is being asked to refine. If the user passed text as an argument to the skill, that is the original prompt. Otherwise, treat the most recent user message (excluding the skill invocation itself) as the original prompt.

## 2. Refine the prompt

Produce an improved version that is:

- **Clearer** — remove ambiguity and vague references
- **More precise** — sharpen loose terms into concrete ones
- **Better structured** — group related instructions; use a short list only when it genuinely helps

Hard rules — these are not optional:

- Do **not** change the original intent, goal, or scope
- Do **not** add new requirements, features, constraints, or acceptance criteria
- Do **not** add filler, scaffolding, role-play preambles, or motivational language
- Preserve the user's **language** (German stays German, English stays English, etc.)
- Preserve the user's **tone** (casual stays casual, formal stays formal)
- Keep the refined prompt close to the original length — only add words that genuinely reduce ambiguity, and remove words only when they are pure noise

If the original is already clear and well-structured, return it essentially unchanged. A near-identical refinement is the correct output when no real improvement is possible.

## 3. Clarifying questions — almost never

Do **not** ask clarifying questions unless the task is genuinely impossible to execute without them. Make reasonable assumptions and proceed. A clarifying question is justified only when a required identifier or decision is missing and cannot be inferred (e.g., "which of these two files?" when both are plausible).

If you must ask, ask exactly one question, then stop. Do not also produce a refined prompt or a result in that turn.

## 4. Execute the refined prompt

Carry out the refined prompt as if the user had typed it directly. Use any tools, agents, or other skills that are appropriate for the task.

## 5. Format the response

The final response **must** contain exactly these two top-level sections, in this order, and nothing else above or below them:

```markdown
## Improved prompt
<the refined version of the prompt, verbatim>

## Result
<the result of executing the refined prompt>
```

No preamble, no closing summary, no extra headings, no meta-commentary about what was changed.
