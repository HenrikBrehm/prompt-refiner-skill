---
name: Bug report
about: The skill violated one of its behavior guarantees, or otherwise misbehaved.
title: "[bug] "
labels: bug
---

## What happened

<!-- One-sentence summary of the misbehavior. -->

## Reproduction

**Original prompt:**

```
<paste verbatim>
```

**Intensity flag (if any):** `light` | `strict` | `review`

**Skill output:**

```markdown
## Improved prompt
<paste verbatim>

## Result
<paste verbatim>
```

## Expected

<!-- Which behavior guarantee was violated, or what should the output have been? -->

- [ ] No scope drift
- [ ] No framework imposition
- [ ] Language preserved
- [ ] Tone preserved
- [ ] Length within budget (light ±30 %, strict ±10 %)
- [ ] No unnecessary clarifying question
- [ ] Fixed two-section output shape
- [ ] Other: ___

## Environment

- Claude Code version: <!-- e.g. 1.2.3 -->
- Install method: <!-- /plugin install | manual copy | other -->
- Skill version: <!-- from plugin.json or SKILL.md frontmatter -->
- OS: <!-- macOS / Linux / Windows -->
