/**
 * Supabase client for persistent storage.
 * Uses service role for server-side API routes.
 */

function hasSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!(url && process.env.SUPABASE_SERVICE_ROLE_KEY && url !== 'https://your-project.supabase.co');
}

let _client = null;

async function getClient() {
  if (!hasSupabase()) return null;
  if (_client) return _client;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  _client = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _client;
}

module.exports = { hasSupabase, getClient };
