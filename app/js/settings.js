const AUTH_KEY = 'vault_manager_auth';
    const PROFILE_KEY = 'vault_manager_profile';

    function getAuth() {
      return JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
    }

    function getProfile() {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    }

    const user = sessionStorage.getItem('vault_user');
    if (!user) {
      window.location.href = 'index.html';
    }

    if (typeof PasswordStrength !== 'undefined') {
      PasswordStrength.attach('new-password', { container: document.getElementById('new-password-strength') });
    }

    const auth = getAuth();
    const profile = getProfile();

    document.getElementById('email').value = auth.email || user;
    document.getElementById('display-name').value = profile.displayName || '';
    document.getElementById('account-info').textContent = 'Account created: ' + (auth.createdAt ? new Date(auth.createdAt).toLocaleDateString() : '—');

    document.getElementById('profile-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const displayName = document.getElementById('display-name').value.trim();
      const p = getProfile();
      p.displayName = displayName;
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      document.getElementById('profile-success').classList.add('visible');
      setTimeout(() => document.getElementById('profile-success').classList.remove('visible'), 2000);
    });

    document.getElementById('password-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const err = document.getElementById('password-error');
      const ok = document.getElementById('password-success');
      err.classList.remove('visible');
      ok.classList.remove('visible');

      const current = document.getElementById('current-password').value;
      const newP = document.getElementById('new-password').value;
      const confirm = document.getElementById('confirm-password').value;

      if (auth.password !== current) {
        err.textContent = 'Current password is incorrect.';
        err.classList.add('visible');
        return;
      }
      if (newP !== confirm) {
        err.textContent = 'New passwords do not match.';
        err.classList.add('visible');
        return;
      }
      if (typeof Validate !== 'undefined') {
        const pwCheck = Validate.validatePassword(newP);
        if (!pwCheck.valid) {
          err.textContent = (pwCheck.errors && pwCheck.errors[0]) || 'Invalid password.';
          err.classList.add('visible');
          return;
        }
      } else if (newP.length < 12) {
        err.textContent = 'New password must be at least 12 characters.';
        err.classList.add('visible');
        return;
      }

      auth.password = newP;
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
      document.getElementById('current-password').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-password').value = '';
      ok.classList.add('visible');
      setTimeout(() => ok.classList.remove('visible'), 2000);
    });

    function updatePinUI() {
      const hasPin = typeof ShardProtection !== 'undefined' && ShardProtection.hasPin();
      const status = document.getElementById('pin-status');
      const setBtn = document.getElementById('pin-set-btn');
      const changeBtn = document.getElementById('pin-change-show');
      const protectBtn = document.getElementById('pin-protect-all');
      if (hasPin) {
        status.textContent = '✓ PIN is set. Shards are encrypted.';
        status.style.background = 'rgba(57, 255, 20, 0.1)';
        status.style.border = '1px solid var(--neon-lime)';
        status.style.color = 'var(--neon-lime)';
        setBtn.style.display = 'none';
        changeBtn.style.display = 'inline-block';
        protectBtn.style.display = 'inline-block';
      } else {
        status.textContent = 'No PIN set. Shards stored in plaintext.';
        status.style.background = 'rgba(255, 102, 0, 0.1)';
        status.style.border = '1px solid var(--neon-orange)';
        status.style.color = 'var(--neon-orange)';
        setBtn.style.display = 'inline-block';
        changeBtn.style.display = 'none';
        protectBtn.style.display = 'none';
      }
    }
    updatePinUI();

    async function update2FAUI() {
      try {
        const res = await fetch('/api/2fa-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vaultId: 'default' })
        });
        const data = await res.json();
        const enabled = data.enabled;
        const statusEl = document.getElementById('2fa-status');
        const setupForm = document.getElementById('2fa-setup-form');
        const enableBtn = document.getElementById('2fa-enable-btn');
        const disableBtn = document.getElementById('2fa-disable-btn');
        if (enabled) {
          statusEl.textContent = '✓ 2FA is enabled. Authenticator code required to unlock vaults.';
          statusEl.style.background = 'rgba(57, 255, 20, 0.1)';
          statusEl.style.border = '1px solid var(--neon-lime)';
          statusEl.style.color = 'var(--neon-lime)';
          setupForm.style.display = 'none';
          enableBtn.style.display = 'none';
          disableBtn.style.display = 'inline-block';
        } else {
          statusEl.textContent = '2FA is not enabled.';
          statusEl.style.background = 'rgba(255, 102, 0, 0.1)';
          statusEl.style.border = '1px solid var(--neon-orange)';
          statusEl.style.color = 'var(--neon-orange)';
          setupForm.style.display = 'none';
          enableBtn.style.display = 'inline-block';
          disableBtn.style.display = 'none';
        }
      } catch (_) {}
    }
    update2FAUI();

    document.getElementById('2fa-enable-btn')?.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/2fa-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vaultId: 'default' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        const qr = document.getElementById('2fa-qr-container');
        const qrUrl = (data.qrDataUrl || '').toString();
        if (/^data:image\/(png|jpeg|gif|webp);base64,/.test(qrUrl)) {
          qr.innerHTML = '<img src="' + qrUrl.replace(/"/g, '&quot;') + '" alt="QR Code" style="width:200px;height:200px;">';
        } else {
          qr.textContent = 'Invalid QR data';
        }
        document.getElementById('2fa-setup-form').style.display = 'block';
        document.getElementById('2fa-enable-btn').style.display = 'none';
        document.getElementById('2fa-verify-code').value = '';
      } catch (e) { alert(e.message || 'Failed to setup 2FA'); }
    });

    document.getElementById('2fa-setup-cancel')?.addEventListener('click', () => {
      document.getElementById('2fa-setup-form').style.display = 'none';
      document.getElementById('2fa-enable-btn').style.display = 'inline-block';
      update2FAUI();
    });

    document.getElementById('2fa-verify-btn')?.addEventListener('click', async () => {
      const code = document.getElementById('2fa-verify-code').value.trim();
      if (!code || code.length !== 6) { alert('Enter 6-digit code'); return; }
      try {
        const res = await fetch('/api/2fa-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vaultId: 'default', code })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid code');
        document.getElementById('2fa-setup-form').style.display = 'none';
        document.getElementById('2fa-success').style.display = 'block';
        setTimeout(() => document.getElementById('2fa-success').style.display = 'none', 2000);
        update2FAUI();
      } catch (e) { alert(e.message || 'Invalid code. Try again.'); }
    });

    async function updateWebAuthnUI() {
      try {
        const res = await fetch('/api/webauthn-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'default' }) });
        const data = await res.json();
        const statusEl = document.getElementById('webauthn-status');
        const btn = document.getElementById('webauthn-register-btn');
        if (data.enabled) {
          statusEl.textContent = '✓ Security key registered. Use it to unlock vaults.';
          statusEl.style.background = 'rgba(57, 255, 20, 0.1)';
          statusEl.style.border = '1px solid var(--neon-lime)';
          statusEl.style.color = 'var(--neon-lime)';
          btn.style.display = 'none';
        } else {
          statusEl.textContent = 'No security key. Add one for biometric/hardware unlock.';
          statusEl.style.background = 'rgba(255, 102, 0, 0.1)';
          statusEl.style.border = '1px solid var(--neon-orange)';
          statusEl.style.color = 'var(--neon-orange)';
          btn.style.display = 'inline-block';
        }
      } catch (_) {}
    }
    updateWebAuthnUI();

    document.getElementById('webauthn-register-btn')?.addEventListener('click', async () => {
      if (typeof SimpleWebAuthnBrowser === 'undefined') { alert('WebAuthn not loaded'); return; }
      try {
        const optsRes = await fetch('/api/webauthn-register-options', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'default' }) });
        const options = await optsRes.json();
        if (!optsRes.ok) throw new Error(options.error || 'Failed');
        const credential = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options });
        const verifyRes = await fetch('/api/webauthn-register-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential, userId: 'default' }) });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed');
        document.getElementById('webauthn-success').style.display = 'block';
        setTimeout(() => document.getElementById('webauthn-success').style.display = 'none', 2000);
        updateWebAuthnUI();
      } catch (e) { alert(e.message || 'Failed to add security key'); }
    });

    document.getElementById('2fa-disable-btn')?.addEventListener('click', async () => {
      if (!confirm('Disable 2FA? You will no longer need an authenticator code to unlock.')) return;
      try {
        const res = await fetch('/api/2fa-disable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vaultId: 'default' })
        });
        if (!res.ok) throw new Error('Failed');
        document.getElementById('2fa-success').textContent = '2FA disabled.';
        document.getElementById('2fa-success').style.display = 'block';
        setTimeout(() => { document.getElementById('2fa-success').style.display = 'none'; document.getElementById('2fa-success').textContent = '2FA updated.'; }, 2000);
        update2FAUI();
      } catch (e) { alert(e.message || 'Failed to disable 2FA'); }
    });

    document.getElementById('pin-set-btn')?.addEventListener('click', async () => {
      const pin = prompt('Enter new PIN (4+ digits):');
      if (!pin || pin.length < 4) return;
      try {
        await ShardProtection.setPin(pin);
        updatePinUI();
        document.getElementById('pin-success').style.display = 'block';
        setTimeout(() => document.getElementById('pin-success').style.display = 'none', 2000);
      } catch (e) { alert(e.message); }
    });

    document.getElementById('pin-change-show')?.addEventListener('click', () => {
      document.getElementById('pin-change-form').style.display = 'block';
      document.getElementById('pin-actions').style.display = 'none';
    });

    document.getElementById('pin-change-cancel')?.addEventListener('click', () => {
      document.getElementById('pin-change-form').style.display = 'none';
      document.getElementById('pin-actions').style.display = 'block';
      document.getElementById('pin-current').value = '';
      document.getElementById('pin-new').value = '';
      document.getElementById('pin-confirm').value = '';
    });

    document.getElementById('pin-protect-all')?.addEventListener('click', async () => {
      const pin = prompt('Enter your PIN to encrypt all unprotected vault shards:');
      if (!pin) return;
      try {
        const count = await ShardProtection.protectAllUnprotected(pin);
        alert(count > 0 ? `Protected ${count} vault(s).` : 'All vaults already protected.');
        updatePinUI();
      } catch (e) {
        alert(e.message || 'Failed.');
      }
    });

    document.getElementById('pin-change-btn')?.addEventListener('click', async () => {
      const current = document.getElementById('pin-current').value;
      const newP = document.getElementById('pin-new').value;
      const confirm = document.getElementById('pin-confirm').value;
      if (!current || !newP || newP !== confirm) {
        alert('Fill all fields and ensure new PINs match.');
        return;
      }
      if (newP.length < 4) {
        alert('New PIN must be at least 4 digits.');
        return;
      }
      try {
        await ShardProtection.changePin(current, newP);
        document.getElementById('pin-change-form').style.display = 'none';
        document.getElementById('pin-actions').style.display = 'block';
        document.getElementById('pin-current').value = '';
        document.getElementById('pin-new').value = '';
        document.getElementById('pin-confirm').value = '';
        document.getElementById('pin-success').style.display = 'block';
        setTimeout(() => document.getElementById('pin-success').style.display = 'none', 2000);
      } catch (e) {
        alert(e.message || 'Failed to change PIN.');
      }
    });

    document.getElementById('delete-account').addEventListener('click', () => {
      if (!confirm('Permanently delete your account and ALL vault data? This cannot be undone.')) return;
      if (!confirm('Type DELETE to confirm.')) return;
      const confirmText = prompt('Type DELETE to confirm:');
      if (confirmText !== 'DELETE') {
        alert('Deletion cancelled.');
        return;
      }
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem('vault_manager_vaults');
      localStorage.removeItem('vault_shard_pin_config');
      Object.keys(localStorage).filter(k => k.startsWith('vault_') || k.startsWith('vault_data_')).forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
      alert('Account deleted. Redirecting to login.');
      window.location.href = 'index.html';
    });