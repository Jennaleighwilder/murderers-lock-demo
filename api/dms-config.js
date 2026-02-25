/**
 * GET/POST /api/dms-config
 * DMS configuration - enabled, interval, grace, contacts
 */

const dmsStore = require('./dms-store.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const userId = (req.body || req.query || {}).userId || 'default';

  if (req.method === 'GET') {
    const rec = dmsStore.get(userId);
    return res.status(200).json(rec);
  }

  if (req.method === 'POST') {
    const { enabled, intervalDays, graceDays, contacts } = req.body || {};
    const updates = {};
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (typeof intervalDays === 'number') updates.intervalDays = intervalDays;
    if (typeof graceDays === 'number') updates.graceDays = graceDays;
    if (Array.isArray(contacts)) updates.contacts = contacts;
    const rec = dmsStore.set(userId, updates);
    return res.status(200).json({ success: true, ...rec });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
