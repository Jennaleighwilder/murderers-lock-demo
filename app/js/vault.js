const VAULTS_KEY = 'vault_manager_vaults';
    const VAULT_DATA_PREFIX = 'vault_data_';

    function escapeHtml(s) {
      if (s == null) return '';
      const d = document.createElement('div');
      d.textContent = String(s);
      return d.innerHTML;
    }

    const params = new URLSearchParams(window.location.search);
    const vaultId = params.get('id');

    function getVault() {
      const vaults = JSON.parse(localStorage.getItem(VAULTS_KEY) || '[]');
      return vaults.find(v => v.id === vaultId);
    }

    function getVaultData() {
      return JSON.parse(localStorage.getItem(VAULT_DATA_PREFIX + vaultId) || '{}');
    }

    function saveVaultData(data) {
      localStorage.setItem(VAULT_DATA_PREFIX + vaultId, JSON.stringify(data));
    }

    function getVaultEncrypted() {
      const v = getVault();
      if (v && v.salt && v.iv && v.encryptedData) return { salt: v.salt, iv: v.iv, encryptedData: v.encryptedData, timestamp: v.timestamp };
      const d = getVaultData();
      return d.salt && d.iv && d.encryptedData ? { salt: d.salt, iv: d.iv, encryptedData: d.encryptedData, timestamp: d.timestamp } : null;
    }

    function updateVaultLockState(locked, murderCount, lockjawEngaged) {
      const vaults = JSON.parse(localStorage.getItem(VAULTS_KEY) || '[]');
      const v = vaults.find(x => x.id === vaultId);
      if (v) {
        v.locked = locked;
        if (murderCount !== undefined) v.murderCount = murderCount;
        if (lockjawEngaged !== undefined) v.lockjawEngaged = lockjawEngaged;
      }
      localStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
    }

    if (!vaultId || !getVault()) {
      window.location.href = 'dashboard.html';
    }

    fetch('/api/2fa-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vaultId: 'default' }) })
      .then(r => r.json())
      .then(d => { if (d.enabled) document.getElementById('2fa-code-group').style.display = 'block'; })
      .catch(() => {});

    if (typeof PasswordStrength !== 'undefined') {
      PasswordStrength.attach('recovered-password', { container: document.getElementById('recovered-password-strength') });
    }

    const vault = getVault();
    const integrityEl = document.getElementById('vault-integrity');
    if (integrityEl && typeof Validate !== 'undefined') {
      const enc = getVaultEncrypted();
      const check = enc ? Validate.validateVault({ ...vault, ...enc }) : Validate.validateVault(vault);
      if (check.valid && enc) {
        integrityEl.textContent = '✓ Data integrity verified';
        integrityEl.style.color = 'var(--neon-lime)';
      } else if (!check.valid && check.errors && check.errors.length > 0) {
        integrityEl.textContent = '⚠ ' + check.errors.join('; ');
        integrityEl.style.color = 'var(--neon-orange)';
      }
    }
    document.getElementById('vault-name').textContent = vault.name;
    document.getElementById('vault-id').textContent = 'ID: ' + vaultId;
    document.getElementById('recovery-link').href = 'recovery.html?id=' + vaultId;
    document.getElementById('recovery-link-unlocked').href = 'recovery.html?id=' + vaultId;

    const view = document.getElementById('vault-view');
    const recoveredContents = sessionStorage.getItem('vault_contents_' + vaultId);
    if (vault.locked !== false) {
      view.classList.remove('unlocked-view');
      view.classList.add('locked-view');
      if (recoveredContents !== null) {
        sessionStorage.removeItem('vault_contents_' + vaultId);
        view.classList.remove('locked-view');
        view.classList.add('unlocked-view');
        document.getElementById('secrets-content').value = recoveredContents;
        document.getElementById('recovered-banner').style.display = 'block';
        setTimeout(() => { if (typeof runHealthCheckAndBadge === 'function') runHealthCheckAndBadge(); }, 500);
      }
    } else {
      view.classList.remove('locked-view');
      view.classList.add('unlocked-view');
      const recoveredContents = sessionStorage.getItem('vault_contents_' + vaultId);
      const data = getVaultData();
      document.getElementById('secrets-content').value = recoveredContents !== null
        ? recoveredContents
        : (data.secrets || '');
      if (recoveredContents !== null) sessionStorage.removeItem('vault_contents_' + vaultId);
      const hasPassword = sessionStorage.getItem('vault_password_' + vaultId);
      if (!hasPassword) document.getElementById('recovered-banner').style.display = 'block';
      setTimeout(() => { if (typeof runHealthCheckAndBadge === 'function') runHealthCheckAndBadge(); }, 500);
    }

    document.getElementById('set-recovered-password')?.addEventListener('click', async () => {
      const pwInput = document.getElementById('recovered-password');
      const password = pwInput?.value;
      const enc = getVaultEncrypted();
      const content = document.getElementById('secrets-content').value;
      if (!password || !enc) return;
      if (typeof Validate !== 'undefined') {
        const pwCheck = Validate.validatePassword(password);
        if (!pwCheck.valid) {
          alert((pwCheck.errors && pwCheck.errors[0]) || 'Invalid password');
          return;
        }
      } else if (password.length < 12) {
        alert('Password must be at least 12 characters');
        return;
      }
      try {
        const res = await fetch('/api/encrypt-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ password, salt: enc.salt, contents: content, vaultId }, enc.timestamp ? { useNanosecond: true } : {}))
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        const vaults = JSON.parse(localStorage.getItem(VAULTS_KEY) || '[]');
        const v = vaults.find(x => x.id === vaultId);
        if (v) {
          v.encryptedData = data.encryptedData;
          v.iv = data.iv;
          if (data.timestamp) v.timestamp = data.timestamp;
          localStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
        }
        saveVaultData({ ...getVaultData(), salt: enc.salt, iv: data.iv, encryptedData: data.encryptedData, timestamp: data.timestamp || enc.timestamp });
        sessionStorage.setItem('vault_password_' + vaultId, password);
        document.getElementById('recovered-banner').style.display = 'none';
        if (typeof SecureMemory !== 'undefined') SecureMemory.clearInput(pwInput);
        else pwInput.value = '';
      } catch (e) {
        alert(e.message || 'Failed to set password');
      }
    });

    document.getElementById('unlock-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('unlock-error');
      err.classList.remove('visible');
      const password = document.getElementById('unlock-password').value;
      const submitBtn = e.target.querySelector('button[type="submit"]');

      const enc = getVaultEncrypted();
      if (!enc) {
        err.textContent = 'Vault data missing. Create vault via dashboard.';
        err.classList.add('visible');
        return;
      }

      let pow = null;
      if (typeof ProofOfWork !== 'undefined') {
        pow = ProofOfWork.show('#vault-view', { message: 'Unlocking vault...', duration: 5000 });
        if (submitBtn) submitBtn.disabled = true;
      }

      try {
        const body = { password, salt: enc.salt, encryptedData: enc.encryptedData, iv: enc.iv, vaultId };
        if (enc.timestamp) body.timestamp = enc.timestamp;
        const totpEl = document.getElementById('unlock-totp-code');
        if (totpEl && totpEl.value) body.totpCode = totpEl.value.trim();
        if (typeof DeviceKeys !== 'undefined' && DeviceKeys.getDeviceAuthPayload) {
          const deviceAuth = await DeviceKeys.getDeviceAuthPayload(vaultId, '/api');
          if (deviceAuth) Object.assign(body, deviceAuth);
        }
        const res = await fetch('/api/unlock-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();

        if (!res.ok) {
          if (data.deviceKeyRequired && typeof DeviceKeys !== 'undefined' && DeviceKeys.registerDeviceKey) {
            err.textContent = data.message || 'This vault requires a registered device. Unlock from a registered device first, or use Shamir recovery.';
            err.classList.add('visible');
            return;
          }
          if (data.deviceRegistrationTokenRequired) {
            err.textContent = 'Unlock the vault first, then register this device.';
            err.classList.add('visible');
            return;
          }
          if (data.deviceRequired) {
            err.textContent = data.message || 'This vault requires a registered device. Unlock from a registered device or use Shamir recovery.';
            err.classList.add('visible');
            return;
          }
          if (data.twoFactorRequired) {
            document.getElementById('2fa-code-group').style.display = 'block';
            err.textContent = data.message || 'Enter your 6-digit authenticator code.';
            err.classList.add('visible');
            return;
          }
          if (data.webauthnRequired && data.webauthnSessionId && typeof SimpleWebAuthnBrowser !== 'undefined') {
            err.textContent = 'Use your security key...';
            err.classList.add('visible');
            try {
              const optsRes = await fetch('/api/webauthn-auth-options', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'default' }) });
              const opts = await optsRes.json();
              if (!optsRes.ok) throw new Error(opts.error || 'Failed');
              const assertion = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: opts });
              const verifyRes = await fetch('/api/webauthn-auth-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assertion, userId: 'default', sessionId: data.webauthnSessionId }) });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed');
              sessionStorage.setItem('vault_password_' + vaultId, password);
              updateVaultLockState(false, 0, false);
              view.classList.remove('locked-view');
              view.classList.add('unlocked-view');
              document.getElementById('secrets-content').value = verifyData.contents || '';
              if (typeof SecureMemory !== 'undefined') SecureMemory.clearInput(document.getElementById('unlock-password'));
              window.dispatchEvent(new CustomEvent('vault-unlocked', { detail: { vaultId, contents: verifyData.contents } }));
              if (typeof runHealthCheckAndBadge === 'function') runHealthCheckAndBadge();
              err.classList.remove('visible');
            } catch (e) {
              err.textContent = e.message || 'Security key verification failed.';
            }
            return;
          }
          updateVaultLockState(true, data.murderCount, data.lockjawEngaged);
          let msg = data.message || data.error || 'Incorrect password.';
          if (data.murderCount > 0) msg += ` (Murder count: ${data.murderCount}/3)`;
          err.textContent = msg;
          err.classList.add('visible');
          if (data.lockjawEngaged) {
            if (confirm('🚨 LOCKJAW ENGAGED!\n\nVault is locked. Use Shamir recovery to restore access?')) {
              window.location.href = 'recovery.html?id=' + vaultId;
            }
          }
          return;
        }

        sessionStorage.setItem('vault_password_' + vaultId, password);
        updateVaultLockState(false, 0, false);
        view.classList.remove('locked-view');
        view.classList.add('unlocked-view');
        document.getElementById('secrets-content').value = data.contents || '';
        if (typeof SecureMemory !== 'undefined') SecureMemory.clearInput(document.getElementById('unlock-password'));

        if (data.deviceRegistrationToken && typeof DeviceKeys !== 'undefined' && DeviceKeys.registerDeviceKey) {
          DeviceKeys.registerDeviceKey(vaultId, '/api', data.deviceRegistrationToken).catch(() => {});
        }

        window.dispatchEvent(new CustomEvent('vault-unlocked', { detail: { vaultId, contents: data.contents } }));

        if (data.gates && typeof KeyProfile !== 'undefined') {
          const kp = document.getElementById('key-profile-container');
          if (kp) {
            kp.style.display = 'block';
            KeyProfile.container = kp;
            KeyProfile.render('key-profile-svg', data.gates);
            KeyProfile.playAlignment(50);
          }
        }
        if (typeof runHealthCheckAndBadge === 'function') runHealthCheckAndBadge();
      } catch (err2) {
        err.textContent = 'Network error. Try again.';
        err.classList.add('visible');
      } finally {
        if (pow) pow.stop();
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.getElementById('key-profile-rotate')?.addEventListener('click', () => {
      if (typeof KeyProfile !== 'undefined') KeyProfile.toggleRotate();
    });

    document.getElementById('lock-vault').addEventListener('click', () => {
      sessionStorage.removeItem('vault_password_' + vaultId);
      updateVaultLockState(true);
      view.classList.remove('unlocked-view');
      view.classList.add('locked-view');
      const kp = document.getElementById('key-profile-container');
      if (kp) kp.style.display = 'none';
      const badge = document.getElementById('security-badge-container');
      if (badge) badge.style.display = 'none';
      if (typeof SecureMemory !== 'undefined') {
        SecureMemory.clearInput(document.getElementById('unlock-password'));
        SecureMemory.clearInput(document.getElementById('secrets-content'));
      } else {
        document.getElementById('unlock-password').value = '';
        document.getElementById('secrets-content').value = '';
      }
    });

    const KILL_SEQUENCE = [0, 1, 2, 3, 4];
    let killSequenceInput = [];

    function playTone(freq, duration = 0.15) {
      try {
        const ctx = window.killSwitchAudioContext || (window.killSwitchAudioContext = new (window.AudioContext || window.webkitAudioContext)());
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    }

    function playDeathMelody() {
      const freqs = [261.63, 329.63, 392.00, 523.25, 392.00];
      freqs.forEach((f, i) => setTimeout(() => playTone(f, 0.3), i * 200));
    }

    document.querySelectorAll('.tone-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tone = parseInt(btn.dataset.tone, 10);
        const freq = parseFloat(btn.dataset.freq);
        playTone(freq);

        if (killSequenceInput.length < KILL_SEQUENCE.length && tone === KILL_SEQUENCE[killSequenceInput.length]) {
          killSequenceInput.push(tone);
          btn.classList.add('played');
          document.getElementById('kill-sequence-status').textContent = 'Sequence: ' + killSequenceInput.length + '/5';
          if (killSequenceInput.length === KILL_SEQUENCE.length) {
            document.getElementById('destroy-vault-btn').style.display = 'inline-block';
          }
        } else {
          killSequenceInput = [];
          document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('played'));
          btn.classList.add('wrong');
          setTimeout(() => btn.classList.remove('wrong'), 300);
          document.getElementById('kill-sequence-status').textContent = 'Sequence: Wrong — try again.';
          document.getElementById('destroy-vault-btn').style.display = 'none';
        }
      });
    });

    document.getElementById('destroy-vault-btn').addEventListener('click', () => {
      if (!confirm('PERMANENTLY DESTROY this vault? All data will be wiped. This cannot be undone.')) return;
      if (!confirm('Type DESTROY to confirm:')) return;
      const confirmText = prompt('Type DESTROY to confirm:');
      if (confirmText !== 'DESTROY') {
        alert('Cancelled.');
        return;
      }
      playDeathMelody();
      setTimeout(() => {
        if (typeof SecureMemory !== 'undefined') {
          SecureMemory.clearInput(document.getElementById('unlock-password'));
          SecureMemory.clearInput(document.getElementById('secrets-content'));
          SecureMemory.clearInput(document.getElementById('recovered-password'));
        }
        const vaults = JSON.parse(localStorage.getItem(VAULTS_KEY) || '[]');
        const filtered = vaults.filter(v => v.id !== vaultId);
        localStorage.setItem(VAULTS_KEY, JSON.stringify(filtered));
        localStorage.removeItem(VAULT_DATA_PREFIX + vaultId);
        localStorage.removeItem('vault_' + vaultId);
        localStorage.removeItem('vault_shards_' + vaultId);
        sessionStorage.removeItem('vault_password_' + vaultId);
        alert('Vault destroyed.');
        window.location.href = 'dashboard.html';
      }, 1200);
    });

    document.getElementById('load-audit-log')?.addEventListener('click', async () => {
      const listEl = document.getElementById('audit-log-list');
      const btn = document.getElementById('load-audit-log');
      if (!listEl || !btn) return;
      listEl.textContent = 'Loading...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/audit-log?vaultId=' + encodeURIComponent(vaultId));
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        if (!data.events || data.events.length === 0) {
          listEl.innerHTML = '<p style="color:var(--text-gray);">No audit events yet.</p>';
        } else {
          listEl.innerHTML = data.events.map(e => {
            const d = new Date(e.ts);
            const action = escapeHtml(String(e.action || 'unknown'));
            const extra = e.name ? ' (' + escapeHtml(String(e.name)) + ')' : '';
            return `<div style="margin-bottom:8px;color:var(--text-silver);">${d.toLocaleString()} — ${action}${extra}</div>`;
          }).join('');
        }
      } catch (e) {
        listEl.textContent = 'Error: ' + (e.message || 'Failed to load');
      }
      btn.disabled = false;
    });

    (function loadImporter() {
      const s = document.createElement('script');
      s.src = 'js/password-importer.js';
      s.onload = () => { window._importerLoaded = true; };
      s.onerror = () => { console.warn('Import module failed to load'); };
      document.head.appendChild(s);
    })();

    async function runHealthCheckAndBadge() {
      const content = document.getElementById('secrets-content')?.value || '';
      const reportEl = document.getElementById('password-health-report');
      const badgeEl = document.getElementById('security-badge-container');
      const btn = document.getElementById('run-health-check');
      if (btn) btn.disabled = true;
      try {
        if (typeof PasswordHealth !== 'undefined') {
          const report = await PasswordHealth.analyze(content);
          if (reportEl) { reportEl.textContent = 'Analyzing...'; PasswordHealth.renderReport(reportEl, report); }
          if (badgeEl && typeof SecurityBadge !== 'undefined') {
            badgeEl.style.display = 'block';
            SecurityBadge.render(badgeEl, report);
          }
        } else if (reportEl) reportEl.textContent = 'Password health module not loaded.';
      } catch (e) {
        if (reportEl) reportEl.textContent = 'Error: ' + (e.message || 'Health check failed');
      }
      if (btn) btn.disabled = false;
    }
    document.getElementById('run-health-check')?.addEventListener('click', runHealthCheckAndBadge);

    document.getElementById('copy-password-btn')?.addEventListener('click', () => {
      const ta = document.getElementById('secrets-content');
      if (!ta) return;
      const text = ta.value || '';
      const pos = ta.selectionStart;
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      const lineEnd = text.indexOf('\n', pos);
      const line = (lineEnd >= 0 ? text.slice(lineStart, lineEnd) : text.slice(lineStart)).trim();
      if (!line) { if (typeof SecureCopy !== 'undefined') SecureCopy.showToast('Click in a line first'); return; }
      const parts = line.split(/\|/).map(p => p.trim());
      const pass = parts.length >= 2 ? parts[parts.length - 1] : '';
      if (!pass) { if (typeof SecureCopy !== 'undefined') SecureCopy.showToast('No password found (use: label | password)'); return; }
      if (typeof SecureCopy !== 'undefined') {
        SecureCopy.copy(pass, () => SecureCopy.showToast('Copied! Clipboard clears in 30s'));
      } else {
        navigator.clipboard.writeText(pass).then(() => alert('Copied'));
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        const view = document.getElementById('vault-view');
        if (view?.classList.contains('locked-view')) {
          document.getElementById('unlock-form')?.requestSubmit();
        } else {
          document.getElementById('save-secrets')?.click();
        }
        e.preventDefault();
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        if (!document.getElementById('vault-view')?.classList.contains('locked-view')) {
          document.getElementById('lock-vault')?.click();
        }
      }
    });

    let lastImportedEntries = [];
    document.getElementById('import-trigger')?.addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      const errEl = document.getElementById('import-error');
      const previewEl = document.getElementById('import-preview');
      const actionsEl = document.getElementById('import-actions');
      const loadingEl = document.getElementById('import-loading');
      if (!file) return;
      errEl.style.display = 'none';
      previewEl.style.display = 'none';
      actionsEl.style.display = 'none';
      if (loadingEl) loadingEl.style.display = 'inline';
      try {
        if (typeof PasswordImporter === 'undefined') throw new Error('Import module loading. Please wait a moment and try again.');
        const { entries, format, error } = await PasswordImporter.parseFile(file);
        if (error) throw new Error(error);
        if (!entries.length) throw new Error('No passwords found in file');
        lastImportedEntries = entries;
        previewEl.style.display = 'block';
        previewEl.dataset.format = format || 'generic';
        const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
        previewEl.innerHTML = `<strong style="color:var(--neon-cyan);">${esc(String(format || 'generic'))} — ${entries.length} entries</strong><br><br>` +
          entries.slice(0, 10).map(x => `${esc(String(x.label || ''))} | ${x.username ? esc(String(x.username)) + ' | ' : ''}••••••`).join('<br>') +
          (entries.length > 10 ? `<br><span style="color:var(--text-gray);">... and ${entries.length - 10} more</span>` : '');
        actionsEl.style.display = 'block';
      } catch (err) {
        errEl.textContent = err.message || 'Import failed';
        errEl.style.display = 'block';
      }
      if (loadingEl) loadingEl.style.display = 'none';
      e.target.value = '';
    });
    async function logImport(action, format, count) {
      try {
        await fetch('/api/import-passwords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vaultId, format, count, action })
        });
      } catch (_) {}
    }
    document.getElementById('import-merge')?.addEventListener('click', async () => {
      if (!lastImportedEntries.length) return;
      if (typeof PasswordImporter === 'undefined') { alert('Import module loading. Please wait and try again.'); return; }
      const textarea = document.getElementById('secrets-content');
      const existing = textarea.value.trim();
      const existingMap = new Map();
      (existing ? existing.split(/\r?\n/) : []).forEach(line => {
        const parts = line.split(/\|/).map(p => p.trim());
        if (parts.length >= 2) {
          const label = (parts[0] || '').toLowerCase();
          const pass = parts[parts.length - 1] || '';
          const user = parts.length >= 3 ? (parts[1] || '').toLowerCase() : '';
          existingMap.set(`${label}|${user}|${pass}`, true);
        }
      });
      const deduped = PasswordImporter.deduplicate(lastImportedEntries, existingMap);
      const newLines = PasswordImporter.toVaultFormat(deduped);
      textarea.value = existing ? existing + '\n' + newLines : newLines;
      await logImport('merge', document.getElementById('import-preview').dataset.format || 'generic', deduped.length);
      document.getElementById('import-preview').style.display = 'none';
      document.getElementById('import-actions').style.display = 'none';
      lastImportedEntries = [];
    });
    document.getElementById('import-replace')?.addEventListener('click', async () => {
      if (!lastImportedEntries.length) return;
      if (typeof PasswordImporter === 'undefined') { alert('Import module loading. Please wait and try again.'); return; }
      if (!confirm('Replace all vault contents with imported passwords?')) return;
      const format = document.getElementById('import-preview').dataset.format || 'generic';
      document.getElementById('secrets-content').value = PasswordImporter.toVaultFormat(lastImportedEntries);
      await logImport('replace', format, lastImportedEntries.length);
      document.getElementById('import-preview').style.display = 'none';
      document.getElementById('import-actions').style.display = 'none';
      lastImportedEntries = [];
    });

    document.getElementById('save-secrets').addEventListener('click', async () => {
      const content = document.getElementById('secrets-content').value;
      const password = sessionStorage.getItem('vault_password_' + vaultId);
      const enc = getVaultEncrypted();

      if (!password || !enc) {
        document.getElementById('save-success').textContent = 'Error: session expired. Lock and unlock again.';
        document.getElementById('save-success').style.color = 'var(--neon-pink)';
        document.getElementById('save-success').classList.add('visible');
        setTimeout(() => {
          document.getElementById('save-success').classList.remove('visible');
          document.getElementById('save-success').textContent = 'Saved.';
          document.getElementById('save-success').style.color = '';
        }, 3000);
        return;
      }

      try {
        const res = await fetch('/api/encrypt-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ password, salt: enc.salt, contents: content, vaultId }, enc.timestamp ? { useNanosecond: true } : {}))
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Save failed');

        const vaults = JSON.parse(localStorage.getItem(VAULTS_KEY) || '[]');
        const v = vaults.find(x => x.id === vaultId);
        if (v) {
          v.encryptedData = data.encryptedData;
          v.iv = data.iv;
          if (data.timestamp) v.timestamp = data.timestamp;
          localStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
        }
        saveVaultData({ ...getVaultData(), salt: enc.salt, iv: data.iv, encryptedData: data.encryptedData, timestamp: data.timestamp || enc.timestamp });

        document.getElementById('save-success').classList.add('visible');
        setTimeout(() => document.getElementById('save-success').classList.remove('visible'), 2000);
      } catch (err) {
        document.getElementById('save-success').textContent = err.message || 'Save failed';
        document.getElementById('save-success').style.color = 'var(--neon-pink)';
        document.getElementById('save-success').classList.add('visible');
        setTimeout(() => {
          document.getElementById('save-success').classList.remove('visible');
          document.getElementById('save-success').textContent = 'Saved.';
          document.getElementById('save-success').style.color = '';
        }, 3000);
      }
    });

    if (typeof SecureMemory !== 'undefined') {
      SecureMemory.clearOnUnload(['#unlock-password', '#secrets-content', '#recovered-password']);
    }