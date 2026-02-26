/**
 * Device registration tokens — proof of recent unlock.
 * Required to register a device. Token valid 5 minutes.
 */

const crypto = require('crypto');
const { hasSupabase, getClient } = require('../lib/supabase.js');

const TTL_MS = 5 * 60 * 1000;
const memTokens = new Map();

/** 32 bytes = 256 bits entropy (elite minimum) */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function createSupabase(vaultId) {
  const sb = await getClient();
  if (!sb) return createMem(vaultId);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  try {
    await sb.from('device_registration_tokens').insert({
      token,
      vault_id: vaultId || 'default',
      expires_at: expiresAt
    });
    return token;
  } catch (e) {
    if (e.code === '42P01') return createMem(vaultId);
    throw e;
  }
}

function createMem(vaultId) {
  const token = generateToken();
  memTokens.set(token, { vaultId: vaultId || 'default', expiresAt: Date.now() + TTL_MS });
  return token;
}

async function create(vaultId) {
  if (hasSupabase()) return createSupabase(vaultId);
  return createMem(vaultId);
}

async function consumeSupabase(token, vaultId) {
  const sb = await getClient();
  if (!sb) return consumeMem(token, vaultId);
  if (!token || typeof token !== 'string') return false;
  const { data } = await sb.from('device_registration_tokens').select('id, expires_at').eq('token', token).eq('vault_id', vaultId || 'default').single();
  if (!data) return false;
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await sb.from('device_registration_tokens').delete().eq('token', token);
    return false;
  }
  await sb.from('device_registration_tokens').delete().eq('token', token);
  return true;
}

function consumeMem(token, vaultId) {
  const entry = memTokens.get(token);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    memTokens.delete(token);
    return false;
  }
  if (entry.vaultId !== (vaultId || 'default')) return false;
  memTokens.delete(token);
  return true;
}

async function consume(token, vaultId) {
  if (hasSupabase()) return consumeSupabase(token, vaultId);
  return consumeMem(token, vaultId);
}

module.exports = { create, consume };
