/**
 * Secure Copy — Copy to clipboard with auto-clear after 30s
 * Prevents passwords lingering in clipboard
 */
(function (global) {
  'use strict';

  let clearTimer = null;
  const CLEAR_MS = 30000;

  function copy(text, onCopied) {
    if (!text || typeof text !== 'string') return Promise.resolve(false);
    if (clearTimer) clearTimeout(clearTimer);
    return navigator.clipboard.writeText(text).then(() => {
      clearTimer = setTimeout(() => {
        navigator.clipboard.writeText('');
        clearTimer = null;
      }, CLEAR_MS);
      if (typeof onCopied === 'function') onCopied('copied');
      return true;
    }).catch(() => false);
  }

  function showToast(message, duration = 3000) {
    const t = document.createElement('div');
    t.className = 'secure-copy-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:16px 24px;background:rgba(0,245,255,0.2);border:2px solid var(--neon-cyan);border-radius:12px;color:var(--neon-cyan);font-weight:600;z-index:9999;animation:fadeIn 0.3s;';
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300);
    }, duration);
  }

  global.SecureCopy = {
    copy,
    showToast,
    CLEAR_MS
  };
})(typeof window !== 'undefined' ? window : globalThis);
