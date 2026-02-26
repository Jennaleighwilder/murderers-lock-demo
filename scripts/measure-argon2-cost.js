/**
 * scripts/measure-argon2-cost.js
 * Measures Argon2id cost for vault path (matches lib/recovery.js exactly).
 * Run: node scripts/measure-argon2-cost.js
 * Output: attempts/sec for your hardware → use in cracking-cost table.
 */

const argon2 = require('argon2');
const crypto = require('crypto');

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  hashLength: 32
};

async function measure() {
  const salt = crypto.randomBytes(32);
  const password = 'test-password-123';
  const iterations = 5;

  console.log('Measuring Argon2id (64 MiB, t=3, p=4) — matches lib/recovery.js\n');

  const start = Date.now();
  for (let i = 0; i < iterations; i++) {
    await argon2.hash(password, { ...ARGON2_OPTIONS, salt, raw: true });
  }
  const elapsed = (Date.now() - start) / 1000;
  const perSec = iterations / elapsed;

  console.log(`  ${iterations} hashes in ${elapsed.toFixed(2)}s`);
  console.log(`  ≈ ${perSec.toFixed(2)} attempts/sec (single-thread)\n`);

  const keyspace = Math.pow(62, 8);
  const halfKeyspace = keyspace / 2;

  console.log('--- Cracking-cost table (8-char alphanumeric) ---');
  console.log('Keyspace: 62^8 ≈ 2.18 × 10^14 | Expected guesses ≈ 1.09 × 10^14\n');

  const scenarios = [
    { label: 'Your measured CPU (1 thread)', rate: perSec },
    { label: '10× parallel CPU', rate: perSec * 10 },
    { label: '100× (e.g. 100 cores)', rate: perSec * 100 },
    { label: '1,000 attempts/sec', rate: 1000 },
    { label: '10,000 attempts/sec', rate: 10000 },
    { label: '100,000 attempts/sec', rate: 100000 }
  ];

  for (const s of scenarios) {
    const years = halfKeyspace / s.rate / (365.25 * 24 * 3600);
    const str = years < 1 ? (years * 365).toFixed(0) + ' days' : years.toFixed(1) + ' years';
    console.log(`  ${s.label}: ${str}`);
  }
}

measure().catch(console.error);
