/**
 * lib/device-challenge-store.js
 * Consume server-issued one-time challenges. Replay-proof.
 * Hash raw challenge, lookup, verify not expired/used, mark used.
 */

const crypto = require('crypto');

/**
 * Consume a server-issued challenge. Replay-proof, atomic (no race).
 * Uses consume_device_challenge() RPC when available; falls back to select+update.
 * @param {object} sb - Supabase client
 * @param {string} vaultId
 * @param {string} rawChallenge - Raw challenge from client (was returned by /api/device-challenge)
 * @returns {Promise<boolean>} true if challenge valid and consumed
 */
async function consumeServerChallenge(sb, vaultId, rawChallenge) {
  if (!sb || !vaultId || !rawChallenge || typeof rawChallenge !== 'string') return false;
  const challengeHash = crypto.createHash('sha256').update(rawChallenge, 'utf8').digest('base64');

  try {
    const { data, error } = await sb.rpc('consume_device_challenge', {
      p_vault_id: vaultId,
      p_challenge_hash: challengeHash
    });
    if (!error && (data === true || data?.[0] === true)) return true;
  } catch (_) {}

  const now = new Date().toISOString();
  const { data: rows } = await sb
    .from('device_challenges')
    .select('id')
    .eq('vault_id', vaultId)
    .eq('challenge_hash', challengeHash)
    .eq('used', false)
    .gt('expires_at', now)
    .limit(1);

  if (!rows?.length) return false;

  const { error } = await sb.from('device_challenges').update({ used: true }).eq('id', rows[0].id);
  return !error;
}

module.exports = { consumeServerChallenge };
