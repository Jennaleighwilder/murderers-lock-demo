/**
 * POST /api/unlock-vault
 * Unlock vault with password OR session token (from recovery)
 * Supports Nanosecond Lock (33 Gates + timestamp) and legacy Argon2id
 * Rate limited: 10 attempts/hour per vault
 * Murder count: max 3 failures → lockjaw (demo); 33 for production
 * Graduated lockjaw: Stage 1 (10) slow mode, Stage 2 (20) email recovery only, Stage 3 (33) full lockdown
 * Panic code: returns fake success, triggers silent alarm
 * Device binding: requires trusted device when Supabase configured
 */

const { unlockVault } = require('../lib/recovery.js');
const { unlock } = require('../lib/nanosecond-lock-production.js');
const { getOrCreate, save } = require('./shared-unlock-store.js');
const { checkUnlockLimit, recordUnlockAttempt } = require('./rate-limit-store.js');
const recoverySessions = require('./recovery-sessions.js');
const { verify } = require('otplib');
const { get, has } = require('./2fa-store.js');
const { hasCredential } = require('./webauthn-store.js');
const webauthnSessions = require('./webauthn-unlock-sessions.js');
const webauthnVaultStore = require('../lib/webauthn-vault-store.js');
const webauthnSessionTokens = require('./webauthn-session-tokens.js');
const auditStore = require('./audit-store.js');
const { hasSupabase, getClient } = require('../lib/supabase.js');
const { verifyPanic } = require('../lib/panic.js');
const { senseThreat } = require('../lib/hive-mind.js');
const { verifyDeviceSignature } = require('../lib/device-keys.js');
const { consumeServerChallenge } = require('../lib/device-challenge-store.js');
const { buildSignature, respond, getPoisonedContents } = require('../lib/hive-defense.js');

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_ATTEMPTS_PER_HOUR = 10;
const MURDER_THRESHOLD = parseInt(process.env.MURDER_THRESHOLD, 10) || 3;
const CONSTANT_TIME_MS = process.env.TEST_FAST === '1' ? 0 : 5000;

// Graduated lockjaw stages
const STAGE_1_FAILURES = 10;
const STAGE_2_FAILURES = 20;
const STAGE_3_FAILURES = 33;
const SLOW_MODE_INTERVAL_MS = 5 * 60 * 1000;   // 1 attempt per 5 min
const STAGE_1_DURATION_MS = 15 * 60 * 1000;   // 15 min
const STAGE_2_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hr
const STAGE_3_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function cleanupOldAttempts(record) {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  record.attempts = record.attempts.filter(t => t > cutoff);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getStage(record) {
  const now = Date.now();
  if (record.stageUntil && now > record.stageUntil) {
    return { stage: 'none', until: null };
  }
  return { stage: record.lockjawStage || 'none', until: record.stageUntil };
}

function advanceStage(record) {
  const mc = record.murderCount;
  if (mc >= STAGE_3_FAILURES) {
    record.lockjawStage = 'full_lockdown';
    record.stageUntil = Date.now() + STAGE_3_DURATION_MS;
  } else if (mc >= STAGE_2_FAILURES) {
    record.lockjawStage = 'email_recovery';
    record.stageUntil = Date.now() + STAGE_2_DURATION_MS;
  } else if (mc >= STAGE_1_FAILURES) {
    record.lockjawStage = 'slow_mode';
    record.stageUntil = Date.now() + STAGE_1_DURATION_MS;
  }
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
  const webauthnSessionToken = body.webauthnSessionToken;

  // Distributed rate limit: per-IP + global (before vault-specific logic)
  const rateLimitResult = await checkUnlockLimit(req);
  if (!rateLimitResult.allowed) {
    await sleep(CONSTANT_TIME_MS);
    return res.status(429).json({
      error: 'Rate limited',
      message: `Too many unlock attempts. Try again in ${rateLimitResult.retryAfter} seconds.`,
      retryAfter: rateLimitResult.retryAfter
    });
  }

  const record = await getOrCreate(vaultId);
  cleanupOldAttempts(record);

  // Hive sense: 33 gates evaluate threat. Sensor lines trigger response.
  const signature = buildSignature(req, vaultId, record);
  const hiveResult = senseThreat(signature);
  if (hiveResult.action && hiveResult.action !== 'none') {
    const resp = await respond(hiveResult.action, vaultId, signature, req);
    if (hiveResult.action === 'abscond') {
      await sleep(CONSTANT_TIME_MS);
      return res.status(403).json({
        error: 'Hive absconded',
        lockjawEngaged: true,
        message: 'Vault has entered protective mode. Use Shamir recovery after the lockdown period.'
      });
    }
    if (hiveResult.action === 'swarm') {
      await sleep(CONSTANT_TIME_MS);
      return res.status(403).json({
        error: 'Hive swarm',
        lockjawEngaged: true,
        message: 'Unusual activity detected. Vault locked. Use Shamir recovery.'
      });
    }
    if (hiveResult.action === 'log' && resp.delay) {
      await sleep(resp.delay);
    }
  }

  // SESSION TOKEN PATH: Recovery flow - token exchanges for contents, no password
  if (sessionToken && vaultId) {
    await recordUnlockAttempt(req);
    const entry = await recoverySessions.consume(sessionToken);
    if (entry && entry.vaultId === vaultId) {
      record.murderCount = 0;
      record.attempts = [];
      await save(vaultId, record);
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
  const { stage } = getStage(record);
  if (stage === 'full_lockdown') {
    await sleep(CONSTANT_TIME_MS);
    return res.status(403).json({
      error: 'Vault locked',
      lockjawEngaged: true,
      message: 'Vault is in full lockdown. Use Shamir recovery after the lockdown period.'
    });
  }
  if (stage === 'email_recovery' && !sessionToken) {
    await sleep(CONSTANT_TIME_MS);
    return res.status(403).json({
      error: 'Email recovery only',
      lockjawEngaged: true,
      message: 'Too many failed attempts. Use Shamir recovery to restore access.'
    });
  }
  if (stage === 'slow_mode' && !sessionToken) {
    const lastAttempt = record.attempts[record.attempts.length - 1];
    if (lastAttempt && Date.now() - lastAttempt < SLOW_MODE_INTERVAL_MS) {
      const waitSec = Math.ceil((lastAttempt + SLOW_MODE_INTERVAL_MS - Date.now()) / 1000);
      await sleep(CONSTANT_TIME_MS);
      return res.status(429).json({
        error: 'Slow mode',
        message: `1 attempt per 5 minutes. Try again in ${waitSec} seconds.`,
        retryAfter: waitSec
      });
    }
  }

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
    const { password, salt, encryptedData, iv, timestamp, deviceFingerprint, devicePublicKey, deviceChallenge, deviceSignature } = body;
    if (!password || !encryptedData || !iv) {
      return res.status(400).json({ error: 'Password, encryptedData, and iv required' });
    }

    await recordUnlockAttempt(req);

    // WebAuthn passkeys (vault-scoped): require webauthnSessionToken when vault has passkeys
    if (hasSupabase()) {
      const hasPasskeys = await webauthnVaultStore.hasCredentials(vaultId);
      if (hasPasskeys) {
        const token = (webauthnSessionToken || '').trim();
        if (!token) {
          return res.status(403).json({
            error: 'WebAuthn required',
            webauthnRequired: true,
            message: 'This vault requires passkey authentication. Complete WebAuthn auth first, then retry unlock with webauthnSessionToken.'
          });
        }
        const valid = await webauthnSessionTokens.consume(token, vaultId);
        if (!valid) {
          return res.status(403).json({
            error: 'Invalid or expired WebAuthn session',
            message: 'Passkey session expired. Complete WebAuthn auth again, then retry unlock.'
          });
        }
      }
    }

    // Device binding: verify trusted device when Supabase has devices for this vault
    if (hasSupabase()) {
      const sb = await getClient();
      const { data: devices } = await sb.from('devices').select('id, device_fingerprint, device_public_key').eq('vault_id', vaultId).eq('is_trusted', true);
      if (devices?.length) {
        const hasKeyDevices = devices.some(d => d.device_public_key);
        if (hasKeyDevices) {
          const pubKey = (devicePublicKey || '').trim();
          const challenge = (deviceChallenge || '').trim();
          const sig = (deviceSignature || '').trim();
          if (!pubKey || !challenge || !sig) {
            return res.status(403).json({
              error: 'Device verification required',
              deviceKeyRequired: true,
              message: 'This vault requires cryptographic device verification. Provide devicePublicKey, deviceChallenge, deviceSignature.'
            });
          }
          const trusted = devices.find(d => d.device_public_key === pubKey);
          if (!trusted || !verifyDeviceSignature(pubKey, challenge, sig)) {
            return res.status(403).json({
              error: 'Untrusted device',
              message: 'This device is not registered or signature verification failed.'
            });
          }
          const consumed = await consumeServerChallenge(sb, vaultId, challenge);
          if (!consumed) {
            return res.status(403).json({
              error: 'Invalid device challenge',
              message: 'Challenge expired, already used, or invalid. Request a new challenge from /api/device-challenge.'
            });
          }
        } else {
          const fp = (deviceFingerprint || '').trim();
          if (!fp) {
            return res.status(403).json({
              error: 'Device verification required',
              deviceRequired: true,
              message: 'This vault requires device verification. Provide deviceFingerprint.'
            });
          }
          const trusted = devices.find(d => d.device_fingerprint === fp);
          if (!trusted) {
            return res.status(403).json({
              error: 'Untrusted device',
              message: 'This device is not registered for this vault. Register the device first.'
            });
          }
        }
      }
    }

    // Panic code: if password matches panic code, return fake success and trigger alarm
    // Constant-time: always run same duration as normal unlock to prevent timing oracle
    if (hasSupabase()) {
      const sb = await getClient();
      const { data: panic } = await sb.from('panic_codes').select('panic_hash, emergency_contacts').eq('vault_id', vaultId).single();
      if (panic?.panic_hash && verifyPanic(password, panic.panic_hash)) {
        await auditStore.append(vaultId, { action: 'panic_used', success: false, metadata: { alarm: true } });
        const { poisoned } = getPoisonedContents(vaultId, (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim());
        await sleep(CONSTANT_TIME_MS);
        return res.status(200).json({
          success: true,
          contents: poisoned,
          murderCount: record.murderCount,
          lockjawEngaged: false
        });
      }
    }

    let contents;
    let gates;
    if (timestamp && salt) {
      const result = await unlock(password, timestamp, encryptedData, iv, salt);
      const parsed = JSON.parse(result.data);
      contents = parsed.secrets || '';
      gates = result.gates;
    } else if (salt) {
      const result = await unlockVault(password, salt, encryptedData, iv);
      contents = result.contents;
    } else {
      return res.status(400).json({ error: 'Salt required' });
    }

    // 2FA check: TOTP or WebAuthn
    const has2fa = await has('default');
    if (has2fa) {
      const totpCode = body.totpCode;
      const secret = await get('default');
      const totpValid = totpCode && secret?.secret
        ? await verify({ secret: secret.secret, token: String(totpCode).trim() })
        : false;
      if (!totpCode || !secret || !totpValid) {
        return res.status(403).json({
          error: '2FA required',
          twoFactorRequired: true,
          message: 'Enter your 6-digit authenticator code.'
        });
      }
    } else if (hasCredential('default')) {
      const sessionId = webauthnSessions.create(contents);
      return res.status(403).json({
        error: 'WebAuthn required',
        webauthnRequired: true,
        webauthnSessionId: sessionId,
        message: 'Use your security key to complete unlock.'
      });
    }

    // Success: reset murder count
    record.murderCount = 0;
    record.attempts = [];
    await save(vaultId, record);

    await auditStore.append(vaultId, { action: 'unlock', success: true });

    const deviceRegSessions = require('./device-registration-sessions.js');
    const deviceRegToken = await deviceRegSessions.create(vaultId);

    const response = {
      success: true,
      contents,
      murderCount: 0,
      lockjawEngaged: false,
      deviceRegistrationToken: deviceRegToken
    };
    if (gates) response.gates = gates;

    return res.status(200).json(response);
  } catch (err) {
    // Failed unlock: increment murder count (unless already at lockjaw), add to rate limit
    if (!lockjawEngaged) {
      record.murderCount++;
      record.attempts.push(Date.now());
      advanceStage(record);
      await save(vaultId, record);
    }
    const nowLockjaw = record.murderCount >= MURDER_THRESHOLD;
    const lockjawWarning = nowLockjaw
      ? `Vault locked. Use Shamir recovery to restore access.`
      : `${MURDER_THRESHOLD - record.murderCount} attempts remaining before lockjaw.`;

    await sleep(CONSTANT_TIME_MS);

    if (err.message && (err.message.includes('Invalid password') || err.message.includes('Wrong password') || err.message.includes('corrupted'))) {
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
