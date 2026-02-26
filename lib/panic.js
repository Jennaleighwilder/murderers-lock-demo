/**
 * Panic/duress code verification.
 * Hash must match stored panic_hash.
 */

const crypto = require('crypto');

function hashPanic(code) {
  return crypto.scryptSync(code, 'panic-salt', 64).toString('hex');
}

function verifyPanic(code, storedHash) {
  if (!code || !storedHash) return false;
  const h = hashPanic(code);
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(storedHash, 'hex'));
}

module.exports = { hashPanic, verifyPanic };
