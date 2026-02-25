/**
 * Shard Protection - PIN-encrypted shards for localStorage
 * PBKDF2 (100k iterations) + AES-256-GCM
 * Protects shards if device is stolen - useless without PIN
 */

const ShardProtection = {
  CONFIG_KEY: 'vault_shard_pin_config',
  PBKDF2_ITERATIONS: 100000,
  SALT_LENGTH: 32,
  IV_LENGTH: 12,
  KEY_LENGTH: 256,

  /** Check if PIN is configured */
  hasPin() {
    try {
      const cfg = JSON.parse(localStorage.getItem(this.CONFIG_KEY) || '{}');
      return !!(cfg.salt && cfg.hasPin);
    } catch {
      return false;
    }
  },

  /** Set new PIN (or change). Creates salt if first time. */
  async setPin(pin) {
    if (!pin || pin.length < 4) throw new Error('PIN must be at least 4 digits');
    const salt = this._randomBytes(this.SALT_LENGTH);
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify({ salt: this._toHex(salt), hasPin: true }));
    return true;
  },

  /** Verify PIN by attempting to derive key (doesn't decrypt, just validates format) */
  async verifyPin(pin) {
    const cfg = JSON.parse(localStorage.getItem(this.CONFIG_KEY) || '{}');
    if (!cfg.salt) return false;
    try {
      await this._deriveKey(pin, this._fromHex(cfg.salt));
      return true;
    } catch {
      return false;
    }
  },

  /** Encrypt shards with PIN. Returns encrypted format for storage. */
  async encryptShards(shards, pin) {
    if (!shards || !Array.isArray(shards) || shards.length === 0) throw new Error('Shards required');
    const cfg = JSON.parse(localStorage.getItem(this.CONFIG_KEY) || '{}');
    if (!cfg.salt) throw new Error('Set PIN first');
    const key = await this._deriveKey(pin, this._fromHex(cfg.salt));
    const encrypted = [];
    for (const shard of shards) {
      const iv = this._randomBytes(this.IV_LENGTH);
      const ciphertext = await this._encrypt(key, this._fromHex(shard.replace(/\s/g, '')), iv);
      encrypted.push({ iv: this._toHex(iv), enc: this._toBase64(ciphertext) });
    }
    return encrypted;
  },

  /** Decrypt shards with PIN. Returns plain hex shards. */
  async decryptShards(encryptedShards, pin) {
    if (!encryptedShards || !Array.isArray(encryptedShards)) throw new Error('Encrypted shards required');
    const cfg = JSON.parse(localStorage.getItem(this.CONFIG_KEY) || '{}');
    if (!cfg.salt) throw new Error('PIN not configured');
    const key = await this._deriveKey(pin, this._fromHex(cfg.salt));
    const decrypted = [];
    for (const item of encryptedShards) {
      if (!item.iv || !item.enc) throw new Error('Invalid encrypted shard format');
      const plain = await this._decrypt(key, this._fromBase64(item.enc), this._fromHex(item.iv));
      decrypted.push(this._toHex(plain));
    }
    return decrypted;
  },

  /** Check if shards are encrypted (object with iv/enc) or plain (hex string) */
  isEncrypted(shards) {
    if (!shards || !Array.isArray(shards) || shards.length === 0) return false;
    const first = shards[0];
    return typeof first === 'object' && first !== null && 'iv' in first && 'enc' in first;
  },

  /** Protect all vaults with plaintext shards - encrypt with current PIN */
  async protectAllUnprotected(pin) {
    if (!this.hasPin()) throw new Error('Set PIN first');
    const valid = await this.verifyPin(pin);
    if (!valid) throw new Error('Incorrect PIN');
    const vaults = JSON.parse(localStorage.getItem('vault_manager_vaults') || '[]');
    let count = 0;
    for (const vault of vaults) {
      const stored = localStorage.getItem('vault_shards_' + vault.id);
      if (!stored || this.isEncrypted(JSON.parse(stored))) continue;
      const shards = JSON.parse(stored);
      const encrypted = await this.encryptShards(shards, pin);
      localStorage.setItem('vault_shards_' + vault.id, JSON.stringify(encrypted));
      count++;
    }
    return count;
  },

  /** Change PIN - re-encrypt all vault shards with new PIN */
  async changePin(oldPin, newPin) {
    if (!this.hasPin()) throw new Error('No PIN set');
    const valid = await this.verifyPin(oldPin);
    if (!valid) throw new Error('Current PIN incorrect');
    if (!newPin || newPin.length < 4) throw new Error('New PIN must be at least 4 digits');

    const vaults = JSON.parse(localStorage.getItem('vault_manager_vaults') || '[]');
    const newSalt = this._randomBytes(this.SALT_LENGTH);
    const oldKey = await this._deriveKey(oldPin, this._fromHex(JSON.parse(localStorage.getItem(this.CONFIG_KEY)).salt));
    const newKey = await this._deriveKey(newPin, newSalt);

    for (const vault of vaults) {
      const stored = localStorage.getItem('vault_shards_' + vault.id);
      if (!stored) continue;
      const data = JSON.parse(stored);
      if (!this.isEncrypted(data)) continue; // Skip plaintext
      const decrypted = [];
      for (const item of data) {
        const plain = await this._decrypt(oldKey, this._fromBase64(item.enc), this._fromHex(item.iv));
        decrypted.push(plain);
      }
      const reEncrypted = [];
      for (const plain of decrypted) {
        const iv = this._randomBytes(this.IV_LENGTH);
        const ciphertext = await this._encrypt(newKey, plain, iv);
        reEncrypted.push({ iv: this._toHex(iv), enc: this._toBase64(ciphertext) });
      }
      localStorage.setItem('vault_shards_' + vault.id, JSON.stringify(reEncrypted));
    }
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify({ salt: this._toHex(newSalt), hasPin: true }));
    return true;
  },

  async _deriveKey(pin, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: this.PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async _encrypt(key, data, iv) {
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data);
    return new Uint8Array(enc);
  },

  async _decrypt(key, ciphertext, iv) {
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ciphertext);
    return new Uint8Array(dec);
  },

  _randomBytes(n) {
    return crypto.getRandomValues(new Uint8Array(n));
  },

  _toHex(buf) {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  _fromHex(hex) {
    const m = hex.match(/.{1,2}/g) || [];
    return new Uint8Array(m.map(byte => parseInt(byte, 16)));
  },

  _toBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  },

  _fromBase64(b64) {
    return new Uint8Array([...atob(b64)].map(c => c.charCodeAt(0)));
  }
};

if (typeof window !== 'undefined') window.ShardProtection = ShardProtection;
