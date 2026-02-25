/**
 * lib/recovery.js
 * Real crypto for Vault Manager: Argon2id + AES-256-GCM + Shamir 2-of-3
 */

const crypto = require('crypto');
const argon2 = require('argon2');
const { split, combine } = require('shamirs-secret-sharing');

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  hashLength: 32
};

/**
 * Derive encryption key from password using Argon2id
 * @param {string} password
 * @param {string} saltHex
 * @returns {Promise<Buffer>}
 */
async function deriveKey(password, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  const hash = await argon2.hash(password, {
    ...ARGON2_OPTIONS,
    salt,
    raw: true
  });
  return Buffer.isBuffer(hash) ? hash : Buffer.from(hash);
}

/**
 * Verify password against stored hash (for unlock)
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  return argon2.verify(hash, password);
}

/**
 * Encrypt data with AES-256-GCM
 * @param {Buffer} key
 * @param {string} plaintext
 * @returns {{ encrypted: string, iv: string }}
 */
function encrypt(key, plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([enc, authTag]);
  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('hex')
  };
}

/**
 * Decrypt data with AES-256-GCM
 * @param {Buffer} key
 * @param {string} encryptedBase64
 * @param {string} ivHex
 * @returns {string}
 */
function decrypt(key, encryptedBase64, ivHex) {
  const iv = Buffer.from(ivHex, 'hex');
  const combined = Buffer.from(encryptedBase64, 'base64');
  const authTag = combined.subarray(-16);
  const enc = combined.subarray(0, -16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(enc) + decipher.final('utf8');
}

/**
 * Split secret into 3 Shamir shards (2 needed to recover)
 * @param {string} secret
 * @returns {string[]} hex-encoded shards
 */
function splitSecret(secret) {
  const buf = Buffer.from(secret, 'utf8');
  const shards = split(buf, { shares: 3, threshold: 2 });
  return shards.map(s => s.toString('hex'));
}

/**
 * Recover secret from 2+ Shamir shards
 * @param {string[]} shardHexes
 * @returns {string}
 */
function recoverSecret(shardHexes) {
  const shards = shardHexes.map(h => Buffer.from(h, 'hex'));
  const recovered = combine(shards);
  return recovered.toString('utf8');
}

/**
 * Create a new vault: derive key, encrypt, generate Shamir shards
 * @param {string} name
 * @param {string} password
 * @param {string} [initialContent]
 * @returns {Promise<{vaultId: string, name: string, salt: string, encryptedData: string, iv: string, shards: string[]}>}
 */
async function createVault(name, password, initialContent = '') {
  const salt = crypto.randomBytes(32);
  const saltHex = salt.toString('hex');
  const key = await deriveKey(password, saltHex);

  const payload = JSON.stringify({ secrets: initialContent || '' });
  const { encrypted, iv } = encrypt(key, payload);

  const shards = splitSecret(password);

  const vaultId = 'v_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

  return {
    vaultId,
    name,
    salt: saltHex,
    encryptedData: encrypted,
    iv,
    shards
  };
}

/**
 * Re-encrypt vault contents (for save)
 * @param {string} password
 * @param {string} saltHex
 * @param {string} contents
 * @returns {Promise<{encryptedData: string, iv: string}>}
 */
async function reEncryptVault(password, saltHex, contents) {
  const key = await deriveKey(password, saltHex);
  const payload = JSON.stringify({ secrets: contents || '' });
  const { encrypted, iv } = encrypt(key, payload);
  return { encryptedData: encrypted, iv };
}

/**
 * Unlock vault: verify password, decrypt contents
 * @param {string} password
 * @param {string} saltHex
 * @param {string} encryptedData
 * @param {string} ivHex
 * @returns {Promise<{contents: string}>}
 */
async function unlockVault(password, saltHex, encryptedData, ivHex) {
  const key = await deriveKey(password, saltHex);
  try {
    const decrypted = decrypt(key, encryptedData, ivHex);
    const parsed = JSON.parse(decrypted);
    return { contents: parsed.secrets || '' };
  } catch (err) {
    throw new Error('Invalid password or corrupted vault');
  }
}

/**
 * Recover password from Shamir shards
 * @param {string[]} shards
 * @returns {{password: string}}
 */
function recoverFromShards(shards) {
  if (!shards || shards.length < 2) {
    throw new Error('At least 2 shards required');
  }
  const password = recoverSecret(shards.slice(0, 2));
  return { password };
}

module.exports = {
  createVault,
  unlockVault,
  reEncryptVault,
  recoverFromShards,
  splitSecret,
  recoverSecret,
  deriveKey,
  encrypt,
  decrypt
};
