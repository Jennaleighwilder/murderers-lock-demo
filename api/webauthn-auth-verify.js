/**
 * POST /api/webauthn-auth-verify
 * Verify WebAuthn authentication. If sessionId provided (from unlock flow), return vault contents.
 */

const { verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { getChallenge, getCredentials, setCredential } = require('./webauthn-store.js');
const webauthnSessions = require('./webauthn-unlock-sessions.js');

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
    const { assertion, userId, sessionId } = req.body || {};
    const uid = userId || 'default';

    const expectedChallenge = getChallenge(uid);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Authentication expired. Try again.' });
    }

    const creds = getCredentials(uid);
    const cred = creds.find(c => c.id === assertion.id);
    if (!cred) {
      return res.status(401).json({ error: 'Unknown credential' });
    }

    const origin = getOrigin(req);
    const rpID = getRpId(origin);

    const pk = cred.publicKey;
    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID === 'localhost' ? 'localhost' : rpID,
      authenticator: {
        credentialID: Buffer.from(cred.id, 'base64url'),
        credentialPublicKey: pk instanceof Uint8Array ? pk : new Uint8Array(pk),
        counter: cred.counter
      }
    });

    if (!verification.verified) {
      return res.status(401).json({ error: 'Verification failed' });
    }

    if (verification.authenticationInfo) {
      cred.counter = verification.authenticationInfo.newCounter;
    }

    if (sessionId) {
      const contents = webauthnSessions.consume(sessionId);
      if (!contents) return res.status(400).json({ error: 'Session expired. Unlock again.' });
      return res.status(200).json({ success: true, contents });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('webauthn-auth-verify error:', err);
    return res.status(500).json({ error: err.message || 'Verification failed' });
  }
};
