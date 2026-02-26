-- Short-lived tokens issued after WebAuthn auth/verify
-- Required for unlock when vault has WebAuthn credentials

CREATE TABLE IF NOT EXISTS webauthn_session_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  vault_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_session_tokens_token ON webauthn_session_tokens (token);
CREATE INDEX IF NOT EXISTS idx_webauthn_session_tokens_vault ON webauthn_session_tokens (vault_id);
