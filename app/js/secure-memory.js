/**
 * Secure Memory - Best-effort memory zeroing for sensitive data
 *
 * JavaScript strings are immutable and cannot be reliably zeroed. This library
 * provides best-effort protection by:
 * - Zeroing TypedArrays/ArrayBuffers (which CAN be overwritten)
 * - Clearing form inputs promptly
 * - Providing SecureBuffer for sensitive data that can be zeroed on dispose
 *
 * LIMITATION: Complete memory security is not possible in JS. Use as defense-in-depth.
 */
(function (global) {
  'use strict';

  const SecureMemory = {
    /** Zero a Uint8Array in place. Call before releasing reference. */
    zero(arr) {
      if (!arr || !(arr instanceof Uint8Array)) return;
      try {
        arr.fill(0);
      } catch (e) {}
    },

    /** Clear a form input/textarea and blur to reduce retention. */
    clearInput(el) {
      if (!el) return;
      try {
        el.value = '';
        el.blur();
      } catch (e) {}
    },

    /**
     * Create a SecureBuffer from a string. Data is stored in Uint8Array.
     * Call .zero() when done to overwrite memory.
     */
    createBuffer(str) {
      if (typeof str !== 'string') return null;
      const enc = new TextEncoder();
      const bytes = enc.encode(str);
      const buf = new Uint8Array(bytes.length);
      buf.set(bytes);
      return {
        getString() {
          return new TextDecoder().decode(buf);
        },
        zero() {
          SecureMemory.zero(buf);
        },
        length: buf.length
      };
    },

    /**
     * Run a callback with a secure buffer, then zero it.
     * Use when you need to read string once and then dispose.
     */
    withBuffer(str, fn) {
      const buf = SecureMemory.createBuffer(str);
      if (!buf) return fn ? fn('') : undefined;
      try {
        const result = fn ? fn(buf.getString()) : undefined;
        return result;
      } finally {
        buf.zero();
      }
    },

    /** Clear multiple sensitive elements by selector. */
    clearElements(selectors) {
      (Array.isArray(selectors) ? selectors : [selectors]).forEach(sel => {
        try {
          const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
          if (el) SecureMemory.clearInput(el);
        } catch (e) {}
      });
    },

    /** Register elements to clear on page unload (beforeunload). */
    clearOnUnload(selectors) {
      const sels = Array.isArray(selectors) ? selectors : [selectors];
      const handler = () => {
        SecureMemory.clearElements(sels);
      };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecureMemory;
  } else {
    global.SecureMemory = SecureMemory;
  }
})(typeof window !== 'undefined' ? window : globalThis);
