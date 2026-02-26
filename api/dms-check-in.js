/**
 * POST /api/dms-check-in
 * Record DMS check-in for user
 */

const dmsStore = require('./dms-store.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = req.body || {};
  const uid = userId || 'default';

  const rec = await dmsStore.checkIn(uid);
  return res.status(200).json({
    success: true,
    lastCheckIn: rec.lastCheckIn,
    nextDue: rec.lastCheckIn
      ? new Date(new Date(rec.lastCheckIn).getTime() + (rec.intervalDays || 7) * 24 * 60 * 60 * 1000).toISOString()
      : null
  });
};
