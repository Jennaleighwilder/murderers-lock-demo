/**
 * POST /api/2fa-verify
 * Verify TOTP code and confirm 2FA is enabled
 */

const { verify } = require('otplib');
const { get } = require('./2fa-store.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { vaultId, code } = req.body || {};
    const vid = vaultId || 'default';

    const stored = await get(vid);
    if (!stored || !stored.secret) {
      return res.status(400).json({ error: '2FA not enabled for this vault. Run setup first.' });
    }

    const valid = await verify({ secret: stored.secret, token: String(code).trim() });
    if (!valid) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    return res.status(200).json({
      success: true,
      vaultId: vid,
      message: '2FA verified and enabled'
    });
  } catch (err) {
    console.error('2fa-verify error:', err);
    return res.status(500).json({ error: err.message || 'Failed to verify 2FA' });
  }
};
