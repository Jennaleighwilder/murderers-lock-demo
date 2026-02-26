/**
 * Stripe client for subscriptions.
 * Personal $29/mo, Professional $99/mo.
 */

function hasStripe() {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_'));
}

let _stripe = null;

function getStripe() {
  if (!hasStripe()) return null;
  if (_stripe) return _stripe;
  const Stripe = require('stripe');
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

const PLANS = {
  personal: { priceId: process.env.STRIPE_PRICE_PERSONAL || 'price_personal', amount: 2900 },
  professional: { priceId: process.env.STRIPE_PRICE_PROFESSIONAL || 'price_professional', amount: 9900 }
};

module.exports = { hasStripe, getStripe, PLANS };
