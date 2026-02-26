/**
 * device-keys.js — Client-side cryptographic device binding.
 * ECDSA P-256 keypair, IndexedDB persistence, server-issued challenges.
 * Private key stored as JWK in IndexedDB (never sent to server).
 *
 * Note: JWK is still extractable (XSS = key theft). For "hardware-backed"
 * or "non-exportable" claims, use WebAuthn passkeys instead.
 */

const DB_NAME = 'ml_device_keys';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

/**
 * Open IndexedDB for device keys.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'vaultId' });
      }
    };
  });
}

/**
 * Get stored key from IndexedDB.
 * @param {string} vaultId
 * @returns {Promise<{ publicKeyBase64: string, privateKeyJwk: object }|null>}
 */
async function getStoredKey(vaultId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(vaultId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Store key in IndexedDB (JWK format; never base64 for private key).
 * @param {string} vaultId
 * @param {string} publicKeyBase64 - SPKI export for server
 * @param {object} privateKeyJwk - JWK for re-import
 */
async function storeKey(vaultId, publicKeyBase64, privateKeyJwk) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put({
      vaultId,
      publicKeyBase64,
      privateKeyJwk,
      createdAt: Date.now()
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generate ECDSA P-256 keypair. Exports for storage only; never sent.
 * @returns {Promise<{ publicKeyBase64: string, privateKeyJwk: object }>}
 */
async function generateDeviceKeypair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const pubBuf = await crypto.subtle.exportKey('spki', pair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(pubBuf)));
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKeyBase64, privateKeyJwk };
}

/**
 * Sign challenge with private key (from JWK).
 * @param {string} challenge
 * @param {object} privateKeyJwk
 * @returns {Promise<string>} signature base64
 */
async function signChallengeWithJwk(challenge, privateKeyJwk) {
  const key = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const data = new TextEncoder().encode(challenge);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    data
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * Build challenge string (legacy; server-issued preferred).
 * @param {string} vaultId
 * @returns {string}
 */
function buildChallenge(vaultId) {
  return `${vaultId}:${Math.floor(Date.now() / 1000)}`;
}

/**
 * Get or create device keypair. Persists in IndexedDB (JWK).
 * @param {string} vaultId
 * @returns {Promise<{ publicKeyBase64: string, privateKeyJwk: object, hasStoredKey: boolean }>}
 */
async function getOrCreateDeviceKey(vaultId) {
  const stored = await getStoredKey(vaultId);
  if (stored?.publicKeyBase64 && stored?.privateKeyJwk) {
    return {
      publicKeyBase64: stored.publicKeyBase64,
      privateKeyJwk: stored.privateKeyJwk,
      hasStoredKey: true
    };
  }
  const { publicKeyBase64, privateKeyJwk } = await generateDeviceKeypair();
  await storeKey(vaultId, publicKeyBase64, privateKeyJwk);
  return { publicKeyBase64, privateKeyJwk, hasStoredKey: false };
}

/**
 * Fetch server-issued one-time challenge (replay-proof).
 * @param {string} vaultId
 * @param {string} apiBase
 * @returns {Promise<string|null>} raw challenge or null
 */
async function fetchServerChallenge(vaultId, apiBase = '/api') {
  try {
    const base = apiBase.replace(/\/$/, '');
    const res = await fetch(`${base}/device-challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.challenge) return null;
    return data.challenge;
  } catch (err) {
    console.warn('Fetch challenge failed:', err);
    return null;
  }
}

/**
 * Produce device auth payload for unlock request.
 * Uses server-issued one-time challenge (replay-proof).
 * @param {string} vaultId
 * @param {string} apiBase
 * @returns {Promise<{ devicePublicKey: string, deviceChallenge: string, deviceSignature: string } | null>}
 */
async function getDeviceAuthPayload(vaultId, apiBase = '/api') {
  try {
    const challenge = await fetchServerChallenge(vaultId, apiBase);
    if (!challenge) return null;
    const { publicKeyBase64, privateKeyJwk } = await getOrCreateDeviceKey(vaultId);
    const signature = await signChallengeWithJwk(challenge, privateKeyJwk);
    return {
      devicePublicKey: publicKeyBase64,
      deviceChallenge: challenge,
      deviceSignature: signature
    };
  } catch (err) {
    console.warn('Device key auth failed:', err);
    return null;
  }
}

/**
 * Register device with server.
 * Requires deviceRegistrationToken (from recent unlock) when vault has key-based devices.
 * @param {string} vaultId
 * @param {string} apiBase
 * @param {string} [deviceRegistrationToken] - From unlock response; required when vault has devices
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function registerDeviceKey(vaultId, apiBase = '/api', deviceRegistrationToken) {
  try {
    const { publicKeyBase64 } = await getOrCreateDeviceKey(vaultId);
    const base = apiBase.replace(/\/$/, '');
    const body = { vaultId, devicePublicKey: publicKeyBase64 };
    if (deviceRegistrationToken) body.deviceRegistrationToken = deviceRegistrationToken;
    const res = await fetch(`${base}/device-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.error || data.message || res.statusText };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/** Legacy: sign with base64 PKCS8 key (for backward compat) */
async function signChallenge(challenge, privateKeyBase64) {
  const buf = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    buf,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const data = new TextEncoder().encode(challenge);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    data
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

if (typeof window !== 'undefined') {
  window.DeviceKeys = {
    generateDeviceKeypair,
    signChallenge,
    signChallengeWithJwk,
    buildChallenge,
    fetchServerChallenge,
    getOrCreateDeviceKey,
    getDeviceAuthPayload,
    registerDeviceKey,
    openDB,
    getStoredKey,
    storeKey
  };
}
