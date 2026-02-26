# Device Key Migration — Cryptographic Device Binding

Add `device_public_key` column to support cryptographic device binding (replaces spoofable fingerprint).

## Supabase Migration

Run the migration in Supabase SQL editor, or use `supabase db push`:

```sql
-- See supabase/migrations/20260226000000_add_device_public_key.sql
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_public_key TEXT;
COMMENT ON COLUMN devices.device_public_key IS 'SPKI public key base64; when set, unlock requires signature verification';
```

## Behavior

- **Legacy:** Device with only `device_fingerprint` → unlock requires `deviceFingerprint` (unchanged).
- **New:** Device with `device_public_key` → unlock requires `deviceChallenge` + `deviceSignature` (signed by device private key).

## Client Flow (device key)

1. Generate ECDSA P-256 keypair. Store private key in IndexedDB (JWK).
2. **Unlock first:** Unlock vault with password → receive `deviceRegistrationToken`.
3. **Register:** POST `devicePublicKey` + `deviceRegistrationToken` to `/api/device-register`.
4. **Unlock (with device):** Fetch challenge from `/api/device-challenge` → sign with private key → POST `deviceChallenge`, `deviceSignature` to `/api/unlock-vault`.
