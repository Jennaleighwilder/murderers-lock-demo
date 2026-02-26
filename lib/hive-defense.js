/**
 * Hive Defense — Response orchestration.
 * log → swarm → abscond. Workers respond; drones wait.
 *
 * Defensive only: no offensive counter-attack (no DDOS, no hacking back).
 * Swarm = deploy decoys, escalate lockjaw, alert.
 * Abscond = scatter shards, time-lock, activate drones, DMS.
 */

const { getHive, STATES } = require('./hive-mind.js');
const { hasSupabase, getClient } = require('./supabase.js');
const { deploy } = require('./harm-barriers.js');
const auditStore = require('../api/audit-store.js'); // eslint-disable-line

const ABSCOND_DAYS = 30;

/**
 * Build threat signature from request context.
 */
function buildSignature(req, vaultId, record = {}) {
  const now = Date.now();
  const attempts = record.attempts || [];
  const recent = attempts.filter(t => now - t < 60 * 60 * 1000);
  const timingEntropy = recent.length > 0
    ? Math.abs(recent[recent.length - 1] - (recent[0] || now)) / 1000
    : 0;
  return {
    requestCount: attempts.length,
    murderCount: record.murderCount || 0,
    timingEntropy: Math.min(1, timingEntropy / 60),
    parallelRequests: 0, // Would need global request counter per IP
    vaultId,
    ip: (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim()
  };
}

/**
 * Perimeter response: log, slight delay.
 */
async function respondLog(vaultId, signature, req) {
  await auditStore.append(vaultId, {
    action: 'hive_perimeter',
    success: true,
    metadata: { threat: signature, response: 'log' }
  });
  return { response: 'log', delay: 100 };
}

/**
 * Swarm response: escalate lockjaw, deploy decoy flag, alert.
 * Defensive: we don't attack the attacker. We harden our position.
 */
async function respondSwarm(vaultId, signature, req) {
  const hive = getHive();
  hive.setState(STATES.SWARM);

  await auditStore.append(vaultId, {
    action: 'hive_swarm',
    success: true,
    metadata: { threat: signature, response: 'swarm' }
  });

  if (hasSupabase()) {
    const sb = await getClient();
    if (sb) {
      await sb.from('unlock_state').update({
        lockjaw_stage: 'full_lockdown',
        stage_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }).eq('vault_id', vaultId);
    }
  }

  return { response: 'swarm', lockjaw: true };
}

/**
 * Abscond response: queen hidden, shards scattered, time-lock, drones armed.
 * Vault enters liminal state — unreachable for ABSCOND_DAYS.
 */
async function respondAbscond(vaultId, signature, req) {
  const hive = getHive();
  hive.setState(STATES.ABSENT);

  await auditStore.append(vaultId, {
    action: 'hive_abscond',
    success: true,
    metadata: {
      threat: signature,
      response: 'abscond',
      abscondUntil: Date.now() + ABSCOND_DAYS * 24 * 60 * 60 * 1000
    }
  });

  if (hasSupabase()) {
    const sb = await getClient();
    if (sb) {
      await sb.from('unlock_state').update({
        lockjaw_stage: 'full_lockdown',
        stage_until: new Date(Date.now() + ABSCOND_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        murder_count: 33,
        updated_at: new Date().toISOString()
      }).eq('vault_id', vaultId);
    }
  }

  return { response: 'abscond', lockjaw: true, abscondDays: ABSCOND_DAYS };
}

/**
 * Route response by action.
 */
async function respond(action, vaultId, signature, req) {
  switch (action) {
    case 'log': return respondLog(vaultId, signature, req);
    case 'swarm': return respondSwarm(vaultId, signature, req);
    case 'abscond': return respondAbscond(vaultId, signature, req);
    default: return { response: 'none' };
  }
}

/**
 * Get poisoned contents with Bloodhound scent (Carrier).
 * Harm prevention: victim can be alerted when scent is detected.
 */
function getPoisonedContents(vaultId, origin = 'unknown') {
  const result = deploy('[]', { vaultId, origin, endpoint: 'unlock-vault' });
  return { poisoned: result.payload, blotId: result.scentId };
}

module.exports = {
  buildSignature,
  respond,
  respondLog,
  respondSwarm,
  respondAbscond,
  getPoisonedContents,
  ABSCOND_DAYS
};
