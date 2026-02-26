/**
 * POST /api/stripe-webhook
 * Stripe webhook for subscription events.
 * Requires raw body for signature verification.
 */

const { hasSupabase, getClient } = require('../lib/supabase.js');
const crypto = require('crypto');

function getRawBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => resolve(data));
  });
}

function verifySignature(payload, sig) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return false;
  const parts = (sig || '').split(',');
  let timestamp = '';
  let v1 = '';
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (k === 't') timestamp = v || '';
    if (k === 'v1') v1 = v || '';
  }
  if (!timestamp || !v1) return false;
  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  if (v1.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const raw = await getRawBody(req);
  const sig = req.headers['stripe-signature'];
  if (!verifySignature(raw, sig)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { type, data } = event;
  const obj = data?.object;

  if (type === 'checkout.session.completed' && obj?.metadata) {
    const { vaultId, plan } = obj.metadata;
    if (hasSupabase()) {
      const sb = await getClient();
      if (sb && vaultId) {
        const { data: existing } = await sb.from('stripe_subscriptions').select('id').eq('vault_id', vaultId).limit(1);
        if (existing?.length) {
          await sb.from('stripe_subscriptions').update({
            stripe_customer_id: obj.customer,
            stripe_subscription_id: obj.subscription || obj.id,
            plan: plan || 'personal',
            status: 'active'
          }).eq('vault_id', vaultId);
        } else {
          await sb.from('stripe_subscriptions').insert({
            vault_id: vaultId,
            stripe_customer_id: obj.customer,
            stripe_subscription_id: obj.subscription || obj.id,
            plan: plan || 'personal',
            status: 'active'
          });
        }
      }
    }
  }

  if (type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
    const status = obj?.status;
    if (hasSupabase() && obj?.id) {
      const sb = await getClient();
      if (sb) {
        await sb.from('stripe_subscriptions')
          .update({ status: status || 'canceled' })
          .eq('stripe_subscription_id', obj.id);
      }
    }
  }

  return res.status(200).json({ received: true });
};
