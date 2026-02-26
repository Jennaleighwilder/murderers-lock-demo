#!/usr/bin/env node
/**
 * Red-Team Attack Simulation Suite
 * Run: npm run test:redteam
 *
 * Modes:
 *   lite (default) — deterministic tests only, no env vars required
 *   full          — all tests, REDTEAM_VAULT_ID + REDTEAM_PASSWORD required
 *   webauthn      — requires REDTEAM_WEBAUTHN_TOKEN for WebAuthn tests
 */

const { requireEnv, MODE } = require('./_config');
const { writeReport } = require('./_report');

const ALL_TESTS = [
  require('./attack_device_register_without_token.test'),
  require('./attack_device_register_token_reuse.test'),
  require('./attack_rate_limit_distributed.test'),
  require('./attack_kdf_type_mismatch.test'),
  require('./attack_prod_fail_closed_ratelimit.test'),
  require('./attack_webauthn_token_reuse.test'),
  require('./attack_webauthn_wrong_vault_binding.test'),
  require('./attack_webauthn_no_downgrade.test'),
];

const LITE_ONLY = ['attack_device_register_without_token', 'attack_kdf_type_mismatch', 'attack_prod_fail_closed_ratelimit'];

function getTests() {
  if (MODE === 'lite') {
    return ALL_TESTS.filter(t => LITE_ONLY.includes(t.name));
  }
  return ALL_TESTS;
}

(async () => {
  try {
    requireEnv();
  } catch (e) {
    console.error('❌', e.message);
    console.error('For lite mode: no env vars needed. For full mode: set REDTEAM_VAULT_ID and REDTEAM_PASSWORD.');
    process.exit(1);
  }

  const tests = getTests();
  const results = [];
  let failed = 0;

  for (const t of tests) {
    try {
      const r = await t.run();
      results.push({ ...r, passed: true });
    } catch (e) {
      failed++;
      results.push({
        name: t.name,
        goal: t.goal,
        expected: t.expected,
        observed: e?.message || String(e),
        traceFile: e?.traceFile,
        passed: false,
      });
    }
  }

  const passed = results.length - failed;
  const report = { tests: results, failed, passed, mode: MODE };
  writeReport(report);

  if (failed) {
    console.error(`❌ Red-team failed: ${failed} test(s)`);
    process.exit(1);
  }
  console.log(`✅ Red-team passed: ${passed} tests (mode: ${MODE})`);
})();
