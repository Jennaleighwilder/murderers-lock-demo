/**
 * nanosecond-lock-production.js
 * 33 Gates + Timestamp = Key changes every lock. No deps. crypto.subtle only.
 *
 * LOCK:  password + timestamp → 33 gates → XOR → AES-256-GCM
 *        Timestamp = unique per lock (nanosecond-precision entropy)
 * UNLOCK: password + stored_timestamp → same derivation → decrypt
 *
 * Works: Browser (crypto.subtle) + Node (require('crypto').webcrypto.subtle)
 */

const NUM_GATES = 33;
const KEY_LENGTH = 32;

function getCrypto() {
  if (typeof crypto !== 'undefined' && crypto.subtle) return crypto.subtle;
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) return globalThis.crypto.subtle;
  try {
    const nodeCrypto = require('crypto');
    const wc = nodeCrypto.webcrypto || nodeCrypto;
    return wc.subtle || (wc.crypto && wc.crypto.subtle);
  } catch (_) {}
  throw new Error('crypto.subtle not available');
}

function toHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex) {
  const arr = hex.match(/.{2}/g).map(b => parseInt(b, 16));
  return new Uint8Array(arr);
}

async function sha256(data) {
  const crypto = getCrypto();
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.digest('SHA-256', buf);
  return new Uint8Array(hash);
}

async function hmacSha256(key, data) {
  const crypto = getCrypto();
  const keyBuf = key instanceof ArrayBuffer ? key : key.buffer || key;
  const dataBuf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const cryptoKey = await crypto.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.sign('HMAC', cryptoKey, dataBuf);
  return new Uint8Array(sig);
}

function randomBytes(n) {
  const arr = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    const nodeCrypto = require('crypto');
    const buf = nodeCrypto.randomBytes(n);
    arr.set(buf);
  }
  return arr;
}

/** Nanosecond-precision timestamp string (unique per lock) */
function generateTimestamp() {
  const ms = Date.now();
  const extra = randomBytes(4);
  const hex = Array.from(extra).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${ms}.${hex}`;
}

/** Witch order: deterministic shuffle from seed */
async function witchOrder(seed) {
  const arr = Array.from({ length: NUM_GATES }, (_, i) => i);
  for (let i = NUM_GATES - 1; i > 0; i--) {
    const h = await hmacSha256(seed, `witch-shuffle-${i}`);
    const r = (new DataView(h.buffer).getUint32(0, false) >>> 0) % (i + 1);
    [arr[i], arr[r]] = [arr[r], arr[i]];
  }
  return arr;
}

/** Compute 33 gate outputs */
async function computeGates(seed) {
  const gates = [];
  for (let i = 0; i < NUM_GATES; i++) {
    const h = await hmacSha256(seed, `gate-${i}`);
    gates.push(h);
  }
  return gates;
}

/** XOR gates in witch order → master key */
function combineGates(gates, order) {
  const key = new Uint8Array(KEY_LENGTH);
  for (let i = 0; i < NUM_GATES; i++) {
    const gate = gates[order[i]];
    for (let j = 0; j < KEY_LENGTH; j++) {
      key[j] ^= gate[j];
    }
  }
  return key;
}

/** Gate output → frequency (200–1200 Hz) for display */
function gateToFrequency(gate) {
  const v = (gate[0] << 8) | gate[1];
  return 200 + (v % 1000);
}

/** Derive master key from password + salt + timestamp */
async function deriveKey(password, saltHex, timestamp) {
  const salt = typeof saltHex === 'string' ? fromHex(saltHex) : saltHex;
  const ts = String(timestamp);
  const combined = new Uint8Array(
    new TextEncoder().encode(password).length + salt.length + new TextEncoder().encode(ts).length
  );
  const enc = new TextEncoder();
  let off = 0;
  combined.set(enc.encode(password), off);
  off += enc.encode(password).length;
  combined.set(salt, off);
  off += salt.length;
  combined.set(enc.encode(ts), off);

  const seed = await sha256(combined);
  const gates = await computeGates(seed);
  const order = await witchOrder(seed);
  const masterKey = combineGates(gates, order);

  const gateFrequencies = gates.map(g => gateToFrequency(g));
  return { masterKey, gates, witchOrder: order, gateFrequencies };
}

/** LOCK: encrypt data, return blob + timestamp + gates for display */
async function lock(password, plaintext, saltHex = null) {
  const salt = saltHex ? fromHex(saltHex) : randomBytes(32);
  const saltHexOut = toHex(salt);
  const timestamp = generateTimestamp();

  const { masterKey, gateFrequencies } = await deriveKey(password, saltHexOut, timestamp);

  const crypto = getCrypto();
  const iv = randomBytes(16);
  const key = await crypto.importKey('raw', masterKey, { name: 'AES-GCM' }, false, ['encrypt']);

  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    encoded
  );

  const encArr = new Uint8Array(encrypted);
  const b64 = typeof Buffer !== 'undefined'
    ? Buffer.from(encArr).toString('base64')
    : btoa(String.fromCharCode(...encArr));

  return {
    encryptedData: b64,
    iv: toHex(iv),
    timestamp,
    salt: saltHexOut,
    gates: gateFrequencies
  };
}

/** UNLOCK: decrypt with password + stored timestamp */
async function unlock(password, timestamp, encryptedData, ivHex, saltHex) {
  if (!timestamp || !encryptedData || !ivHex) {
    throw new Error('Wrong password or corrupted data');
  }

  const salt = saltHex || '';
  const iv = fromHex(ivHex);
  const encBuf = typeof Buffer !== 'undefined'
    ? new Uint8Array(Buffer.from(encryptedData, 'base64'))
    : Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  const { masterKey, gateFrequencies } = await deriveKey(password, salt, timestamp);

  const crypto = getCrypto();
  const key = await crypto.importKey('raw', masterKey, { name: 'AES-GCM' }, false, ['decrypt']);

  try {
    const decrypted = await crypto.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      encBuf
    );
    const plaintext = new TextDecoder().decode(decrypted);
    return { data: plaintext, gates: gateFrequencies };
  } catch (_) {
    throw new Error('Wrong password or corrupted data');
  }
}

// Export for ESM / browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { lock, unlock, NUM_GATES, generateTimestamp, deriveKey };
}
if (typeof window !== 'undefined') {
  window.NanosecondLock = { lock, unlock, NUM_GATES, generateTimestamp, deriveKey };
}
