/**
 * Shared store for unlock-vault and recover-vault.
 * Tracks murder count and rate limits per vault.
 * recover-vault resets vault record on successful recovery.
 */

const store = new Map();

function getOrCreate(vaultId) {
  const key = vaultId || 'default';
  if (!store.has(key)) {
    store.set(key, { attempts: [], murderCount: 0 });
  }
  return store.get(key);
}

function resetVault(vaultId) {
  const key = vaultId || 'default';
  if (store.has(key)) {
    store.set(key, { attempts: [], murderCount: 0 });
  }
}

module.exports = { store, getOrCreate, resetVault };
