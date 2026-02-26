/**
 * POST /api/webauthn-status
 * Check if user has WebAuthn credentials
 */

const { hasCredential } = require('./webauthn-store.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = (req.body || {}).userId || 'default';
  return res.status(200).json({ success: true, enabled: hasCredential(userId) });
};
