/**
 * POST /api/2fa-setup
 * Generate TOTP secret for vault, return QR code data URL
 */

const { generateSecret, generateURI } = require('otplib');
const QRCode = require('qrcode');
const { set } = require('./2fa-store.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { vaultId } = req.body || {};
    const vid = vaultId || 'default';

    const secret = generateSecret();
    await set(vid, { secret });

    const otpauth = generateURI({ issuer: "The Murderer's Lock", label: 'user', secret });
    const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 200, margin: 2 });

    return res.status(200).json({
      success: true,
      secret,
      qrDataUrl,
      vaultId: vid
    });
  } catch (err) {
    console.error('2fa-setup error:', err);
    return res.status(500).json({ error: err.message || 'Failed to setup 2FA' });
  }
};
