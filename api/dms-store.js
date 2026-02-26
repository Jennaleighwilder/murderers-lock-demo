/**
 * DMS store - check-in and config per user.
 * Uses Supabase when configured, in-memory fallback otherwise.
 */

const { hasSupabase, getClient } = require('../lib/supabase.js');

const memStore = new Map();

function key(userId) {
  return 'dms:' + (userId || 'default');
}

function getMem(userId) {
  const k = key(userId);
  if (!memStore.has(k)) {
    memStore.set(k, {
      enabled: false,
      intervalDays: 7,
      graceDays: 5,
      lastCheckIn: null,
      contacts: []
    });
  }
  return memStore.get(k);
}

function setMem(userId, data) {
  const k = key(userId);
  const current = getMem(userId);
  memStore.set(k, { ...current, ...data });
  return memStore.get(k);
}

function checkInMem(userId) {
  const rec = getMem(userId);
  rec.lastCheckIn = new Date().toISOString();
  setMem(userId, rec);
  return rec;
}

async function getSupabase(userId) {
  const sb = await getClient();
  if (!sb) return getMem(userId);
  const uid = userId || 'default';
  const { data } = await sb.from('dms_config').select('*').eq('user_id', uid).single();
  if (!data) {
    return { enabled: false, intervalDays: 7, graceDays: 5, lastCheckIn: null, contacts: [] };
  }
  return {
    enabled: !!data.enabled,
    intervalDays: data.interval_days ?? 7,
    graceDays: data.grace_days ?? 5,
    lastCheckIn: data.last_check_in,
    contacts: data.contacts || []
  };
}

async function setSupabase(userId, data) {
  const sb = await getClient();
  if (!sb) return setMem(userId, data);
  const uid = userId || 'default';
  const current = await getSupabase(userId);
  const merged = { ...current, ...data };
  await sb.from('dms_config').upsert({
    user_id: uid,
    enabled: merged.enabled,
    interval_days: merged.intervalDays,
    grace_days: merged.graceDays,
    last_check_in: merged.lastCheckIn || current.lastCheckIn,
    contacts: merged.contacts || [],
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  return merged;
}

async function checkInSupabase(userId) {
  const sb = await getClient();
  if (!sb) return checkInMem(userId);
  const uid = userId || 'default';
  const current = await getSupabase(userId);
  const now = new Date().toISOString();
  await sb.from('dms_config').upsert({
    user_id: uid,
    enabled: current.enabled,
    interval_days: current.intervalDays,
    grace_days: current.graceDays,
    last_check_in: now,
    contacts: current.contacts || [],
    updated_at: now
  }, { onConflict: 'user_id' });
  return { ...current, lastCheckIn: now };
}

async function get(userId) {
  if (hasSupabase()) return getSupabase(userId);
  return getMem(userId);
}

async function set(userId, data) {
  if (hasSupabase()) return setSupabase(userId, data);
  return setMem(userId, data);
}

async function checkIn(userId) {
  if (hasSupabase()) return checkInSupabase(userId);
  return checkInMem(userId);
}

module.exports = { get, set, checkIn };
