const BASE_URL = process.env.REDTEAM_BASE_URL || process.env.API_BASE || 'http://localhost:3000';
const MODE = (process.env.REDTEAM_MODE || 'lite').toLowerCase();
const VAULT_ID = process.env.REDTEAM_VAULT_ID || (MODE === 'lite' ? 'default' : '');
const PASSWORD = process.env.REDTEAM_PASSWORD || '';
const TOTP = process.env.REDTEAM_TOTP || '';
const SUPABASE_ON = (process.env.REDTEAM_SUPABASE_ON || 'true').toLowerCase() === 'true';
const KDF_TYPE_EXPECTED = process.env.REDTEAM_KDF_TYPE_EXPECTED || '';
const REAL_VAULT = (process.env.REDTEAM_REAL_VAULT || 'false').toLowerCase() === 'true';

function requireEnv() {
  if (MODE !== 'lite') {
    if (!VAULT_ID) throw new Error('REDTEAM_VAULT_ID is required for full/webauthn mode');
    if (!PASSWORD) throw new Error('REDTEAM_PASSWORD is required for full/webauthn mode');
  }
}

module.exports = {
  BASE_URL, VAULT_ID, PASSWORD, TOTP, SUPABASE_ON, KDF_TYPE_EXPECTED, MODE, REAL_VAULT, requireEnv,
};
