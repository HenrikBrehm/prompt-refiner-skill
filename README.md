# prompt-refiner-skill

> The anti-bloat prompt refiner for Claude Code. Lightly refines your prompt — clearer, more precise, better structured — then runs it. Without rewriting it into a framework template you didn't ask for.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](CHANGELOG.md)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-skill-d97757)](https://claude.com/claude-code)
[![CI](https://github.com/HenrikBrehm/prompt-refiner-skill/actions/workflows/validate.yml/badge.svg)](https://github.com/HenrikBrehm/prompt-refiner-skill/actions/workflows/validate.yml)

---

## Contents

- [Why this skill exists](#why-this-skill-exists)
- [Install](#install)
- [Usage](#usage) — incl. [intensity modes](#intensity-modes)
- [Example](#example) (more in [`examples/`](examples/))
- [When NOT to use this skill](#when-not-to-use-this-skill)
- [Behavior guarantees](#behavior-guarantees)
- [FAQ](#faq)
- [Use it outside Claude Code](#use-it-outside-claude-code)
- [Contributing](#contributing)
- [License & changelog](#license--changelog)

---

## Why this skill exists

Most "prompt improvers" are maximalists — you give them `"write a tweet"` and they hand back a 30-line CO-STAR template with `CONTEXT:`, `OBJECTIVE:`, `STYLE:`, `TONE:`, `AUDIENCE:`, `RESPONSE FORMAT:`. That's great when you're writing a prompt from scratch. It's the wrong tool for refining a prompt you already wrote.

`prompt-refiner` does the opposite. It takes your prompt, sharpens it just enough — fixes the typos, removes the ambiguity, tightens the structure — and runs it. It will not insert a framework. It will not change your language from German to English. It will not invent an audience or a tone you never specified.

If your prompt is already clear, the "improved" version is nearly identical to the original. That is correct behavior, not a bug.

## Install

### Option 1 — As a Claude Code plugin (recommended)

```bash
/plugin marketplace add HenrikBrehm/prompt-refiner-skill
/plugin install prompt-refiner@prompt-refiner-marketplace
```

### Option 2 — Manual copy (per project)

```bash
git clone https://github.com/HenrikBrehm/prompt-refiner-skill.git /tmp/prompt-refiner-skill
mkdir -p .claude/skills
cp -r /tmp/prompt-refiner-skill/skills/prompt-refiner .claude/skills/
```

### Option 3 — Manual copy (user-level, all projects)

```bash
git clone https://github.com/HenrikBrehm/prompt-refiner-skill.git /tmp/prompt-refiner-skill
mkdir -p ~/.claude/skills
cp -r /tmp/prompt-refiner-skill/skills/prompt-refiner ~/.claude/skills/
```

## Usage

Invoke the skill any of these ways:

- *"Use the prompt-refiner skill on this: &lt;your prompt&gt;"*
- *"Refine this prompt and run it: &lt;your prompt&gt;"*
- `/prompt-refiner &lt;your prompt&gt;` (if your harness exposes skills as slash commands)

### Intensity modes

| Mode | When to use | Word-count budget |
|------|-------------|-------------------|
| `light` (default) | Most prompts. Refines for clarity, precision, structure. | ±30 % of original |
| `strict` | When you trust your prompt and only want typos / true bugs fixed. | ±10 % of original |
| `review` | When you want to *see* the refined version without running it. | n/a |

Append the flag to your invocation, e.g. *"refine this prompt --strict: &lt;your prompt&gt;"*.

## Example

**Original prompt:**

> mach mir ne liste mit ideen für nen blog post über ai

**Skill output:**

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

Notice what *didn't* happen: language wasn't switched to English, no `CONTEXT:` / `AUDIENCE:` / `TONE:` scaffolding, no clarifying questions about word count or target reader.

See [`examples/`](examples/) for four more before/after pairs, including `--strict` and `--review` mode walkthroughs.

## When NOT to use this skill

Use a different tool when:

- **You're writing a brand-new prompt from scratch and want a structured template.** Reach for a framework-based skill instead — for example [`prompt-architect`](https://github.com/ckelsoe/prompt-architect) (27 frameworks: CO-STAR, RISEN, RTF, RACE, …). It's the right shape for "I have an idea, help me prompt it well."
- **You want the AI to interview you** before producing a prompt. That's also a job for framework-based skills with progressive-disclosure dialogue.
- **You want a different output every time.** This skill is deterministic in spirit — same prompt + same intensity → essentially the same refinement.

`prompt-refiner` is for when the prompt is *already there* and you want it sharpened, not reimagined.

## Behavior guarantees

The skill enforces these rules on every invocation:

- **No scope drift** — won't add features, requirements, or constraints you didn't ask for.
- **No framework imposition** — never inserts CO-STAR / RISEN / RTF / RACE-style scaffolding.
- **Language preserved** — replies in the language of the original prompt (DE stays DE, EN stays EN, mixed stays mixed).
- **Tone preserved** — casual stays casual, formal stays formal, terse stays terse.
- **Length budgeted** — `light` ≤ ±30 %, `strict` ≤ ±10 % of original word count.
- **No unnecessary questions** — only asks when the task is genuinely impossible without clarification.
- **Fixed output shape** — always exactly `## Improved prompt` followed by `## Result`, in that order, with nothing else around them.

## FAQ

**Will this skill make my prompt much longer?**
No. By design, light mode stays within ±30 % of your original word count and strict mode within ±10 %. If your prompt was 7 words, the refined version will be roughly 7 words.

**Why no clarifying questions?**
Because most clarifying questions are unnecessary friction — the AI can usually make a reasonable assumption. Reserve questions for the rare case where the task is genuinely impossible without an answer.

**Why no framework (CO-STAR / RISEN / RTF)?**
Because frameworks are for *writing new prompts*, not for *refining ones you already wrote*. Forcing a framework onto an existing prompt smuggles in scope you didn't ask for: an audience, a tone, a response format, a structure. If you want a framework, use a framework-based skill — see [When NOT to use this skill](#when-not-to-use-this-skill).

**My prompt was already clear and the skill barely changed it. Is that a bug?**
No, that's the correct behavior. Returning your prompt verbatim when there's nothing to fix is one of the skill's hard rules.

**Can I use this with Cursor / ChatGPT / Windsurf?**
Yes. See [`adapters/system-prompt.md`](adapters/system-prompt.md) — a portable system prompt that reproduces the skill's behavior in any tool with a custom-instructions field.

**How do I report a misbehavior?**
Open a [bug report](.github/ISSUE_TEMPLATE/bug_report.md) — the template asks for the original prompt, the intensity flag, and which behavior guarantee was violated.

## Use it outside Claude Code

For Cursor, Windsurf, ChatGPT, Gemini, Copilot Chat, and similar tools, paste [`adapters/system-prompt.md`](adapters/system-prompt.md) into the tool's system-prompt / custom-instructions field. The behavior matches the Claude Code skill, modulo features that depend on Claude Code's native skill harness.

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The bar is high: each change should make the skill *more reliable* or *more discoverable* without bloating it. Behavior assertions live in [`tests/spec.md`](tests/spec.md); structural validation is in [`scripts/validate-skill.sh`](scripts/validate-skill.sh) and runs on every push and PR via GitHub Actions.

## License & changelog

- License: [MIT](LICENSE) © 2026 Henrik Brehm
- Release notes: [CHANGELOG.md](CHANGELOG.md)
