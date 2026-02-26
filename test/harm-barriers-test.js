/**
 * Harm Barriers Integration Test
 * Verify end-to-end harm prevention.
 */

const { deploy, detectAndProcess, victimKillSwitch, bloodhound, carrier } = require('../lib/harm-barriers.js');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) { passed++; console.log('  ✓', name); return; }
  failed++; console.log('  ✗', name);
}

async function run(name, fn) {
  try {
    await fn();
  } catch (e) {
    failed++; console.log('  ✗', name, '-', e.message);
  }
}

async function main() {
  console.log('\n--- Harm Barriers ---\n');

  await run('Witness records testimony on breach', () => {
    const result = deploy('[]', { vaultId: 'test-vault', origin: '1.2.3.4', endpoint: 'unlock-vault' });
    ok('deploy returns payload', !!result.payload);
    ok('deploy returns scentId', !!result.scentId);
    ok('deploy returns packId', !!result.packId);
    ok('testimony recorded', !!result.testimonyId);
  });

  await run('Bloodhound scent survives transformation', () => {
    const { scented } = bloodhound.embedScent('secret', { vaultId: 'v1', origin: 'x' });
    const b64 = Buffer.from(scented, 'utf8').toString('base64');
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    ok('survives base64', bloodhound.detectScent(decoded) !== null);

    const json = JSON.stringify({ data: scented });
    const parsed = JSON.parse(json);
    ok('survives JSON serialization', bloodhound.detectScent(parsed.data) !== null);

    const trimmed = scented.trim();
    ok('survives trim', bloodhound.detectScent(trimmed) !== null);
  });

  await run('Carrier maps spread through generations', async () => {
    const { payload, scentId } = deploy('[]', { vaultId: 'v2', origin: 'y' });
    await detectAndProcess(payload, { endpoint: 'encrypt-vault', name: 'loc1' });
    await detectAndProcess(payload, { endpoint: 'import-passwords', name: 'loc2' });
    const map = carrier.getSpreadMap(scentId);
    ok('spread map exists', !!map);
    ok('detections >= 2', map && map.detections >= 2);
  });

  await run('Canary trap: per-recipient variation detects resale', () => {
    const { payload: p1 } = deploy('[]', { vaultId: 'v-canary', origin: 'buyer-a' });
    const { payload: p2 } = deploy('[]', { vaultId: 'v-canary', origin: 'buyer-b' });
    const c1 = carrier.detectCanary(p1);
    const c2 = carrier.detectCanary(p2);
    ok('canary embedded in payload', c1 && c2);
    ok('different origins produce different canaries', c1 !== c2);
  });

  await run('Deploy returns within 100ms', () => {
    const start = Date.now();
    for (let i = 0; i < 10; i++) deploy('[]', { vaultId: `v${i}`, origin: 'z' });
    const elapsed = Date.now() - start;
    ok('10 deploys < 500ms total', elapsed < 500);
  });

  await run('Kill switch voids all scent', async () => {
    const { payload, scentId, packId } = deploy('[]', { vaultId: 'v3', origin: 'k' });
    ok('scent active before kill', bloodhound.getTrail(scentId) && !bloodhound.getTrail(scentId).voided);

    await victimKillSwitch('v3', packId);

    ok('scent voided after kill', bloodhound.getTrail(scentId)?.voided === true);
    const afterDetect = await detectAndProcess(payload, { endpoint: 'encrypt-vault' });
    ok('processFind returns null for voided scent', afterDetect === null || !afterDetect?.trail);
  });

  await run('Deactivated carrier ignores new spread', async () => {
    const { payload, scentId } = deploy('[]', { vaultId: 'v4', origin: 'd' });
    await victimKillSwitch('v4', scentId);
    const result = await detectAndProcess(payload, { endpoint: 'encrypt-vault' });
    ok('observeSpread returns null for deactivated strain', result === null);
  });

  console.log('\n========== HARM BARRIERS SUMMARY ==========');
  console.log('Passed:', passed);
  console.log('Failed:', failed);
  console.log(failed === 0 ? '\n✓ All harm barrier tests passed.' : '\n✗ Some tests failed.');
  process.exit(failed > 0 ? 1 : 0);
}

main();
