-- Explicit kdf_type for vaults (auditable, server-authoritative)
-- Run: supabase db push
-- When vaults table exists: ALTER TABLE vaults ADD COLUMN kdf_type TEXT NOT NULL DEFAULT 'argon2id';

-- Note: If vaults table does not exist, create it first. This migration assumes vaults exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vaults') THEN
    ALTER TABLE vaults ADD COLUMN IF NOT EXISTS kdf_type TEXT NOT NULL DEFAULT 'argon2id';
  END IF;
END $$;
