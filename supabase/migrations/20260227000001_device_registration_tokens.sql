-- Tokens proving recent unlock; required for device registration
-- Run: supabase db push

CREATE TABLE IF NOT EXISTS device_registration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL,
  vault_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_reg_tokens_token ON device_registration_tokens (token);
CREATE INDEX IF NOT EXISTS idx_device_reg_tokens_expires ON device_registration_tokens (expires_at);
