/**
 * POST /api/generate-shards
 * Generate Shamir 2-of-3 shards from a secret (e.g. vault password)
 */

const { splitSecret } = require('../lib/recovery.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { secret } = req.body || {};
    if (!secret || typeof secret !== 'string') {
      return res.status(400).json({ error: 'Secret required' });
    }

    const shards = splitSecret(secret);

    return res.status(200).json({
      success: true,
      shards
    });
  } catch (err) {
    console.error('generate-shards error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate shards' });
  }
};
