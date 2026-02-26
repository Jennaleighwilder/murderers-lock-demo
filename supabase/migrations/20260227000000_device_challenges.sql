-- Server-issued one-time device challenges (replay-proof)
-- Never store raw challenge; only hash.
-- Run: supabase db push (or execute in Supabase SQL editor)

CREATE TABLE IF NOT EXISTS device_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id TEXT NOT NULL,
  challenge_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_challenges_vault_id ON device_challenges (vault_id);
CREATE INDEX IF NOT EXISTS idx_device_challenges_expires_at ON device_challenges (expires_at);
CREATE INDEX IF NOT EXISTS idx_device_challenges_used ON device_challenges (vault_id, used) WHERE used = FALSE;
-- Elite: partial index for consume query (vault_id + challenge_hash, unused only)
CREATE INDEX IF NOT EXISTS idx_device_challenges_consume ON device_challenges (vault_id, challenge_hash) WHERE used = FALSE;

COMMENT ON TABLE device_challenges IS 'One-time server-issued challenges for device binding; raw challenge never stored';

-- Atomic consume: prevents race where two requests claim same challenge
CREATE OR REPLACE FUNCTION consume_device_challenge(p_vault_id TEXT, p_challenge_hash TEXT)
RETURNS BOOLEAN AS $$
  WITH target AS (
    SELECT id FROM device_challenges
    WHERE vault_id = p_vault_id AND challenge_hash = p_challenge_hash
      AND used = FALSE AND expires_at > now()
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE device_challenges SET used = TRUE
    WHERE id IN (SELECT id FROM target)
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM updated) > 0;
$$ LANGUAGE sql;
