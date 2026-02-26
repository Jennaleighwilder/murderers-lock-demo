const fs = require('fs');
const path = require('path');

const ART_DIR = path.join(process.cwd(), 'artifacts', 'redteam');
const TRACE_DIR = path.join(ART_DIR, 'traces');

function ensureDirs() {
  fs.mkdirSync(TRACE_DIR, { recursive: true });
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeTrace(testName, trace) {
  ensureDirs();
  const file = path.join(TRACE_DIR, `${testName}-${nowStamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(trace, null, 2));
  return file;
}

function writeReport(report) {
  ensureDirs();
  fs.writeFileSync(path.join(ART_DIR, 'redteam-report.json'), JSON.stringify(report, null, 2));

  const lines = [];
  lines.push('# Red-Team Report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  for (const t of report.tests) {
    lines.push(`## ${t.name}`);
    lines.push(`- Status: ${t.passed ? '✅ PASS' : '❌ FAIL'}`);
    lines.push(`- Goal: ${t.goal}`);
    lines.push(`- Expected: ${t.expected}`);
    lines.push(`- Observed: ${t.observed}`);
    if (t.traceFile) lines.push(`- Trace: ${t.traceFile}`);
    lines.push('');
  }
  fs.writeFileSync(path.join(ART_DIR, 'redteam-summary.md'), lines.join('\n'));
}

module.exports = { writeTrace, writeReport };
