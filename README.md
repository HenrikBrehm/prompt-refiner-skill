# prompt-refiner-skill

A Claude Code skill that quietly refines your prompt before executing it — clearer, more precise, better structured — without changing what you actually asked for.

## What it does

When invoked, the skill takes your original prompt, produces an improved version (clearer, sharper, better grouped), and then carries it out. Intent, tone, scope, and language are preserved — German stays German, casual stays casual, nothing new is invented.

The reply always has exactly two sections: the improved prompt and the result of running it. The skill does **not** ask clarifying questions unless the task is genuinely impossible without one.

## Installation

### Option 1 — Per project

```bash
git clone https://github.com/HenrikBrehm/prompt-refiner-skill.git /tmp/prompt-refiner-skill
mkdir -p .claude/skills
cp -r /tmp/prompt-refiner-skill/.claude/skills/prompt-refiner .claude/skills/
```

The skill is now available in any Claude Code session opened in this project.

### Option 2 — For all your projects (user-level)

```bash
git clone https://github.com/HenrikBrehm/prompt-refiner-skill.git /tmp/prompt-refiner-skill
mkdir -p ~/.claude/skills
cp -r /tmp/prompt-refiner-skill/.claude/skills/prompt-refiner ~/.claude/skills/
```

The skill is now available in every Claude Code session on your machine.

## Usage

Once installed, invoke the skill in any of these ways:

- Ask Claude directly: *"Use the prompt-refiner skill on this: &lt;your prompt&gt;"*
- Mention it by name: *"refine this prompt and then run it: &lt;your prompt&gt;"*
- Run it as a slash command: `/prompt-refiner &lt;your prompt&gt;` (works if your harness exposes skills as slash commands)

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

Notice: the language stayed German, the casual tone was tightened just enough to remove ambiguity, and no new requirements were invented.

## Behavior guarantees

The skill enforces these rules on every invocation:

- **No scope drift** — won't add features, requirements, or constraints you didn't ask for.
- **Language preserved** — replies in the language of the original prompt.
- **Tone preserved** — casual stays casual, formal stays formal.
- **Length preserved** — the refined prompt stays close to the original length; words are added only when they genuinely reduce ambiguity.
- **No unnecessary questions** — only asks when the task is genuinely impossible without clarification.
- **Fixed output shape** — always exactly `## Improved prompt` followed by `## Result`, in that order, with nothing else around them.

If your prompt is already clear, the "improved" version may be nearly identical to the original — that's the correct behavior, not a bug.

## License

[MIT](LICENSE) © 2026 Henrik Brehm
