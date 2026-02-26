/**
 * Typhoid Mary / Blue Ink Blot — DEPRECATED, use harm-barriers.js
 * Kept for backward compatibility. Delegates to The Bloodhound.
 */

const { deploy, detectAndProcess, bloodhound, carrier } = require('./harm-barriers.js');

const BLOT_PREFIX = '🔵';
const BLOT_PREFIX_ALT = '<!--blot:';

function injectBlot(contents, metadata = {}) {
  const result = deploy(contents || '', { ...metadata, vaultId: metadata.vaultId, origin: metadata.origin });
  return { poisoned: result.payload, blotId: result.scentId };
}

function detectBlot(payload) {
  return bloodhound.detectScent(payload);
}

function stripBlot(payload) {
  return bloodhound.stripScent(payload);
}

async function recordBlotDetection(blotId, context = {}) {
  return carrier.observeSpread(blotId, { endpoint: context.endpoint, action: context.action }, 1);
}

function getBlotMeta(blotId) {
  return bloodhound.getTrail(blotId);
}

module.exports = {
  injectBlot,
  detectBlot,
  stripBlot,
  recordBlotDetection,
  getBlotMeta,
  BLOT_PREFIX,
  BLOT_PREFIX_ALT
};
