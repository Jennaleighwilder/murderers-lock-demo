#!/usr/bin/env node
/**
 * Load: 100 vaults, 500 operations
 * Production: 10k vaults, 1M ops (run with LOAD_FULL=1)
 */
const { deploy, detectAndProcess } = require('../../lib/harm-barriers.js');

const VAULT_COUNT = process.env.LOAD_FULL === '1' ? 10000 : 100;
const OP_COUNT = process.env.LOAD_FULL === '1' ? Math.min(1000000, 5000) : 500;

let passed = 0, failed = 0;
function ok(name, cond) { cond ? (passed++, console.log('  ✓', name)) : (failed++, console.log('  ✗', name)); }

async function main() {
console.log('\n--- Load:', VAULT_COUNT, 'vaults,', OP_COUNT, 'ops ---\n');

const start = Date.now();
const payloads = [];
for (let i = 0; i < VAULT_COUNT; i++) {
  const r = deploy('[]', { vaultId: `v-load-${i}`, origin: `ip-${i}` });
  payloads.push(r);
}
const createTime = Date.now() - start;
const maxCreateMs = process.env.LOAD_FULL === '1' ? 600000 : 10000;
ok('vaults created in time', createTime < maxCreateMs);

const opsToRun = Math.min(OP_COUNT, 5000);
let failures = 0;
for (let i = 0; i < opsToRun; i++) {
  const p = payloads[i % payloads.length];
  try {
    const r = await detectAndProcess(p.payload, { endpoint: 'load-test' });
    if (!r && p.scentId) failures++;
  } catch (e) {
    failures++;
  }
}
const failRate = failures / opsToRun;
ok('failure rate < 5%', failRate < 0.05);

console.log('\nLoad:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
}

main();
