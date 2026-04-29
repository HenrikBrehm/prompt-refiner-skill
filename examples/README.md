# Examples

Five real before/after refinements showing what `prompt-refiner` does — and, just as importantly, what it does *not* do. Notice across all of them: language is preserved, scope is preserved, length stays close to the original, and there is no framework scaffolding ("CONTEXT:", "OBJECTIVE:", "STYLE:" etc.).

---

## 1. Casual German blog-post brainstorm

> mach mir ne liste mit ideen für nen blog post über ai

```markdown
## Improved prompt
Erstelle eine Liste mit konkreten Ideen für einen Blog-Post über KI.

## Result
- "10 KI-Tools, die ich im Alltag wirklich benutze"
- "Was ChatGPT immer noch nicht kann — und warum"
- "Wie ich mit Claude Code in einer Woche eine App gebaut habe"
- "Prompt-Engineering für Nicht-Entwickler: ein Mini-Leitfaden"
- "Warum lokale Modelle 2026 endlich gut genug sind"
```

**What changed:** "ne liste" → "eine Liste", "nen blog post über ai" → "einen Blog-Post über KI", added "konkrete" to nudge the result toward specificity. **What did NOT change:** language (still German), tone (still casual-but-cleaner), scope (still a list of blog ideas — no audience, no word count, no framework imposed).

---

## 2. Vague code request, English

> can you fix the function that does the date stuff its broken

```markdown
## Improved prompt
Fix the function that handles dates — it's currently broken. Identify the bug, explain it briefly, and apply the fix.

## Result
[Claude reads the codebase, locates the date-handling function, diagnoses the bug, and applies a fix.]
```

**What changed:** added a comma and apostrophe, named the three actions implied by "fix" (identify, explain, apply). **What did NOT change:** still no specific filename — the user didn't know it, so the refined version doesn't pretend to. The skill makes a reasonable assumption (search the codebase) rather than asking a clarifying question.

---

## 3. Already-good prompt — should pass through almost unchanged

> Refactor `auth/middleware.ts` so the JWT verification is in its own module. Keep the public API of the file the same. Run the tests after.

```markdown
## Improved prompt
Refactor `auth/middleware.ts` so the JWT verification is in its own module. Keep the public API of the file the same. Run the tests after.

## Result
[Claude refactors the file, extracts JWT verification, preserves the public API, and runs the tests.]
```

**What changed:** nothing. The prompt was already clear, specific, and well-structured. Returning it verbatim is the correct refinement.

---

## 4. Anti-bloat: refusing to add a framework

Original (using `--strict` mode):

> write me a tweet about claude code

```markdown
## Improved prompt
Write a tweet about Claude Code.

## Result
"Spent the weekend building a side project with Claude Code. Felt like pair-programming with someone who actually read the spec. 10/10."
```

**What did NOT happen:** the skill did not insert a CO-STAR template ("CONTEXT: …, AUDIENCE: developers on Twitter, TONE: enthusiastic but technical, …"). The user asked for a tweet — they got a tweet.

---

## 5. Review mode — analyze, don't execute

Original (using `--review` mode):

> ok also ich brauch jetzt mal so nen plan oder so wie ich meine app launchen soll, weiß nich genau, halt sowas wie ne checkliste

```markdown
## Improved prompt
Erstelle eine Launch-Checkliste für meine App.

## Result
Drei Änderungen: (1) Füllwörter ("ok also", "jetzt mal", "halt") entfernt, (2) "so nen plan oder so" → "Launch-Checkliste" (das war die eigentliche Absicht), (3) "weiß nich genau" entfernt — eine Checkliste impliziert ohnehin, dass man noch nicht alles weiß. Sprache und Ton bleiben informell-deutsch; Umfang ist unverändert (eine Checkliste für *deinen* App-Launch — keine Annahmen über App-Typ, Zielgruppe oder Plattform).
```

**Note:** in `--review` mode the skill does not execute the refined prompt. The "Result" section explains what was changed and why, so the user can decide whether to run it.
