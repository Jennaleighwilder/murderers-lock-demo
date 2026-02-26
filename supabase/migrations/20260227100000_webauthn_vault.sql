-- Vault-scoped WebAuthn passkeys (hardware-backed device binding)
-- challenge_hash only; raw challenge never stored
-- Atomic consume for replay prevention

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_vault_id ON webauthn_credentials (vault_id);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id TEXT NOT NULL,
  challenge_hash TEXT NOT NULL,
  type TEXT NOT NULL, -- 'registration' | 'authentication'
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_vault_id ON webauthn_challenges (vault_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires_at ON webauthn_challenges (expires_at);
-- Partial index: fast consume lookup on unused challenges (elite perf as table grows)
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_consume ON webauthn_challenges (vault_id, challenge_hash, type) WHERE used = FALSE;

COMMENT ON TABLE webauthn_credentials IS 'Hardware-backed passkeys per vault; non-exportable';
COMMENT ON TABLE webauthn_challenges IS 'One-time WebAuthn challenges; raw challenge never stored';

-- Atomic consume: prevents replay
CREATE OR REPLACE FUNCTION consume_webauthn_challenge(
  p_vault_id TEXT,
  p_challenge_hash TEXT,
  p_type TEXT
) RETURNS BOOLEAN AS $$
  WITH target AS (
    SELECT id FROM webauthn_challenges
    WHERE vault_id = p_vault_id AND challenge_hash = p_challenge_hash
      AND type = p_type AND used = FALSE AND expires_at > now()
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE webauthn_challenges SET used = TRUE
    WHERE id IN (SELECT id FROM target)
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM updated) > 0;
$$ LANGUAGE sql;
