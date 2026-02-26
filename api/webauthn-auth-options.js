/**
 * POST /api/webauthn-auth-options
 * Generate WebAuthn authentication options (challenge)
 */

const { generateAuthenticationOptions } = require('@simplewebauthn/server');
const { setChallenge, getCredentials } = require('./webauthn-store.js');

function getOrigin(req) {
  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';
  if (origin) return new URL(origin).origin;
  return 'https://localhost';
}

function getRpId(origin) {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' ? 'localhost' : host;
  } catch (_) {
    return 'localhost';
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = (req.body || {}).userId || 'default';
    const creds = getCredentials(userId);

    if (creds.length === 0) {
      return res.status(400).json({ error: 'No security keys registered' });
    }

    const origin = getOrigin(req);
    const rpID = getRpId(origin);

    const options = await generateAuthenticationOptions({
      rpID: rpID === 'localhost' ? 'localhost' : rpID,
      allowCredentials: creds.map(c => ({
        id: c.id,
        transports: c.transports
      }))
    });

    setChallenge(userId, options.challenge);

    return res.status(200).json(options);
  } catch (err) {
    console.error('webauthn-auth-options error:', err);
    return res.status(500).json({ error: err.message || 'Failed' });
  }
};
