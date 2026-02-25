/**
 * 33 Gates Display - Visual + Audio
 * The frequencies ARE real. Uses Web Crypto API for client-side gate derivation.
 *
 * Usage:
 *   Gates33Display.render(containerId);
 *   Gates33Display.unlockWithPassword(password, saltHex, { onSuccess, onFail });
 *   // Or: Gates33Display.animateFromServerData({ witchOrder, gateFrequencies });
 */

(function (global) {
  'use strict';

  const NUM_GATES = 33;

  async function deriveSeed(password, saltBuf) {
    const enc = new TextEncoder();
    const data = new Uint8Array(enc.encode(password).length + saltBuf.length);
    data.set(enc.encode(password));
    data.set(saltBuf, enc.encode(password).length);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash);
  }

  async function hmacSha256(key, data) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return new Uint8Array(sig);
  }

  async function witchOrder(seed) {
    const arr = Array.from({ length: NUM_GATES }, (_, i) => i);
    for (let i = NUM_GATES - 1; i > 0; i--) {
      const enc = new TextEncoder();
      const data = enc.encode(`witch-shuffle-${i}`);
      const h = await hmacSha256(seed, data);
      const r = (new DataView(h.buffer).getUint32(0, false) >>> 0) % (i + 1);
      [arr[i], arr[r]] = [arr[r], arr[i]];
    }
    return arr;
  }

  async function computeGates(seed) {
    const gates = [];
    const enc = new TextEncoder();
    for (let i = 0; i < NUM_GATES; i++) {
      const data = enc.encode(`gate-${i}`);
      const h = await hmacSha256(seed, data);
      gates.push(h);
    }
    return gates;
  }

  function gateToFrequency(gate) {
    const v = (gate[0] << 8) | gate[1];
    return 200 + (v % 1000);
  }

  const Gates33Display = {
    audioContext: null,

    /** Initialize Web Audio */
    getAudioContext() {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      return this.audioContext;
    },

    /** Play a gate tone */
    playTone(frequency, duration = 0.12) {
      try {
        const ctx = this.getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = frequency;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    },

    /** Derive gate metadata from password + salt (client-side) */
    async deriveGateData(password, saltHex) {
      const salt = new Uint8Array(
        saltHex.match(/.{2}/g).map(b => parseInt(b, 16))
      );
      const seed = await deriveSeed(password, salt);
      const gates = await computeGates(seed);
      const order = await witchOrder(seed);
      return {
        witchOrder: order,
        gateFrequencies: gates.map(g => gateToFrequency(g))
      };
    },

    /** Render 33 gates into container */
    render(containerId) {
      const container = document.getElementById(containerId) || document.querySelector(containerId);
      if (!container) return null;

      container.innerHTML = '';
      container.className = 'gates33-grid';
      container.style.cssText = 'display:grid;grid-template-columns:repeat(11,1fr);gap:10px;max-width:1200px;margin:0 auto 24px;';

      for (let i = 0; i < NUM_GATES; i++) {
        const gate = document.createElement('div');
        gate.className = 'gate33';
        gate.dataset.gateIndex = i;
        gate.style.cssText = 'width:80px;height:100px;background:linear-gradient(180deg,#1a1a2e 0%,#0a0a0f 100%);border:2px solid #333;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:all 0.4s;';
        gate.innerHTML = `
          <span class="gate33-num" style="font-size:11px;color:#666;">#${i + 1}</span>
          <div class="gate33-wave" style="width:60px;height:16px;margin:6px 0;background:#111;border-radius:4px;"></div>
          <span class="gate33-icon" style="font-size:20px;">🔒</span>
        `;
        container.appendChild(gate);
      }
      return container;
    },

    /** Animate gates unlocking in witch order with real frequencies */
    async animateUnlock(gateData, options = {}) {
      const { witchOrder: order, gateFrequencies: freqs } = gateData;
      const onGateUnlock = options.onGateUnlock || (() => {});
      const delay = options.delayMs || 80;

      for (let i = 0; i < NUM_GATES; i++) {
        const gateIdx = order[i];
        const gateEl = document.querySelector(`.gate33[data-gate-index="${gateIdx}"]`);
        if (gateEl) {
          gateEl.style.borderColor = '#39FF14';
          gateEl.style.boxShadow = '0 0 20px rgba(57,255,20,0.6)';
          gateEl.style.background = 'linear-gradient(180deg,#1a2e1a 0%,#0f1a0f 100%)';
          const icon = gateEl.querySelector('.gate33-icon');
          if (icon) icon.textContent = '🔓';
        }
        const freq = freqs && freqs[gateIdx] ? freqs[gateIdx] : 400 + gateIdx * 20;
        this.playTone(freq, 0.1);
        onGateUnlock(i, gateIdx);
        await new Promise(r => setTimeout(r, delay));
      }
    },

    /** Mark all gates as failed */
    animateFail() {
      document.querySelectorAll('.gate33').forEach((g, i) => {
        if (i < 5) {
          g.style.borderColor = '#FF0000';
          g.style.animation = 'shake 0.4s';
        }
      });
    },

    /** Full flow: derive from password, animate, return gate data for API */
    async unlockWithPassword(password, saltHex, callbacks) {
      const { onSuccess, onFail, onGateData } = callbacks || {};
      try {
        const gateData = await this.deriveGateData(password, saltHex);
        if (onGateData) onGateData(gateData);
        await this.animateUnlock(gateData);
        if (onSuccess) onSuccess(gateData);
        return gateData;
      } catch (e) {
        this.animateFail();
        if (onFail) onFail(e);
        throw e;
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Gates33Display;
  } else {
    global.Gates33Display = Gates33Display;
  }
})(typeof window !== 'undefined' ? window : globalThis);
