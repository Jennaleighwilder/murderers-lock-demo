const VAULTS_KEY = 'vault_manager_vaults';

    if (typeof PasswordStrength !== 'undefined') {
      PasswordStrength.attach('vault-password', { container: document.getElementById('vault-password-strength') });
    }

    function getVaults() {
      return JSON.parse(localStorage.getItem(VAULTS_KEY) || '[]');
    }

    function saveVaults(vaults) {
      localStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
    }

    function renderVaults() {
      const grid = document.getElementById('vaults-grid');
      const empty = document.getElementById('empty-state');
      const vaults = getVaults();
      grid.innerHTML = '';

      if (vaults.length === 0) {
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';

      vaults.forEach((v, i) => {
        const card = document.createElement('a');
        card.href = 'vault.html?id=' + encodeURIComponent(v.id);
        card.className = 'vault-card';
        const murderInfo = (v.murderCount > 0 || v.lockjawEngaged) ? `
          <div style="margin-top: 12px; font-size: 11px; color: var(--neon-orange);">
            ${v.lockjawEngaged ? '🚨 LOCKJAW ENGAGED' : `⚠️ Murder count: ${v.murderCount || 0}/3`}
          </div>
        ` : '';
        card.innerHTML = `
          <div class="vault-icon">🔒</div>
          <div class="vault-name">${escapeHtml(v.name)}</div>
          <div class="vault-meta">ID: ${escapeHtml((v.id || '').slice(0, 8))}...</div>
          <span class="vault-status ${v.locked !== false ? 'locked' : 'unlocked'}">${v.locked !== false ? '🔒 Locked' : '🔓 Unlocked'}</span>
          ${murderInfo}
        `;
        grid.appendChild(card);
      });
    }

    function escapeHtml(s) {
      const div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    // Auth check
    const user = sessionStorage.getItem('vault_user');
    if (!user) {
      window.location.href = 'index.html';
    }
    const profile = JSON.parse(localStorage.getItem('vault_manager_profile') || '{}');
    document.getElementById('user-email').textContent = profile.displayName || user;

    function updateDMSBanner() {
      const dms = JSON.parse(localStorage.getItem('vault_manager_dms') || '{}');
      const banner = document.getElementById('dms-banner');
      if (!dms.enabled) {
        banner.style.display = 'none';
        return;
      }
      const lastCheckIn = dms.lastCheckIn ? new Date(dms.lastCheckIn) : null;
      const intervalDays = dms.intervalDays || 7;
      const graceDays = dms.graceDays || 5;
      const dueDate = lastCheckIn ? new Date(lastCheckIn.getTime() + intervalDays * 24 * 60 * 60 * 1000) : new Date();
      const graceEnd = new Date(dueDate.getTime() + graceDays * 24 * 60 * 60 * 1000);
      const now = new Date();

      if (!lastCheckIn || now > dueDate) {
        banner.style.display = 'flex';
        const title = document.getElementById('dms-banner-title');
        const text = document.getElementById('dms-banner-text');
        const btn = document.getElementById('dms-banner-btn');
        if (now > graceEnd) {
          title.textContent = '🚨 DEAD MAN\'S SWITCH: OVERDUE';
          text.textContent = 'Contacts would be notified. Check in now to reset.';
          banner.style.borderColor = 'var(--neon-orange)';
          title.style.color = 'var(--neon-orange)';
        } else if (now > dueDate) {
          const daysLeft = Math.ceil((graceEnd - now) / (24 * 60 * 60 * 1000));
          title.textContent = '⚠️ Check-in overdue';
          text.textContent = daysLeft + ' day(s) until contacts are notified. Check in now.';
          banner.style.borderColor = 'var(--neon-gold)';
          title.style.color = 'var(--neon-gold)';
        } else {
          title.textContent = 'Dead Man\'s Switch: First check-in needed';
          text.textContent = 'Check in now to start your interval.';
          banner.style.borderColor = 'var(--neon-gold)';
          title.style.color = 'var(--neon-gold)';
        }
      } else {
        banner.style.display = 'none';
      }
    }
    updateDMSBanner();

    if (typeof document !== 'undefined') {
      document.getElementById('create-vault-btn').addEventListener('click', () => {
        if (typeof ShardProtection === 'undefined') {
          document.getElementById('create-modal').style.display = 'flex';
          return;
        }
        if (!ShardProtection.hasPin() && getVaults().length === 0) {
          document.getElementById('pin-modal-title').textContent = '🔐 Shard Protection PIN';
          document.getElementById('pin-modal-desc').textContent = 'Encrypt your recovery shards with a PIN. If your device is stolen, shards are useless without the PIN.';
          document.getElementById('pin-actions').style.display = 'flex';
          document.getElementById('pin-enter-actions').style.display = 'none';
          document.getElementById('pin-modal').style.display = 'flex';
          document.getElementById('pin-input').value = '';
        } else if (ShardProtection.hasPin()) {
          document.getElementById('pin-modal-title').textContent = 'Enter PIN';
          document.getElementById('pin-modal-desc').textContent = 'Enter your shard protection PIN to encrypt new vault shards.';
          document.getElementById('pin-actions').style.display = 'none';
          document.getElementById('pin-enter-actions').style.display = 'flex';
          document.getElementById('pin-modal').style.display = 'flex';
          document.getElementById('pin-input').value = '';
        } else {
          document.getElementById('create-modal').style.display = 'flex';
        }
      });

      document.getElementById('pin-set')?.addEventListener('click', async () => {
        const pin = document.getElementById('pin-input').value;
        if (!pin || pin.length < 4) { alert('PIN must be at least 4 digits'); return; }
        try {
          await ShardProtection.setPin(pin);
          sessionStorage.setItem('vault_shard_pin_temp', pin);
          document.getElementById('pin-modal').style.display = 'none';
          document.getElementById('create-modal').style.display = 'flex';
        } catch (e) { alert(e.message || 'Failed to set PIN'); }
      });

      document.getElementById('pin-skip')?.addEventListener('click', () => {
        document.getElementById('pin-modal').style.display = 'none';
        document.getElementById('create-modal').style.display = 'flex';
      });

      document.getElementById('pin-enter')?.addEventListener('click', async () => {
        const pin = document.getElementById('pin-input').value;
        if (!pin) { alert('Enter your PIN'); return; }
        try {
          const ok = await ShardProtection.verifyPin(pin);
          if (!ok) { alert('Incorrect PIN'); return; }
          sessionStorage.setItem('vault_shard_pin_temp', pin);
          document.getElementById('pin-modal').style.display = 'none';
          document.getElementById('create-modal').style.display = 'flex';
        } catch (e) { alert(e.message || 'PIN verification failed'); }
      });


      document.getElementById('cancel-create').addEventListener('click', () => {
        document.getElementById('create-modal').style.display = 'none';
      });

      document.getElementById('create-vault-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('vault-name').value.trim();
        const password = document.getElementById('vault-password').value;
        if (!name) return;
        if (typeof Validate !== 'undefined') {
          const pwCheck = Validate.validatePassword(password);
          if (!pwCheck.valid) {
            alert((pwCheck.errors && pwCheck.errors[0]) || 'Invalid password.');
            return;
          }
        } else if (!password || password.length < 12) return;

        const btn = document.getElementById('create-submit-btn');
        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
          const res = await fetch('/api/create-vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, password, useNanosecond: true })
          });
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Failed to create vault');
          }

          const { vaultId, salt, encryptedData, iv, shards, timestamp } = data;

          const vaults = getVaults();
          vaults.push({
            id: vaultId,
            name,
            locked: true,
            salt,
            iv,
            encryptedData,
            timestamp: timestamp || null,
            createdAt: new Date().toISOString()
          });
          saveVaults(vaults);

          localStorage.setItem('vault_data_' + vaultId, JSON.stringify({ salt, iv, encryptedData, timestamp: timestamp || null }));

          document.getElementById('create-form-step').style.display = 'none';
          document.getElementById('shards-step').style.display = 'block';
          document.getElementById('modal-shard-1').textContent = shards[0];
          document.getElementById('modal-shard-2').textContent = shards[1];
          document.getElementById('modal-shard-3').textContent = shards[2];

          if (vaultId) {
            const pin = sessionStorage.getItem('vault_shard_pin_temp');
            if (typeof ShardProtection !== 'undefined' && ShardProtection.hasPin() && pin) {
              try {
                const encrypted = await ShardProtection.encryptShards(shards, pin);
                localStorage.setItem('vault_shards_' + vaultId, JSON.stringify(encrypted));
              } catch (e) {
                localStorage.setItem('vault_shards_' + vaultId, JSON.stringify(shards));
              }
              sessionStorage.removeItem('vault_shard_pin_temp');
            } else {
              localStorage.setItem('vault_shards_' + vaultId, JSON.stringify(shards));
            }
          }
        } catch (err) {
          alert(err.message || 'Failed to create vault');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Create Vault';
        }
      });

      document.getElementById('shards-done').addEventListener('click', () => {
        document.getElementById('create-modal').style.display = 'none';
        document.getElementById('create-form-step').style.display = 'block';
        document.getElementById('shards-step').style.display = 'none';
        document.getElementById('vault-name').value = '';
        document.getElementById('vault-password').value = '';
        renderVaults();
      });

      document.getElementById('cancel-create').addEventListener('click', () => {
        document.getElementById('create-modal').style.display = 'none';
        document.getElementById('create-form-step').style.display = 'block';
        document.getElementById('shards-step').style.display = 'none';
      });
    }

    renderVaults();