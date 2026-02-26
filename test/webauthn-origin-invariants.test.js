#!/usr/bin/env node
/**
 * WebAuthn Origin + RP ID Invariants — CI fails if production misconfigured
 * Run: node test/webauthn-origin-invariants.test.js
 *
 * Production must NOT use localhost, http, or mismatched subdomain.
 * Set WEBAUTHN_EXPECTED_ORIGIN and WEBAUTHN_EXPECTED_RP_ID for production.
 */

const webauthnStore = require('../lib/webauthn-vault-store.js');

let passed = 0;
let failed = 0;

function ok(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); return; }
  failed++; console.log(`  ✗ ${msg}`);
}

function section(t) {
  console.log(`\n--- ${t} ---`);
}

// 1. Production config: when EXPECTED_* set, must be used
section('WebAuthn production origin/RP ID');
const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const expectedOrigin = (process.env.WEBAUTHN_EXPECTED_ORIGIN || '').trim();
const expectedRpId = (process.env.WEBAUTHN_EXPECTED_RP_ID || '').trim();

if (isProd && (expectedOrigin || expectedRpId)) {
  const req = { headers: {} };
  const origin = webauthnStore.getOrigin(req);
  const rpId = webauthnStore.getRpId(origin);
  if (expectedOrigin) ok(origin === expectedOrigin, `origin matches WEBAUTHN_EXPECTED_ORIGIN`);
  if (expectedRpId) ok(rpId === expectedRpId, `rpID matches WEBAUTHN_EXPECTED_RP_ID`);
  ok(!origin.includes('localhost'), 'Production must not use localhost origin');
  ok(!origin.startsWith('http://'), 'Production must use https');
  ok(rpId !== 'localhost', 'Production must not use localhost rpID');
} else {
  ok(true, 'Non-production or no EXPECTED_* set — skip');
}

// 2. CI guard: if CI and production URL configured, assert no localhost fallback
section('CI production guard');
if (process.env.CI === 'true' && isProd) {
  ok(expectedOrigin && expectedRpId, 'CI production: WEBAUTHN_EXPECTED_ORIGIN and WEBAUTHN_EXPECTED_RP_ID must be set');
} else {
  ok(true, 'Not CI production — skip');
}

console.log(`\n========== WEBAUTHN ORIGIN INVARIANTS ==========`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) {
  console.error('\n⚠️ WebAuthn origin/RP ID misconfigured. Fix before deploy.');
  process.exit(1);
}
console.log('✓ WebAuthn origin invariants intact.\n');
