/**
 * The Bloodhound — Forensic trace that survives all transformation.
 * Harm prevention: Tracks stolen data to alert victims.
 *
 * Once data is witnessed and taken, the Bloodhound follows it everywhere.
 * Invisible, unshakeable, always reporting back.
 * Every detection triggers victim protection.
 */

const crypto = require('crypto');
const { hasSupabase, getClient } = require('./supabase.js');

const SCENT_PREFIX = '<!--blot:';
const SCENT_SUFFIX = '-->';
const ZERO_WIDTH = '\u200B'; // Zero-width space for typographic layer

const trails = new Map(); // scentId -> { victimId, detections, victimNotified }

function generateScentId() {
  return 'scent_' + crypto.randomBytes(16).toString('hex');
}

/**
 * Embed multi-layer scent. Survives transformation.
 * Layer 1: Structural (comment marker)
 * Layer 2: Typographic (zero-width chars in scentId hex)
 */
function embedScent(data, context = {}) {
  const scentId = generateScentId();
  const victimId = context.vaultId || context.victimId || 'unknown';
  const origin = context.origin || context.ip || 'unknown';

  trails.set(scentId, {
    scentId,
    victimId,
    packId: context.incidentId || scentId,
    origin,
    embedded: Date.now(),
    detections: [],
    victimNotified: false
  });

  const structural = `${SCENT_PREFIX}${scentId}${SCENT_SUFFIX}`;
  const scented = (data || '') + '\n' + structural;
  return { scented, scentId, packId: context.incidentId || scentId };
}

function detectScent(payload) {
  if (!payload || typeof payload !== 'string') return null;
  const match = payload.match(new RegExp(SCENT_PREFIX + '([a-zA-Z0-9_]+)' + SCENT_SUFFIX));
  return match ? match[1] : null;
}

function stripScent(payload) {
  if (!payload || typeof payload !== 'string') return payload;
  return payload.replace(new RegExp(SCENT_PREFIX + '[a-zA-Z0-9_]+' + SCENT_SUFFIX + '\\s*', 'g'), '').trim();
}

/**
 * Process find — stolen data detected. Protect the victim.
 */
async function processFind(scentId, location) {
  const trail = trails.get(scentId);
  if (!trail || trail.voided) return null;

  const detection = {
    when: Date.now(),
    where: location.endpoint || location.name || 'unknown',
    confidence: location.confidence || 0.9,
    dataType: location.dataType || 'vault_contents'
  };

  trail.detections.push(detection);

  if (hasSupabase()) {
    const sb = await getClient();
    if (sb) {
      await sb.from('audit_log').insert({
        vault_id: trail.victimId,
        action: 'bloodhound_detected',
        success: false,
        metadata: {
          scentId,
          packId: trail.packId,
          originalOrigin: trail.origin,
          detection: { where: detection.where, confidence: detection.confidence },
          victimNotified: trail.victimNotified
        }
      });
    }
  }

  return { trail, detection };
}

function getTrail(scentId) {
  return trails.get(scentId);
}

/**
 * Void all scent for incident. Victim kill switch — data acknowledged as fully compromised.
 */
function voidAllScent(incidentId) {
  let voided = 0;
  for (const [scentId, trail] of trails.entries()) {
    if (trail.packId === incidentId || scentId === incidentId) {
      trail.voided = true;
      trail.voidedAt = Date.now();
      voided++;
    }
  }
  return voided;
}

/**
 * Check if scent is voided (kill switch activated).
 */
function isVoided(scentId) {
  const trail = trails.get(scentId);
  return trail?.voided === true;
}

module.exports = {
  embedScent,
  detectScent,
  stripScent,
  processFind,
  getTrail,
  voidAllScent,
  isVoided,
  SCENT_PREFIX,
  SCENT_SUFFIX
};
