/**
 * The Dragon — Maximum aggression within legal bounds.
 * Phase 1: Honey vault, alert-only fire credentials, passive pursuit.
 * We protect the client. We do not hack. We do not destroy.
 */

const crypto = require('crypto');

const hoard = new Map();
const threats = new Map();

/**
 * Guard a vault. Registers it for dragon protection.
 */
function guardHoard(victimId, vaultId, context = {}) {
  const key = `${victimId || 'unknown'}:${vaultId || 'unknown'}`;
  hoard.set(key, {
    status: 'GUARDED',
    victimId,
    vaultId,
    guardedAt: Date.now(),
    context: { ...context },
    aggressionLevel: 'PHASE_1_LEGAL'
  });
  return { guarded: true, key };
}

/**
 * Honey vault — credible fake data for duress/panic path.
 * Real-looking data, all traceable, all leading to honeypot services.
 * Alert-only: no lockout, no DoS.
 */
function openHoneyVault(duressContext) {
  const incidentId = duressContext.incidentId || crypto.randomUUID();
  const traceId = crypto.randomBytes(8).toString('hex');

  const honey = {
    _meta: { traceId, incidentId, type: 'honey_vault', embedded: Date.now() },
    cryptoWallets: generateHoneypotWallets(traceId),
    bankAccounts: generateHoneypotAccounts(traceId),
    credentials: generateFireCredentials(duressContext, traceId),
    timeLocks: generateTimeLockTraps(duressContext, traceId)
  };

  return honey;
}

function generateHoneypotWallets(traceId) {
  return [
    { network: 'BTC', address: `bc1q${traceId}${crypto.randomBytes(10).toString('hex')}`, label: 'Primary' },
    { network: 'ETH', address: `0x${traceId}${crypto.randomBytes(19).toString('hex')}`, label: 'Savings' }
  ];
}

function generateHoneypotAccounts(traceId) {
  return [
    { bank: 'Chase', last4: traceId.slice(0, 4), routing: `0210${traceId.slice(0, 4)}` },
    { bank: 'BofA', last4: traceId.slice(4, 8), routing: `0260${traceId.slice(4, 8)}` }
  ];
}

/**
 * Fire credentials — alert-only. When used, services log/alert.
 * No lockout, no rate-limit trigger. Defensive.
 */
function generateFireCredentials(context, traceId) {
  const base = `${traceId}:${context.origin || 'unknown'}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', 'dragon-fire').update(base).digest('hex').slice(0, 12);
  return [
    { service: 'email', username: `honey-${hmac}@example.com`, note: 'ALERT_ON_USE' },
    { service: 'banking', username: `honey_${hmac}`, note: 'ALERT_ON_USE' }
  ];
}

function generateTimeLockTraps(context, traceId) {
  return [{
    id: traceId,
    unlockAfter: Date.now() + 3600000,
    note: 'Time-delayed decryption — attacker must wait, must expose tools'
  }];
}

/**
 * Passive pursuit incentives — embed in carrier data.
 * Economic incentives that make criminals spread our tracking.
 * We don't force. We make it profitable for them to do what we want.
 */
function embedPursuitIncentives(carrierPayload, incidentId) {
  const incentives = {
    resellerBonus: '10% extra for bulk buyers',
    validationReward: 'Payment for confirming data works',
    referralProgram: 'Bring new buyers, earn commission'
  };
  const marker = `<!--dragon:pursuit:${incidentId}-->`;
  return (carrierPayload || '') + '\n' + marker;
}

/**
 * Record threat when canary sings or breach detected.
 */
function recordThreat(incidentId, canarySong, coalMine) {
  const entry = threats.get(incidentId) || { incidentId, songs: [], firstSeen: Date.now() };
  entry.songs.push({
    timestamp: Date.now(),
    tone: canarySong?.tone,
    condition: canarySong?.condition,
    coalMine: coalMine || 'unknown',
    response: 'ALERT_ONLY'
  });
  threats.set(incidentId, entry);
  return entry;
}

/**
 * Get guarded hoard status.
 */
function getHoardStatus(victimId, vaultId) {
  const key = `${victimId || 'unknown'}:${vaultId || 'unknown'}`;
  return hoard.get(key);
}

/**
 * Get threat record.
 */
function getThreat(incidentId) {
  return threats.get(incidentId);
}

module.exports = {
  guardHoard,
  openHoneyVault,
  generateFireCredentials,
  embedPursuitIncentives,
  recordThreat,
  getHoardStatus,
  getThreat
};
