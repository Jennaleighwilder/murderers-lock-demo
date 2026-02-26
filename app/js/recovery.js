const params = new URLSearchParams(window.location.search);
    const vaultId = params.get('id');
    document.getElementById('back-link').href = vaultId ? 'vault.html?id=' + vaultId : 'dashboard.html';

    const view = document.getElementById('recovery-view');
    document.getElementById('tab-setup').addEventListener('click', () => {
      view.classList.add('setup-view');
      view.classList.remove('recover-view');
    });
    document.getElementById('tab-recover').addEventListener('click', () => {
      view.classList.remove('setup-view');
      view.classList.add('recover-view');
    });
    view.classList.add('setup-view');

    document.getElementById('load-shards-btn')?.addEventListener('click', async () => {
      if (!vaultId) {
        alert('Open a vault first to load shards from this device.');
        return;
      }
      const stored = localStorage.getItem('vault_shards_' + vaultId);
      if (!stored) {
        alert('No shards found for this vault on this device.');
        return;
      }
      let shards;
      try {
        shards = JSON.parse(stored);
      } catch {
        alert('Invalid shard data.');
        return;
      }
      if (typeof ShardProtection !== 'undefined' && ShardProtection.isEncrypted(shards)) {
        document.getElementById('recovery-pin-modal').style.display = 'flex';
        document.getElementById('recovery-pin-input').value = '';
        window._pendingEncryptedShards = shards;
      } else {
        if (Array.isArray(shards) && shards.length >= 2) {
          document.getElementById('recover-shard-1').value = shards[0];
          document.getElementById('recover-shard-2').value = shards[1];
        }
      }
    });

    document.getElementById('recovery-pin-ok')?.addEventListener('click', async () => {
      const pin = document.getElementById('recovery-pin-input').value;
      if (!pin) return;
      if (window._pendingShardsToEncrypt) {
        const { shards, vaultId } = window._pendingShardsToEncrypt;
        try {
          const encrypted = await ShardProtection.encryptShards(shards, pin);
          localStorage.setItem('vault_shards_' + vaultId, JSON.stringify(encrypted));
          document.getElementById('recovery-pin-modal').style.display = 'none';
          document.querySelector('#recovery-pin-modal h3').textContent = 'Enter PIN to decrypt shards';
          document.getElementById('recovery-pin-ok').textContent = 'Decrypt';
          window._pendingShardsToEncrypt = null;
        } catch (e) {
          alert(e.message || 'Failed to encrypt.');
        }
      } else if (window._pendingEncryptedShards) {
        try {
          const decrypted = await ShardProtection.decryptShards(window._pendingEncryptedShards, pin);
          document.getElementById('recover-shard-1').value = decrypted[0] || '';
          document.getElementById('recover-shard-2').value = decrypted[1] || '';
          document.getElementById('recovery-pin-modal').style.display = 'none';
          window._pendingEncryptedShards = null;
        } catch (e) {
          alert('Wrong PIN or corrupted shards.');
        }
      }
    });

    document.getElementById('recovery-pin-cancel')?.addEventListener('click', () => {
      document.getElementById('recovery-pin-modal').style.display = 'none';
      if (window._pendingShardsToEncrypt) {
        const { vaultId } = window._pendingShardsToEncrypt;
        localStorage.setItem('vault_shards_' + vaultId, JSON.stringify(window._pendingShardsToEncrypt.shards));
        window._pendingShardsToEncrypt = null;
      }
      window._pendingEncryptedShards = null;
      document.querySelector('#recovery-pin-modal h3').textContent = 'Enter PIN to decrypt shards';
      document.getElementById('recovery-pin-ok').textContent = 'Decrypt';
    });

    document.getElementById('generate-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('gen-error');
      err.classList.remove('visible');
      const password = document.getElementById('gen-password').value;

      try {
        const res = await fetch('/api/generate-shards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: password })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to generate shards');

        const shards = data.shards;
        document.getElementById('shard-1').textContent = shards[0];
        document.getElementById('shard-2').textContent = shards[1];
        document.getElementById('shard-3').textContent = shards[2];
        document.getElementById('shards-output').style.display = 'block';
        if (vaultId) {
          if (typeof ShardProtection !== 'undefined' && ShardProtection.hasPin()) {
            document.querySelector('#recovery-pin-modal h3').textContent = 'Enter PIN to encrypt shards';
            document.getElementById('recovery-pin-ok').textContent = 'Encrypt & Save';
            window._pendingShardsToEncrypt = { shards, vaultId };
            document.getElementById('recovery-pin-modal').style.display = 'flex';
            document.getElementById('recovery-pin-input').value = '';
          } else {
            localStorage.setItem('vault_shards_' + vaultId, JSON.stringify(shards));
          }
        }
      } catch (ex) {
        err.textContent = ex.message || 'Failed to generate shards.';
        err.classList.add('visible');
      }
    });

    document.getElementById('recover-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('recover-error');
      const ok = document.getElementById('recover-success');
      err.classList.remove('visible');
      ok.classList.remove('visible');
      const s1 = document.getElementById('recover-shard-1').value.replace(/\s/g, '');
      const s2 = document.getElementById('recover-shard-2').value.replace(/\s/g, '');
      const submitBtn = e.target.querySelector('button[type="submit"]');

      if (typeof Validate !== 'undefined') {
        const check = Validate.validateShardPair(s1, s2);
        if (!check.valid) {
          err.textContent = check.error || 'Invalid shard format.';
          err.classList.add('visible');
          return;
        }
      }

      let pow = null;
      if (typeof ProofOfWork !== 'undefined') {
        pow = ProofOfWork.show('#recovery-view', { message: 'Reconstructing vault...', duration: 5000 });
        if (submitBtn) submitBtn.disabled = true;
      }

      try {
        const vaults = JSON.parse(localStorage.getItem('vault_manager_vaults') || '[]');
        const vault = vaultId ? vaults.find(x => x.id === vaultId) : null;
        const enc = (vault && vault.salt && vault.iv && vault.encryptedData)
          ? { salt: vault.salt, iv: vault.iv, encryptedData: vault.encryptedData }
          : (vaultId ? (() => {
              const d = JSON.parse(localStorage.getItem('vault_data_' + vaultId) || '{}');
              return d.salt && d.iv && d.encryptedData ? d : null;
            })() : null);

        if (!vaultId || !enc) {
          err.textContent = 'Open a vault first, then use recovery from the vault page.';
          err.classList.add('visible');
          return;
        }

        const res = await fetch('/api/recover-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shards: [s1, s2],
            vaultId,
            salt: enc.salt,
            encryptedData: enc.encryptedData,
            iv: enc.iv
          })
        });
        const data = await res.json();

        if (!res.ok) {
          err.textContent = data.message || data.error || (res.status === 429 ? 'Too many attempts. Try again later.' : 'Invalid shards');
          err.classList.add('visible');
          return;
        }

        const token = data.sessionToken;
        if (!token) {
          err.textContent = 'Recovery failed: no session token.';
          err.classList.add('visible');
          return;
        }

        const unlockRes = await fetch('/api/unlock-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken: token, vaultId })
        });
        const unlockData = await unlockRes.json();

        if (!unlockRes.ok) {
          err.textContent = unlockData.message || unlockData.error || 'Session expired. Try recovery again.';
          err.classList.add('visible');
          return;
        }

        if (vault) {
          vault.murderCount = 0;
          vault.lockjawEngaged = false;
          vault.locked = false;
          localStorage.setItem('vault_manager_vaults', JSON.stringify(vaults));
        }
        sessionStorage.setItem('vault_contents_' + vaultId, unlockData.contents || '');
        ok.textContent = '✓ Vault recovered. Security state reset. Redirecting...';
        ok.classList.add('visible');
        setTimeout(() => { window.location.href = 'vault.html?id=' + vaultId; }, 1500);
      } catch (ex) {
        err.textContent = ex.message || 'Invalid shards. Ensure you have 2 valid shards from the same split.';
        err.classList.add('visible');
      } finally {
        if (pow) pow.stop();
        if (submitBtn) submitBtn.disabled = false;
      }
    });