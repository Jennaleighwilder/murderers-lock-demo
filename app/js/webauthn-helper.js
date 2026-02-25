/**
 * WebAuthn Helper - Placeholder for Phase 2 hardware key support
 *
 * Usage (when integrated):
 *   const webauthn = await WebAuthnHelper.createCredential('vault-' + vaultId);
 *   const assertion = await WebAuthnHelper.getAssertion(challenge);
 *
 * Requires server-side challenge generation and verification.
 * Browser support: Chrome, Firefox, Safari, Edge (FIDO2)
 */

(function (global) {
  'use strict';

  const WebAuthnHelper = {
    /** Check if WebAuthn is available */
    isAvailable() {
      return typeof window !== 'undefined' &&
        window.PublicKeyCredential &&
        typeof window.PublicKeyCredential === 'function';
    },

    /** Create credential (registration) - placeholder */
    async createCredential(rpId, userId) {
      if (!this.isAvailable()) {
        throw new Error('WebAuthn not supported');
      }
      // Server must provide challenge, user, etc.
      const options = {
        challenge: new Uint8Array(32), // From server
        rp: { name: 'The Murderer\'s Lock', id: rpId || window.location.hostname },
        user: {
          id: new Uint8Array(16),
          name: userId || 'user',
          displayName: 'Vault User'
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ]
      };
      const credential = await navigator.credentials.create({ publicKey: options });
      return credential;
    },

    /** Get assertion (authentication) - placeholder */
    async getAssertion(challenge, allowCredentials) {
      if (!this.isAvailable()) {
        throw new Error('WebAuthn not supported');
      }
      const options = {
        challenge: typeof challenge === 'string' ? this._base64ToBuffer(challenge) : challenge,
        allowCredentials: allowCredentials || [],
        timeout: 60000
      };
      const assertion = await navigator.credentials.get({ publicKey: options });
      return assertion;
    },

    _base64ToBuffer(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebAuthnHelper;
  } else {
    global.WebAuthnHelper = WebAuthnHelper;
  }
})(typeof window !== 'undefined' ? window : globalThis);
