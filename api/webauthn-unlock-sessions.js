/**
 * Temporary sessions for WebAuthn unlock flow.
 * When password is correct but WebAuthn required, we store contents here.
 * Consumed by webauthn-auth-verify.
 */

const sessions = new Map();
const TTL_MS = 2 * 60 * 1000; // 2 min

function create(contents) {
  const id = require('crypto').randomBytes(24).toString('hex');
  sessions.set(id, { contents, ts: Date.now() });
  return id;
}

function consume(id) {
  const s = sessions.get(id);
  if (!s) return null;
  if (Date.now() - s.ts > TTL_MS) {
    sessions.delete(id);
    return null;
  }
  sessions.delete(id);
  return s.contents;
}

module.exports = { create, consume };
