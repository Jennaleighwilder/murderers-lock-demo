/**
 * POST /api/recover-vault
 * Recover vault from 2+ Shamir shards
 *
 * SECURITY:
 * - Per-IP rate limit: 10 attempts/hour, 24hr block
 * - Per-vault rate limit: 5 attempts/hour, 24hr block
 * - Session tokens: password/contents NEVER in HTTP response
 * - Constant-time (5s) on failure to prevent timing attacks
 */

const { recoverFromShards, unlockVault } = require('../lib/recovery.js');
const { resetVault } = require('./shared-unlock-store.js');
const recoverySessions = require('./recovery-sessions.js');

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_ATTEMPTS_PER_IP = 10;
const MAX_ATTEMPTS_PER_VAULT = 5;
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const CONSTANT_TIME_MS = 5000;

const ipStore = new Map();
const vaultStore = new Map();

function getClientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : null) || req.headers['x-real-ip'] || 'unknown';
  return 'recovery:ip:' + ip.trim();
}

function getOrCreate(store, key) {
  if (!store.has(key)) {
    store.set(key, { attempts: [], blockUntil: 0 });
  }
  return store.get(key);
}

function isBlocked(record) {
  return record.blockUntil > Date.now();
}

function cleanupAndCheckLimit(record, maxAttempts) {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  record.attempts = record.attempts.filter(t => t > cutoff);
  return record.attempts.length >= maxAttempts;
}

function triggerBlock(record) {
  record.blockUntil = Date.now() + BLOCK_DURATION_MS;
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

  const clientKey = getClientKey(req);
  const ipRecord = getOrCreate(ipStore, clientKey);
  const now = Date.now();

  recoverySessions.cleanupExpired();

  if (isBlocked(ipRecord)) {
    const resetIn = Math.ceil((ipRecord.blockUntil - now) / 1000);
    await sleep(CONSTANT_TIME_MS);
    return res.status(429).json({
      error: 'Recovery blocked',
      message: `Too many recovery attempts. Blocked for 24 hours. Retry in ${resetIn} seconds.`,
      retryAfter: resetIn
    });
  }

  const ipCutoff = now - RATE_LIMIT_WINDOW_MS;
  ipRecord.attempts = ipRecord.attempts.filter(t => t > ipCutoff);
  if (ipRecord.attempts.length >= MAX_ATTEMPTS_PER_IP) {
    triggerBlock(ipRecord);
    await sleep(CONSTANT_TIME_MS);
    return res.status(429).json({
      error: 'Recovery rate limited',
      message: 'Too many recovery attempts. Blocked for 24 hours.',
      retryAfter: Math.ceil(BLOCK_DURATION_MS / 1000)
    });
  }

  try {
    const { shards, vaultId, salt, encryptedData, iv } = req.body || {};
    if (!shards || !Array.isArray(shards) || shards.length < 2) {
      await sleep(CONSTANT_TIME_MS);
      return res.status(400).json({ error: 'At least 2 shards required' });
    }

    if (vaultId) {
      const vaultRecord = getOrCreate(vaultStore, 'recovery:vault:' + vaultId);
      if (isBlocked(vaultRecord)) {
        const resetIn = Math.ceil((vaultRecord.blockUntil - now) / 1000);
        await sleep(CONSTANT_TIME_MS);
        return res.status(429).json({
          error: 'Vault recovery blocked',
          message: `This vault has too many recovery attempts. Blocked for 24 hours. Retry in ${resetIn} seconds.`,
          retryAfter: resetIn
        });
      }
      if (cleanupAndCheckLimit(vaultRecord, MAX_ATTEMPTS_PER_VAULT)) {
        triggerBlock(vaultRecord);
        await sleep(CONSTANT_TIME_MS);
        return res.status(429).json({
          error: 'Vault recovery rate limited',
          message: 'Too many recovery attempts for this vault. Blocked for 24 hours.',
          retryAfter: Math.ceil(BLOCK_DURATION_MS / 1000)
        });
      }
    }

    const { password } = recoverFromShards(shards);

    if (vaultId && salt && encryptedData && iv) {
      try {
        const result = await unlockVault(password, salt, encryptedData, iv);
        ipRecord.attempts = [];
        ipRecord.blockUntil = 0;
        if (vaultId) {
          const vaultRecord = vaultStore.get('recovery:vault:' + vaultId);
          if (vaultRecord) {
            vaultRecord.attempts = [];
            vaultRecord.blockUntil = 0;
          }
        }
        resetVault(vaultId);

        const token = recoverySessions.store(result.contents, vaultId);
        return res.status(200).json({
          success: true,
          sessionToken: token,
          vaultId
        });
      } catch (unlockErr) {
        ipRecord.attempts.push(Date.now());
        if (cleanupAndCheckLimit(ipRecord, MAX_ATTEMPTS_PER_IP)) triggerBlock(ipRecord);
        if (vaultId) {
          const vaultRecord = getOrCreate(vaultStore, 'recovery:vault:' + vaultId);
          vaultRecord.attempts.push(Date.now());
          if (cleanupAndCheckLimit(vaultRecord, MAX_ATTEMPTS_PER_VAULT)) triggerBlock(vaultRecord);
        }
        await sleep(CONSTANT_TIME_MS);
        return res.status(400).json({ error: 'Invalid shards' });
      }
    }

    ipRecord.attempts.push(Date.now());
    if (cleanupAndCheckLimit(ipRecord, MAX_ATTEMPTS_PER_IP)) triggerBlock(ipRecord);
    await sleep(CONSTANT_TIME_MS);
    return res.status(400).json({
      error: 'Vault data required for secure recovery. Include vaultId, salt, encryptedData, iv.'
    });
  } catch (err) {
    ipRecord.attempts.push(Date.now());
    if (cleanupAndCheckLimit(ipRecord, MAX_ATTEMPTS_PER_IP)) triggerBlock(ipRecord);
    console.error('recover-vault error:', err);
    await sleep(CONSTANT_TIME_MS);
    return res.status(400).json({ error: 'Invalid shards' });
  }
};
