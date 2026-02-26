#!/usr/bin/env node
/**
 * Fail-Closed Invariants — Production must deny when Supabase unavailable
 * Run: node test/fail-closed-invariants.test.js
 *
 * When NODE_ENV=production and SUPABASE_URL missing:
 * - Rate limit check must return allowed: false (no in-memory fallback)
 * - Unlock attempts must be denied
 */

const { spawnSync } = require('child_process');
const path = require('path');

let passed = 0;
let failed = 0;

function ok(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); return; }
  failed++; console.log(`  ✗ ${msg}`);
}

function section(t) {
  console.log(`\n--- ${t} ---`);
}

// Run in subprocess to isolate env
function runWithEnv(script, env) {
  const result = spawnSync('node', [path.join(__dirname, script)], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 10000,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', code: result.status };
}

section('Fail-closed: production + no Supabase');
const r = runWithEnv('fail-closed-check.js', {
  NODE_ENV: 'production',
  SUPABASE_URL: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
});
ok(r.code === 0, 'Fail-closed check passes (deny when production + no Supabase)');

console.log(`\n========== FAIL-CLOSED INVARIANTS ==========`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) {
  console.error('\n⚠️ Fail-closed invariant violated.');
  process.exit(1);
}
console.log('✓ Fail-closed invariants intact.\n');
