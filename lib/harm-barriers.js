/**
 * Harm Barriers — Three barriers, one purpose: protect victims.
 *
 * The Witness: Forces attacker to engage actively, reveals their methods.
 * The Bloodhound: Forensic trace that survives, tracks to alert victims.
 * The Carrier: Spreads tracing through criminal networks, maps harm infrastructure.
 */

const TheWitness = require('./the-witness.js');
const TheBloodhound = require('./the-bloodhound.js');
const TheCarrier = require('./the-carrier.js');
const TheDragon = require('./the-dragon.js');

const witness = new (class {
  sense(signature) { return TheWitness.witnessSense(signature); }
  recordTestimony(pattern) { return TheWitness.recordTestimony(pattern); }
  getTestimony(id) { return TheWitness.getTestimony(id); }
})();

const bloodhound = new (class {
  embedScent(data, ctx) { return TheBloodhound.embedScent(data, ctx); }
  detectScent(payload) { return TheBloodhound.detectScent(payload); }
  stripScent(payload) { return TheBloodhound.stripScent(payload); }
  processFind(scentId, location) { return TheBloodhound.processFind(scentId, location); }
  getTrail(scentId) { return TheBloodhound.getTrail(scentId); }
  voidAllScent(incidentId) { return TheBloodhound.voidAllScent(incidentId); }
})();

const carrier = new (class {
  createCarrier(data, ctx) { return TheCarrier.createCarrier(data, ctx); }
  observeSpread(strainId, location, gen) { return TheCarrier.observeSpread(strainId, location, gen); }
  getSpreadMap(id) { return TheCarrier.getSpreadMap(id); }
  deactivateStrain(incidentId) { return TheCarrier.deactivateStrain(incidentId); }
  detectScent(payload) { return TheCarrier.detectScent(payload); }
  stripScent(payload) { return TheCarrier.stripScent(payload); }
  detectCanary(payload) { return TheCarrier.detectCanary(payload); }
})();

/**
 * Deploy all three when breach/attack detected.
 * Returns poisoned payload with scent for victim protection.
 */
function deploy(vaultData, context) {
  const testimony = witness.recordTestimony({
    endpoint: context.endpoint,
    ip: context.origin || context.ip,
    userAgent: context.userAgent
  });

  const { scented, scentId, packId } = bloodhound.embedScent(vaultData || '[]', {
    ...context,
    incidentId: context.incidentId,
    testimonyId: testimony?.testimonyId
  });

  const carrierPayload = carrier.createCarrier(scented, {
    ...context,
    scentId,
    incidentId: packId,
    timestamp: Date.now()
  });

  TheDragon.guardHoard(context.vaultId || context.victimId, context.vaultId, {
    scentId,
    incidentId: packId,
    ...context
  });

  return {
    payload: carrierPayload.payload,
    scentId,
    packId,
    testimonyId: testimony?.testimonyId
  };
}

/**
 * Detect scent in incoming data — carrier has spread.
 */
async function detectAndProcess(payload, location) {
  const scentId = carrier.detectScent(payload);
  if (!scentId) return null;
  return carrier.observeSpread(scentId, { ...location, rawPayload: payload }, 1);
}

/**
 * Victim Kill Switch — Emergency stop.
 * Victim acknowledges data is fully compromised. System stops tracking, starts containing.
 */
async function victimKillSwitch(victimId, incidentId) {
  const voided = bloodhound.voidAllScent(incidentId);
  const deactivated = carrier.deactivateStrain(incidentId);

  const { hasSupabase, getClient } = require('./supabase.js');
  if (hasSupabase()) {
    const sb = await getClient();
    if (sb) {
      await sb.from('audit_log').insert({
        vault_id: victimId,
        action: 'kill_switch_activated',
        success: true,
        metadata: {
          incidentId,
          voidedScent: voided,
          deactivatedStrains: deactivated,
          reason: 'VICTIM_INITIATED_KILL_SWITCH'
        }
      });
    }
  }

  return {
    voided,
    deactivated,
    incidentId,
    message: 'KILL_SWITCH_ACTIVATED',
    victimNotified: true
  };
}

module.exports = {
  witness,
  bloodhound,
  carrier,
  dragon: TheDragon,
  deploy,
  detectAndProcess,
  victimKillSwitch
};
