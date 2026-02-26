/**
 * POST /api/device-register
 * Register device for vault. Max 5 devices per vault.
 * Requires deviceRegistrationToken (from recent unlock) when vault has key-based devices.
 *
 * Body: { vaultId, deviceFingerprint?, devicePublicKey?, deviceRegistrationToken?, userAgent? }
 */

const { hasSupabase, getClient } = require('../lib/supabase.js');
const deviceRegSessions = require('./device-registration-sessions.js');

const MAX_DEVICES = 5;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!hasSupabase()) {
    return res.status(503).json({ error: 'Device binding requires database', message: 'Supabase not configured.' });
  }

  try {
    const { vaultId, deviceFingerprint, devicePublicKey, deviceRegistrationToken, userAgent } = req.body || {};
    const vid = vaultId || 'default';
    const fp = (deviceFingerprint || '').trim().slice(0, 256);
    const pubKey = (devicePublicKey || '').trim().slice(0, 1024);
    if (!fp && !pubKey) return res.status(400).json({ error: 'deviceFingerprint or devicePublicKey required' });

    const sb = await getClient();
    const { data: devices } = await sb.from('devices').select('id, device_public_key').eq('vault_id', vid);
    const hasKeyDevices = devices?.some(d => d.device_public_key) ?? false;

    if (pubKey && hasKeyDevices) {
      const token = (deviceRegistrationToken || '').trim();
      if (!token) {
        return res.status(403).json({
          error: 'Proof of unlock required',
          deviceRegistrationTokenRequired: true,
          message: 'Unlock the vault first from a registered device, then register this device. Pass deviceRegistrationToken from unlock response.'
        });
      }
      const consumed = await deviceRegSessions.consume(token, vid);
      if (!consumed) {
        return res.status(403).json({
          error: 'Invalid or expired registration token',
          message: 'Unlock the vault again to get a fresh deviceRegistrationToken.'
        });
      }
    } else if (pubKey && !hasKeyDevices) {
      const token = (deviceRegistrationToken || '').trim();
      if (!token) {
        return res.status(403).json({
          error: 'Proof of unlock required',
          deviceRegistrationTokenRequired: true,
          message: 'Unlock the vault first, then register this device. Pass deviceRegistrationToken from unlock response.'
        });
      }
      const consumed = await deviceRegSessions.consume(token, vid);
      if (!consumed) {
        return res.status(403).json({
          error: 'Invalid or expired registration token',
          message: 'Unlock the vault again to get a fresh deviceRegistrationToken.'
        });
      }
    }

    const count = devices?.length || 0;

    if (count >= MAX_DEVICES) {
      return res.status(429).json({
        error: 'Max devices reached',
        message: `Maximum ${MAX_DEVICES} devices per vault. Remove a device first.`
      });
    }

    const row = {
      vault_id: vid,
      device_fingerprint: fp || null,
      user_agent: (userAgent || req.headers['user-agent'] || '').slice(0, 512),
      is_trusted: true,
      verified_at: new Date().toISOString()
    };
    if (pubKey) row.device_public_key = pubKey;

    const { error } = await sb.from('devices').insert(row);

    if (error) {
      if (error.code === '23505') {
        const upd = { verified_at: new Date().toISOString(), is_trusted: true };
        if (pubKey) upd.device_public_key = pubKey;
        if (fp) {
          await sb.from('devices').update(upd).eq('vault_id', vid).eq('device_fingerprint', fp);
        } else if (pubKey) {
          await sb.from('devices').update(upd).eq('vault_id', vid).eq('device_public_key', pubKey);
        }
        return res.status(200).json({ success: true, message: 'Device already registered' });
      }
      if (error.code === '42703') {
        return res.status(503).json({ error: 'Run device_public_key migration', message: 'See docs/DEVICE-KEY-MIGRATION.md' });
      }
      throw error;
    }

    return res.status(200).json({ success: true, message: 'Device registered' });
  } catch (err) {
    console.error('device-register error:', err);
    return res.status(500).json({ error: err.message || 'Failed to register device' });
  }
};
