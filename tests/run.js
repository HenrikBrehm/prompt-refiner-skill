#!/usr/bin/env node
// tests/run.js — zero-dep fixture runner for the new feature/rule tests.
//
// Each fixture is a markdown file under tests/fixtures/ with YAML-style
// frontmatter:
//   ---
//   test_id: <string>
//   expected_rules: <CSV of rule IDs>     # must fire
//   forbidden_rules: <CSV of rule IDs>    # must NOT fire
//   language: <string>                    # informational
//   args: <space-separated lint.js args>  # default: --format=json --no-config -
//   expect_exit: <0|1|2>                  # default 0
//   cwd: <repo-relative path>             # default: repo root
//   ---
//   <prompt body fed to lint.js via stdin>
//
// The runner pipes the body to scripts/lint.js, asserts:
//   - exit code matches expect_exit
//   - every expected_rules ID is present in findings
//   - no forbidden_rules ID is present in findings
//
// scripts/run-tests.sh covers tests/corpus/* (the historical conformance
// corpus). This runner is for the new fixtures only.

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures');
const LINT = path.join(REPO_ROOT, 'scripts', 'lint.js');

function listFixtures(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFixtures(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    throw new Error('fixture missing leading --- delimiter');
  }
  const rest = text.replace(/^---\r?\n/, '');
  const end = rest.search(/^---\r?\n/m);
  if (end === -1) throw new Error('fixture missing closing --- delimiter');
  const fmRaw = rest.slice(0, end);
  const body = rest.slice(end).replace(/^---\r?\n/, '');
  const fm = {};
  for (const line of fmRaw.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i === -1) continue;
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fm, body };
}

function csvList(s) {
  if (!s) return [];
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

function splitArgs(s) {
  if (!s) return [];
  return s.split(/\s+/).filter(Boolean);
}

function runLint(args, body, cwd) {
  const res = spawnSync(process.execPath, [LINT, ...args], {
    cwd,
    input: body,
    encoding: 'utf8',
  });
  return { stdout: res.stdout || '', stderr: res.stderr || '', status: res.status };
}

function assertFixture(file) {
  const rel = path.relative(REPO_ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  const { fm, body } = parseFrontmatter(text);

  if (!fm.test_id) {
    return { rel, ok: false, reason: 'missing test_id' };
  }

  const expected = csvList(fm.expected_rules);
  const forbidden = csvList(fm.forbidden_rules);
  const args = splitArgs(fm.args || '--format=json --no-config -');
  const expectExit = fm.expect_exit !== undefined ? Number(fm.expect_exit) : 0;
  const cwd = fm.cwd ? path.resolve(REPO_ROOT, fm.cwd) : REPO_ROOT;

  const { stdout, stderr, status } = runLint(args, body, cwd);

  if (status !== expectExit) {
    return {
      rel, ok: false,
      reason: `exit ${status} (expected ${expectExit}); stderr=${stderr.trim().slice(0, 200)}`,
    };
  }

  if (expectExit !== 0) {
    return { rel, ok: true, fired: [], summary: `exit ${status}` };
  }

  let report;
  try { report = JSON.parse(stdout); }
  catch (e) {
    return {
      rel, ok: false,
      reason: `lint.js stdout not valid JSON: ${e.message}; stderr=${stderr.trim().slice(0, 200)}`,
    };
  }

  const fired = (report.findings || []).map(f => f.rule_id);
  const firedSet = new Set(fired);

  for (const rid of expected) {
    if (!firedSet.has(rid)) {
      return {
        rel, ok: false,
        reason: `expected rule ${rid} did not fire; got [${[...firedSet].join(',') || 'none'}]`,
      };
    }
  }
  for (const rid of forbidden) {
    if (firedSet.has(rid)) {
      return {
        rel, ok: false,
        reason: `forbidden rule ${rid} fired; got [${[...firedSet].join(',') || 'none'}]`,
      };
    }
  }
  return {
    rel, ok: true, fired,
    summary: `fired=${[...firedSet].join(',') || 'none'}`,
  };
}

function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`run.js: ${FIXTURES_DIR} missing`);
    process.exit(2);
  }
  if (!fs.existsSync(LINT)) {
    console.error(`run.js: ${LINT} missing`);
    process.exit(2);
  }
  const files = listFixtures(FIXTURES_DIR).sort();
  if (files.length === 0) {
    console.error('run.js: no fixtures found under tests/fixtures/');
    process.exit(2);
  }
  let pass = 0, fail = 0;
  for (const f of files) {
    const r = assertFixture(f);
    if (r.ok) {
      console.log(`PASS [${r.rel}] ${r.summary}`);
      pass++;
    } else {
      console.log(`FAIL [${r.rel}] ${r.reason}`);
      fail++;
    }
  }
  console.log('');
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
