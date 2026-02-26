#!/usr/bin/env node
/**
 * Unit: The Witness — 33 voices, testimony recording
 */
const TheWitness = require('../../lib/the-witness.js');

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

console.log('\n--- Unit: Witness ---\n');

const t = TheWitness.recordTestimony({ endpoint: 'unlock-vault', ip: '1.2.3.4', userAgent: 'Mozilla/5.0' });
ok('recordTestimony returns testimony', !!t && !!t.testimonyId);
ok('testimony has sophistication', !!t.sophistication);
ok('testimony has infrastructure hints', Array.isArray(t.infrastructureHints));

const t2 = TheWitness.recordTestimony({ automationDetected: true });
ok('automation detected → AUTOMATED sophistication', t2.sophistication === 'AUTOMATED');

const sense = TheWitness.witnessSense({ vaultId: 'v1', murderCount: 0 });
ok('witnessSense returns result', sense !== undefined);

const got = TheWitness.getTestimony(t.testimonyId);
ok('getTestimony retrieves testimony', !!got && got.testimonyId === t.testimonyId);

console.log('\nWitness:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
