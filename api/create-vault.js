/**
 * POST /api/create-vault
 * Create new vault: Nanosecond Lock (33 Gates + timestamp) or legacy Argon2id
 */

const { createVault, splitSecret } = require('../lib/recovery.js');
const auditStore = require('./audit-store.js');
const { lock } = require('../lib/nanosecond-lock-production.js');
const crypto = require('crypto');
const { validatePassword, validateName } = require('./input-validation.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, password, useNanosecond } = req.body || {};
    const nameV = validateName(name);
    if (!nameV.valid) return res.status(400).json({ error: nameV.error });
    const pw = validatePassword(password);
    if (!pw.valid) return res.status(400).json({ error: pw.error });

    if (useNanosecond) {
      const payload = JSON.stringify({ secrets: '' });
      const locked = await lock(pw.value, payload);
      const vaultId = 'v_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
      const shards = splitSecret(password);
      await auditStore.append(vaultId, { action: 'create', success: true, name: nameV.value });

      return res.status(200).json({
        success: true,
        vaultId,
        name: nameV.value,
        salt: locked.salt,
        encryptedData: locked.encryptedData,
        iv: locked.iv,
        timestamp: locked.timestamp,
        shards,
        gates: locked.gates
      });
    }

    const result = await createVault(nameV.value, pw.value, '');
    await auditStore.append(result.vaultId, { action: 'create', success: true, name: result.name });

    return res.status(200).json({
      success: true,
      vaultId: result.vaultId,
      name: result.name,
      salt: result.salt,
      encryptedData: result.encryptedData,
      iv: result.iv,
      shards: result.shards
    });
  } catch (err) {
    console.error('create-vault error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create vault' });
  }
};
