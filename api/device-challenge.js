/**
 * POST /api/device-challenge
 * Server-issued one-time challenge for device binding (replay-proof).
 * Body: { vaultId }
 * Returns: { challenge } — raw challenge; server stores only hash.
 * Challenge expires in 60 seconds.
 */

const crypto = require('crypto');
const { hasSupabase, getClient } = require('../lib/supabase.js');

const CHALLENGE_TTL_SEC = 60;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!hasSupabase()) {
    return res.status(503).json({ error: 'Device challenges require database', message: 'Supabase not configured.' });
  }

  try {
    const { vaultId } = req.body || {};
    const vid = (vaultId || '').trim().slice(0, 128);
    if (!vid) return res.status(400).json({ error: 'vaultId required' });

    const rawChallenge = crypto.randomBytes(32).toString('base64');
    const challengeHash = crypto.createHash('sha256').update(rawChallenge, 'utf8').digest('base64');
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SEC * 1000).toISOString();

    const sb = await getClient();
    const { error } = await sb.from('device_challenges').insert({
      vault_id: vid,
      challenge_hash: challengeHash,
      expires_at: expiresAt,
      used: false
    });

    if (error) throw error;

    return res.status(200).json({
      challenge: rawChallenge,
      expiresIn: CHALLENGE_TTL_SEC
    });
  } catch (err) {
    console.error('device-challenge error:', err);
    return res.status(500).json({ error: err.message || 'Failed to issue challenge' });
  }
};
