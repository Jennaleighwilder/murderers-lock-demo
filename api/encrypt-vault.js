/**
 * POST /api/encrypt-vault
 * Re-encrypt vault contents (for save)
 * Supports Nanosecond Lock (33 Gates + timestamp) and legacy Argon2id
 */

const { reEncryptVault } = require('../lib/recovery.js');
const { lock } = require('../lib/nanosecond-lock-production.js');
const auditStore = require('./audit-store.js');
const { validatePassword, validateHex, validateContents, validateVaultId } = require('./input-validation.js');
const { detectAndProcess, bloodhound } = require('../lib/harm-barriers.js');

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
    const { password, salt, contents, useNanosecond, vaultId } = req.body || {};
    const contentsStr = typeof contents === 'string' ? contents : (contents ? JSON.stringify(contents) : '');
    const scentId = bloodhound.detectScent(contentsStr);
    if (scentId) {
      await detectAndProcess(contentsStr, { endpoint: 'encrypt-vault', action: 'save' });
    }
    const contentsClean = scentId ? bloodhound.stripScent(contentsStr) : contentsStr;
    const pw = validatePassword(password);
    if (!pw.valid) return res.status(400).json({ error: pw.error });
    const saltV = validateHex(salt, 'Salt');
    if (!saltV.valid) return res.status(400).json({ error: saltV.error });
    const contentsV = validateContents(contentsClean || contents);
    if (!contentsV.valid) return res.status(400).json({ error: contentsV.error });

    if (useNanosecond) {
      const payload = JSON.stringify({ secrets: contentsV.value || '' });
      const locked = await lock(pw.value, payload, saltV.value);
      if (vaultId) await auditStore.append(vaultId, { action: 'save', success: true });
      return res.status(200).json({
        success: true,
        encryptedData: locked.encryptedData,
        iv: locked.iv,
        timestamp: locked.timestamp
      });
    }

    const result = await reEncryptVault(pw.value, saltV.value, contentsV.value || '');
    if (vaultId) await auditStore.append(vaultId, { action: 'save', success: true });

    return res.status(200).json({
      success: true,
      encryptedData: result.encryptedData,
      iv: result.iv
    });
  } catch (err) {
    console.error('encrypt-vault error:', err);
    return res.status(500).json({ error: err.message || 'Failed to encrypt' });
  }
};
