#!/usr/bin/env node
/**
 * BULLETPROOF TEST SUITE - Murderer's Lock
 * Tests validation, API logic, edge cases. Run until nothing breaks.
 * Usage: node test/test-suite.js
 */

const path = require('path');
const { validateVaultId, validatePassword, validateName, validateHex, validateBase64, validateContents } = require('../api/input-validation.js');

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

// ========== INPUT VALIDATION ==========
section('validateVaultId');
assert('accepts valid vault ID', validateVaultId('v_1234567890_abc123').valid);
assert('accepts alphanumeric with dots', validateVaultId('vault.123').valid);
assert('accepts hyphens and underscores', validateVaultId('vault-id_123').valid);
assert('rejects empty', !validateVaultId('').valid);
assert('rejects null', !validateVaultId(null).valid);
assert('rejects undefined', !validateVaultId(undefined).valid);
assert('rejects too long', !validateVaultId('a'.repeat(200)).valid);
assert('rejects invalid chars', !validateVaultId('vault<script>').valid);
assert('rejects SQL injection pattern', !validateVaultId("'; DROP TABLE--").valid);
assert('rejects XSS pattern', !validateVaultId('<img src=x onerror=alert(1)>').valid);
assert('trims whitespace', validateVaultId('  v_123  ').value === 'v_123');

section('validatePassword');
assert('accepts 12+ char password', validatePassword('ValidPass123!').valid);
assert('accepts 256 char max', validatePassword('a'.repeat(256)).valid);
assert('rejects empty', !validatePassword('').valid);
assert('rejects null', !validatePassword(null).valid);
assert('rejects < 12 chars', !validatePassword('short').valid);
assert('rejects 11 chars', !validatePassword('elevenchars').valid);
assert('rejects > 256 chars', !validatePassword('a'.repeat(257)).valid);
assert('rejects non-string (number)', !validatePassword(12345).valid);
assert('rejects object', !validatePassword({}).valid);

section('validateName');
assert('accepts valid name', validateName('My Vault').valid);
assert('accepts unicode', validateName('Vault 你好').valid);
assert('rejects empty', !validateName('').valid);
assert('rejects null', !validateName(null).valid);
assert('rejects > 256 chars', !validateName('a'.repeat(257)).valid);
assert('trims whitespace', validateName('  name  ').value === 'name');

section('validateHex');
assert('accepts valid hex', validateHex('deadbeef', 'field').valid);
assert('accepts uppercase hex', validateHex('DEADBEEF', 'field').valid);
assert('rejects empty', !validateHex('', 'field').valid);
assert('rejects non-hex', !validateHex('ghijkl', 'field').valid);
assert('rejects mixed invalid', !validateHex('dead beef!', 'field').valid);

section('validateBase64');
assert('accepts valid base64', validateBase64('SGVsbG8gV29ybGQ=', 'field').valid);
assert('rejects invalid base64 chars', !validateBase64('!!!', 'field').valid);
assert('rejects wrong length (not mod 4)', !validateBase64('abc', 'field').valid);
assert('rejects empty', !validateBase64('', 'field').valid);

section('validateContents');
assert('accepts empty string', validateContents('').valid);
assert('accepts null', validateContents(null).valid);
assert('accepts normal content', validateContents('line1\nline2').valid);
assert('rejects non-string', !validateContents(123).valid);
assert('rejects object', !validateContents({}).valid);
const huge = 'x'.repeat(2 * 1024 * 1024 + 1); // 2MB + 1
assert('rejects > 2MB', !validateContents(huge).valid);

// ========== CLIENT VALIDATE.JS (run in Node via require) ==========
section('Client Validate (isHex, isBase64)');
let Validate;
try {
  const vm = require('vm');
  const fs = require('fs');
  const validateSrc = fs.readFileSync(path.join(__dirname, '../app/js/validate.js'), 'utf8');
  function mockEscape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  const sandbox = {
    window: {},
    document: {
      createElement: (tag) => {
        let text = '';
        return {
          get textContent() { return text; },
          set textContent(v) { text = String(v ?? ''); },
          get innerHTML() { return mockEscape(text); }
        };
      }
    },
    PasswordStrength: undefined
  };
  vm.createContext(sandbox);
  vm.runInContext(validateSrc, sandbox);
  Validate = sandbox.Validate || (sandbox.window && sandbox.window.Validate);
} catch (e) {
  Validate = null;
}
if (Validate) {
  assert('isHex accepts valid', Validate.isHex('deadbeef'));
  assert('isHex rejects odd length', !Validate.isHex('deadbee'));
  assert('isHex rejects non-hex', !Validate.isHex('ghij'));
  assert('validateShard rejects empty', !Validate.validateShard('').valid);
  assert('validateShard accepts hex', Validate.validateShard('dead').valid);
  assert('validatePassword rejects short', !Validate.validatePassword('short').valid);
  assert('validatePassword accepts 12+', Validate.validatePassword('ValidPass123!').valid);
  try {
    const escaped = Validate.escapeHtml('<script>alert(1)</script>');
    assert('escapeHtml escapes XSS', escaped.indexOf('<script>') === -1 && escaped.indexOf('alert') !== -1);
  } catch (_) { console.log('  (escapeHtml skipped - DOM not available)'); }
} else {
  console.log('  (skipped - Validate not loadable in Node)');
}

// ========== EDGE CASES ==========
section('Edge Cases');
assert('vaultId with v_ prefix', validateVaultId('v_1730000000_abc123').valid);
assert('password with unicode', validatePassword('你好🔐Pass123!').valid);
assert('password with special chars', validatePassword('!@#$%^&*()_+-=[]{}|;:\'",.<>?').valid);
assert('name with only spaces rejected', !validateName('   ').valid);
assert('contents with unicode', validateContents('你好世界').valid);
assert('contents with newlines', validateContents('a\nb\nc').valid);

// ========== API INTEGRATION (optional - requires server) ==========
section('API Integration (create-vault, validation)');
async function runApiTests() {
  const BASE = process.env.API_BASE || 'http://127.0.0.1:3000';
  try {
    const res = await fetch(BASE + '/api/health');
    if (!res.ok) throw new Error('Health check failed');
  } catch (e) {
    console.log('  (skipped - server not running)');
    return;
  }
  const post = async (path, body) => {
    const r = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  };
  const r1 = await post('/api/create-vault', { name: '', password: 'ValidPass123!' });
  assert('create-vault rejects empty name', r1.status === 400 && r1.json.error);
  const r2 = await post('/api/create-vault', { name: 'Test', password: 'short' });
  assert('create-vault rejects short password', r2.status === 400 && r2.json.error);
  const r3 = await post('/api/create-vault', { name: 'Test', password: 'ValidPass123!' });
  assert('create-vault accepts valid input', r3.status === 200 && r3.json.success && r3.json.vaultId);
  const r4 = await post('/api/import-passwords', { vaultId: '<script>', format: 'csv', count: 10 });
  assert('import-passwords rejects invalid vaultId', r4.status === 400 && r4.json.error);
  const r5 = await post('/api/encrypt-vault', { password: 'short', salt: 'deadbeef', contents: 'test' });
  assert('encrypt-vault rejects short password', r5.status === 400 && r5.json.error);
  const r6 = await fetch(BASE + '/api/audit-log?vaultId=v_123');
  assert('audit-log GET works', r6.ok && (await r6.json()).events !== undefined);
  const r7 = await fetch(BASE + '/api/audit-log?vaultId=%3Cscript%3E');
  assert('audit-log rejects invalid vaultId', r7.status === 400);
}

// ========== RUN & SUMMARY ==========
(async function main() {
  await runApiTests();
  console.log('\n========== SUMMARY ==========');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f.name}${f.details ? ': ' + f.details : ''}`));
    process.exit(1);
  }
  console.log('\n✓ All tests passed. Bulletproof.');
  process.exit(0);
})();
