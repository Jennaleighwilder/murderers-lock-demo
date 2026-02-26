/**
 * Audit log store (per vault).
 * Uses Supabase when configured, in-memory fallback otherwise.
 */

const { hasSupabase, getClient } = require('../lib/supabase.js');

const MAX_EVENTS_PER_VAULT = 500;
const memStore = new Map();

function appendMem(vaultId, event) {
  const vid = vaultId || 'default';
  if (!memStore.has(vid)) memStore.set(vid, []);
  const list = memStore.get(vid);
  list.push({
    ...event,
    ts: Date.now(),
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  });
  if (list.length > MAX_EVENTS_PER_VAULT) list.shift();
}

function getMem(vaultId, limit = 100) {
  const vid = vaultId || 'default';
  const list = memStore.get(vid) || [];
  return list.slice(-limit).reverse();
}

async function appendSupabase(vaultId, event) {
  const sb = await getClient();
  if (!sb) {
    appendMem(vaultId, event);
    return;
  }
  const vid = vaultId || 'default';
  await sb.from('audit_log').insert({
    vault_id: vid,
    action: event.action || 'unknown',
    success: event.success !== false,
    metadata: event.metadata || {}
  });
}

async function getSupabase(vaultId, limit = 100) {
  const sb = await getClient();
  if (!sb) return getMem(vaultId, limit);
  const vid = vaultId || 'default';
  const { data, error } = await sb.from('audit_log')
    .select('id, vault_id, action, success, metadata, created_at')
    .eq('vault_id', vid)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return getMem(vaultId, limit);
  return (data || []).map(r => ({
    id: r.id,
    action: r.action,
    success: r.success,
    metadata: r.metadata,
    ts: new Date(r.created_at).getTime()
  }));
}

async function append(vaultId, event) {
  if (hasSupabase()) return appendSupabase(vaultId, event);
  appendMem(vaultId, event);
}

async function get(vaultId, limit = 100) {
  if (hasSupabase()) return getSupabase(vaultId, limit);
  return getMem(vaultId, limit);
}

module.exports = { append, get };
