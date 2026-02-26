/**
 * Vault-scoped WebAuthn passkeys — 4 endpoints
 * POST /api/webauthn/register/options
 * POST /api/webauthn/register/verify
 * POST /api/webauthn/auth/options
 * POST /api/webauthn/auth/verify
 *
 * Elite: userVerification required, challenge_hash only, atomic consume, counter monotonicity
 */

const url = require('url');
const crypto = require('crypto');
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const webauthnStore = require('../lib/webauthn-vault-store.js');
const webauthnSessions = require('./webauthn-session-tokens.js');
const deviceRegSessions = require('./device-registration-sessions.js');
const { hasSupabase } = require('../lib/supabase.js');

function getOrigin(req) {
  return webauthnStore.getOrigin(req);
}

function getRpId(origin) {
  return webauthnStore.getRpId(origin);
}

async function handleRegisterOptions(req, res) {
  if (!hasSupabase()) {
    return res.status(503).json({ error: 'WebAuthn requires database', message: 'Supabase not configured.' });
  }
  const { vaultId, deviceRegistrationToken } = req.body || {};
  const vid = (vaultId || '').trim().slice(0, 128);
  if (!vid) return res.status(400).json({ error: 'vaultId required' });

  const token = (deviceRegistrationToken || '').trim();
  if (!token) {
    return res.status(403).json({
      error: 'Proof of unlock required',
      deviceRegistrationTokenRequired: true,
      message: 'Unlock the vault first, then register a passkey. Pass deviceRegistrationToken from unlock response.'
    });
  }
  const consumed = await deviceRegSessions.consume(token, vid);
  if (!consumed) {
    return res.status(403).json({
      error: 'Invalid or expired registration token',
      message: 'Unlock the vault again to get a fresh deviceRegistrationToken.'
    });
  }

  const count = await webauthnStore.credentialCount(vid);
  if (count >= webauthnStore.MAX_CREDENTIALS) {
    return res.status(429).json({
      error: 'Max passkeys reached',
      message: `Maximum ${webauthnStore.MAX_CREDENTIALS} passkeys per vault.`
    });
  }

  const origin = getOrigin(req);
  const rpID = getRpId(origin);
  const existingCreds = await webauthnStore.getCredentials(vid);

  const options = await generateRegistrationOptions({
    rpName: "The Murderer's Lock",
    rpID: rpID === 'localhost' ? 'localhost' : rpID,
    userID: new TextEncoder().encode(vid),
    userName: vid,
    attestationType: 'none',
    timeout: 60000,
    excludeCredentials: existingCreds.map(c => ({ id: c.id, transports: c.transports })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required'
    }
  });

  await webauthnStore.insertChallenge(vid, options.challenge, 'registration');

  return res.status(200).json(options);
}

async function handleRegisterVerify(req, res) {
  if (!hasSupabase()) {
    return res.status(503).json({ error: 'WebAuthn requires database', message: 'Supabase not configured.' });
  }
  const { vaultId, credential } = req.body || {};
  const vid = (vaultId || '').trim().slice(0, 128);
  if (!vid || !credential) return res.status(400).json({ error: 'vaultId and credential required' });

  const rawChallenge = credential?.response?.clientDataJSON
    ? JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64url').toString('utf8')).challenge
    : null;
  if (!rawChallenge) return res.status(400).json({ error: 'Invalid credential response' });

  // Elite: verify first, then consume — prevents challenge-burning DoS
  const exists = await webauthnStore.checkChallengeExists(vid, rawChallenge, 'registration');
  if (!exists) {
    return res.status(400).json({ error: 'Registration challenge expired or already used. Try again.' });
  }

  const origin = getOrigin(req);
  const rpID = getRpId(origin);

  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: rawChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID === 'localhost' ? 'localhost' : rpID,
    requireUserVerification: true
  });

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'Verification failed' });
  }

  const consumed = await webauthnStore.consumeChallenge(vid, rawChallenge, 'registration');
  if (!consumed) {
    return res.status(400).json({ error: 'Challenge already used — possible replay. Try again.' });
  }

  const { credential: cred } = verification.registrationInfo;
  const credId = typeof cred.id === 'string' ? cred.id : Buffer.from(cred.id).toString('base64url');
  const pk = cred.publicKey instanceof Uint8Array ? cred.publicKey : new Uint8Array(cred.publicKey);

  await webauthnStore.saveCredential(vid, credId, pk, cred.counter ?? 0, cred.transports);

  return res.status(200).json({ success: true, message: 'Passkey registered' });
}

async function handleAuthOptions(req, res) {
  if (!hasSupabase()) {
    return res.status(503).json({ error: 'WebAuthn requires database', message: 'Supabase not configured.' });
  }
  const { vaultId } = req.body || {};
  const vid = (vaultId || '').trim().slice(0, 128);
  if (!vid) return res.status(400).json({ error: 'vaultId required' });

  const creds = await webauthnStore.getCredentials(vid);
  if (creds.length === 0) {
    return res.status(400).json({ error: 'No passkeys registered for this vault' });
  }

  const origin = getOrigin(req);
  const rpID = getRpId(origin);

  const options = await generateAuthenticationOptions({
    rpID: rpID === 'localhost' ? 'localhost' : rpID,
    timeout: 60000,
    userVerification: 'required',
    allowCredentials: creds.map(c => ({ id: c.id, transports: c.transports }))
  });

  const rawChallenge = options.challenge;
  await webauthnStore.insertChallenge(vid, rawChallenge, 'authentication');

  return res.status(200).json(options);
}

async function handleAuthVerify(req, res) {
  if (!hasSupabase()) {
    return res.status(503).json({ error: 'WebAuthn requires database', message: 'Supabase not configured.' });
  }
  const { vaultId, assertion } = req.body || {};
  const vid = (vaultId || '').trim().slice(0, 128);
  if (!vid || !assertion) return res.status(400).json({ error: 'vaultId and assertion required' });

  const rawChallenge = assertion?.response?.clientDataJSON
    ? JSON.parse(Buffer.from(assertion.response.clientDataJSON, 'base64url').toString('utf8')).challenge
    : null;
  if (!rawChallenge) return res.status(400).json({ error: 'Invalid assertion response' });

  // Elite: verify first, then consume — prevents challenge-burning DoS
  const exists = await webauthnStore.checkChallengeExists(vid, rawChallenge, 'authentication');
  if (!exists) {
    return res.status(400).json({ error: 'Authentication challenge expired or already used. Try again.' });
  }

  const creds = await webauthnStore.getCredentials(vid);
  const credId = assertion.id;
  const cred = creds.find(c => c.id === credId);
  if (!cred) return res.status(401).json({ error: 'Unknown passkey' });

  const origin = getOrigin(req);
  const rpID = getRpId(origin);

  const verification = await verifyAuthenticationResponse({
    response: assertion,
    expectedChallenge: rawChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID === 'localhost' ? 'localhost' : rpID,
    credential: cred,
    requireUserVerification: true
  });

  if (!verification.verified) {
    return res.status(401).json({ error: 'Verification failed' });
  }

  const consumed = await webauthnStore.consumeChallenge(vid, rawChallenge, 'authentication');
  if (!consumed) {
    return res.status(401).json({ error: 'Challenge already used — possible replay. Try again.' });
  }

  const { userVerified, newCounter } = verification.authenticationInfo;
  if (!userVerified) {
    return res.status(401).json({ error: 'User verification required' });
  }
  // Counter policy: enforce monotonicity when counter is supported (stored > 0).
  // Some authenticators (e.g. Touch ID) return 0; we allow that. When counter
  // increases, reject rollback (clone detection). UV required compensates when
  // counter is non-functional.
  if (newCounter <= cred.counter && cred.counter > 0) {
    return res.status(401).json({ error: 'Counter rollback detected — possible clone' });
  }

  await webauthnStore.updateCredentialCounter(vid, credId, newCounter);

  const webauthnSessionToken = await webauthnSessions.create(vid);
  return res.status(200).json({
    success: true,
    webauthnSessionToken,
    expiresIn: 180
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const pathname = url.parse(req.url || '').pathname || '';
  if (pathname.endsWith('/register/options')) return handleRegisterOptions(req, res);
  if (pathname.endsWith('/register/verify')) return handleRegisterVerify(req, res);
  if (pathname.endsWith('/auth/options')) return handleAuthOptions(req, res);
  if (pathname.endsWith('/auth/verify')) return handleAuthVerify(req, res);

  return res.status(404).json({ error: 'Not found' });
};
