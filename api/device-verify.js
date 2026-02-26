/**
 * POST /api/device-verify
 * Verify device is registered for vault.
 * Body: { vaultId, deviceFingerprint }
 */

const { hasSupabase, getClient } = require('../lib/supabase.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!hasSupabase()) {
    return res.status(200).json({ success: true, trusted: true }); // No device binding = allow
  }

  try {
    const { vaultId, deviceFingerprint } = req.body || {};
    const vid = vaultId || 'default';
    const fp = (deviceFingerprint || '').trim().slice(0, 256);
    if (!fp) return res.status(400).json({ error: 'deviceFingerprint required' });

    const sb = await getClient();
    const { data } = await sb.from('devices').select('id').eq('vault_id', vid).eq('device_fingerprint', fp).eq('is_trusted', true).limit(1).single();

    return res.status(200).json({ success: true, trusted: !!data });
  } catch (err) {
    console.error('device-verify error:', err);
    return res.status(500).json({ error: err.message || 'Failed to verify device' });
  }
};
