/**
 * POST /api/encrypt-vault
 * Re-encrypt vault contents (for save)
 */

const { reEncryptVault } = require('../lib/recovery.js');

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
    const { password, salt, contents } = req.body || {};
    if (!password || !salt) {
      return res.status(400).json({ error: 'Password and salt required' });
    }

    const result = await reEncryptVault(password, salt, contents || '');

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
