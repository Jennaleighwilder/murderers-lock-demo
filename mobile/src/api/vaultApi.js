/**
 * Vault API - sync with web backend
 * Set API_BASE in env or use your deployed URL
 */
// For dev: use your machine's LAN IP so the phone can reach it, e.g. http://192.168.1.222:54040
const API_BASE = __DEV__
  ? 'http://192.168.1.222:54040'  // Change to your IP when testing
  : 'https://your-app.vercel.app';

export async function createVault(name, password) {
  const res = await fetch(`${API_BASE}/api/create-vault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to create vault');
  return res.json();
}

export async function unlockVault(vaultId, password, totpCode) {
  const res = await fetch(`${API_BASE}/api/unlock-vault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultId, password, totpCode }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to unlock');
  return res.json();
}

export async function encryptVault(vaultId, password, contents, salt, iv, timestamp) {
  const res = await fetch(`${API_BASE}/api/encrypt-vault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultId, password, salt, contents, iv, ...(timestamp && { useNanosecond: true }) }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to encrypt');
  return res.json();
}
