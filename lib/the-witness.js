/**
 * The Witness — Forces attacker to process actively, reveals their methods.
 * Harm prevention: Creates evidence for victim protection.
 *
 * The 33 gates require active engagement. Automated consumption fails.
 * Every choice reveals cognition. Every hesitation reveals sophistication.
 * This becomes evidence for The Bloodhound's tracking.
 */

const crypto = require('crypto');
const { senseThreat, getHive, NUM_GATES } = require('./hive-mind.js');

const testimonies = new Map(); // testimonyId -> { pattern, sophistication, infrastructureHints }

/**
 * Record testimony when attacker interacts with witnessed data.
 * Called when we observe their behavior (e.g. which endpoint they hit, timing).
 */
function recordTestimony(interactionPattern) {
  const testimonyId = crypto.randomUUID();
  const sophistication = assessSophistication(interactionPattern);
  const infrastructureHints = inferInfrastructure(interactionPattern);

  const testimony = {
    testimonyId,
    timestamp: Date.now(),
    firstSelection: interactionPattern.firstSelection,
    hesitationMs: interactionPattern.timeToFirstAction,
    triedToFlatten: interactionPattern.triedToFlatten,
    automationDetected: interactionPattern.automationDetected,
    sophistication,
    infrastructureHints,
    endpoint: interactionPattern.endpoint
  };

  testimonies.set(testimonyId, testimony);
  return testimony;
}

function assessSophistication(pattern) {
  if (!pattern) return 'UNKNOWN';
  if (pattern.automationDetected) return 'AUTOMATED';
  if (pattern.hesitationMs !== undefined && pattern.hesitationMs < 500) return 'SCRIPTED';
  if (pattern.triedToFlatten) return 'HIGH';
  return 'MANUAL';
}

function inferInfrastructure(pattern) {
  const hints = [];
  if (pattern.userAgent) hints.push(`ua:${pattern.userAgent.slice(0, 50)}`);
  if (pattern.ip) hints.push(`ip:${pattern.ip}`);
  if (pattern.endpoint) hints.push(`ep:${pattern.endpoint}`);
  return hints;
}

/**
 * The 33 gates are the witness. Sense threat = force them to reveal.
 */
function witnessSense(signature) {
  return senseThreat(signature);
}

function getTestimony(testimonyId) {
  return testimonies.get(testimonyId);
}

module.exports = {
  recordTestimony,
  witnessSense,
  getTestimony,
  assessSophistication,
  NUM_GATES
};
