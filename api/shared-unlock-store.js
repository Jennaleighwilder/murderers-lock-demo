/**
 * Shared store for unlock-vault and recover-vault.
 * Tracks murder count, rate limits, and graduated lockjaw per vault.
 * Uses Supabase when configured, in-memory fallback otherwise.
 */

const { hasSupabase, getClient } = require('../lib/supabase.js');

const memStore = new Map();

function getOrCreateMem(vaultId) {
  const key = vaultId || 'default';
  if (!memStore.has(key)) {
    memStore.set(key, { attempts: [], murderCount: 0, lockjawStage: 'none', stageUntil: null });
  }
  return memStore.get(key);
}

async function getOrCreateSupabase(vaultId) {
  const sb = await getClient();
  if (!sb) return getOrCreateMem(vaultId);
  const key = vaultId || 'default';
  const { data, error } = await sb.from('unlock_state').select('*').eq('vault_id', key).single();
  if (error && error.code !== 'PGRST116') throw error;
  if (data) {
    return {
      attempts: Array.isArray(data.attempts) ? data.attempts : [],
      murderCount: data.murder_count ?? 0,
      lockjawStage: data.lockjaw_stage || 'none',
      stageUntil: data.stage_until ? new Date(data.stage_until).getTime() : null
    };
  }
  const record = { attempts: [], murderCount: 0, lockjawStage: 'none', stageUntil: null };
  await sb.from('unlock_state').upsert({
    vault_id: key,
    murder_count: 0,
    attempts: [],
    lockjaw_stage: 'none',
    stage_until: null
  }, { onConflict: 'vault_id' });
  return record;
}

async function saveSupabase(vaultId, record) {
  const sb = await getClient();
  if (!sb) return;
  const key = vaultId || 'default';
  await sb.from('unlock_state').upsert({
    vault_id: key,
    murder_count: record.murderCount ?? 0,
    attempts: record.attempts || [],
    lockjaw_stage: record.lockjawStage || 'none',
    stage_until: record.stageUntil ? new Date(record.stageUntil).toISOString() : null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'vault_id' });
}

async function getOrCreate(vaultId) {
  if (hasSupabase()) return getOrCreateSupabase(vaultId);
  return getOrCreateMem(vaultId);
}

async function save(vaultId, record) {
  if (hasSupabase()) return saveSupabase(vaultId, record);
}

async function resetVault(vaultId) {
  const key = vaultId || 'default';
  if (hasSupabase()) {
    const sb = await getClient();
    if (sb) {
      const { error } = await sb.rpc('reset_unlock_state', { p_vault_id: key });
      if (error) {
        await sb.from('unlock_state').upsert({
          vault_id: key,
          murder_count: 0,
          attempts: [],
          lockjaw_stage: 'none',
          stage_until: null
        }, { onConflict: 'vault_id' });
      }
      return;
    }
  }
  memStore.set(key, { attempts: [], murderCount: 0, lockjawStage: 'none', stageUntil: null });
}

module.exports = { memStore, getOrCreate, save, resetVault };
