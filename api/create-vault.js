/**
 * POST /api/create-vault
 * Create new vault with Argon2id + AES-256-GCM + Shamir 2-of-3 shards
 */

const { createVault } = require('../lib/recovery.js');

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
    const { name, password } = req.body || {};
    if (!name || !password || typeof name !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Name and password required' });
    }
    if (password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters' });
    }

    const result = await createVault(name.trim(), password, '');

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
