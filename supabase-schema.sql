-- The Murderer's Lock - Supabase Schema
-- Run in Supabase SQL Editor

-- Unlock state: murder count, rate limit, graduated lockjaw
CREATE TABLE IF NOT EXISTS unlock_state (
  vault_id TEXT PRIMARY KEY,
  murder_count INT NOT NULL DEFAULT 0,
  attempts JSONB DEFAULT '[]'::jsonb,
  lockjaw_stage TEXT NOT NULL DEFAULT 'none' CHECK (lockjaw_stage IN ('none', 'slow_mode', 'email_recovery', 'full_lockdown')),
  stage_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id TEXT NOT NULL,
  action TEXT NOT NULL,
  success BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_vault ON audit_log(vault_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- Recovery sessions (short-lived tokens)
CREATE TABLE IF NOT EXISTS recovery_sessions (
  token TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  contents TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recovery_expires ON recovery_sessions(expires_at);

-- 2FA TOTP secrets
CREATE TABLE IF NOT EXISTS totp_secrets (
  vault_id TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WebAuthn credentials
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT DEFAULT 0,
  device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webauthn_vault ON webauthn_credentials(vault_id);

-- WebAuthn challenges (short-lived)
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  vault_id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DMS config
CREATE TABLE IF NOT EXISTS dms_config (
  user_id TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  interval_days INT DEFAULT 7,
  grace_days INT DEFAULT 5,
  last_check_in TIMESTAMPTZ,
  contacts JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device binding (up to 5 per vault)
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  user_agent TEXT,
  is_trusted BOOLEAN DEFAULT true,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vault_id, device_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_devices_vault ON devices(vault_id);

-- Panic/duress codes (hash only, never store plaintext)
CREATE TABLE IF NOT EXISTS panic_codes (
  vault_id TEXT PRIMARY KEY,
  panic_hash TEXT NOT NULL,
  emergency_contacts JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stripe subscriptions (for plan gating)
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id TEXT,
  user_id TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('personal', 'professional', 'enterprise')),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stripe_vault ON stripe_subscriptions(vault_id);

-- RPC: Reset unlock state (for recovery)
CREATE OR REPLACE FUNCTION reset_unlock_state(p_vault_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE unlock_state SET murder_count = 0, attempts = '[]'::jsonb, lockjaw_stage = 'none', stage_until = NULL, updated_at = NOW()
  WHERE vault_id = p_vault_id;
END;
$$ LANGUAGE plpgsql;
