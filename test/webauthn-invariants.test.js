#!/usr/bin/env node
/**
 * WebAuthn Elite Invariants — CI fails if these regress
 * Run: node test/webauthn-invariants.test.js
 */

const fs = require('fs');
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

// 1. Challenge hash only, raw never stored
section('WebAuthn challenge hash only');
const migrationPath = path.join(__dirname, '../supabase/migrations');
const webauthnMigrations = fs.readdirSync(migrationPath).filter(f => f.includes('webauthn_vault'));
const webauthnMigrationSrc = webauthnMigrations.length
  ? fs.readFileSync(path.join(migrationPath, webauthnMigrations[0]), 'utf8')
  : '';
ok(webauthnMigrationSrc.includes('challenge_hash'), 'webauthn_challenges stores challenge_hash');
ok(!webauthnMigrationSrc.includes('challenge TEXT') && !webauthnMigrationSrc.includes('challenge VARCHAR'), 'Raw challenge never stored');

// 2. Atomic consume
section('WebAuthn atomic consume');
ok(webauthnMigrationSrc.includes('consume_webauthn_challenge'), 'consume_webauthn_challenge RPC');
ok(webauthnMigrationSrc.includes('FOR UPDATE SKIP LOCKED'), 'FOR UPDATE SKIP LOCKED');

// 3. Unlock requires webauthnSessionToken when vault has passkeys
section('Unlock WebAuthn enforcement');
const unlockPath = path.join(__dirname, '../api/unlock-vault.js');
const unlockSrc = fs.readFileSync(unlockPath, 'utf8');
ok(unlockSrc.includes('webauthnSessionToken'), 'unlock-vault checks webauthnSessionToken');
ok(unlockSrc.includes('webauthnVaultStore.hasCredentials'), 'Checks vault has passkeys');
ok(unlockSrc.includes('webauthnRequired'), 'Returns webauthnRequired when token missing');

// 4. auth/verify returns webauthnSessionToken
section('auth/verify issues token');
const webauthnVaultPath = path.join(__dirname, '../api/webauthn-vault.js');
const webauthnVaultSrc = fs.readFileSync(webauthnVaultPath, 'utf8');
ok(webauthnVaultSrc.includes('webauthnSessionToken'), 'auth/verify returns webauthnSessionToken');
ok(webauthnVaultSrc.includes('userVerification: \'required\''), 'userVerification required');

// 5. Counter rollback detection
section('Counter rollback');
ok(webauthnVaultSrc.includes('Counter rollback') || webauthnVaultSrc.includes('newCounter <= cred.counter'), 'Counter rollback detected');

// 6. Registration requires deviceRegistrationToken
section('Registration proof');
ok(webauthnVaultSrc.includes('deviceRegistrationToken'), 'register/options requires deviceRegistrationToken');

console.log(`\n========== WEBAUTHN INVARIANTS ==========`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) {
  console.error('\n⚠️ WebAuthn invariant violated.');
  process.exit(1);
}
console.log('✓ WebAuthn elite invariants intact.\n');
