/**
 * Single source of truth for production detection.
 * Use IS_PROD everywhere; no ad-hoc NODE_ENV checks.
 * CI must set NODE_ENV=production for prod deployments.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

module.exports = { IS_PROD };
