#!/usr/bin/env node
/**
 * Subprocess: verify rate limit fails closed when production + no Supabase.
 * Called by fail-closed-invariants.test.js with isolated env.
 */

const { checkUnlockLimit } = require('../api/rate-limit-store.js');

const req = { headers: {}, socket: {} };
checkUnlockLimit(req).then((result) => {
  const isProd = process.env.NODE_ENV === 'production';
  const hasSupabaseUrl = !!process.env.SUPABASE_URL;
  if (isProd && !hasSupabaseUrl) {
    if (result.allowed === false) {
      console.log('OK: allowed=false (fail closed)');
      process.exit(0);
    } else {
      console.error('FAIL: allowed=true when production and no Supabase');
      process.exit(1);
    }
  } else {
    console.log('OK: not production or Supabase configured');
    process.exit(0);
  }
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
