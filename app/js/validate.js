/**
 * Client-side validation utilities for Vault Manager
 * Verifies data integrity before API calls and on load
 */

const Validate = {
  /** Valid hex string (even length, 0-9a-fA-F) */
  isHex(str) {
    if (typeof str !== 'string') return false;
    const s = str.replace(/\s/g, '');
    return /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
  },

  /** Valid base64 string */
  isBase64(str) {
    if (typeof str !== 'string') return false;
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  },

  /** Validate vault object has required fields */
  validateVault(vault) {
    const errors = [];
    if (!vault || typeof vault !== 'object') return { valid: false, errors: ['Invalid vault object'] };
    if (!vault.id || typeof vault.id !== 'string') errors.push('Missing or invalid vault id');
    if (!vault.name || typeof vault.name !== 'string') errors.push('Missing or invalid vault name');
    if (vault.salt && !this.isHex(vault.salt)) errors.push('Salt must be valid hex');
    if (vault.iv && !this.isHex(vault.iv)) errors.push('IV must be valid hex');
    if (vault.encryptedData && !this.isBase64(vault.encryptedData)) errors.push('Encrypted data must be valid base64');
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /** Validate Shamir shard format (hex, min length) */
  validateShard(shard) {
    const s = (shard || '').toString().replace(/\s/g, '');
    if (!s) return { valid: false, error: 'Shard is empty' };
    if (!this.isHex(s)) return { valid: false, error: 'Shard must be valid hex' };
    if (s.length < 4) return { valid: false, error: 'Shard too short' };
    return { valid: true };
  },

  /** Validate two shards have compatible format (same length for Shamir) */
  validateShardPair(s1, s2) {
    const r1 = this.validateShard(s1);
    const r2 = this.validateShard(s2);
    if (!r1.valid) return r1;
    if (!r2.valid) return r2;
    const a = (s1 || '').replace(/\s/g, '');
    const b = (s2 || '').replace(/\s/g, '');
    if (a.length !== b.length) return { valid: false, error: 'Shards must be from same split (same length)' };
    return { valid: true };
  },

  /** Validate password strength */
  validatePassword(pw) {
    const errors = [];
    if (!pw || pw.length < 12) errors.push('Password must be at least 12 characters');
    if (pw && pw.length > 128) errors.push('Password too long');
    if (typeof PasswordStrength !== 'undefined') {
      const s = PasswordStrength.score(pw);
      if (s.score < 2) errors.push('Use a stronger password (mix case, numbers, symbols)');
    }
    return { valid: errors.length === 0, errors };
  },

  /** Validate email format */
  validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  },

  /** Sanitize for display (prevent XSS) */
  escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
};

// Export for use in browser
if (typeof window !== 'undefined') window.Validate = Validate;
