-- Add device_public_key for cryptographic device binding
-- Run: supabase db push (or execute in Supabase SQL editor)

ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_public_key TEXT;
COMMENT ON COLUMN devices.device_public_key IS 'SPKI public key base64; when set, unlock requires ECDSA P-256 signature verification';
