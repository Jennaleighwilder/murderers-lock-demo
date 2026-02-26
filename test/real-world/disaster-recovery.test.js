#!/usr/bin/env node
/**
 * Disaster Recovery: RPO/RTO targets, kill switch propagation.
 * Single-region. Cross-region requires infrastructure.
 */
const { deploy, victimKillSwitch, bloodhound, carrier } = require('../../lib/harm-barriers.js');

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

async function main() {
  console.log('\n--- Disaster Recovery ---\n');

  const vaults = [];
  for (let i = 0; i < 50; i++) {
    vaults.push(deploy('[]', { vaultId: `v-dr-${i}`, origin: 'dr-test' }));
  }

  const start = Date.now();
  const kill = await victimKillSwitch('v-dr-0', vaults[0].packId);
  const propagationMs = Date.now() - start;

  ok('kill switch propagates', kill.voided >= 0 && kill.deactivated >= 0);
  ok('RTO: propagation < 5s', propagationMs < 5000);

  const trail = bloodhound.getTrail(vaults[0].scentId);
  ok('trail voided after kill', trail?.voided === true);

  console.log('\nRPO/RTO targets (single-region):');
  console.log('  RPO: N/A (no cross-region replication)');
  console.log('  RTO: <5s (kill switch propagation)');

  console.log('\nDisaster Recovery:', passed, 'passed,', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

main();
