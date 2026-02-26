/**
 * lib/device-keys.js
 * Cryptographic device binding: verify ECDSA P-256 signatures.
 * Client signs challenge (vaultId:timestamp) with device private key.
 * Server verifies with stored public key.
 */

const crypto = require('crypto');

const CHALLENGE_MAX_AGE_SEC = 5 * 60; // 5 min

/**
 * Verify device signature over challenge.
 * @param {string} publicKeyBase64 - SPKI public key, base64
 * @param {string} challenge - "vaultId:timestampSec"
 * @param {string} signatureBase64 - ECDSA P-256 signature, base64
 * @returns {boolean}
 */
function verifyDeviceSignature(publicKeyBase64, challenge, signatureBase64) {
  if (!publicKeyBase64 || !challenge || !signatureBase64) return false;
  try {
    const keyBuf = Buffer.from(publicKeyBase64, 'base64');
    const sigBuf = Buffer.from(signatureBase64, 'base64');
    const key = crypto.createPublicKey({
      key: keyBuf,
      format: 'der',
      type: 'spki'
    });
    return crypto.verify('sha256', Buffer.from(challenge, 'utf8'), key, sigBuf);
  } catch (_) {
    return false;
  }
}

/**
 * Validate challenge is recent and matches vaultId.
 * @param {string} challenge - "vaultId:timestampSec"
 * @param {string} vaultId
 * @returns {boolean}
 */
function validateChallenge(challenge, vaultId) {
  if (!challenge || typeof challenge !== 'string') return false;
  const parts = challenge.split(':');
  if (parts.length !== 2) return false;
  const [cid, tsStr] = parts;
  if (cid !== vaultId) return false;
  const ts = parseInt(tsStr, 10);
  if (isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) <= CHALLENGE_MAX_AGE_SEC;
}

/**
 * Build challenge string for client to sign.
 * @param {string} vaultId
 * @returns {string} vaultId:timestampSec
 */
function buildChallenge(vaultId) {
  return `${vaultId}:${Math.floor(Date.now() / 1000)}`;
}

module.exports = {
  verifyDeviceSignature,
  validateChallenge,
  buildChallenge,
  CHALLENGE_MAX_AGE_SEC
};
