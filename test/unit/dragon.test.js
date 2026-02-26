#!/usr/bin/env node
/**
 * Unit: The Dragon — Grey zones, fire, honey vault
 */
const TheDragon = require('../../lib/the-dragon.js');

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

console.log('\n--- Unit: Dragon ---\n');

const guard = TheDragon.guardHoard('v1', 'vault-1', { incidentId: 'i1' });
ok('guardHoard returns guarded', guard.guarded === true);

const honey = TheDragon.openHoneyVault({ incidentId: 'i1', origin: 'attacker' });
ok('openHoneyVault returns honey', !!honey);
ok('honey has cryptoWallets', Array.isArray(honey.cryptoWallets));
ok('honey has credentials', Array.isArray(honey.credentials));
ok('honey has _meta traceId', !!honey._meta?.traceId);

const creds = TheDragon.generateFireCredentials({ origin: 'x' }, 'trace123');
ok('generateFireCredentials returns array', Array.isArray(creds));

const enhanced = TheDragon.embedPursuitIncentives('payload', 'inc-1');
ok('embedPursuitIncentives adds marker', enhanced.includes('dragon:pursuit'));

TheDragon.recordThreat('inc-1', { tone: 7, condition: 'BULK' }, 'forum');
const threat = TheDragon.getThreat('inc-1');
ok('recordThreat stores threat', !!threat && threat.songs?.length > 0);

const status = TheDragon.getHoardStatus('v1', 'vault-1');
ok('getHoardStatus returns guarded', status?.status === 'GUARDED');

console.log('\nDragon:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
