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
//   PR001, PR002 (hybrid), PR004, PR005 (hybrid), PR006, PR007, PR008,
//   PR010 (hybrid), PR011, PR012, PR013, PR014, PR015, PR016, PR017,
//   PR-INJ01, PR-INJ02, PR-INJ03.
// "Hybrid" rules catch the obvious cases here; the model layer in
// skills/prompt-refiner/SKILL.md adds semantic coverage on top.
// Pure model-only rules (PR003, PR009) are intentionally NOT detected
// here — antecedent resolution and persona/domain comparison have too
// much false-positive risk for a regex pass.
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

const VERSION = '1.5.0';
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

Detected deterministically:
  PR001, PR002*, PR004, PR005*, PR006, PR007, PR008, PR010*,
  PR011, PR012, PR013, PR014, PR015, PR016, PR017,
  PR-INJ01, PR-INJ02, PR-INJ03.
  (* hybrid — basic case here, semantic case in the model pass.)

Pure model-only rules: PR003 (pronoun antecedent), PR009 (conflicting
persona). The SKILL.md procedure layers those on top of this engine.
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
  PR002: "Two distinct intents in one instruction — split into separately scoped steps.",
  PR004: "Scale conflict — these constraints contradict on length/structure/depth.",
  PR005: "Contradictory constraints — the prompt requires X and forbids X simultaneously.",
  PR006: "Unbounded quantifier — supply a numeric bound or accept model's choice.",
  PR007: "Structural format requested without schema, types, or example.",
  PR008: "Placeholder token left in prompt — substitute the real value before sending.",
  PR010: "Untestable success criterion — attach an operational definition (rubric, example, automated check).",
  PR011: "Stale or unanchored relative date — pin to an absolute date so the model doesn't guess.",
  PR012: "Politeness padding — words like 'please', 'kindly' add tokens without changing model behavior.",
  PR013: "Untrusted content introduced without a delimiter — wrap in ```, --- or <tag> so input boundaries are explicit.",
  PR014: "Reasoning-then-answer requested without a parsable output delimiter — specify a tag or format for the final answer.",
  PR015: "Rating/confidence requested without a scale — supply a numeric range or anchor (e.g. 0-1, 1-10, percent).",
  PR016: "Open-ended creative output requested without a length bound — specify words/paragraphs or accept the model's default (~150-300 words).",
  PR017: "Negation-heavy prompt with no positive direction — tell the model what to do, not just what to avoid.",
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

// ---- PR002 (hybrid): mixed intent — basic case ------------------------
//
// Catches a single sentence with two DIFFERENT imperative verbs from a
// known action-verb vocabulary, joined by `and`/`then`/`,`. The model
// pass adds the semantic cases this regex misses.

const PR002_VERB_LIST = '(?:write|writes|writing|summari[sz]e|summari[sz]es|summari[sz]ing|classify|classifies|classifying|translate|translates|translating|extract|extracts|extracting|generate|generates|generating|list|lists|listing|explain|explains|explaining|describe|describes|describing|compare|compares|comparing|analy[sz]e|analy[sz]es|analy[sz]ing|rate|rates|rating|score|scores|scoring|review|reviews|reviewing|create|creates|creating|compose|composes|composing|draft|drafts|drafting|email|emails|emailing|send|sends|sending|post|posts|posting|tweet|tweets|tweeting|publish|publishes|publishing|render|renders|rendering|format|formats|formatting|convert|converts|converting|return|returns|returning|output|outputs|outputting|tag|tags|tagging|categori[sz]e|categori[sz]es|categori[sz]ing|cluster|clusters|clustering|annotate|annotates|annotating)';
const PR002_SENTENCE = new RegExp(
  `\\b(${PR002_VERB_LIST})\\b[^.!?\\n]{1,160}\\b(?:and|then|,\\s*then)\\b[^.!?\\n]{1,120}?\\b(${PR002_VERB_LIST})\\b`,
  'gi'
);

function verbStem(v) {
  return v.toLowerCase()
    .replace(/(ies|es|ing|s)$/, '')
    .replace(/y$/, 'i')
    .replace(/se$/, 'z');
}

function detectPR002(text, findings) {
  PR002_SENTENCE.lastIndex = 0;
  let m;
  const seenLines = new Set();
  while ((m = PR002_SENTENCE.exec(text))) {
    if (verbStem(m[1]) === verbStem(m[2])) continue;
    const { line, col } = lineColFor(text, m.index);
    if (seenLines.has(line)) continue;
    seenLines.add(line);
    findings.push({
      rule_id: 'PR002',
      severity: 'error',
      line, col,
      evidence: `${m[1]} ... ${m[2]}`,
      rationale: RATIONALES.PR002,
    });
  }
}

// ---- PR005 (hybrid): contradictory constraints — basic case -----------
//
// Catches well-known contradictions inside one paragraph. Each entry is
// {require, forbid, label}: the require pattern matches a stated demand,
// the forbid pattern matches an explicit prohibition that contradicts it.

const PR005_PAIRS = [
  {
    require: /\bJSON\b/i,
    forbid: /\b(?:no|not|don'?t|do\s+not|without|avoid)\s+(?:any\s+|using\s+|use\s+(?:any\s+)?)?(?:curly\s+)?(?:braces?|brackets?|\{)/i,
    label: 'JSON / no braces',
  },
  {
    require: /\bJSON\b/i,
    forbid: /\b(?:plain|raw)\s+text\s+only\b/i,
    label: 'JSON / plain text only',
  },
  {
    require: /\b(?:formal|professional)\s+tone\b/i,
    forbid: /\b(?:casual|informal|chatty|playful)\s+tone\b/i,
    label: 'formal / casual tone',
  },
  {
    require: /\bbullet\s+points?\b/i,
    forbid: /\b(?:prose|paragraphs?)\s+only\b/i,
    label: 'bullets / prose-only',
  },
  {
    require: /\bmarkdown\b/i,
    forbid: /\bplain\s+text\s+only\b/i,
    label: 'markdown / plain text only',
  },
  {
    require: /\bcode\s+only\b/i,
    forbid: /\b(?:explain|with\s+commentary|narrate)\b/i,
    label: 'code-only / explain',
  },
  {
    require: /\b(?:in\s+English|English\s+only)\b/i,
    forbid: /\bin\s+(?:German|Deutsch|Spanish|French|Italian|Portuguese|Japanese|Chinese|Korean|Russian|Dutch)\b/i,
    label: 'English / other language',
  },
];

function detectPR005(text, findings) {
  // Split into paragraphs separated by blank lines; check pairs per paragraph.
  const paragraphs = [];
  let offset = 0;
  for (const part of text.split(/\n\s*\n/)) {
    paragraphs.push({ start: offset, text: part });
    offset += part.length + 2; // approximate; we only need start within ±2 chars
  }
  const seen = new Set();
  for (const para of paragraphs) {
    for (const pair of PR005_PAIRS) {
      const reqMatch = para.text.match(pair.require);
      const forbMatch = para.text.match(pair.forbid);
      if (!reqMatch || !forbMatch) continue;
      // Anchor evidence at the forbid match (it's the contradicting clause).
      const localIdx = para.text.indexOf(forbMatch[0]);
      const absIdx = para.start + (localIdx >= 0 ? localIdx : 0);
      const key = `${absIdx}:${pair.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const { line, col } = lineColFor(text, absIdx);
      findings.push({
        rule_id: 'PR005',
        severity: 'error',
        line, col,
        evidence: forbMatch[0],
        rationale: `${RATIONALES.PR005} (${pair.label})`,
      });
    }
  }
}

// ---- PR010 (hybrid): untestable success criterion — basic case --------
//
// Vague-quality words used as a success criterion in instructional context.

const PR010_VAGUE = /\b(?:write|make|create|generate|produce|use|ensure|deliver|craft|build)\b[\w\s,]{0,40}\b(good|great|nice|high[- ]quality|professional|engaging|compelling|polished|memorable|impactful|effective|excellent|amazing|outstanding|world[- ]class|top[- ]notch)\b[\w\s]{0,20}\b(?:response|output|result|answer|content|article|essay|email|tweet|copy|message|description|summary|paragraph|section|piece|text|writing|prose|report|post|caption|headline)\b/gi;

function detectPR010(text, findings) {
  PR010_VAGUE.lastIndex = 0;
  let m;
  const seenLines = new Set();
  while ((m = PR010_VAGUE.exec(text))) {
    const adjStart = m.index + m[0].toLowerCase().indexOf(m[1].toLowerCase());
    const { line, col } = lineColFor(text, adjStart);
    if (seenLines.has(line)) continue;
    seenLines.add(line);
    findings.push({
      rule_id: 'PR010',
      severity: 'info',
      line, col,
      evidence: m[1],
      rationale: RATIONALES.PR010,
    });
  }
}

// ---- PR011: stale relative date reference -----------------------------

const PR011_RELATIVE = /\b(yesterday|today|tomorrow|tonight|this\s+(?:morning|afternoon|evening|week|month|year|quarter)|last\s+(?:week|month|year|quarter|night)|next\s+(?:week|month|year|quarter)|currently|recently|lately|the\s+other\s+day|a\s+(?:few\s+)?(?:days?|weeks?|months?)\s+ago|in\s+the\s+past\s+(?:few\s+)?(?:days?|weeks?|months?)|the\s+most\s+recent|latest|up[- ]to[- ]date)\b/gi;
const PR011_ABSOLUTE = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)|(?:Q[1-4])\s+\d{4})\b/i;

function detectPR011(text, findings) {
  if (PR011_ABSOLUTE.test(text)) return;
  PR011_RELATIVE.lastIndex = 0;
  let m;
  const seenLines = new Set();
  while ((m = PR011_RELATIVE.exec(text))) {
    const { line, col } = lineColFor(text, m.index);
    if (seenLines.has(line)) continue;
    seenLines.add(line);
    findings.push({
      rule_id: 'PR011',
      severity: 'warning',
      line, col,
      evidence: m[1],
      rationale: RATIONALES.PR011,
    });
  }
}

// ---- PR012: politeness padding ---------------------------------------

const PR012_PADS = /\b(please|kindly|if\s+you\s+(?:could|would|wouldn'?t\s+mind)|would\s+you\s+(?:please\s+)?mind|i'?d\s+(?:really\s+)?(?:appreciate|love|like)|could\s+you\s+please|would\s+you\s+please|i\s+would\s+(?:really\s+)?(?:appreciate|like|love)|thanks\s+in\s+advance|thank\s+you\s+(?:so\s+much|in\s+advance)|sorry\s+to\s+bother|hope\s+this\s+is\s+okay|when\s+you\s+(?:get\s+a\s+chance|have\s+time)|bitte|danke|por\s+favor|gracias)\b/gi;

function detectPR012(text, findings) {
  PR012_PADS.lastIndex = 0;
  let m;
  while ((m = PR012_PADS.exec(text))) {
    const { line, col } = lineColFor(text, m.index);
    findings.push({
      rule_id: 'PR012',
      severity: 'info',
      line, col,
      evidence: m[1],
      rationale: RATIONALES.PR012,
    });
  }
}

// ---- PR013: missing input delimiter ----------------------------------
//
// Phrase like "the following text:" / "process this content:" / etc.,
// followed (within ~3 lines) by content that is NOT wrapped in a
// recognizable delimiter (```, ---, """, ''', <tag>, [TAG]).

const PR013_INTRO = /\b(?:the\s+following\s+(?:text|content|data|input|message|paragraph|prompt)|here\s+is\s+the\s+(?:text|content|data|input|message|paragraph)|below\s+is\s+the\s+(?:text|content|data|input|message)|process\s+this\s+(?:text|content|data|message)|use\s+this\s+(?:text|content|data|input)|given\s+the\s+(?:text|content|data|input)|user[- ]?provided\s+(?:text|content|input))\b[^:\n]{0,40}:\s*(?:\n|$)/gim;
const PR013_DELIM = /(?:^|\n)\s*(?:```|---|"""|'''|<[a-z][a-z0-9_-]*>|\[[A-Z][A-Z0-9_-]+\])/;

function detectPR013(text, findings) {
  PR013_INTRO.lastIndex = 0;
  let m;
  while ((m = PR013_INTRO.exec(text))) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 400);
    if (PR013_DELIM.test(after)) continue;
    if (!after.trim()) continue; // nothing follows — not our concern
    const { line, col } = lineColFor(text, m.index);
    findings.push({
      rule_id: 'PR013',
      severity: 'warning',
      line, col,
      evidence: m[0].replace(/\s+$/, ''),
      rationale: RATIONALES.PR013,
    });
  }
}

// ---- PR014: reasoning-then-answer without output delimiter -----------

const PR014_REASONING = /\b(?:explain\s+your\s+reasoning|show\s+your\s+work|think\s+step[- ]by[- ]step|let'?s\s+think\s+step[- ]by[- ]step|reason\s+through|chain[- ]of[- ]thought|first\s+(?:reason|think)|walk\s+through\s+your\s+thinking)\b[^.\n]{0,200}\b(?:then|and\s+then|after\s+that|finally|next)\b[^.\n]{0,120}\b(?:(?:give|provide|return|output|state)(?:\s+the)?\s+(?:final\s+)?answer|the\s+(?:final\s+)?answer|(?:your|the)\s+(?:final\s+)?(?:response|conclusion|result|verdict))\b/gi;
const PR014_DELIM_HINT = /\b(?:format|json|xml|<answer>|<final>|```|begin\s+with|end\s+with|wrap(?:ped)?\s+in|delimit|inside\s+(?:a\s+)?tag|after\s+["`])/i;

function detectPR014(text, findings) {
  PR014_REASONING.lastIndex = 0;
  let m;
  const seenLines = new Set();
  while ((m = PR014_REASONING.exec(text))) {
    const window = text.slice(Math.max(0, m.index - 200), m.index + m[0].length + 200);
    if (PR014_DELIM_HINT.test(window)) continue;
    const { line, col } = lineColFor(text, m.index);
    if (seenLines.has(line)) continue;
    seenLines.add(line);
    findings.push({
      rule_id: 'PR014',
      severity: 'info',
      line, col,
      evidence: m[0].slice(0, 80),
      rationale: RATIONALES.PR014,
    });
  }
}

// ---- PR015: unscaled rating / confidence request ---------------------

const PR015_RATE = /\b(?:rate|score|grade|estimate|assess|judge)\s+(?:the\s+|its\s+|your\s+)?(?:confidence|probability|likelihood|certainty|quality|accuracy|relevance|severity|importance|priority)|\bhow\s+confident\s+are\s+you\b|\bgive\s+(?:a|your)\s+(?:confidence|probability|likelihood|certainty)\b|\b(?:assign|return|output)\s+a\s+(?:confidence|probability|likelihood|score|rating)\b/gi;
const PR015_SCALE = /\b(?:0\s*[-–—]\s*1|0\s*to\s*1|1\s*[-–—]\s*(?:5|10|100)|1\s*to\s*(?:5|10|100)|out\s+of\s+(?:5|10|100)|percent|%|(?:low|medium|high)(?:\/|\s*,\s*)|likert|stars?|stanine|float\s+between|number\s+between|range)\b/i;

function detectPR015(text, findings) {
  PR015_RATE.lastIndex = 0;
  let m;
  const seenLines = new Set();
  while ((m = PR015_RATE.exec(text))) {
    const window = text.slice(Math.max(0, m.index - 100), m.index + m[0].length + 200);
    if (PR015_SCALE.test(window)) continue;
    const { line, col } = lineColFor(text, m.index);
    if (seenLines.has(line)) continue;
    seenLines.add(line);
    findings.push({
      rule_id: 'PR015',
      severity: 'info',
      line, col,
      evidence: m[0].slice(0, 60),
      rationale: RATIONALES.PR015,
    });
  }
}

// ---- PR016: open-ended creative length -------------------------------

const PR016_CREATE = /\b(?:write|compose|draft|create|generate|produce)\s+(?:a|an)\s+(?:[a-z]+\s+){0,3}(essay|story|article|description|summary|report|post|poem|email|letter|memo|review|analysis|caption|blurb|introduction|conclusion|proposal)\b/gi;
const PR016_LENGTH = /\b(?:\d+\s+(?:words?|paragraphs?|sentences?|pages?|lines?|chars?|characters?|tokens?)|(?:in\s+)?(?:a\s+)?brief|short|long|concise|detailed|exhaustive|one[- ]?liner|one\s+paragraph|two\s+paragraphs?|under\s+\d+|at\s+most\s+\d+|no\s+more\s+than\s+\d+|tweet[- ]?length)\b/i;

function detectPR016(text, findings) {
  PR016_CREATE.lastIndex = 0;
  let m;
  const seenLines = new Set();
  while ((m = PR016_CREATE.exec(text))) {
    const window = text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 160);
    if (PR016_LENGTH.test(window)) continue;
    const artStart = m.index + m[0].toLowerCase().indexOf(m[1].toLowerCase());
    const { line, col } = lineColFor(text, artStart);
    if (seenLines.has(line)) continue;
    seenLines.add(line);
    findings.push({
      rule_id: 'PR016',
      severity: 'info',
      line, col,
      evidence: m[1],
      rationale: RATIONALES.PR016,
    });
  }
}

// ---- PR017: negation-heavy without positive direction ----------------
//
// Fires when the prompt has >= 3 negation patterns AND no positive
// imperative verb that is free of negation context. A positive verb
// preceded within 30 chars by a negation token (don't/never/avoid/...)
// is considered shadowed and does not count as positive direction.

const PR017_NEG = /\b(?:don'?t|do\s+not|never|avoid|must\s+not|should\s+not|cannot|can'?t|won'?t|will\s+not|refrain\s+from|stop|no\s+(?:longer|more))\b/gi;
const PR017_POS_VERB = /\b(?:write|create|generate|produce|summari[sz]e|classify|extract|translate|return|output|describe|list|explain|compute|calculate|find|identify|analy[sz]e|review|compare|rate|evaluate|provide|give|use|format|emit|render|build|draft|compose|tag|categori[sz]e|highlight|annotate|score|sort|filter|map)\b/gi;
const PR017_NEG_LOOKBACK = /\b(?:don'?t|do\s+not|never|avoid|must\s+not|should\s+not|cannot|can'?t|won'?t|will\s+not|refrain\s+from|stop)\s+(?:to\s+)?$/i;

function detectPR017(text, findings) {
  PR017_NEG.lastIndex = 0;
  let negCount = 0;
  let firstNeg = null;
  let m;
  while ((m = PR017_NEG.exec(text))) {
    if (firstNeg === null) firstNeg = m;
    negCount++;
  }
  if (negCount < 3) return;
  // Look for any positive imperative verb NOT in negation context.
  PR017_POS_VERB.lastIndex = 0;
  let hasFreePositive = false;
  while ((m = PR017_POS_VERB.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    if (PR017_NEG_LOOKBACK.test(before)) continue;
    hasFreePositive = true;
    break;
  }
  if (hasFreePositive) return;
  const { line, col } = lineColFor(text, firstNeg.index);
  findings.push({
    rule_id: 'PR017',
    severity: 'info',
    line, col,
    evidence: firstNeg[0],
    rationale: `${RATIONALES.PR017} (${negCount} negations, no positive imperative)`,
  });
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
  ['PR002', detectPR002],
  ['PR004', detectPR004],
  ['PR005', detectPR005],
  ['PR006', detectPR006],
  ['PR007', detectPR007],
  ['PR008', detectPR008],
  ['PR010', detectPR010],
  ['PR011', detectPR011],
  ['PR012', detectPR012],
  ['PR013', detectPR013],
  ['PR014', detectPR014],
  ['PR015', detectPR015],
  ['PR016', detectPR016],
  ['PR017', detectPR017],
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
    const engine = f.engine || 'deterministic';
    lines.push(`\`${f.rule_id}\` [${f.severity}] ${f.line}:${f.col} - \`${f.evidence}\` - ${f.rationale} _(${engine})_`);
  }
  const s = summarize(findings);
  lines.push('');
  lines.push(`**summary:** ${s.error} error${s.error === 1 ? '' : 's'}, ${s.warning} warning${s.warning === 1 ? '' : 's'}, ${s.info} info`);
  return lines.join('\n') + '\n';
}

function formatText(findings) {
  return findings.map(f =>
    `${f.line}:${f.col}\t${f.rule_id}\t${f.severity}\t${f.engine || 'deterministic'}\t${f.evidence.replace(/\t/g, ' ').replace(/\n/g, '\\n')}\t${f.rationale}`
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
