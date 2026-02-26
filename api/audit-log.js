/**
 * GET /api/audit-log? vaultId=xxx
 * Returns recent audit events for a vault.
 */

const { get } = require('./audit-store.js');
const { validateVaultId } = require('./input-validation.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const v = validateVaultId(req.query?.vaultId || 'default');
    if (!v.valid) return res.status(400).json({ error: v.error });
    const vaultId = v.value;
    const limit = Math.min(Math.max(1, parseInt(req.query?.limit || '100', 10) || 100), 200);
    const events = await get(vaultId, limit);
    return res.status(200).json({ events });
  } catch (err) {
    console.error('audit-log error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch audit log' });
  }
};
