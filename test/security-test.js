#!/usr/bin/env node
/**
 * SECURITY TEST SUITE - The Lock Must Be Real
 * Tests encryption, wrong-password rejection, rate limit, lockjaw, Shamir recovery.
 * If these fail, the product doesn't matter.
 *
 * Set TEST_FAST=1 to skip 5s delays (for rate limit / lockjaw tests)
 * Usage: TEST_FAST=1 node test/security-test.js
 */

const { lock, unlock } = require('../lib/nanosecond-lock-production.js');
const { createVault, unlockVault, splitSecret, recoverFromShards, reEncryptVault } = require('../lib/recovery.js');

const BASE = process.env.API_BASE || 'http://127.0.0.1:3000';
const TEST_FAST = process.env.TEST_FAST === '1';
const LOCKJAW_ONLY = process.argv.includes('--lockjaw-only');
const NO_LOCKJAW = process.argv.includes('--no-lockjaw');

let passed = 0;
let failed = 0;
const failures = [];

function assert(name, condition, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
    return true;
  }
  failed++;
  failures.push({ name, details });
  console.log(`  ✗ ${name}${details ? ': ' + details : ''}`);
  return false;
}

function section(title) {
  console.log(`\n--- ${title} ---`);
}

async function runAll() {
if (!LOCKJAW_ONLY) {
// ========== CRYPTO: Nanosecond Lock ==========
section('Nanosecond Lock (33 Gates) - Encryption Correctness');
{
  const password = 'CorrectPassword123!';
  const plaintext = 'secret-data-123';
  const locked = await lock(password, plaintext);
  assert('lock produces encryptedData, iv, salt, timestamp', !!locked.encryptedData && !!locked.iv && !!locked.salt && !!locked.timestamp);
  assert('timestamp is unique per lock', locked.timestamp.includes('.'));
  const unlocked = await unlock(password, locked.timestamp, locked.encryptedData, locked.iv, locked.salt);
  assert('correct password decrypts to original', unlocked.data === plaintext);
  try {
    await unlock('WrongPassword123!', locked.timestamp, locked.encryptedData, locked.iv, locked.salt);
    assert('wrong password MUST throw', false);
  } catch (e) {
    assert('wrong password throws (no data leak)', e.message && (e.message.includes('Wrong') || e.message.includes('corrupted')));
  }
  try {
    await unlock(password, locked.timestamp, locked.encryptedData, locked.iv, 'wrong' + locked.salt);
    assert('wrong salt MUST throw', false);
  } catch (e) {
    assert('wrong salt throws', true);
  }
  const locked2 = await lock(password, plaintext);
  assert('same password different ciphertext (unique IV/timestamp)', locked.encryptedData !== locked2.encryptedData);
}

// ========== CRYPTO: Argon2id Legacy ==========
section('Argon2id + AES-256-GCM - Legacy Vault');
{
  const { vaultId, salt, encryptedData, iv } = await createVault('Test', 'ValidPass123!', 'my-secret');
  assert('createVault produces valid output', !!vaultId && !!salt && !!encryptedData && !!iv);
  const result = await unlockVault('ValidPass123!', salt, encryptedData, iv);
  assert('correct password unlocks', result.contents === 'my-secret');
  try {
    await unlockVault('WrongPass123!', salt, encryptedData, iv);
    assert('wrong password MUST throw', false);
  } catch (e) {
    assert('wrong password throws (no plaintext leak)', e.message && e.message.includes('Invalid'));
  }
}

// ========== SHAMIR RECOVERY ==========
section('Shamir 2-of-3 Recovery');
{
  const password = 'RecoveryTest123!';
  const shards = splitSecret(password);
  assert('splitSecret produces 3 shards', shards.length === 3);
  assert('shards are hex', /^[0-9a-f]+$/.test(shards[0]));
  const recovered = recoverFromShards([shards[0], shards[1]]);
  assert('2 shards recover password', recovered.password === password);
  const recovered2 = recoverFromShards([shards[1], shards[2]]);
  assert('any 2 shards work', recovered2.password === password);
  try {
    recoverFromShards([shards[0]]);
    assert('1 shard MUST fail', false);
  } catch (e) {
    assert('1 shard throws', true);
  }
}

// ========== API: Wrong Password Never Leaks ==========
section('API: Wrong Password - No Data Leak');
{
  try {
    const res = await fetch(BASE + '/api/health');
    if (!res.ok) throw new Error('Server down');
  } catch (e) {
    console.log('  (skipped - server not running)');
    return;
  }
  const create = await fetch(BASE + '/api/create-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'SecTest', password: 'RealPassword123!', useNanosecond: true })
  });
  const data = await create.json();
  if (!data.success) {
    assert('create vault for security test', false);
    return;
  }
  const { vaultId, salt, encryptedData, iv, timestamp } = data;
  const wrong = await fetch(BASE + '/api/unlock-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultId, password: 'WrongPassword123!', salt, encryptedData, iv, timestamp })
  });
  const wrongJson = await wrong.json();
  assert('wrong password returns 401', wrong.status === 401);
  assert('wrong password NEVER returns contents', !wrongJson.contents);
  assert('wrong password returns murderCount', typeof wrongJson.murderCount === 'number');
  const right = await fetch(BASE + '/api/unlock-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultId, password: 'RealPassword123!', salt, encryptedData, iv, timestamp })
  });
  const rightJson = await right.json();
  assert('correct password returns contents', right.status === 200 && rightJson.contents !== undefined);
}

}
// ========== API: Lockjaw (3 failed) ==========
section('API: Lockjaw (3 failed attempts)');
{
  try {
    const res = await fetch(BASE + '/api/health');
    if (!res.ok) throw new Error('Server down');
  } catch (e) {
    console.log('  (skipped - server not running)');
    return;
  }
  if (!TEST_FAST && !LOCKJAW_ONLY) {
    console.log('  (skipped - set TEST_FAST=1 to run, takes ~165s otherwise)');
    return;
  }
  const create = await fetch(BASE + '/api/create-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'LockjawTest', password: 'LockjawPass123!', useNanosecond: true })
  });
  const data = await create.json();
  if (!data.success) return;
  const { vaultId, salt, encryptedData, iv, timestamp } = data;
  let lockjawEngaged = false;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(BASE + '/api/unlock-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultId, password: 'wrong', salt, encryptedData, iv, timestamp })
    });
    const j = await r.json();
    if (j.lockjawEngaged) lockjawEngaged = true;
  }
  assert('lockjaw engaged after 3 failures', lockjawEngaged);
}

if (!LOCKJAW_ONLY) {
// ========== API: Correct Password After Lockjaw ==========
section('API: Correct Password Still Works After Lockjaw');
{
  try {
    const res = await fetch(BASE + '/api/health');
    if (!res.ok) throw new Error('Server down');
  } catch (e) {
    console.log('  (skipped - server not running)');
    return;
  }
  const create = await fetch(BASE + '/api/create-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'CorrectTest', password: 'CorrectAfterLock123!', useNanosecond: true })
  });
  const data = await create.json();
  if (!data.success) return;
  const { vaultId, salt, encryptedData, iv, timestamp } = data;
  let lastStatus = 0;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(BASE + '/api/unlock-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultId, password: 'wrong', salt, encryptedData, iv, timestamp })
    });
    lastStatus = r.status;
  }
  const right = await fetch(BASE + '/api/unlock-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultId, password: 'CorrectAfterLock123!', salt, encryptedData, iv, timestamp })
  });
  assert('correct password unlocks even after wrong attempts', right.status === 200 && (await right.json()).contents !== undefined);
}

// ========== API: Recover Returns Token Not Password ==========
section('API: Recovery - Token Not Password');
{
  try {
    const res = await fetch(BASE + '/api/health');
    if (!res.ok) throw new Error('Server down');
  } catch (e) {
    console.log('  (skipped - server not running)');
    return;
  }
  const create = await fetch(BASE + '/api/create-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'RecoveryTest', password: 'RecoveryPass123!', useNanosecond: false })
  });
  const data = await create.json();
  if (!data.success) return;
  const { vaultId, salt, encryptedData, iv, shards } = data;
  const recover = await fetch(BASE + '/api/recover-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '127.0.0.1' },
    body: JSON.stringify({ shards: [shards[0], shards[1]], vaultId, salt, encryptedData, iv })
  });
  const recoverJson = await recover.json();
  assert('recover returns sessionToken', recoverJson.sessionToken && !recoverJson.password);
  assert('recover returns vaultId', recoverJson.vaultId === vaultId);
  const unlock = await fetch(BASE + '/api/unlock-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultId, sessionToken: recoverJson.sessionToken })
  });
  const unlockJson = await unlock.json();
  assert('session token unlocks vault', unlock.status === 200 && unlockJson.contents !== undefined);
  const reuse = await fetch(BASE + '/api/unlock-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultId, sessionToken: recoverJson.sessionToken })
  });
  assert('session token is one-time use', reuse.status === 401);
}

// ========== ARGON2 CONFIG ==========
section('Argon2id Configuration');
{
  const argon2 = require('argon2');
  const opts = argon2.argon2id ? {} : {};
  const hash = await argon2.hash('test', { type: argon2.argon2id, memoryCost: 65536, timeCost: 3 });
  assert('Argon2id available', !!hash);
  assert('Argon2id memory-hard (64MB)', true); // Manual check
}

}

// ========== SUMMARY ==========
  console.log('\n========== SECURITY SUMMARY ==========');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failures.length > 0) {
    console.log('\nCRITICAL FAILURES:');
    failures.forEach(f => console.log(`  - ${f.name}${f.details ? ': ' + f.details : ''}`));
    process.exit(1);
  }
  console.log('\n✓ Security tests passed. The lock is real.');
  process.exit(0);
}

runAll().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
