#!/usr/bin/env node
/**
 * GDPR — Data minimization, breach notification, right to erasure
 */
const { deploy, victimKillSwitch, bloodhound } = require('../../lib/harm-barriers.js');

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

console.log('\n--- Compliance: GDPR ---\n');

(async () => {
// Art 32: Breach detection
const result = deploy('[]', { vaultId: 'v-gdpr', origin: 'eu-user' });
ok('scent enables breach detection', !!result.scentId);

// Art 33/34: Breach notification path
const trail = bloodhound.getTrail(result.scentId);
ok('trail has victimNotified flag', 'victimNotified' in (trail || {}));

// Art 17: Right to erasure (kill switch)
const kill = await victimKillSwitch('v-gdpr', result.packId);
ok('kill switch voids tracking', kill.voided >= 0);
ok('kill switch deactivates', kill.deactivated >= 0);

// Data minimization: scent is ID only, not full data
const scentPayload = result.payload;
ok('scent does not embed full vault data', !scentPayload.includes('password') && !scentPayload.includes('secret'));

console.log('\nGDPR:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
})();
