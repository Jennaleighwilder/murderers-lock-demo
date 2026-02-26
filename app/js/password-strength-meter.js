/**
 * password-strength-meter.js
 * Client-side password strength scoring + breach check (haveibeenpwned)
 * No dependencies. Industry-standard UX.
 */

(function (global) {
  'use strict';

  const LABELS = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const COLORS = ['#FF4444', '#FF8800', '#FFD700', '#88FF00', '#00FF88'];

  function scorePassword(pw) {
    if (!pw || typeof pw !== 'string') return { score: 0, label: LABELS[0], feedback: ['Enter a password'] };
    const feedback = [];
    let score = 0;

    if (pw.length >= 12) score += 1;
    else feedback.push('Use at least 12 characters');
    if (pw.length >= 16) score += 1;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
    else if (pw.length > 0) feedback.push('Mix uppercase and lowercase');
    if (/\d/.test(pw)) score += 1;
    else if (pw.length > 0) feedback.push('Add numbers');
    if (/[^a-zA-Z0-9]/.test(pw)) score += 1;
    else if (pw.length > 0) feedback.push('Add symbols (!@#$%^&*)');

    score = Math.min(4, score);
    if (feedback.length === 0 && score < 4) feedback.push('Longer passwords are stronger');
    return {
      score,
      label: LABELS[score],
      color: COLORS[score],
      feedback: feedback.slice(0, 3)
    };
  }

  /** Check password against haveibeenpwned (k-anonymity, no full password sent) */
  async function checkBreach(password) {
    try {
      const enc = new TextEncoder();
      const data = await crypto.subtle.digest('SHA-1', enc.encode(password));
      const hash = Array.from(new Uint8Array(data))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);

      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' }
      });
      if (!res.ok) return { pwned: false, count: 0 };
      const text = await res.text();
      const lines = text.split('\r\n');
      for (const line of lines) {
        const [s, count] = line.split(':');
        if (s && s.trim() === suffix) return { pwned: true, count: parseInt(count || '0', 10) };
      }
      return { pwned: false, count: 0 };
    } catch (_) {
      return { pwned: false, count: 0 };
    }
  }

  /** Attach strength meter + optional breach check to password input */
  function attach(inputId, opts = {}) {
    const input = document.getElementById(inputId) || document.querySelector(inputId);
    if (!input) return null;

    const container = opts.container || input.parentElement;
    const showBreach = opts.breachCheck !== false;
    const breachDebounce = opts.breachDebounce || 800;

    const wrap = document.createElement('div');
    wrap.className = 'password-strength-wrap';
    wrap.style.cssText = 'margin-top:8px;';
    const barWrap = document.createElement('div');
    barWrap.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;';
    for (let i = 0; i < 5; i++) {
      const seg = document.createElement('div');
      seg.className = 'strength-seg';
      seg.style.cssText = `flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,0.1);transition:background 0.3s;`;
      barWrap.appendChild(seg);
    }
    const labelEl = document.createElement('div');
    labelEl.className = 'strength-label';
    labelEl.style.cssText = 'font-size:11px;color:var(--text-gray, #808080);';
    const breachEl = document.createElement('div');
    breachEl.className = 'strength-breach';
    breachEl.style.cssText = 'font-size:11px;margin-top:4px;';
    wrap.appendChild(barWrap);
    wrap.appendChild(labelEl);
    if (showBreach) wrap.appendChild(breachEl);

    container.appendChild(wrap);

    let breachTimeout;
    function update() {
      const result = scorePassword(input.value);
      barWrap.querySelectorAll('.strength-seg').forEach((seg, i) => {
        seg.style.background = i <= result.score ? result.color : 'rgba(255,255,255,0.1)';
      });
      labelEl.textContent = result.label;
      labelEl.style.color = result.color;

      if (showBreach && input.value.length >= 8) {
        clearTimeout(breachTimeout);
        breachEl.textContent = 'Checking breach database...';
        breachEl.style.color = 'var(--text-gray, #808080)';
        breachTimeout = setTimeout(async () => {
          const breach = await checkBreach(input.value);
          if (breach.pwned) {
            breachEl.textContent = `⚠️ This password appeared in ${breach.count.toLocaleString()} data breaches. Choose a different one.`;
            breachEl.style.color = 'var(--neon-pink, #FF10F0)';
          } else {
            breachEl.textContent = '✓ Not found in known breaches';
            breachEl.style.color = 'var(--neon-lime, #39FF14)';
          }
        }, breachDebounce);
      } else if (showBreach) {
        breachEl.textContent = '';
      }
    }

    input.addEventListener('input', update);
    input.addEventListener('focus', update);
    update();
    return { update, scorePassword, checkBreach };
  }

  global.PasswordStrength = {
    score: scorePassword,
    checkBreach,
    attach
  };
})(typeof window !== 'undefined' ? window : globalThis);
