#!/usr/bin/env node
/**
 * E2E: Create → breach (panic) → detect → kill switch
 */
const { deploy, detectAndProcess, victimKillSwitch, bloodhound, carrier } = require('../../lib/harm-barriers.js');

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

async function main() {
console.log('\n--- E2E: Breach Scenario ---\n');

// 1. Create
const result = deploy('[]', { vaultId: 'v-e2e', origin: 'attacker-ip', endpoint: 'unlock-vault' });
ok('1. deploy', !!result.payload && !!result.scentId);

// 2. Breach (attacker gets payload)
const stolenPayload = result.payload;
ok('2. payload stolen', !!stolenPayload);

// 3. Detect (attacker uses encrypted-vault / import)
const detected = await detectAndProcess(stolenPayload, { endpoint: 'encrypt-vault', name: 'criminal-market' });
ok('3. detect', detected !== null);

// 4. Spread map
const map = carrier.getSpreadMap(result.scentId);
ok('4. spread mapped', !!map && map.detections >= 1);

// 5. Kill switch
const kill = await victimKillSwitch('v-e2e', result.packId);
ok('5. kill switch', kill.voided >= 0 && kill.deactivated >= 0);

// 6. Voided
const trail = bloodhound.getTrail(result.scentId);
ok('6. trail voided', trail?.voided === true);

// 7. No further detection
const afterDetect = await detectAndProcess(stolenPayload, { endpoint: 'encrypt-vault' });
ok('7. no further detection', afterDetect === null);

console.log('\nE2E Breach:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
}

main();
