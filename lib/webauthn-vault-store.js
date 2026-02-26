/**
 * Vault-scoped WebAuthn store (Supabase).
 * Credentials and challenges per vault; challenge_hash only.
 */

const crypto = require('crypto');
const { hasSupabase, getClient } = require('./supabase.js');

const CHALLENGE_TTL_SEC = 60;
const MAX_CREDENTIALS = 5;

async function insertChallenge(vaultId, rawChallenge, type) {
  const sb = await getClient();
  if (!sb) return null;
  const challengeHash = crypto.createHash('sha256').update(rawChallenge, 'utf8').digest('base64');
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SEC * 1000).toISOString();
  const { error } = await sb.from('webauthn_challenges').insert({
    vault_id: vaultId,
    challenge_hash: challengeHash,
    type,
    expires_at: expiresAt,
    used: false
  });
  if (error) throw error;
  return { rawChallenge, challengeHash };
}

/**
 * Check challenge exists, not used, not expired. Does NOT consume.
 * Elite: prevents challenge-burning DoS — we verify first, then consume.
 */
async function checkChallengeExists(vaultId, rawChallenge, type) {
  const sb = await getClient();
  if (!sb) return false;
  const challengeHash = crypto.createHash('sha256').update(rawChallenge, 'utf8').digest('base64');
  const { data } = await sb.from('webauthn_challenges')
    .select('id')
    .eq('vault_id', vaultId)
    .eq('challenge_hash', challengeHash)
    .eq('type', type)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .limit(1);
  return !!data?.length;
}

async function consumeChallenge(vaultId, rawChallenge, type) {
  const sb = await getClient();
  if (!sb) return false;
  const challengeHash = crypto.createHash('sha256').update(rawChallenge, 'utf8').digest('base64');
  const { data, error } = await sb.rpc('consume_webauthn_challenge', {
    p_vault_id: vaultId,
    p_challenge_hash: challengeHash,
    p_type: type
  });
  return !error && (data === true || data?.[0] === true);
}

async function getCredentials(vaultId) {
  const sb = await getClient();
  if (!sb) return [];
  const { data } = await sb.from('webauthn_credentials').select('credential_id, public_key, counter, transports').eq('vault_id', vaultId);
  return (data || []).map(r => {
    const pk = r.public_key;
    const pkBytes = typeof pk === 'string' ? Buffer.from(pk, 'base64') : pk;
    return {
      id: r.credential_id,
      publicKey: pkBytes instanceof Uint8Array ? pkBytes : new Uint8Array(pkBytes),
      counter: Number(r.counter) || 0,
      transports: r.transports ? JSON.parse(r.transports) : undefined
    };
  });
}

async function hasCredentials(vaultId) {
  const creds = await getCredentials(vaultId);
  return creds.length > 0;
}

async function credentialCount(vaultId) {
  const creds = await getCredentials(vaultId);
  return creds.length;
}

async function saveCredential(vaultId, credentialId, publicKey, counter, transports) {
  const sb = await getClient();
  if (!sb) throw new Error('Database required');
  const pk = publicKey instanceof Uint8Array ? Buffer.from(publicKey) : publicKey;
  const pkBase64 = (typeof pk === 'string' ? pk : pk.toString('base64'));
  const transportsJson = transports ? JSON.stringify(transports) : null;
  const { error } = await sb.from('webauthn_credentials').insert({
    vault_id: vaultId,
    credential_id: credentialId,
    public_key: pkBase64,
    counter: counter || 0,
    transports: transportsJson
  });
  if (error) throw error;
}

async function updateCredentialCounter(vaultId, credentialId, newCounter) {
  const sb = await getClient();
  if (!sb) return;
  await sb.from('webauthn_credentials')
    .update({ counter: newCounter, last_used_at: new Date().toISOString() })
    .eq('vault_id', vaultId)
    .eq('credential_id', credentialId);
}

const IS_PROD = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const EXPECTED_ORIGIN = (process.env.WEBAUTHN_EXPECTED_ORIGIN || '').trim();
const EXPECTED_RP_ID = (process.env.WEBAUTHN_EXPECTED_RP_ID || '').trim();

function getOrigin(req) {
  if (IS_PROD && EXPECTED_ORIGIN) return EXPECTED_ORIGIN;
  const origin = req.headers?.origin || req.headers?.referer?.replace(/\/$/, '') || '';
  if (origin) {
    try { return new URL(origin).origin; } catch (_) {}
  }
  return 'https://localhost';
}

function getRpId(origin) {
  if (IS_PROD && EXPECTED_RP_ID) return EXPECTED_RP_ID;
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' ? 'localhost' : host;
  } catch (_) {
    return 'localhost';
  }
}

module.exports = {
  CHALLENGE_TTL_SEC,
  MAX_CREDENTIALS,
  insertChallenge,
  checkChallengeExists,
  consumeChallenge,
  getCredentials,
  hasCredentials,
  credentialCount,
  saveCredential,
  updateCredentialCounter,
  getOrigin,
  getRpId
};
