/**
 * POST /api/import-passwords
 * Log import event for audit. Actual import is client-side.
 * Body: { vaultId, format, count, action: 'merge'|'replace' }
 */

const auditStore = require('./audit-store.js');
const { validateVaultId } = require('./input-validation.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { vaultId, format, count, action } = req.body || {};
    const v = validateVaultId(vaultId || 'default');
    if (!v.valid) return res.status(400).json({ error: v.error });
    const vid = v.value;
    const n = Math.min(Math.max(0, parseInt(count, 10) || 0), 50000);
    const act = action === 'replace' ? 'replace' : 'merge';

    await auditStore.append(vid, {
      action: 'import',
      success: true,
      format: format || 'unknown',
      count: n,
      importAction: act
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('import-passwords error:', err);
    return res.status(500).json({ error: err.message || 'Failed to log import' });
  }
};
