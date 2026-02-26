/**
 * Recovery session store - token -> { contents, vaultId, expiresAt }
 * Tokens expire after 5 minutes. Uses Supabase when configured.
 */

const crypto = require('crypto');
const { hasSupabase, getClient } = require('../lib/supabase.js');

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const memSessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function storeSupabase(contents, vaultId) {
  const sb = await getClient();
  if (!sb) return storeMem(contents, vaultId);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await sb.from('recovery_sessions').insert({
    token,
    vault_id: vaultId || 'default',
    contents: contents || '',
    expires_at: expiresAt
  });
  return token;
}

function storeMem(contents, vaultId) {
  const token = generateToken();
  memSessions.set(token, {
    contents: contents || '',
    vaultId,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

async function store(contents, vaultId) {
  if (hasSupabase()) return storeSupabase(contents, vaultId);
  return storeMem(contents, vaultId);
}

async function getSupabase(token) {
  const sb = await getClient();
  if (!sb) return getMem(token);
  if (!token || typeof token !== 'string') return null;
  const { data, error } = await sb.from('recovery_sessions').select('*').eq('token', token).single();
  if (error || !data) return null;
  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() > expiresAt) {
    await sb.from('recovery_sessions').delete().eq('token', token);
    return null;
  }
  return { contents: data.contents, vaultId: data.vault_id, expiresAt };
}

function getMem(token) {
  if (!token || typeof token !== 'string') return null;
  const entry = memSessions.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memSessions.delete(token);
    return null;
  }
  return entry;
}

async function get(token) {
  if (hasSupabase()) return getSupabase(token);
  return getMem(token);
}

async function consumeSupabase(token) {
  const entry = await getSupabase(token);
  if (entry) {
    const sb = await getClient();
    if (sb) await sb.from('recovery_sessions').delete().eq('token', token);
    return entry;
  }
  return null;
}

function consumeMem(token) {
  const entry = getMem(token);
  if (entry) {
    memSessions.delete(token);
    return entry;
  }
  return null;
}

async function consume(token) {
  if (hasSupabase()) return consumeSupabase(token);
  return consumeMem(token);
}

async function cleanupExpired() {
  if (hasSupabase()) {
    const sb = await getClient();
    if (sb) await sb.from('recovery_sessions').delete().lt('expires_at', new Date().toISOString());
    return;
  }
  const now = Date.now();
  for (const [token, entry] of memSessions.entries()) {
    if (now > entry.expiresAt) memSessions.delete(token);
  }
}

module.exports = { store, get, consume, cleanupExpired };
