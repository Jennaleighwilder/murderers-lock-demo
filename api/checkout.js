/**
 * POST /api/checkout
 * Create Stripe Checkout session for Personal ($29/mo) or Professional ($99/mo)
 * Body: { plan: 'personal'|'professional', vaultId?, successUrl?, cancelUrl? }
 */

const { hasStripe, getStripe, PLANS } = require('../lib/stripe.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!hasStripe()) {
    return res.status(503).json({ error: 'Billing not configured', message: 'Stripe is not configured.' });
  }

  try {
    const { plan, vaultId, successUrl, cancelUrl } = req.body || {};
    const p = plan === 'professional' ? 'professional' : 'personal';
    const planConfig = PLANS[p];
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: p === 'professional' ? 'Professional Plan' : 'Personal Plan',
            description: p === 'professional' ? '$99/month - Team features' : '$29/month - Personal use'
          },
          unit_amount: planConfig.amount,
          recurring: { interval: 'month' }
        },
        quantity: 1
      }],
      success_url: successUrl || `${req.headers.origin || 'https://murderers-lock-demo.vercel.app'}/?checkout=success`,
      cancel_url: cancelUrl || `${req.headers.origin || 'https://murderers-lock-demo.vercel.app'}/?checkout=cancel`,
      metadata: { vaultId: vaultId || '', plan: p }
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (err) {
    console.error('checkout error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
};
