/**
 * vault-integration.js
 * Drop-in integration for Nanosecond Lock (33 Gates + Timestamp)
 * Works with existing vault.html, dashboard.html, and API.
 *
 * - Unlock: Uses NanosecondLock when vault has timestamp; falls back to API for legacy
 * - Create: Uses NanosecondLock when API supports it (timestamp in response)
 * - Shows frequency display (theater) during unlock
 */

(function (global) {
  'use strict';

  const NUM_GATES = 33;

  function hasNanosecondLock() {
    return typeof global.NanosecondLock !== 'undefined' && global.NanosecondLock.lock;
  }

  function isNanosecondVault(vault) {
    return !!(vault && vault.timestamp);
  }

  /** Play a gate tone (200-1200 Hz) */
  function playTone(frequency, duration = 0.08) {
    try {
      const ctx = window.nanosecondAudioContext || (window.nanosecondAudioContext = new (window.AudioContext || window.webkitAudioContext)());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  }

  /** Show gates container and animate unlock sequence */
  function showGatesDisplay(container, gates, options = {}) {
    const { onComplete, delayBetween = 60 } = options;
    if (!container) return;

    container.innerHTML = '';
    container.style.cssText = 'display:grid;grid-template-columns:repeat(11,1fr);gap:8px;max-width:900px;margin:20px auto;';
    container.classList.add('nanosecond-gates');
    container.style.display = 'grid';

    const order = gates || Array.from({ length: NUM_GATES }, (_, i) => 200 + (i * 30));
    let unlocked = 0;

    order.forEach((freq, i) => {
      const gate = document.createElement('div');
      gate.className = 'gate-cell';
      gate.dataset.gateIndex = i;
      gate.style.cssText = 'width:48px;height:60px;background:rgba(0,0,0,0.5);border:2px solid #333;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:all 0.3s;';
      gate.innerHTML = `<span style="font-size:10px;color:#666">#${i + 1}</span><span class="gate-freq" style="font-size:9px;color:#00F5FF;margin-top:4px">${Math.round(freq)}Hz</span><span class="gate-icon" style="font-size:14px;margin-top:4px">🔒</span>`;
      container.appendChild(gate);
    });

    function unlockGate(index) {
      const gate = container.querySelector(`[data-gate-index="${index}"]`);
      if (!gate) return;
      const freq = order[index];
      playTone(freq, 0.1);
      gate.style.borderColor = '#39FF14';
      gate.style.background = 'rgba(57,255,20,0.15)';
      gate.style.boxShadow = '0 0 12px rgba(57,255,20,0.5)';
      const icon = gate.querySelector('.gate-icon');
      if (icon) icon.textContent = '🔓';
      unlocked++;
      if (unlocked >= NUM_GATES && onComplete) onComplete();
    }

    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= NUM_GATES) {
        clearInterval(interval);
        return;
      }
      unlockGate(idx);
      idx++;
    }, delayBetween);
  }

  /**
   * Unlock vault - API always (supports timestamp for Nanosecond Lock)
   * @param {Object} opts - { password, vault, vaultData, vaultId }
   * @returns {Promise<{ contents: string, gates?: number[] }>}
   */
  async function unlockVault(opts) {
    const { password, vault, vaultData, vaultId } = opts;
    const enc = vault?.salt && vault?.iv && vault?.encryptedData
      ? { salt: vault.salt, iv: vault.iv, encryptedData: vault.encryptedData, timestamp: vault.timestamp }
      : vaultData?.salt && vaultData?.iv && vaultData?.encryptedData
        ? { salt: vaultData.salt, iv: vaultData.iv, encryptedData: vaultData.encryptedData, timestamp: vaultData.timestamp }
        : null;

    if (!enc) throw new Error('Vault data missing');

    const body = {
      password,
      salt: enc.salt,
      encryptedData: enc.encryptedData,
      iv: enc.iv,
      vaultId: vaultId || 'default'
    };
    if (enc.timestamp) body.timestamp = enc.timestamp;

    const res = await fetch('/api/unlock-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Unlock failed');
    return { contents: data.contents };
  }

  /**
   * Create vault - uses NanosecondLock when available
   * @param {Object} opts - { name, password, initialContent }
   * @returns {Promise<{ vaultId, name, salt, encryptedData, iv, timestamp?, shards }>}
   */
  async function createVault(opts) {
    const { name, password, initialContent = '' } = opts;

    if (hasNanosecondLock()) {
      const lock = global.NanosecondLock;
      const payload = JSON.stringify({ secrets: initialContent || '' });
      const locked = await lock.lock(password, payload);
      const vaultId = 'v_' + Date.now() + '_' + Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('');
      const shardsRes = await fetch('/api/generate-shards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: password })
      });
      let shards = [];
      if (shardsRes.ok) {
        const shardsData = await shardsRes.json();
        shards = shardsData.shards || [];
      }
      return {
        vaultId,
        name,
        salt: locked.salt,
        encryptedData: locked.encryptedData,
        iv: locked.iv,
        timestamp: locked.timestamp,
        shards,
        gates: locked.gates
      };
    }

    const res = await fetch('/api/create-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Create failed');
    return data;
  }

  global.VaultIntegration = {
    hasNanosecondLock,
    isNanosecondVault,
    unlockVault,
    createVault,
    showGatesDisplay,
    NUM_GATES
  };
})(typeof window !== 'undefined' ? window : globalThis);
