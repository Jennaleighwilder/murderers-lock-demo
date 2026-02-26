/**
 * POST /api/2fa-status
 * Check if vault has 2FA enabled
 */

const { has } = require('./2fa-store.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { vaultId } = req.body || {};
    const vid = vaultId || 'default';

    const enabled = await has(vid);
    return res.status(200).json({
      success: true,
      vaultId: vid,
      enabled
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to check 2FA status' });
  }
};
