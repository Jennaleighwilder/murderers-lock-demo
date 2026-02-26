#!/usr/bin/env node
/**
 * Integration: Harm barriers — deploy, detect, kill switch
 */
const { deploy, detectAndProcess, victimKillSwitch, bloodhound, carrier } = require('../../lib/harm-barriers.js');

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

console.log('\n--- Integration: Barriers ---\n');

(async () => {
const result = deploy('[]', { vaultId: 'v-int', origin: '1.2.3.4', endpoint: 'unlock-vault' });
ok('deploy returns payload', !!result.payload);
ok('deploy returns scentId', !!result.scentId);
ok('deploy returns packId', !!result.packId);
ok('payload contains scent', bloodhound.detectScent(result.payload) === result.scentId);
ok('payload contains canary', !!carrier.detectCanary(result.payload));

const processed = await detectAndProcess(result.payload, { endpoint: 'encrypt-vault', name: 'loc1' });
ok('detectAndProcess finds scent', processed !== null);

const map = carrier.getSpreadMap(result.scentId);
ok('spread map exists', !!map);
ok('spread has detections', map?.detections >= 1);

const kill = await victimKillSwitch('v-int', result.packId);
ok('kill switch returns voided', typeof kill.voided === 'number');
ok('kill switch returns deactivated', typeof kill.deactivated === 'number');

const trail = bloodhound.getTrail(result.scentId);
ok('trail voided after kill', trail?.voided === true);

const afterKill = await detectAndProcess(result.payload, { endpoint: 'encrypt-vault' });
ok('detectAndProcess returns null for voided scent', afterKill === null || !afterKill?.trail);

console.log('\nBarriers Integration:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
})();
