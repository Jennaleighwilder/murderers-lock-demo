/**
 * 2FA TOTP secrets per vault.
 * Uses Supabase when configured, in-memory fallback otherwise.
 */

const { hasSupabase, getClient } = require('../lib/supabase.js');

const memStore = new Map();

function setMem(vaultId, secret) {
  memStore.set(vaultId || 'default', { secret });
}

function getMem(vaultId) {
  return memStore.get(vaultId || 'default');
}

function hasMem(vaultId) {
  return memStore.has(vaultId || 'default');
}

function removeMem(vaultId) {
  memStore.delete(vaultId || 'default');
}

async function setSupabase(vaultId, secret) {
  const sb = await getClient();
  if (!sb) return setMem(vaultId, secret);
  const vid = vaultId || 'default';
  await sb.from('totp_secrets').upsert({
    vault_id: vid,
    secret: secret?.secret || secret
  }, { onConflict: 'vault_id' });
}

async function getSupabase(vaultId) {
  const sb = await getClient();
  if (!sb) return getMem(vaultId);
  const vid = vaultId || 'default';
  const { data } = await sb.from('totp_secrets').select('secret').eq('vault_id', vid).single();
  return data ? { secret: data.secret } : null;
}

async function hasSupabaseCheck(vaultId) {
  const r = await getSupabase(vaultId);
  return !!r?.secret;
}

async function set(vaultId, secret) {
  if (hasSupabase()) return setSupabase(vaultId, secret);
  setMem(vaultId, secret);
}

function get(vaultId) {
  if (hasSupabase()) {
    return getSupabase(vaultId).then(r => r).catch(() => getMem(vaultId));
  }
  return Promise.resolve(getMem(vaultId));
}

function has(vaultId) {
  if (hasSupabase()) {
    return hasSupabaseCheck(vaultId);
  }
  return Promise.resolve(hasMem(vaultId));
}

async function remove(vaultId) {
  if (hasSupabase()) {
    const sb = await getClient();
    if (sb) await sb.from('totp_secrets').delete().eq('vault_id', vaultId || 'default');
    return;
  }
  removeMem(vaultId);
}

module.exports = { set, get, has, remove };
