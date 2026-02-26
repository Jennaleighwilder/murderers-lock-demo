/**
 * POST /api/webauthn-register-verify
 * Verify WebAuthn registration response, store credential
 */

const { verifyRegistrationResponse } = require('@simplewebauthn/server');
const { getChallenge, setCredential } = require('./webauthn-store.js');

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
    const { credential, userId } = req.body || {};
    const uid = userId || 'default';

    const expectedChallenge = getChallenge(uid);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Registration expired. Try again.' });
    }

    const origin = getOrigin(req);
    const rpID = getRpId(origin);

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID === 'localhost' ? 'localhost' : rpID
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    const id = Buffer.from(credentialID).toString('base64url');
    const pk = credentialPublicKey instanceof Uint8Array ? credentialPublicKey : new Uint8Array(credentialPublicKey);
    setCredential(uid, {
      id,
      publicKey: Buffer.from(pk),
      counter: counter || 0
    });

    return res.status(200).json({
      success: true,
      message: 'Security key registered'
    });
  } catch (err) {
    console.error('webauthn-register-verify error:', err);
    return res.status(500).json({ error: err.message || 'Verification failed' });
  }
};
