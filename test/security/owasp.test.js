#!/usr/bin/env node
/**
 * OWASP Top 10 — Injection, XSS, broken auth
 */
const { validateVaultId, validatePassword, validateName } = require('../../api/input-validation.js');

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

console.log('\n--- Security: OWASP ---\n');

// A03: Injection
const sqlInjection = validateVaultId("'; DROP TABLE vaults;--");
ok('SQL injection in vaultId rejected', !sqlInjection.valid);

// A03: XSS
const xssName = validateName('<script>alert(1)</script>');
ok('XSS in name rejected or sanitized', !xssName.valid || !xssName.value?.includes('<script>'));

// A07: Auth
const shortPw = validatePassword('short');
ok('short password rejected', !shortPw.valid);

const validPw = validatePassword('ValidPassword123!');
ok('valid password accepted', validPw.valid);

// Path traversal
const pathTraversal = validateVaultId('../../../etc/passwd');
ok('path traversal rejected', !pathTraversal.valid);

console.log('\nOWASP:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
