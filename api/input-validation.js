/**
 * API input validation - armor against injection and DoS
 */

const MAX_PASSWORD_LEN = 256;
const MAX_VAULT_CONTENTS_LEN = 2 * 1024 * 1024; // 2MB
const MAX_NAME_LEN = 256;
const VAULT_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const HEX_PATTERN = /^[0-9a-fA-F]+$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

function validateVaultId(vaultId) {
  if (!vaultId || typeof vaultId !== 'string') return { valid: false, error: 'Vault ID required' };
  const trimmed = vaultId.trim();
  if (trimmed.length > 128) return { valid: false, error: 'Vault ID too long' };
  if (!VAULT_ID_PATTERN.test(trimmed)) return { valid: false, error: 'Invalid vault ID format' };
  return { valid: true, value: trimmed };
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return { valid: false, error: 'Password required' };
  if (password.length < 12) return { valid: false, error: 'Password must be at least 12 characters' };
  if (password.length > MAX_PASSWORD_LEN) return { valid: false, error: 'Password too long' };
  return { valid: true, value: password };
}

function validateName(name) {
  if (!name || typeof name !== 'string') return { valid: false, error: 'Name required' };
  const trimmed = name.trim();
  if (trimmed.length === 0) return { valid: false, error: 'Name required' };
  if (trimmed.length > MAX_NAME_LEN) return { valid: false, error: 'Name too long' };
  if (/[<>]/.test(trimmed)) return { valid: false, error: 'Name contains invalid characters' };
  return { valid: true, value: trimmed };
}

function validateHex(str, fieldName) {
  if (!str || typeof str !== 'string') return { valid: false, error: `${fieldName} required` };
  if (!HEX_PATTERN.test(str)) return { valid: false, error: `Invalid ${fieldName} (must be hex)` };
  if (str.length > 10000) return { valid: false, error: `${fieldName} too long` };
  return { valid: true, value: str };
}

function validateBase64(str, fieldName) {
  if (!str || typeof str !== 'string') return { valid: false, error: `${fieldName} required` };
  if (str.length % 4 !== 0 || !BASE64_PATTERN.test(str)) return { valid: false, error: `Invalid ${fieldName} (must be base64)` };
  try {
    if (Buffer.byteLength(str, 'utf8') > MAX_VAULT_CONTENTS_LEN) return { valid: false, error: `${fieldName} too large` };
    Buffer.from(str, 'base64');
    return { valid: true, value: str };
  } catch {
    return { valid: false, error: `Invalid ${fieldName} (must be base64)` };
  }
}

function validateContents(contents) {
  if (contents == null) return { valid: true, value: '' };
  if (typeof contents !== 'string') return { valid: false, error: 'Contents must be string' };
  if (contents.length > MAX_VAULT_CONTENTS_LEN) return { valid: false, error: 'Vault contents too large' };
  return { valid: true, value: contents };
}

module.exports = {
  validateVaultId,
  validatePassword,
  validateName,
  validateHex,
  validateBase64,
  validateContents,
  MAX_PASSWORD_LEN,
  MAX_VAULT_CONTENTS_LEN
};
