# Security Verification

## Panic Code Timing

**Verified:** Constant-time. The panic path uses `crypto.timingSafeEqual` for hash comparison and `sleep(CONSTANT_TIME_MS)` before returning, matching the normal unlock path. An attacker cannot distinguish panic vs real password via response timing.

## Stripe Webhook

**Verified:** Signature verification uses Stripe's format: `t=timestamp,v1=signature`. The signed payload is `timestamp.payload` (raw body). HMAC-SHA256 with `STRIPE_WEBHOOK_SECRET`. Webhook without valid signature returns 400.

## Graduated Lockjaw State

**Verified:** `shared-unlock-store.js` persists to Supabase `unlock_state` when configured. `lockjaw_stage` and `stage_until` survive redeploy. Without Supabase, state resets on cold start (in-memory fallback).

## Device Fingerprinting

**Client-defined:** The server accepts `deviceFingerprint` from the client. Recommended composition:
- Hash of: user-agent + screen resolution + timezone + language + canvas fingerprint (if available)
- Use a library like FingerprintJS or similar for consistency
- **Limitation:** Software fingerprinting adds friction, not hardware security. Headers can be spoofed. For stronger binding, use WebAuthn (hardware-backed).

## 33 Gates: Mechanism vs Visualization

**The 33 gates are real crypto.** From `nanosecond-lock-production.js`:
- `deriveKey`: password + salt + timestamp → SHA256 → seed
- `computeGates`: 33 HMAC-SHA256 rounds → 33 gate outputs
- `witchOrder`: deterministic shuffle from seed
- `combineGates`: XOR all 33 gates in witch order → master key
- Master key → AES-256-GCM

The frequencies (200–1200 Hz) are derived from gate outputs for display. Same gates, dual purpose: **key derivation + visualization**. The lock is: 33-gate KDF + AES-256-GCM + rate limiting + device binding + panic code.

## Quantum Claims

**Honest:** Argon2id + AES-256-GCM is not quantum-resistant. Grover's algorithm halves AES effective key space (128-bit security). Shor's does not apply (no RSA/ECC).

**Recommended copy:** "Quantum-computer hardened" (rate limiting works regardless) or "Post-quantum ready" (migration path). Avoid "quantum-resistant" until CRYSTALS-Kyber or similar is integrated.
