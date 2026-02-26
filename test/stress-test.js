#!/usr/bin/env node
/**
 * STRESS TEST - Run test suite N times. Break things.
 * Usage: node test/stress-test.js [N]
 */
const { spawn } = require('child_process');
const N = parseInt(process.argv[2] || '5', 10);

console.log(`\n🔥 STRESS TEST: Running test suite ${N} times...\n`);

let run = 0;
let failed = 0;

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn('node', ['test/test-suite.js'], {
      cwd: __dirname + '/..',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => {
      run++;
      if (code !== 0) {
        failed++;
        console.log(`Run ${run}/${N}: FAILED`);
        if (err) console.log(err);
      } else {
        process.stdout.write(`Run ${run}/${N}: OK\r`);
      }
      resolve(code);
    });
  });
}

async function main() {
  for (let i = 0; i < N; i++) {
    await runOnce();
  }
  console.log(`\n\n========== STRESS RESULT ==========`);
  console.log(`Runs: ${run}, Passed: ${run - failed}, Failed: ${failed}`);
  if (failed > 0) {
    console.log('\n❌ Stress test FAILED. Fix and retest.');
    process.exit(1);
  }
  console.log('\n✓ Bulletproof. All runs passed.');
  process.exit(0);
}

main();
