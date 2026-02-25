/**
 * lib/time-lock.js
 * Time-locked recovery: shards become valid only after unlockAfter
 *
 * Usage:
 *   const { encryptWithTimeLock, decryptWithTimeLock } = require('./time-lock');
 *   const locked = encryptWithTimeLock(shards, unlockAfterEpochMs);
 *   const shards = decryptWithTimeLock(locked, Date.now());
 */

const crypto = require('crypto');

const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;

/**
 * Derive key from timestamp + salt (deterministic for given unlockAfter)
 */
function deriveTimeKey(unlockAfterEpochMs, salt) {
  const hmac = crypto.createHmac('sha256', salt);
  hmac.update('time-lock-v1');
  hmac.update(Buffer.from(String(unlockAfterEpochMs), 'utf8'));
  return hmac.digest();
}

/**
 * Encrypt shards with time lock. Valid only after unlockAfterEpochMs.
 * @param {string[]} shards - Plain hex shards
 * @param {number} unlockAfterEpochMs - Unix timestamp (ms) when shards become valid
 * @returns {{ encrypted: string, salt: string, unlockAfter: number }}
 */
function encryptWithTimeLock(shards, unlockAfterEpochMs) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveTimeKey(unlockAfterEpochMs, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const plaintext = JSON.stringify(shards);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([enc, authTag]);
  return {
    encrypted: combined.toString('base64'),
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    unlockAfter: unlockAfterEpochMs
  };
}

/**
 * Decrypt time-locked shards. Throws if unlockAfter not yet reached.
 * @param {{ encrypted: string, salt: string, iv: string, unlockAfter: number }} locked
 * @param {number} nowEpochMs - Current time (default: Date.now())
 * @returns {string[]} Plain hex shards
 */
function decryptWithTimeLock(locked, nowEpochMs = Date.now()) {
  if (nowEpochMs < locked.unlockAfter) {
    throw new Error('TIME_LOCKED');
  }
  const salt = Buffer.from(locked.salt, 'hex');
  const key = deriveTimeKey(locked.unlockAfter, salt);
  const iv = Buffer.from(locked.iv, 'hex');
  const combined = Buffer.from(locked.encrypted, 'base64');
  const authTag = combined.subarray(-16);
  const enc = combined.subarray(0, -16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = decipher.update(enc) + decipher.final('utf8');
  return JSON.parse(plaintext);
}

/**
 * Get remaining ms until unlock
 */
function getRemainingMs(locked) {
  const remaining = locked.unlockAfter - Date.now();
  return Math.max(0, remaining);
}

module.exports = {
  encryptWithTimeLock,
  decryptWithTimeLock,
  getRemainingMs
};
