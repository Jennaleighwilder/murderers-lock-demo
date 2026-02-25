/**
 * Recovery session store - token -> { contents, vaultId, expiresAt }
 * Tokens expire after 5 minutes. Password/contents never leave server.
 */

const crypto = require('crypto');

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function store(contents, vaultId) {
  const token = generateToken();
  sessions.set(token, {
    contents: contents || '',
    vaultId,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function get(token) {
  if (!token || typeof token !== 'string') return null;
  const entry = sessions.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return entry;
}

function consume(token) {
  const entry = get(token);
  if (entry) {
    sessions.delete(token);
    return entry;
  }
  return null;
}

function cleanupExpired() {
  const now = Date.now();
  for (const [token, entry] of sessions.entries()) {
    if (now > entry.expiresAt) sessions.delete(token);
  }
}

module.exports = { store, get, consume, cleanupExpired };
