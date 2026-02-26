/**
 * POST /api/webauthn-register-options
 * Generate WebAuthn registration options (challenge)
 */

const { generateRegistrationOptions } = require('@simplewebauthn/server');
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
    const origin = getOrigin(req);
    const rpID = getRpId(origin);
    const userId = (req.body || {}).userId || 'default';

    const existingCreds = getCredentials(userId);

    const options = await generateRegistrationOptions({
      rpName: "The Murderer's Lock",
      rpID: rpID === 'localhost' ? 'localhost' : rpID,
      userID: new TextEncoder().encode(userId),
      userName: userId,
      attestationType: 'none',
      excludeCredentials: existingCreds.map(c => ({ id: c.id })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred'
      }
    });

    setChallenge(userId, options.challenge);

    return res.status(200).json(options);
  } catch (err) {
    console.error('webauthn-register-options error:', err);
    return res.status(500).json({ error: err.message || 'Failed' });
  }
};
