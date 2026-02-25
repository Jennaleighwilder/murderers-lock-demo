/**
 * lib/recovery-33gates.js
 * Vault creation/unlock using 33 Gates cryptography
 * Same interface as recovery.js, but key derivation via 33 HMAC gates
 */

const crypto = require('crypto');
const { split, combine } = require('shamirs-secret-sharing');
const gates33 = require('./33-gates-real.js');

function splitSecret(secret) {
  const buf = Buffer.from(secret, 'utf8');
  const shards = split(buf, { shares: 3, threshold: 2 });
  return shards.map(s => s.toString('hex'));
}

function recoverSecret(shardHexes) {
  const shards = shardHexes.map(h => Buffer.from(h, 'hex'));
  const recovered = combine(shards);
  return recovered.toString('utf8');
}

async function createVault(name, password, initialContent = '') {
  const salt = crypto.randomBytes(32);
  const saltHex = salt.toString('hex');
  const { masterKey } = gates33.deriveMasterKey33Gates(password, salt);

  const payload = JSON.stringify({ secrets: initialContent || '' });
  const { encrypted, iv } = gates33.encrypt(masterKey, payload);

  const shards = splitSecret(password);
  const vaultId = 'v_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

  return {
    vaultId,
    name,
    salt: saltHex,
    encryptedData: encrypted,
    iv,
    shards,
    keyDerivation: '33gates'
  };
}

async function unlockVault(password, saltHex, encryptedData, ivHex, options = {}) {
  const { includeGateMetadata = false } = options;
  const { masterKey, witchOrder, gateFrequencies, gatePhases } = gates33.deriveMasterKey33Gates(password, saltHex);

  try {
    const decrypted = gates33.decrypt(masterKey, encryptedData, ivHex);
    const parsed = JSON.parse(decrypted);
    const result = { contents: parsed.secrets || '' };
    if (includeGateMetadata) {
      result.witchOrder = witchOrder;
      result.gateFrequencies = gateFrequencies;
      result.gatePhases = gatePhases;
    }
    return result;
  } catch (err) {
    throw new Error('Invalid password or corrupted vault');
  }
}

async function reEncryptVault(password, saltHex, contents) {
  const { masterKey } = gates33.deriveMasterKey33Gates(password, saltHex);
  const payload = JSON.stringify({ secrets: contents || '' });
  const { encrypted, iv } = gates33.encrypt(masterKey, payload);
  return { encryptedData: encrypted, iv };
}

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
  recoverSecret
};
