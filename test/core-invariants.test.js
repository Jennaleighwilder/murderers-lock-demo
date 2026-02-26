#!/usr/bin/env node
/**
 * Core Invariants Test — Armored Core
 * CI fails if these invariants regress. Do not weaken.
 * Run: node test/core-invariants.test.js
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

// 1. Argon2id stays memory-hard — frozen parameters
section('Argon2id memory-hard');
const recoveryPath = path.join(__dirname, '../lib/recovery.js');
const recoverySrc = fs.readFileSync(recoveryPath, 'utf8');
ok(recoverySrc.includes('65536'), 'Argon2 memoryCost frozen at 65536');
ok(recoverySrc.includes('timeCost: 3') || recoverySrc.includes('timeCost:3'), 'Argon2 timeCost frozen at 3');
ok(recoverySrc.includes('argon2'), 'Argon2 used');

// 2. Device challenge: server-issued, stored hash only
section('Device challenge server-issued');
const deviceChallengePath = path.join(__dirname, '../api/device-challenge.js');
const deviceChallengeSrc = fs.readFileSync(deviceChallengePath, 'utf8');
ok(deviceChallengeSrc.includes('randomBytes'), 'Challenge uses crypto.randomBytes');
ok(deviceChallengeSrc.includes('sha256') || deviceChallengeSrc.includes('createHash'), 'Challenge hash stored');

const migrationPath = path.join(__dirname, '../supabase/migrations');
const migrations = fs.readdirSync(migrationPath).filter(f => f.includes('device_challenges'));
const migrationSrc = migrations.length ? fs.readFileSync(path.join(migrationPath, migrations[0]), 'utf8') : '';
ok(migrationSrc.includes('challenge_hash') && !migrationSrc.includes('challenge TEXT'), 'Raw challenge never stored');

// 3. Registration requires token
section('Registration requires proof');
const deviceRegisterPath = path.join(__dirname, '../api/device-register.js');
const deviceRegisterSrc = fs.readFileSync(deviceRegisterPath, 'utf8');
ok(deviceRegisterSrc.includes('deviceRegistrationToken'), 'device-register checks deviceRegistrationToken');

// 4. Rate limit fail closed in production
section('Rate limit fail closed');
const rateLimitPath = path.join(__dirname, '../api/rate-limit-store.js');
const rateLimitSrc = fs.readFileSync(rateLimitPath, 'utf8');
ok(rateLimitSrc.includes('IS_PRODUCTION') || rateLimitSrc.includes('NODE_ENV'), 'Production check present');
ok(rateLimitSrc.includes('allowed: false') || rateLimitSrc.includes('fail closed'), 'Fail closed when Supabase unavailable');

// 5. consume_device_challenge atomic
section('Challenge consume atomic');
ok(migrationSrc.includes('consume_device_challenge') || migrationSrc.includes('FOR UPDATE'), 'Atomic consume (RPC or FOR UPDATE)');

// 6. AES mode frozen
section('AES encryption');
ok(recoverySrc.includes('aes-256-gcm'), 'AES-256-GCM mode frozen');

// 7. Marketing: no hardware-backed claim without WebAuthn
section('Claims accuracy');
const whitepaperPath = path.join(__dirname, '../docs/WHITEPAPER.md');
const whitepaperSrc = fs.readFileSync(whitepaperPath, 'utf8');
ok(!whitepaperSrc.includes('hardware-backed') || whitepaperSrc.includes('WebAuthn'), 'No standalone hardware-backed claim');

console.log(`\n========== CORE INVARIANTS ==========`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) {
  console.error('\n⚠️ Core invariant violated. Do not ship.');
  process.exit(1);
}
console.log('✓ Armored core intact.\n');
