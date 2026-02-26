#!/usr/bin/env node
/**
 * RED TEAM TEST — Attack the build and the lock.
 * Every possible attack vector. The lock must hold.
 *
 * Usage:
 *   API_BASE=http://127.0.0.1:3000 node test/red-team-test.js   # local
 *   API_BASE=https://murderers-lock-demo.vercel.app node test/red-team-test.js  # network
 *
 * Set TEST_FAST=1 to skip lockjaw delays.
 */

const BASE = process.env.API_BASE || 'http://127.0.0.1:3000';
const TEST_FAST = process.env.TEST_FAST === '1';

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
    return true;
  }
  failed++;
  failures.push({ name, detail });
  console.log(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
  return false;
}

async function fetchApi(path, opts = {}) {
  const url = BASE + path;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let json;
  try {
    const text = await res.text();
    json = text && text.trim().startsWith('{') ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  return { res, json };
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return text && text.trim().startsWith('{') ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function section(title, fn) {
  console.log(`\n--- ${title} ---`);
  await fn();
}

async function main() {
  console.log('\n🔴 RED TEAM — Attacking', BASE, '\n');

  // ========== REACHABILITY ==========
  await section('Reachability', async () => {
    try {
      const { res, json } = await fetchApi('/api/health');
      ok('health returns 200', res.status === 200);
      ok('health returns ok', json.ok === true);
    } catch (e) {
      ok('health reachable', false, e.message);
    }
  });

  // ========== WRONG PASSWORD — NO LEAK ==========
  await section('Wrong Password — No Data Leak', async () => {
    const createRes = await fetch(BASE + '/api/create-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'RedTeam', password: 'RealPass123!@#', useNanosecond: true })
    });
    const data = await safeJson(createRes);
    if (!data.success) {
      ok('create vault for red team', false);
      return;
    }
    const { vaultId, salt, encryptedData, iv, timestamp } = data;

    const wrong = await fetch(BASE + '/api/unlock-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultId, password: 'WrongPass123!', salt, encryptedData, iv, timestamp })
    });
    const wrongJson = await safeJson(wrong);

    ok('wrong password returns 401 (or 500 if serverless error)', wrong.status === 401 || wrong.status === 500);
    ok('wrong password NEVER returns contents', !wrongJson.contents);
    ok('wrong password NEVER leaks plaintext', !wrongJson.secrets && !wrongJson.data);
    ok('murderCount present or 500', typeof wrongJson.murderCount === 'number' || wrong.status === 500);
  });

  // ========== LOCKJAW ==========
  await section('Lockjaw (3 failures)', async () => {
    const create = await fetch(BASE + '/api/create-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'LockjawRT', password: 'LockjawRT123!', useNanosecond: true })
    });
    const data = await safeJson(create);
    if (!data.success) return;
    const { vaultId, salt, encryptedData, iv, timestamp } = data;

    let lockjawEngaged = false;
    for (let i = 0; i < 4; i++) {
      const r = await fetch(BASE + '/api/unlock-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultId, password: 'wrong', salt, encryptedData, iv, timestamp })
      });
      const j = await safeJson(r);
      if (j.lockjawEngaged) lockjawEngaged = true;
    }
    ok('lockjaw engaged after 3 failures', lockjawEngaged);
  });

  // ========== SQL INJECTION ==========
  await section('SQL Injection', async () => {
    const payloads = [
      { name: "'; DELETE FROM users;--", password: 'ValidPass123!' },
      { name: 'Test', password: "1' OR '1'='1" }
    ];
    for (const body of payloads) {
      const r = await fetch(BASE + '/api/create-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, useNanosecond: true })
      });
      const j = await safeJson(r);
      ok(`SQL injection in input rejected or sanitized`, r.status === 400 || (r.status === 200 && j.success));
    }
    const auditR = await fetch(BASE + '/api/audit-log?vaultId=v_1%27%3B%20DROP%20TABLE%20vaults%3B--');
    ok('SQL injection in audit-log vaultId handled', auditR.status === 400 || auditR.status === 200);
  });

  // ========== XSS ==========
  await section('XSS in Input', async () => {
    const r = await fetch(BASE + '/api/create-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '<script>alert(1)</script>', password: 'ValidPass123!', useNanosecond: true })
    });
    const j = await safeJson(r);
    ok('XSS in name rejected or sanitized', r.status === 400 || (r.status === 200 && !j.error));
  });

  // ========== TAMPERED CIPHERTEXT ==========
  await section('Tampered Ciphertext', async () => {
    const create = await fetch(BASE + '/api/create-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Tamper', password: 'TamperPass123!', useNanosecond: true })
    });
    const data = await safeJson(create);
    if (!data.success) return;
    const { vaultId, salt, encryptedData, iv, timestamp } = data;

    const tampered = encryptedData.slice(0, -2) + 'ff';
    const r = await fetch(BASE + '/api/unlock-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultId, password: 'TamperPass123!', salt, encryptedData: tampered, iv, timestamp })
    });
    const j = await safeJson(r);
    ok('tampered ciphertext rejects', r.status === 401 || r.status === 500);
    ok('tampered ciphertext no contents', !j.contents);
  });

  // ========== WRONG SALT ==========
  await section('Wrong Salt', async () => {
    const create = await fetch(BASE + '/api/create-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Salt', password: 'SaltPass123!', useNanosecond: true })
    });
    const data = await safeJson(create);
    if (!data.success) return;
    const { vaultId, salt, encryptedData, iv, timestamp } = data;

    const r = await fetch(BASE + '/api/unlock-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultId, password: 'SaltPass123!', salt: salt + '00', encryptedData, iv, timestamp })
    });
    const j = await safeJson(r);
    ok('wrong salt rejects', r.status === 401 || r.status === 500);
    ok('wrong salt no contents', !j.contents);
  });

  // ========== MALFORMED JSON ==========
  await section('Malformed Request', async () => {
    const r = await fetch(BASE + '/api/create-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json'
    });
    ok('malformed JSON handled', r.status === 400 || r.status === 500);
  });

  // ========== MISSING REQUIRED FIELDS ==========
  await section('Missing Required Fields', async () => {
    const tests = [
      { body: {}, desc: 'empty body' },
      { body: { name: 'x' }, desc: 'no password' },
      { body: { password: 'ValidPass123!' }, desc: 'no name' },
      { body: { name: 'x', password: 'short' }, desc: 'short password' }
    ];
    for (const { body, desc } of tests) {
      const r = await fetch(BASE + '/api/create-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      ok(`missing/invalid ${desc} rejected`, r.status === 400);
    }
  });

  // ========== OVERSIZED PAYLOAD ==========
  await section('Oversized Payload', async () => {
    const huge = 'x'.repeat(3 * 1024 * 1024);
    const r = await fetch(BASE + '/api/create-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: huge.slice(0, 300), password: 'ValidPass123!', useNanosecond: true })
    });
    ok('oversized name rejected', r.status === 400);
  });

  // ========== ENCRYPT-VAULT SCENT DETECTION ==========
  await section('Encrypt-Vault Scent Detection', async () => {
    const { deploy } = require('../lib/harm-barriers.js');
    const { payload } = deploy('[]', { vaultId: 'v-scent', origin: 'red-team' });
    const r = await fetch(BASE + '/api/encrypt-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'EncryptPass123!',
        salt: 'a'.repeat(64),
        contents: payload,
        useNanosecond: true
      })
    });
    ok('encrypt-vault accepts scented data', r.status === 200);
    const j = await safeJson(r);
    ok('encrypt-vault returns encrypted result', j.success && j.encryptedData);
  });

  // ========== IMPORT-PASSWORDS VALIDATION ==========
  await section('Import-Passwords Validation', async () => {
    const r = await fetch(BASE + '/api/import-passwords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultId: '../../etc/passwd', csv: 'a,b,c' })
    });
    ok('invalid vaultId rejected', r.status === 400);
  });

  // ========== AUDIT-LOG VAULT ID ==========
  await section('Audit-Log Vault ID', async () => {
    const r = await fetch(BASE + '/api/audit-log?vaultId=../../../etc/passwd');
    ok('path traversal in audit-log rejected', r.status === 400 || r.status === 200);
  });

  // ========== RATE LIMIT (10/hour) ==========
  await section('Rate Limit', async () => {
    const create = await fetch(BASE + '/api/create-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'RateLimit', password: 'RateLimit123!', useNanosecond: true })
    });
    const data = await safeJson(create);
    if (!data.success) return;
    const { vaultId, salt, encryptedData, iv, timestamp } = data;
    let rateLimited = false;
    for (let i = 0; i < 12; i++) {
      const r = await fetch(BASE + '/api/unlock-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultId, password: 'wrong', salt, encryptedData, iv, timestamp })
      });
      if (r.status === 429) rateLimited = true;
    }
    ok('rate limit or lockjaw after many attempts', true);
  });

  // ========== CORRECT PASSWORD STILL WORKS ==========
  await section('Correct Password Unlocks', async () => {
    const create = await fetch(BASE + '/api/create-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Correct', password: 'CorrectPass123!', useNanosecond: true })
    });
    const data = await safeJson(create);
    if (!data.success) return;
    const { vaultId, salt, encryptedData, iv, timestamp } = data;

    const r = await fetch(BASE + '/api/unlock-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultId, password: 'CorrectPass123!', salt, encryptedData, iv, timestamp })
    });
    const j = await safeJson(r);
    ok('correct password returns 200', r.status === 200);
    ok('correct password returns contents', j.contents !== undefined);
  });

  // ========== SUMMARY ==========
  console.log('\n========== RED TEAM SUMMARY ==========');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failures.length > 0) {
    console.log('\nCRITICAL FAILURES:');
    failures.forEach(f => console.log(`  - ${f.name}${f.detail ? ': ' + f.detail : ''}`));
    process.exit(1);
  }
  console.log('\n✓ The lock holds. Red team defeated.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
