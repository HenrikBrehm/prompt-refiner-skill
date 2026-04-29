#!/usr/bin/env node
// prompt-refiner deterministic detector — zero deps, Node stdlib only.
//
// Usage:
//   node scripts/lint.js [--format=md|json|text] [--baseline=PATH]
//                        [--write-baseline=PATH] [--fail-on=error|warning|info|none]
//                        [--rules=PR001,PR-INJ01,...] [--quiet] [--version]
//                        [FILE | -]
//
// Reads prompt text from FILE, or stdin if FILE is "-" or omitted.
// Emits findings for the rules this engine can detect deterministically:
//   PR001, PR004, PR006, PR007, PR008, PR-INJ01, PR-INJ02, PR-INJ03.
// Other rules (PR002, PR003, PR005, PR009, PR010) are intentionally NOT
// detected here — see skills/prompt-refiner/SKILL.md for the LLM pass that
// covers them. The skill emits a hybrid report (deterministic + LLM-tagged).
//
// Exit codes:
//   0 — no findings, or only findings below --fail-on threshold
//   1 — findings reached --fail-on threshold
//   2 — usage error / unreadable input
//
// Stability contract:
//   - line:col is 1-based, points at evidence start in the input text
//     (BEFORE suppression / baseline filtering).
//   - evidence is the literal substring from the input, never paraphrased.
//   - findings are ordered by (line, col, rule_id).
//   - rule_id matches /^PR(-INJ)?[0-9]{2,3}$/.

'use strict';

const fs = require('fs');

const VERSION = '1.3.0';
const SKILL_NAME = 'prompt-refiner-skill';

const SEVERITY_RANK = { error: 3, warning: 2, info: 1, none: 0 };

// ---- CLI ---------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    format: 'md',
    baseline: null,
    writeBaseline: null,
    failOn: 'error',
    rules: null,
    quiet: false,
    file: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version') { console.log(VERSION); process.exit(0); }
    if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    if (a === '--quiet') { opts.quiet = true; continue; }
    if (a.startsWith('--format=')) { opts.format = a.slice(9); continue; }
    if (a.startsWith('--baseline=')) { opts.baseline = a.slice(11); continue; }
    if (a.startsWith('--write-baseline=')) { opts.writeBaseline = a.slice(17); continue; }
    if (a.startsWith('--fail-on=')) { opts.failOn = a.slice(10); continue; }
    if (a.startsWith('--rules=')) {
      opts.rules = new Set(a.slice(8).split(',').map(s => s.trim()).filter(Boolean));
      continue;
    }
    if (a === '-' || !a.startsWith('--')) { opts.file = a; continue; }
    fail(`unknown flag: ${a}`, 2);
  }
  if (!['md', 'json', 'text'].includes(opts.format)) fail(`bad --format: ${opts.format}`, 2);
  if (!['error', 'warning', 'info', 'none'].includes(opts.failOn)) fail(`bad --fail-on: ${opts.failOn}`, 2);
  return opts;
}

function printHelp() {
  process.stdout.write(`prompt-refiner lint v${VERSION}

Usage: lint.js [options] [FILE|-]

Options:
  --format=md|json|text   Output format (default: md)
  --baseline=PATH         Suppress findings present in baseline JSON file
  --write-baseline=PATH   Write current findings to PATH and exit 0
  --fail-on=LEVEL         Exit 1 if any finding >= LEVEL fires
                          LEVEL: error (default), warning, info, none
  --rules=ID,ID,...       Restrict to a comma-separated list of rule IDs
  --quiet                 Suppress 'No issues found.' on clean runs
  --version               Print version and exit
  -h, --help              Print this help

Detected deterministically: PR001, PR004, PR006, PR007, PR008,
PR-INJ01, PR-INJ02, PR-INJ03.

Other rules (PR002, PR003, PR005, PR009, PR010) require LLM analysis;
the SKILL.md procedure layers those on top of this engine's output.
`);
}

function fail(msg, code) {
  process.stderr.write(`lint.js: ${msg}\n`);
  process.exit(code);
}

// ---- input I/O ---------------------------------------------------------

function readInput(file) {
  if (!file || file === '-') {
    try { return fs.readFileSync(0, 'utf8'); }
    catch (e) { fail(`cannot read stdin: ${e.message}`, 2); }
  }
  try { return fs.readFileSync(file, 'utf8'); }
  catch (e) { fail(`cannot read ${file}: ${e.message}`, 2); }
}

// ---- offset → (line, col) helper --------------------------------------

function lineColFor(text, offset) {
  let line = 1, col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) { line++; col = 1; } else { col++; }
  }
  return { line, col };
}

// ---- suppression: <!-- prompt-refiner-disable RULE,RULE --> -----------
//
// Three forms:
//   File-level:    <!-- prompt-refiner-disable PR001 -->          (anywhere; whole file)
//   Next-line:     <!-- prompt-refiner-disable-next-line PR001 -->  (applies to following line)
//   Same-line:     <!-- prompt-refiner-disable-line PR001 -->     (applies to its own line)

function parseSuppressions(text) {
  const fileLevel = new Set();
  const lineLevel = new Map(); // 1-based line number -> Set<rule_id>
  const lines = text.split('\n');

  const RX_LINE = /<!--\s*prompt-refiner-disable-line\s+([A-Za-z0-9,\s\-]+?)\s*-->/g;
  const RX_NEXT = /<!--\s*prompt-refiner-disable-next-line\s+([A-Za-z0-9,\s\-]+?)\s*-->/g;
  const RX_FILE = /<!--\s*prompt-refiner-disable\s+([A-Za-z0-9,\s\-]+?)\s*-->/g;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i];
    let m;

    RX_LINE.lastIndex = 0;
    while ((m = RX_LINE.exec(line))) {
      const set = lineLevel.get(lineNo) || new Set();
      splitRules(m[1]).forEach(r => set.add(r));
      lineLevel.set(lineNo, set);
    }

    RX_NEXT.lastIndex = 0;
    while ((m = RX_NEXT.exec(line))) {
      const target = lineNo + 1;
      const set = lineLevel.get(target) || new Set();
      splitRules(m[1]).forEach(r => set.add(r));
      lineLevel.set(target, set);
    }

    RX_FILE.lastIndex = 0;
    while ((m = RX_FILE.exec(line))) {
      const inner = m[1];
      // skip line/next-line variants — they were handled above
      if (/^(line|next-line)\b/i.test(inner)) continue;
      splitRules(inner).forEach(r => fileLevel.add(r));
    }
  }
  return { fileLevel, lineLevel };
}

function splitRules(raw) {
  return raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
}

function isSuppressed(suppressions, ruleId, line) {
  if (suppressions.fileLevel.has(ruleId)) return true;
  const lineSet = suppressions.lineLevel.get(line);
  return !!(lineSet && lineSet.has(ruleId));
}

// ---- baseline ---------------------------------------------------------

function loadBaseline(p) {
  if (!p) return null;
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); }
  catch (e) { fail(`cannot read baseline ${p}: ${e.message}`, 2); }
  let obj;
  try { obj = JSON.parse(raw); }
  catch (e) { fail(`baseline ${p} is not valid JSON: ${e.message}`, 2); }
  const set = new Set();
  for (const f of (obj.findings || [])) {
    set.add(`${f.rule_id} ${f.evidence}`);
  }
  return set;
}

function inBaseline(baseline, finding) {
  if (!baseline) return false;
  return baseline.has(`${finding.rule_id} ${finding.evidence}`);
}

// ---- detectors --------------------------------------------------------

const RATIONALES = {
  PR001: "Vague action verb — name the transformation (extract, summarize, classify, ...).",
  PR004: "Scale conflict — these constraints contradict on length/structure/depth.",
  PR006: "Unbounded quantifier — supply a numeric bound or accept model's choice.",
  PR007: "Structural format requested without schema, types, or example.",
  PR008: "Placeholder token left in prompt — substitute the real value before sending.",
  'PR-INJ01': "Prompt-injection pattern detected — wrap untrusted content in delimiters and treat as data.",
  'PR-INJ02': "Role switch after user-supplied input — reorder so role is fixed before user content.",
  'PR-INJ03': "Unbounded tool/output authority — add an explicit allowlist or denial fallback.",
};

// PR001: vague action verb at start of an imperative.
const PR001_PATTERNS = [
  // English. Note: "do" is intentionally excluded — it is too overloaded
  // ("do not", "do you", "do whatever") and produces too many false positives.
  // The unambiguous vague verbs above are sufficient signal.
  { rx: /(?:^|[\.\?!\n]\s*)(handle|process|manage|deal\s+with|take\s+care\s+of|work\s+on|look\s+at|figure\s+out)\b/gi, lang: 'en' },
  // German
  { rx: /(?:^|[\.\?!\n]\s*)(kümmer(?:e)?\s+dich\s+um|behandle|bearbeite|erledige|mach\s+(?:was|etwas)\s+mit)\b/gi, lang: 'de' },
  // Spanish
  { rx: /(?:^|[\.\?!\n]\s*)(encárgate\s+de|ocúpate\s+de|maneja|gestiona|lidia\s+con)\b/gi, lang: 'es' },
  // Japanese — verbs in command form, no leading punctuation needed
  { rx: /(処理して|対応して|対処して|なんとかして)/g, lang: 'ja' },
];

function detectPR001(text, findings) {
  for (const { rx } of PR001_PATTERNS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text))) {
      const verbStart = m.index + m[0].length - m[1].length;
      const { line, col } = lineColFor(text, verbStart);
      findings.push({
        rule_id: 'PR001',
        severity: 'warning',
        line, col,
        evidence: m[1],
        rationale: RATIONALES.PR001,
      });
    }
  }
}

// PR004: scale conflict — co-occurrence of length-max and length-min/expansion markers.
const PR004_MAX = /\b(under\s+\d+\s+words?|in\s+\d+\s+words?\s+or\s+(?:fewer|less)|at\s+most\s+\d+\s+words?|no\s+more\s+than\s+\d+\s+words?|brief|concise|short|tweet[- ]?length|one[- ]?liner)\b/gi;
const PR004_MIN = /\b(comprehensive|thorough|exhaustive|in\s+(?:full\s+)?detail|at\s+least\s+\d+\s+(?:words?|paragraphs?)|long[- ]form|deep\s+dive)\b/gi;

function detectPR004(text, findings) {
  const maxes = collectMatches(text, PR004_MAX);
  const mins = collectMatches(text, PR004_MIN);
  if (!maxes.length || !mins.length) return;
  const seen = new Set();
  for (const arr of [maxes, mins]) {
    for (const m of arr) {
      const key = `${m.index}:${m.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const { line, col } = lineColFor(text, m.index);
      findings.push({
        rule_id: 'PR004',
        severity: 'error',
        line, col,
        evidence: m.text,
        rationale: RATIONALES.PR004,
      });
    }
  }
}

// PR006: unbounded quantifier near an enumerable noun, no digit between.
const PR006_QUANT = /\b(some|several|a\s+few|many|comprehensive|thorough|detailed|exhaustive)\b/gi;
const PR006_ENUM = /\b(lists?|examples?|paragraphs?|words?|items?|points?|reasons?|ideas?|bullet\s+points?|sentences?|steps?)\b/i;

function detectPR006(text, findings) {
  PR006_QUANT.lastIndex = 0;
  let m;
  while ((m = PR006_QUANT.exec(text))) {
    const start = m.index;
    const end = m.index + m[0].length;
    const slice = text.slice(end, end + 60);
    const enumMatch = slice.match(PR006_ENUM);
    if (!enumMatch) continue;
    const between = slice.slice(0, enumMatch.index);
    if (/\d/.test(between)) continue;
    const { line, col } = lineColFor(text, start);
    findings.push({
      rule_id: 'PR006',
      severity: 'warning',
      line, col,
      evidence: m[1],
      rationale: RATIONALES.PR006,
    });
  }
}

// PR007: structural format requested without schema/types/example markers nearby.
const PR007_NOUN = /\b(JSON|CSV|TSV|YAML|XML|table|markdown\s+table|bullet\s+list|numbered\s+list|diff)\b/gi;
const PR007_SCHEMA = /(\bschema\b|\bfields?:|\bcolumns?:|\bkeys?:|\btypes?:|\be\.?g\.|\bsuch\s+as\b|\blike\s*:|\{[^{}]{1,200}\}|```|^\s*[\-\*•]\s|^\s*\d+\.)/im;

function detectPR007(text, findings) {
  PR007_NOUN.lastIndex = 0;
  let m;
  const seenLines = new Set();
  while ((m = PR007_NOUN.exec(text))) {
    const start = m.index;
    const wStart = Math.max(0, start - 40);
    const wEnd = Math.min(text.length, start + m[0].length + 240);
    const window = text.slice(wStart, wEnd);
    if (PR007_SCHEMA.test(window)) continue;
    const { line, col } = lineColFor(text, start);
    if (seenLines.has(line)) continue;
    seenLines.add(line);
    findings.push({
      rule_id: 'PR007',
      severity: 'warning',
      line, col,
      evidence: m[1],
      rationale: RATIONALES.PR007,
    });
  }
}

// PR008: placeholders.
const PR008_PATTERNS = [
  /\{\{[^}\n]{1,80}\}\}/g,
  /<[A-Z][A-Z0-9_]{1,40}>/g,
  /\[INSERT[^\]\n]{0,60}\]/gi,
  /\bTODO\b/g,
  /\bFIXME\b/g,
  /lorem\s+ipsum/gi,
];

function detectPR008(text, findings) {
  for (const rx of PR008_PATTERNS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text))) {
      const { line, col } = lineColFor(text, m.index);
      findings.push({
        rule_id: 'PR008',
        severity: 'error',
        line, col,
        evidence: m[0],
        rationale: RATIONALES.PR008,
      });
    }
  }
}

// PR-INJ01: embedded "ignore previous" / "disregard above" / "you are now" / "system prompt:".
const PR_INJ01_PATTERNS = [
  /\bignore\s+(?:all\s+|the\s+|your\s+|any\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules?|messages?|directives?)/gi,
  /\bdisregard\s+(?:the\s+|all\s+)?(?:above|previous|prior)/gi,
  /\byou\s+are\s+now\s+(?:a\s+|an\s+)?[a-z]/gi,
  /\bsystem\s+prompt\s*:/gi,
  /\b(?:reveal|show|print|output)\s+(?:your|the)\s+(?:system\s+)?prompt\b/gi,
];

function detectPRInj01(text, findings) {
  for (const rx of PR_INJ01_PATTERNS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text))) {
      const { line, col } = lineColFor(text, m.index);
      findings.push({
        rule_id: 'PR-INJ01',
        severity: 'error',
        line, col,
        evidence: m[0].trim(),
        rationale: RATIONALES['PR-INJ01'],
      });
    }
  }
}

// PR-INJ02: role-switching imperative AFTER a user-content interpolation.
const PR_INJ02_INTERP = /(\$\{[^}\n]{1,40}\}|\{\{\s*user[_\s]?(?:input|message|content|text)\s*\}\}|<user[_\s]?(?:input|message|content|text)>)/gi;
const PR_INJ02_ROLE = /\b(you\s+are\s+(?:now\s+)?(?:a\s+|an\s+)?[a-z]|act\s+as\s+(?:a\s+|an\s+)?[a-z]|from\s+now\s+on\s+you\s+are|you\s+must\s+now|new\s+instructions?:)/gi;

function detectPRInj02(text, findings) {
  PR_INJ02_INTERP.lastIndex = 0;
  let m;
  while ((m = PR_INJ02_INTERP.exec(text))) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 200);
    PR_INJ02_ROLE.lastIndex = 0;
    const r = PR_INJ02_ROLE.exec(after);
    if (!r) continue;
    const evIdx = m.index + m[0].length + r.index;
    const { line, col } = lineColFor(text, evIdx);
    findings.push({
      rule_id: 'PR-INJ02',
      severity: 'warning',
      line, col,
      evidence: r[0].trim(),
      rationale: RATIONALES['PR-INJ02'],
    });
  }
}

// PR-INJ03: blanket-authority grant without scoping clause in same paragraph.
const PR_INJ03_GRANT = /\b(do\s+whatever\s+(?:is\s+)?(?:needed|necessary|required)|take\s+any\s+actions?|you\s+may\s+run\s+any\s+command|unrestricted\s+access|no\s+(?:limits?|restrictions?|constraints?)|free\s+rein|carte\s+blanche)\b/gi;
const PR_INJ03_SCOPE = /\b(only|except|allowed|allowlist|restricted\s+to|limited\s+to|must\s+not|do\s+not\s+(?:run|execute|access|call)|unless|if\s+and\s+only\s+if)\b/i;

function detectPRInj03(text, findings) {
  PR_INJ03_GRANT.lastIndex = 0;
  let m;
  while ((m = PR_INJ03_GRANT.exec(text))) {
    const start = m.index;
    const before = text.lastIndexOf('\n\n', start);
    const after = text.indexOf('\n\n', start);
    const paraStart = before === -1 ? 0 : before + 2;
    const paraEnd = after === -1 ? text.length : after;
    const para = text.slice(paraStart, paraEnd);
    if (PR_INJ03_SCOPE.test(para)) continue;
    const { line, col } = lineColFor(text, start);
    findings.push({
      rule_id: 'PR-INJ03',
      severity: 'warning',
      line, col,
      evidence: m[0].trim(),
      rationale: RATIONALES['PR-INJ03'],
    });
  }
}

// ---- helpers ----------------------------------------------------------

function collectMatches(text, rx) {
  const out = [];
  rx.lastIndex = 0;
  let m;
  while ((m = rx.exec(text))) {
    out.push({ index: m.index, text: m[0] });
  }
  return out;
}

// ---- main pipeline ----------------------------------------------------

const DETECTORS = [
  ['PR001', detectPR001],
  ['PR004', detectPR004],
  ['PR006', detectPR006],
  ['PR007', detectPR007],
  ['PR008', detectPR008],
  ['PR-INJ01', detectPRInj01],
  ['PR-INJ02', detectPRInj02],
  ['PR-INJ03', detectPRInj03],
];

function lint(text, opts) {
  const suppressions = parseSuppressions(text);
  const baseline = loadBaseline(opts.baseline);
  const filterRules = opts.rules;

  const raw = [];
  for (const [rid, fn] of DETECTORS) {
    if (filterRules && !filterRules.has(rid)) continue;
    fn(text, raw);
  }

  const kept = raw
    .filter(f => !isSuppressed(suppressions, f.rule_id, f.line))
    .filter(f => !inBaseline(baseline, f))
    .map(f => ({ ...f, engine: 'deterministic' }));

  kept.sort((a, b) =>
    (a.line - b.line) || (a.col - b.col) || a.rule_id.localeCompare(b.rule_id)
  );

  return kept;
}

function summarize(findings) {
  const s = { error: 0, warning: 0, info: 0 };
  for (const f of findings) s[f.severity]++;
  return s;
}

// ---- formatters -------------------------------------------------------

function formatJson(findings, inputLen) {
  return JSON.stringify({
    skill: SKILL_NAME,
    version: VERSION,
    input_chars: inputLen,
    findings,
    summary: summarize(findings),
  }, null, 2);
}

function formatMd(findings, inputLen, opts) {
  if (findings.length === 0) {
    if (opts.quiet) return '';
    return '# Prompt-refiner report\n\nNo issues found.\n';
  }
  const lines = ['# Prompt-refiner report', ''];
  for (const f of findings) {
    lines.push(`\`${f.rule_id}\` [${f.severity}] ${f.line}:${f.col} — \`${f.evidence}\` — ${f.rationale}`);
  }
  const s = summarize(findings);
  lines.push('');
  lines.push(`**summary:** ${s.error} error${s.error === 1 ? '' : 's'}, ${s.warning} warning${s.warning === 1 ? '' : 's'}, ${s.info} info`);
  return lines.join('\n') + '\n';
}

function formatText(findings) {
  return findings.map(f =>
    `${f.line}:${f.col}\t${f.rule_id}\t${f.severity}\t${f.evidence.replace(/\t/g, ' ').replace(/\n/g, '\\n')}\t${f.rationale}`
  ).join('\n') + (findings.length ? '\n' : '');
}

// ---- entry point ------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const text = readInput(opts.file);
  const findings = lint(text, opts);

  if (opts.writeBaseline) {
    const out = JSON.stringify({
      skill: SKILL_NAME,
      version: VERSION,
      generated: new Date().toISOString(),
      findings,
    }, null, 2);
    fs.writeFileSync(opts.writeBaseline, out + '\n');
    process.exit(0);
  }

  let output;
  if (opts.format === 'json') output = formatJson(findings, text.length);
  else if (opts.format === 'text') output = formatText(findings);
  else output = formatMd(findings, text.length, opts);

  if (output) process.stdout.write(output);

  const threshold = SEVERITY_RANK[opts.failOn];
  if (threshold === 0) process.exit(0);
  const summary = summarize(findings);
  for (const sev of ['error', 'warning', 'info']) {
    if (SEVERITY_RANK[sev] >= threshold && summary[sev] > 0) process.exit(1);
  }
  process.exit(0);
}

main();
