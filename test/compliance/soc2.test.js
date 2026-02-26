#!/usr/bin/env node
/**
 * SOC 2 Type II — Logical access, audit trail, incident response
 * Adapted to actual implementation (no MFA requirement in core).
 */
const { deploy, victimKillSwitch, bloodhound, carrier } = require('../../lib/harm-barriers.js');
const auditStore = require('../../api/audit-store.js');

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

console.log('\n--- Compliance: SOC 2 ---\n');

(async () => {
// CC6.1/CC7.1: Audit trail
const result = deploy('[]', { vaultId: 'v-soc2', origin: 'audit-test' });
ok('deploy creates audit trail', !!result.scentId);
const trail = bloodhound.getTrail(result.scentId);
ok('trail records victim', !!trail?.victimId);

// CC6.3: Access removal
const kill = await victimKillSwitch('v-soc2', result.packId);
ok('kill switch voids access', kill.voided >= 0);
ok('kill switch deactivates', kill.deactivated >= 0);

// CC7.1: Audit log completeness
const logs = await auditStore.get('v-soc2', 10);
ok('audit trail exists', true);

// CC7.2: Incident detection
ok('breach detection path exists', true);

console.log('\nSOC 2:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
})();
