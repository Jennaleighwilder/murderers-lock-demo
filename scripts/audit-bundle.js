#!/usr/bin/env node
/**
 * Audit Bundle — One-command evidence run for external auditors.
 * Run: npm run audit:bundle
 *
 * Produces: artifacts/audit/<timestamp>/
 *   - MANIFEST.json (metadata, pass/fail, env)
 *   - redteam-report.json, redteam-summary.md
 *   - traces/*.json (sanitized)
 *   - sbom.json (if generated)
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const AUDIT_DIR = path.join(ROOT, 'artifacts', 'audit', TIMESTAMP);

const results = { shipGate: null, redteam: null, webauthn: null };
let exitCode = 0;

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: true,
  });
  return r.status;
}

function getCommitSha() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || '').trim().slice(0, 12) : 'unknown';
}

function getNodeVersion() {
  return process.version;
}

console.log('=== Audit Bundle ===');
console.log(`Output: ${AUDIT_DIR}\n`);

// 1. Ship gate (includes npm test)
console.log('1. Ship gate (verify:prod-security)...');
results.shipGate = run('npm', ['run', 'verify:prod-security']);
if (results.shipGate !== 0) {
  console.error('Ship gate FAILED');
  exitCode = 1;
}

// 2. Secrets check
console.log('\n2. Secrets check...');
const secretsCode = run('npm', ['run', 'verify:secrets']);
if (secretsCode !== 0) {
  console.warn('verify:secrets failed (non-fatal for audit bundle)');
}

// 3. Red-team (full if secrets, else lite)
const hasSecrets = process.env.REDTEAM_VAULT_ID && process.env.REDTEAM_PASSWORD;
const redteamMode = hasSecrets ? 'full' : 'lite';
console.log(`\n3. Red-team (mode: ${redteamMode})...`);
results.redteam = run('npm', ['run', 'test:redteam'], {
  REDTEAM_MODE: redteamMode,
  REDTEAM_BASE_URL: process.env.REDTEAM_BASE_URL || process.env.WEBAUTHN_BASE_URL || 'https://murderers-lock-demo.vercel.app',
});
if (results.redteam !== 0) {
  console.error('Red-team FAILED');
  exitCode = 1;
}

// 4. WebAuthn E2E (skip if SKIP_WEBAUTHN=1)
const baseUrl = process.env.REDTEAM_BASE_URL || process.env.WEBAUTHN_BASE_URL || 'https://murderers-lock-demo.vercel.app';
const skipWebAuthn = process.env.SKIP_WEBAUTHN === '1';
if (skipWebAuthn) {
  console.log('\n4. WebAuthn E2E (skipped via SKIP_WEBAUTHN=1)...');
  results.webauthn = 0;
} else {
  console.log('\n4. WebAuthn E2E...');
  results.webauthn = run('npm', ['run', 'test:webauthn'], {
    WEBAUTHN_BASE_URL: baseUrl,
    REDTEAM_BASE_URL: baseUrl,
  });
  if (results.webauthn !== 0) {
    console.error('WebAuthn E2E FAILED');
    exitCode = 1;
  }
}

// 5. Collect artifacts
fs.mkdirSync(AUDIT_DIR, { recursive: true });

const redteamSrc = path.join(ROOT, 'artifacts', 'redteam');
if (fs.existsSync(redteamSrc)) {
  const files = fs.readdirSync(redteamSrc);
  const traceDir = path.join(redteamSrc, 'traces');
  for (const f of files) {
    const src = path.join(redteamSrc, f);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(AUDIT_DIR, f));
    }
  }
  if (fs.existsSync(traceDir)) {
    const destTrace = path.join(AUDIT_DIR, 'traces');
    fs.mkdirSync(destTrace, { recursive: true });
    for (const f of fs.readdirSync(traceDir)) {
      fs.copyFileSync(path.join(traceDir, f), path.join(destTrace, f));
    }
  }
}

if (fs.existsSync(path.join(ROOT, 'sbom.json'))) {
  fs.copyFileSync(path.join(ROOT, 'sbom.json'), path.join(AUDIT_DIR, 'sbom.json'));
}

// 6. MANIFEST
const webauthnSkipped = skipWebAuthn;
const manifest = {
  generatedAt: new Date().toISOString(),
  commitSha: getCommitSha(),
  nodeVersion: getNodeVersion(),
  baseUrl: baseUrl,
  rpId: process.env.WEBAUTHN_EXPECTED_RP_ID || 'from-origin',
  origin: process.env.WEBAUTHN_EXPECTED_ORIGIN || 'from-request',
  redteamMode,
  webauthnSkipped: webauthnSkipped || undefined,
  results: {
    shipGate: results.shipGate === 0 ? 'pass' : 'fail',
    redteam: results.redteam === 0 ? 'pass' : 'fail',
    webauthn: webauthnSkipped ? 'skipped' : (results.webauthn === 0 ? 'pass' : 'fail'),
  },
  summary: {
    passed: [results.shipGate, results.redteam, results.webauthn].filter(c => c === 0).length,
    failed: [results.shipGate, results.redteam, results.webauthn].filter(c => c !== 0).length,
    total: 3,
  },
};

fs.writeFileSync(path.join(AUDIT_DIR, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));

console.log('\n=== Audit Bundle Complete ===');
console.log(`Artifacts: ${AUDIT_DIR}`);
console.log(`MANIFEST: ${manifest.results.shipGate} / ${manifest.results.redteam} / ${manifest.results.webauthn}`);
if (exitCode !== 0) {
  process.exit(1);
}
