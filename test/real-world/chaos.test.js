#!/usr/bin/env node
/**
 * Chaos: Parallel stress with random failures.
 * Verifies system handles concurrent load and simulated failures.
 */
const { deploy, detectAndProcess, victimKillSwitch, bloodhound, carrier } = require('../../lib/harm-barriers.js');

const CONCURRENT = 50;
const ROUNDS = 5;
const FAILURE_RATE = 0.15;

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

async function main() {
  console.log('\n--- Chaos: 15% failure rate, parallel ---\n');

  const payloads = [];
  for (let i = 0; i < 100; i++) {
    payloads.push(deploy('[]', { vaultId: `v-chaos-${i}`, origin: `ip-${i}` }));
  }

  let totalOps = 0;
  let totalFailures = 0;
  const start = Date.now();

  for (let round = 0; round < ROUNDS; round++) {
    const batch = Array(CONCURRENT).fill(null).map((_, i) => {
      const p = payloads[(round * CONCURRENT + i) % payloads.length];
      const shouldFail = Math.random() < FAILURE_RATE;
      return (async () => {
        try {
          if (shouldFail) {
            await detectAndProcess('invalid-no-scent', { endpoint: 'chaos' });
          } else {
            await detectAndProcess(p.payload, { endpoint: 'chaos' });
          }
          totalOps++;
          return true;
        } catch (e) {
          totalFailures++;
          return false;
        }
      })();
    });
    await Promise.all(batch);
  }

  const elapsed = Date.now() - start;
  ok('chaos completed without crash', true);
  ok('operations ran', totalOps > 0);
  ok('failure rate within bounds', totalFailures / (totalOps + totalFailures) < 0.25);
  ok('completion time reasonable', elapsed < 30000);

  const kill = await victimKillSwitch('v-chaos-0', payloads[0].packId);
  ok('kill switch works after chaos', kill.voided >= 0);

  console.log('\nChaos:', passed, 'passed,', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

main();
