/**
 * The Carrier — Data that spreads tracing through criminal networks.
 * Harm prevention: Maps entire harm infrastructure.
 *
 * When attackers share, trade, or process the data, they spread the scent.
 * Each new location reveals buyers, resellers, tools, jurisdictions.
 * This maps who profits from harm.
 *
 * Canary trap: Same functional data, subtly different per recipient.
 * If we see canary A at marketplace X and canary B at forum Y, we know
 * which buyer leaked/resold — harm network has commercial structure.
 */

const crypto = require('crypto');
const { embedScent, detectScent, stripScent, processFind, getTrail } = require('./the-bloodhound.js');

const CANARY_PREFIX = '<!--canary:';
const CANARY_SUFFIX = '-->';

const infections = new Map(); // strainId -> { origin, spread, generations }
const spreadMap = new Map(); // incidentId -> network graph
const canaryRegistry = new Map(); // canaryHash -> { recipientFingerprint, firstSeen }

/**
 * Embed recipient marker (canary). Unique per recipient, survives copy-paste.
 * When same vault appears with different canaries, we know resale occurred.
 */
function embedRecipientMarker(recipientFingerprint, scentId) {
  const hmac = crypto.createHmac('sha256', scentId || 'default');
  hmac.update(String(recipientFingerprint));
  return hmac.digest('hex').slice(0, 16);
}

/**
 * Create canary payload — same functional data, subtly different per recipient.
 */
function createCanaryPayload(baseData, recipientFingerprint, scentId) {
  const canaryHash = embedRecipientMarker(recipientFingerprint, scentId);
  canaryRegistry.set(canaryHash, {
    recipientFingerprint: String(recipientFingerprint).slice(0, 64),
    firstSeen: Date.now()
  });
  const canaryMarker = `${CANARY_PREFIX}${canaryHash}${CANARY_SUFFIX}`;
  const payload = (baseData || '') + '\n' + canaryMarker;
  return { payload, canaryHash };
}

/**
 * Detect canary in payload. Returns canaryHash if found.
 */
function detectCanary(payload) {
  if (!payload || typeof payload !== 'string') return null;
  const match = payload.match(new RegExp(CANARY_PREFIX + '([a-f0-9]+)' + CANARY_SUFFIX));
  return match ? match[1] : null;
}

/**
 * Strip canary from payload.
 */
function stripCanary(payload) {
  if (!payload || typeof payload !== 'string') return payload;
  return payload.replace(new RegExp(CANARY_PREFIX + '[a-f0-9]+' + CANARY_SUFFIX + '\\s*', 'g'), '').trim();
}

/**
 * Create carrier from witnessed, scented data.
 * Optionally add canary for recipient fingerprinting.
 */
function createCarrier(witnessedAndScentedData, context = {}) {
  const scentId = detectScent(witnessedAndScentedData);
  const sid = scentId || context.scentId || 'unknown';

  let payload = witnessedAndScentedData;
  let canaryHash = null;
  const recipientFp = context.origin || context.ip || context.vaultId || 'unknown';
  if (recipientFp) {
    const canaryResult = createCanaryPayload(payload, recipientFp, sid);
    payload = canaryResult.payload;
    canaryHash = canaryResult.canaryHash;
  }

  infections.set(sid, {
    strainId: sid,
    origin: { ...context, timestamp: Date.now(), canaryHash },
    spread: new Map(),
    generations: 0,
    active: true
  });

  return {
    payload,
    strainId: sid,
    canaryHash,
    strainMeta: {
      strainId: sid,
      originVictim: context.vaultId || context.victimId || 'unknown',
      originTime: Date.now(),
      generation: 0
    }
  };
}

/**
 * Observe spread — carrier detected at new location.
 */
async function observeSpread(strainId, newLocation, generation = 1) {
  let infection = infections.get(strainId);
  if (infection && !infection.active) return null;
  if (!infection) {
    const TheBloodhound = require('./the-bloodhound.js');
    const trail = TheBloodhound.getTrail(strainId);
    if (trail) {
      infection = { strainId, origin: { vaultId: trail.victimId, timestamp: trail.embedded }, spread: new Map(), generations: 0 };
      infections.set(strainId, infection);
    } else return null;
  }

  const host = newLocation.endpoint || newLocation.host || 'unknown';
  const canaryHash = detectCanary(newLocation.rawPayload || '');
  infection.spread.set(host, {
    firstSeen: Date.now(),
    generation,
    location: newLocation,
    dataType: newLocation.dataType || 'vault_contents',
    canaryHash: canaryHash || null
  });
  infection.generations = Math.max(infection.generations, generation);

  const result = await processFind(strainId, { ...newLocation, confidence: 0.95 });
  mapHarmNetwork(infection);
  return result;
}

function mapHarmNetwork(infection) {
  const spreadValues = [...infection.spread.values()];
  const canaries = [...new Set(spreadValues.map(s => s.canaryHash).filter(Boolean))];
  const network = {
    patientZero: infection.origin.vaultId || infection.origin.victimId || 'unknown',
    initialTheft: infection.origin.timestamp || infection.origin.embedded,
    detections: spreadValues.length,
    locations: spreadValues.map(s => ({
      where: s.location?.endpoint || s.location?.where,
      generation: s.generation,
      canaryHash: s.canaryHash
    })),
    generations: infection.generations,
    uniqueCanaries: canaries.length,
    resaleIndicated: canaries.length > 1
  };

  const incidentId = infection.origin.incidentId || infection.strainId;
  spreadMap.set(incidentId, network);
  return network;
}

function getSpreadMap(incidentId) {
  return spreadMap.get(incidentId);
}

/**
 * Deactivate strain. Victim kill switch — stop tracking, mark as compromised.
 */
function deactivateStrain(incidentId) {
  let deactivated = 0;
  for (const [strainId, infection] of infections.entries()) {
    if (infection.origin?.incidentId === incidentId || strainId === incidentId || infection.strainId === incidentId) {
      infection.active = false;
      infection.deactivatedAt = Date.now();
      deactivated++;
    }
  }
  return deactivated;
}

function getCanaryMeta(canaryHash) {
  return canaryRegistry.get(canaryHash);
}

module.exports = {
  createCarrier,
  createCanaryPayload,
  embedRecipientMarker,
  detectCanary,
  stripCanary,
  observeSpread,
  mapHarmNetwork,
  getSpreadMap,
  getCanaryMeta,
  deactivateStrain,
  detectScent,
  stripScent,
  embedScent
};
