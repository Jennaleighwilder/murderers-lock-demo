/**
 * POST /api/unlock-vault
 * Unlock vault with password OR session token (from recovery)
 * Rate limited: 10 attempts/hour per vault
 * Murder count: max 33 failures → lockjaw
 */

const { unlockVault } = require('../lib/recovery.js');
const { getOrCreate } = require('./shared-unlock-store.js');
const recoverySessions = require('./recovery-sessions.js');

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_ATTEMPTS_PER_HOUR = 10;
const MURDER_THRESHOLD = 33;
const CONSTANT_TIME_MS = 5000; // Prevent timing attacks

function cleanupOldAttempts(record) {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  record.attempts = record.attempts.filter(t => t > cutoff);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const vaultId = body.vaultId || 'default';
  const sessionToken = body.sessionToken;
  const record = getOrCreate(vaultId);
  cleanupOldAttempts(record);

  // SESSION TOKEN PATH: Recovery flow - token exchanges for contents, no password
  if (sessionToken && vaultId) {
    const entry = recoverySessions.consume(sessionToken);
    if (entry && entry.vaultId === vaultId) {
      record.murderCount = 0;
      record.attempts = [];
      return res.status(200).json({
        success: true,
        contents: entry.contents,
        murderCount: 0,
        lockjawEngaged: false
      });
    }
    return res.status(401).json({
      error: 'Invalid or expired recovery session',
      message: 'Recovery session expired or invalid. Please try recovery again.'
    });
  }

  const lockjawEngaged = record.murderCount >= MURDER_THRESHOLD;
  // When lockjaw engaged: still allow unlock attempt - correct password (from recovery) clears it

  // Rate limit: 10 attempts per hour (skip when lockjaw - user may have recovered password)
  if (!lockjawEngaged && record.attempts.length >= MAX_ATTEMPTS_PER_HOUR) {
    const oldest = Math.min(...record.attempts);
    const resetIn = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - Date.now()) / 1000);
    await sleep(CONSTANT_TIME_MS);
    return res.status(429).json({
      error: 'Rate limited',
      murderCount: record.murderCount,
      lockjawEngaged: false,
      message: `Too many attempts. Try again in ${Math.max(0, resetIn)} seconds.`,
      retryAfter: resetIn
    });
  }

  try {
    const { password, salt, encryptedData, iv } = body;
    if (!password || !salt || !encryptedData || !iv) {
      return res.status(400).json({ error: 'Password, salt, encryptedData, and iv required' });
    }

    const result = await unlockVault(password, salt, encryptedData, iv);

    // Success: reset murder count
    record.murderCount = 0;
    record.attempts = [];

    return res.status(200).json({
      success: true,
      contents: result.contents,
      murderCount: 0,
      lockjawEngaged: false
    });
  } catch (err) {
    // Failed unlock: increment murder count (unless already at lockjaw), add to rate limit
    if (!lockjawEngaged) {
      record.murderCount++;
      record.attempts.push(Date.now());
    }
    const nowLockjaw = record.murderCount >= MURDER_THRESHOLD;
    const lockjawWarning = nowLockjaw
      ? `Vault locked. Use Shamir recovery to restore access.`
      : `${MURDER_THRESHOLD - record.murderCount} attempts remaining before lockjaw.`;

    await sleep(CONSTANT_TIME_MS);

    if (err.message && err.message.includes('Invalid password')) {
      return res.status(nowLockjaw ? 403 : 401).json({
        error: nowLockjaw ? 'Lockjaw engaged' : 'Invalid password',
        murderCount: record.murderCount,
        lockjawEngaged: nowLockjaw,
        message: nowLockjaw
          ? `Vault locked after ${MURDER_THRESHOLD} failed attempts. Use Shamir recovery.`
          : `Invalid password. Murder count: ${record.murderCount}/${MURDER_THRESHOLD}.`,
        lockjawWarning
      });
    }

    console.error('unlock-vault error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to unlock vault',
      murderCount: record.murderCount,
      lockjawEngaged: nowLockjaw
    });
  }
};
