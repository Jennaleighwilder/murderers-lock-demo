/**
 * DMS store - check-in and config per user
 * In-memory (resets on cold start). Add Vercel KV for persistence.
 */

const store = new Map();

function key(userId) {
  return 'dms:' + (userId || 'default');
}

function get(userId) {
  const k = key(userId);
  if (!store.has(k)) {
    store.set(k, {
      enabled: false,
      intervalDays: 7,
      graceDays: 5,
      lastCheckIn: null,
      contacts: []
    });
  }
  return store.get(k);
}

function set(userId, data) {
  const k = key(userId);
  const current = get(userId);
  store.set(k, { ...current, ...data });
  return store.get(k);
}

function checkIn(userId) {
  const k = key(userId);
  const rec = get(userId);
  rec.lastCheckIn = new Date().toISOString();
  store.set(k, rec);
  return rec;
}

module.exports = { get, set, checkIn };
