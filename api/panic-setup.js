/**
 * POST /api/panic-setup
 * Set panic/duress code and emergency contacts.
 * Panic code: when used at unlock, returns fake success and triggers silent alarm.
 * Body: { vaultId, panicCode, emergencyContacts: [{ email, name? }] }
 */

const { hashPanic } = require('../lib/panic.js');
const { hasSupabase, getClient } = require('../lib/supabase.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!hasSupabase()) {
    return res.status(503).json({ error: 'Panic code requires database', message: 'Supabase not configured.' });
  }

  try {
    const { vaultId, panicCode, emergencyContacts } = req.body || {};
    const vid = vaultId || 'default';
    const code = (panicCode || '').trim();
    if (!code || code.length < 6) return res.status(400).json({ error: 'Panic code must be at least 6 characters' });

    const contacts = Array.isArray(emergencyContacts)
      ? emergencyContacts.slice(0, 5).map(c => ({ email: (c?.email || '').trim(), name: (c?.name || '').slice(0, 100) })).filter(c => c.email)
      : [];

    const panicHash = hashPanic(code);
    const sb = await getClient();
    await sb.from('panic_codes').upsert({
      vault_id: vid,
      panic_hash: panicHash,
      emergency_contacts: contacts
    }, { onConflict: 'vault_id' });

    return res.status(200).json({ success: true, message: 'Panic code configured' });
  } catch (err) {
    console.error('panic-setup error:', err);
    return res.status(500).json({ error: err.message || 'Failed to setup panic code' });
  }
};
