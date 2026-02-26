/**
 * POST /api/victim-kill-switch
 * Victim-initiated emergency stop. Voids all scent, deactivates carrier strains.
 * Body: { victimId, incidentId }
 */

const { victimKillSwitch } = require('../lib/harm-barriers.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { victimId, incidentId } = req.body || {};
    const vid = victimId || 'default';
    const iid = (incidentId || '').trim();
    if (!iid) return res.status(400).json({ error: 'incidentId required' });

    const result = await victimKillSwitch(vid, iid);

    return res.status(200).json({
      success: true,
      ...result,
      message: 'Kill switch activated. All tracking scents voided. Data marked as compromised.'
    });
  } catch (err) {
    console.error('victim-kill-switch error:', err);
    return res.status(500).json({ error: err.message || 'Failed to activate kill switch' });
  }
};
