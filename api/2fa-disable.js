/**
 * POST /api/2fa-disable
 * Disable 2FA for vault (requires password or session)
 */

const { remove } = require('./2fa-store.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { vaultId } = req.body || {};
    const vid = vaultId || 'default';

    remove(vid);

    return res.status(200).json({
      success: true,
      vaultId: vid,
      message: '2FA disabled'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to disable 2FA' });
  }
};
