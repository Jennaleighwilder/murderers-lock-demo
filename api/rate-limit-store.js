/**
 * Distributed rate limiting: per-IP and global.
 * Production: Supabase required; in-memory fallback is dev-only (fail closed).
 * Used by unlock-vault to resist distributed brute-force.
 */

const { hasSupabase, getClient } = require('../lib/supabase.js');
const { IS_PROD } = require('../lib/env.js');

const IS_PRODUCTION = IS_PROD;
const ALLOW_INMEMORY_RATELIMIT = process.env.ALLOW_INMEMORY_RATELIMIT === 'true';

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_IP = parseInt(process.env.RATE_LIMIT_PER_IP, 10) || 50;
const MAX_GLOBAL = parseInt(process.env.RATE_LIMIT_GLOBAL, 10) || 500;

const ipAttempts = new Map();
const globalAttempts = [];

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    return first || 'unknown';
  }
  return req.socket?.remoteAddress || 'unknown';
}

function getHourKey() {
  return Math.floor(Date.now() / WINDOW_MS);
}

function getWindowStart() {
  return new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS).toISOString();
}

function cleanup(attempts, cutoff) {
  return attempts.filter(t => t > cutoff);
}

function checkLimit(attempts, maxAttempts, windowMs) {
  const cutoff = Date.now() - windowMs;
  const recent = cleanup(attempts, cutoff);
  if (recent.length >= maxAttempts) {
    const oldest = Math.min(...recent);
    const retryAfter = Math.ceil((oldest + windowMs - Date.now()) / 1000);
    return { allowed: false, retryAfter: Math.max(0, retryAfter) };
  }
  return { allowed: true };
}

async function checkSupabase(req) {
  const sb = await getClient();
  if (!sb) return null;
  const ip = getClientIP(req);
  const hourKey = getHourKey();
  const ipKey = `ip:${ip}:${hourKey}`;
  const globalKey = `global:${hourKey}`;
  const windowStart = getWindowStart();

  try {
    const { data: ipRow } = await sb.from('rate_limits').select('count').eq('key', ipKey).single();
    const { data: globalRow } = await sb.from('rate_limits').select('count').eq('key', globalKey).single();

    const ipCount = ipRow?.count ?? 0;
    const globalCount = globalRow?.count ?? 0;

    if (ipCount >= MAX_PER_IP) {
      const retryAfter = Math.ceil((hourKey + 1) * WINDOW_MS / 1000 - Date.now() / 1000);
      return { allowed: false, retryAfter: Math.max(0, retryAfter) };
    }
    if (globalCount >= MAX_GLOBAL) {
      const retryAfter = Math.ceil((hourKey + 1) * WINDOW_MS / 1000 - Date.now() / 1000);
      return { allowed: false, retryAfter: Math.max(0, retryAfter) };
    }
    return { allowed: true };
  } catch (_) {
    return null;
  }
}

async function recordSupabase(req) {
  const sb = await getClient();
  if (!sb) return;
  const ip = getClientIP(req);
  const hourKey = getHourKey();
  const ipKey = `ip:${ip}:${hourKey}`;
  const globalKey = `global:${hourKey}`;
  const windowStart = getWindowStart();

  try {
    await sb.rpc('increment_rate_limit', { p_key: ipKey, p_window_start: windowStart });
    await sb.rpc('increment_rate_limit', { p_key: globalKey, p_window_start: windowStart });
  } catch (_) {}
}

function recordIP(ip) {
  const key = `ip:${ip}`;
  if (!ipAttempts.has(key)) ipAttempts.set(key, []);
  const arr = ipAttempts.get(key);
  const cutoff = Date.now() - WINDOW_MS;
  ipAttempts.set(key, cleanup(arr, cutoff).concat(Date.now()));
}

function recordGlobal() {
  const cutoff = Date.now() - WINDOW_MS;
  globalAttempts.push(Date.now());
  const recent = cleanup(globalAttempts, cutoff);
  globalAttempts.length = 0;
  globalAttempts.push(...recent);
}

function checkMem(req) {
  const ip = getClientIP(req);
  const ipArr = ipAttempts.get(`ip:${ip}`) || [];
  const ipCutoff = Date.now() - WINDOW_MS;
  const ipRecent = cleanup(ipArr, ipCutoff);
  const globalCutoff = Date.now() - WINDOW_MS;
  const globalRecent = cleanup(globalAttempts, globalCutoff);
  const ipResult = checkLimit(ipRecent, MAX_PER_IP, WINDOW_MS);
  if (!ipResult.allowed) return ipResult;
  const globalResult = checkLimit(globalRecent, MAX_GLOBAL, WINDOW_MS);
  if (!globalResult.allowed) return globalResult;
  return { allowed: true };
}

/**
 * Check if unlock attempt is allowed.
 * Production: requires Supabase; in-memory fallback only when ALLOW_INMEMORY_RATELIMIT=true.
 * @param {object} req
 * @returns {Promise<{ allowed: boolean, retryAfter?: number }>}
 */
async function checkUnlockLimit(req) {
  if (hasSupabase()) {
    const result = await checkSupabase(req);
    if (result) return result;
  }
  if (IS_PRODUCTION && !ALLOW_INMEMORY_RATELIMIT) {
    return { allowed: false, retryAfter: 3600 };
  }
  return checkMem(req);
}

/**
 * Record an unlock attempt.
 * Production: requires Supabase; in-memory only when ALLOW_INMEMORY_RATELIMIT=true.
 * @param {object} req
 */
async function recordUnlockAttempt(req) {
  if (hasSupabase()) {
    await recordSupabase(req);
  } else if (IS_PRODUCTION && !ALLOW_INMEMORY_RATELIMIT) {
    return;
  }
  const ip = getClientIP(req);
  recordIP(ip);
  recordGlobal();
}

module.exports = {
  getClientIP,
  checkUnlockLimit,
  recordUnlockAttempt,
  WINDOW_MS,
  MAX_PER_IP,
  MAX_GLOBAL
};
