/**
 * POST /api/enterprise-contact
 * Enterprise contact form - submit for sales follow-up.
 * Body: { company, name, email, seats?, message? }
 */

function validateEmailSimple(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { company, name, email, seats, message } = req.body || {};
    const companyName = (company || '').trim().slice(0, 200);
    const contactName = (name || '').trim().slice(0, 200);
    const contactEmail = (email || '').trim().toLowerCase();
    const seatCount = Math.min(Math.max(0, parseInt(seats, 10) || 0), 100000);
    const msg = (message || '').trim().slice(0, 2000);

    if (!companyName || !contactName || !contactEmail) {
      return res.status(400).json({ error: 'Company, name, and email required' });
    }
    if (!validateEmailSimple(contactEmail)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    // In production: send to CRM, Formspree, or email service
    // For now: log and return success
    console.log('[Enterprise contact]', { company: companyName, name: contactName, email: contactEmail, seats: seatCount, message: msg });

    return res.status(200).json({
      success: true,
      message: 'Thank you. Our team will contact you shortly.'
    });
  } catch (err) {
    console.error('enterprise-contact error:', err);
    return res.status(500).json({ error: err.message || 'Failed to submit' });
  }
};
