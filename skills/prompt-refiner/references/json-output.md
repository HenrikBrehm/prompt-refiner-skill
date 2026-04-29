# JSON output variant

When the user appends `--json` to their request (or asks for "JSON output" / "machine-readable"), the skill emits the report as a single fenced ```json block whose content validates against `schemas/report.schema.json`. No prose before or after the block.

Shape (informally):

```json
{
  "skill": "prompt-refiner-skill",
  "version": "1.4.0",
  "input_chars": 432,
  "findings": [
    {
      "rule_id": "PR001",
      "severity": "warning",
      "line": 3,
      "col": 12,
      "evidence": "handle the feedback",
      "rationale": "Verb 'handle' does not name the transformation.",
      "engine": "deterministic"
    }
  ],
  "summary": {
    "error": 0,
    "warning": 1,
    "info": 0
  }
}
```

Rules:
- `findings` MUST be ordered by `line`, then `col`.
- `evidence` is the literal substring quoted from the user's prompt, unmodified.
- `engine` MUST be either `deterministic` or `model`.
- `rule_id` MUST appear in `references/lint-rules.md`.
- `version` mirrors the skill's own version field in SKILL.md frontmatter.
- The skill MUST NOT include suggested rewrites in JSON mode.
