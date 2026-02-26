/**
 * In-memory store for WebAuthn challenges and credentials.
 * Production: use DB. Key = userId (we use 'default').
 */

const challenges = new Map();
const credentials = new Map();

function setChallenge(userId, challenge) {
  challenges.set(userId || 'default', { challenge, ts: Date.now() });
}

function getChallenge(userId) {
  const c = challenges.get(userId || 'default');
  if (!c) return null;
  if (Date.now() - c.ts > 5 * 60 * 1000) {
    challenges.delete(userId || 'default');
    return null;
  }
  challenges.delete(userId || 'default');
  return c.challenge;
}

function setCredential(userId, cred) {
  const list = credentials.get(userId || 'default') || [];
  list.push(cred);
  credentials.set(userId || 'default', list);
}

function getCredentials(userId) {
  return credentials.get(userId || 'default') || [];
}

function hasCredential(userId) {
  const list = credentials.get(userId || 'default') || [];
  return list.length > 0;
}

function removeCredentials(userId) {
  credentials.delete(userId || 'default');
}

module.exports = { setChallenge, getChallenge, setCredential, getCredentials, hasCredential, removeCredentials };
