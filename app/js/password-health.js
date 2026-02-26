/**
 * password-health.js
 * Vault password health: weak, reused, breached detection
 * Client-side only. Uses PasswordStrength + haveibeenpwned k-anonymity.
 */

(function (global) {
  'use strict';

  const DELIMITERS = [/\|/, /:/, /\t/, /,/, /->/, /=>/];

  function parseEntries(text) {
    if (!text || typeof text !== 'string') return [];
    const entries = [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      let label = '';
      let password = '';
      for (const d of DELIMITERS) {
        const parts = line.split(d);
        if (parts.length >= 2) {
          label = (parts[0] || '').trim();
          password = (parts[parts.length - 1] || '').trim();
          break;
        }
      }
      if (!password && line.length > 0) {
        const m = line.match(/(?:password|pass|pwd)\s*[:=]\s*["']?([^"'\s]+)["']?/i);
        if (m) password = m[1];
        else password = line;
        label = line.slice(0, line.indexOf(password)).trim() || 'Unknown';
      }
      if (password && password.length >= 4) {
        entries.push({ label: label || 'Entry', password });
      }
    }
    return entries;
  }

  function scorePassword(pw) {
    if (typeof PasswordStrength !== 'undefined' && PasswordStrength.score) {
      return PasswordStrength.score(pw);
    }
    let score = 0;
    if (pw.length >= 12) score++;
    if (pw.length >= 16) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return { score: Math.min(4, score), label: ['Very Weak','Weak','Fair','Strong','Very Strong'][score] };
  }

  async function checkBreach(password) {
    if (typeof PasswordStrength !== 'undefined' && PasswordStrength.checkBreach) {
      return PasswordStrength.checkBreach(password);
    }
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
      for (const line of text.split('\r\n')) {
        const [s, count] = line.split(':');
        if (s && s.trim() === suffix) return { pwned: true, count: parseInt(count || '0', 10) };
      }
      return { pwned: false, count: 0 };
    } catch (_) {
      return { pwned: false, count: 0 };
    }
  }

  async function analyze(secretsText) {
    const entries = parseEntries(secretsText);
    const weak = [];
    const reused = [];
    const breached = [];
    const seen = new Map();

    for (const e of entries) {
      const { score } = scorePassword(e.password);
      if (score <= 1) weak.push({ label: e.label, score });
      const key = e.password;
      if (seen.has(key)) {
        reused.push({ label: e.label, sameAs: seen.get(key) });
      } else {
        seen.set(key, e.label);
      }
    }

    const uniquePasswords = [...new Set(entries.map(e => e.password))];
    for (const pw of uniquePasswords) {
      const b = await checkBreach(pw);
      if (b.pwned) {
        const labels = entries.filter(e => e.password === pw).map(e => e.label);
        breached.push({ labels, count: b.count });
      }
    }

    return {
      total: entries.length,
      weak,
      reused,
      breached,
      healthy: weak.length === 0 && reused.length === 0 && breached.length === 0
    };
  }

  function renderReport(container, report) {
    if (!container) return;
    container.innerHTML = '';
    if (report.total === 0) {
      container.innerHTML = '<p style="color:var(--text-gray);font-size:13px;">No password entries found. Add entries like <code>site.com | mypassword</code> to check health.</p>';
      return;
    }
    const frag = document.createDocumentFragment();
    const h3 = document.createElement('h4');
    h3.style.cssText = 'font-size:14px;color:var(--neon-cyan);margin-bottom:12px;';
    h3.textContent = `Vault Health: ${report.total} entries`;
    frag.appendChild(h3);

    if (report.healthy) {
      const p = document.createElement('p');
      p.style.cssText = 'color:var(--neon-lime);font-size:13px;';
      p.textContent = '✓ All passwords look strong and unique. None found in breaches.';
      frag.appendChild(p);
      container.appendChild(frag);
      return;
    }

    if (report.breached.length > 0) {
      const sec = document.createElement('div');
      sec.style.cssText = 'margin-bottom:16px;';
      sec.innerHTML = '<span style="color:var(--neon-pink);font-weight:600;">⚠ Breached:</span>';
      const ul = document.createElement('ul');
      ul.style.cssText = 'margin:8px 0 0 20px;font-size:12px;color:var(--text-silver);';
      for (const b of report.breached) {
        const li = document.createElement('li');
        li.textContent = `${b.labels.join(', ')} — in ${b.count.toLocaleString()} breaches`;
        ul.appendChild(li);
      }
      sec.appendChild(ul);
      frag.appendChild(sec);
    }
    if (report.weak.length > 0) {
      const sec = document.createElement('div');
      sec.style.cssText = 'margin-bottom:16px;';
      sec.innerHTML = '<span style="color:var(--neon-orange);font-weight:600;">⚠ Weak:</span>';
      const ul = document.createElement('ul');
      ul.style.cssText = 'margin:8px 0 0 20px;font-size:12px;color:var(--text-silver);';
      for (const w of report.weak) {
        const li = document.createElement('li');
        li.textContent = w.label;
        ul.appendChild(li);
      }
      sec.appendChild(ul);
      frag.appendChild(sec);
    }
    if (report.reused.length > 0) {
      const sec = document.createElement('div');
      sec.style.cssText = 'margin-bottom:16px;';
      sec.innerHTML = '<span style="color:var(--neon-gold);font-weight:600;">⚠ Reused:</span>';
      const ul = document.createElement('ul');
      ul.style.cssText = 'margin:8px 0 0 20px;font-size:12px;color:var(--text-silver);';
      for (const r of report.reused) {
        const li = document.createElement('li');
        li.textContent = `${r.label} (same as ${r.sameAs})`;
        ul.appendChild(li);
      }
      sec.appendChild(ul);
      frag.appendChild(sec);
    }
    container.appendChild(frag);
  }

  global.PasswordHealth = {
    parseEntries,
    analyze,
    renderReport,
    scorePassword,
    checkBreach
  };
})(typeof window !== 'undefined' ? window : globalThis);
