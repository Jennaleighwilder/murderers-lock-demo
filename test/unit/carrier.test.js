#!/usr/bin/env node
/**
 * Unit: The Carrier — Spread, canary, network mapping
 */
const TheCarrier = require('../../lib/the-carrier.js');

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

console.log('\n--- Unit: Carrier ---\n');

const { payload, strainId, canaryHash } = TheCarrier.createCarrier('data', { vaultId: 'v1', origin: 'a', scentId: 's1' });
ok('createCarrier returns payload', !!payload);
ok('strainId present', !!strainId);
ok('canary embedded', !!canaryHash);

const c1 = TheCarrier.createCarrier('x', { origin: 'buyer-a', scentId: 's2' });
const c2 = TheCarrier.createCarrier('x', { origin: 'buyer-b', scentId: 's2' });
const hash1 = TheCarrier.detectCanary(c1.payload);
const hash2 = TheCarrier.detectCanary(c2.payload);
ok('different origins → different canaries', hash1 !== hash2);

const stripped = TheCarrier.stripCanary(c1.payload);
ok('stripCanary removes canary', !TheCarrier.detectCanary(stripped));

const fp = TheCarrier.embedRecipientMarker('recipient-1', 'scent');
ok('embedRecipientMarker returns hash', !!fp && fp.length === 16);

const { payload: canaryPayload } = TheCarrier.createCanaryPayload('base', 'fp', 'scent');
ok('createCanaryPayload embeds canary', TheCarrier.detectCanary(canaryPayload));

console.log('\nCarrier:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
