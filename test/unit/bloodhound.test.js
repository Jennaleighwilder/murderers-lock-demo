#!/usr/bin/env node
/**
 * Unit: The Bloodhound — Scent survival, detection
 */
const TheBloodhound = require('../../lib/the-bloodhound.js');

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

console.log('\n--- Unit: Bloodhound ---\n');

const { scented, scentId, packId } = TheBloodhound.embedScent('secret-data', { vaultId: 'v1', origin: 'x' });
ok('embedScent returns scented data', !!scented && scented.includes('secret-data'));
ok('scentId generated', !!scentId && scentId.startsWith('scent_'));
ok('packId present', !!packId);

const detected = TheBloodhound.detectScent(scented);
ok('detectScent finds scent', detected === scentId);

const b64 = Buffer.from(scented, 'utf8').toString('base64');
const decoded = Buffer.from(b64, 'base64').toString('utf8');
ok('scent survives base64', TheBloodhound.detectScent(decoded) === scentId);

const json = JSON.stringify({ data: scented });
ok('scent survives JSON', TheBloodhound.detectScent(JSON.parse(json).data) === scentId);

const stripped = TheBloodhound.stripScent(scented);
ok('stripScent removes marker', !TheBloodhound.detectScent(stripped));

const trail = TheBloodhound.getTrail(scentId);
ok('getTrail returns trail', !!trail && trail.victimId === 'v1');

console.log('\nBloodhound:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
