#!/usr/bin/env node
/**
 * Unit: Crypto — Argon2id, AES-256-GCM, Shamir, Nanosecond Lock
 */
const { lock, unlock } = require('../../lib/nanosecond-lock-production.js');
const { createVault, unlockVault, splitSecret, recoverFromShards } = require('../../lib/recovery.js');

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

console.log('\n--- Unit: Crypto ---\n');

(async () => {
  const pw = 'CorrectPassword123!';
  const plain = 'secret-data';
  const locked = await lock(pw, plain);
  ok('lock produces encryptedData, iv, salt, timestamp', !!locked.encryptedData && !!locked.iv && !!locked.salt && !!locked.timestamp);

  const unlocked = await unlock(pw, locked.timestamp, locked.encryptedData, locked.iv, locked.salt);
  ok('correct password decrypts', unlocked.data === plain);

  try {
    await unlock('WrongPassword', locked.timestamp, locked.encryptedData, locked.iv, locked.salt);
    ok('wrong password throws', false);
  } catch (e) {
    ok('wrong password throws', e.message?.includes('Wrong') || e.message?.includes('corrupted'));
  }

  const locked2 = await lock(pw, plain);
  ok('same password different ciphertext', locked.encryptedData !== locked2.encryptedData);

  const { vaultId, salt, encryptedData, iv } = await createVault('Test', 'ValidPass123!', 'legacy-secret');
  ok('createVault produces output', !!vaultId && !!salt && !!encryptedData && !!iv);

  const result = await unlockVault('ValidPass123!', salt, encryptedData, iv);
  ok('unlockVault returns contents', result.contents === 'legacy-secret');

  const shards = splitSecret('RecoveryPass123!');
  ok('splitSecret produces 3 shards', shards.length === 3);

  const recovered = recoverFromShards([shards[0], shards[1]]);
  ok('2 shards recover password', recovered.password === 'RecoveryPass123!');

  console.log('\nCrypto:', passed, 'passed,', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
})();
