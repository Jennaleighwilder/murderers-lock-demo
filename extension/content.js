/**
 * Murderer's Lock - Content script for auto-fill
 * Listens for vault-unlocked event from app, adds fill buttons to password fields
 */

(function () {
  const STORAGE_KEY = 'vaultContents';

  // Listen for vault unlock from app (same-origin)
  window.addEventListener('vault-unlocked', (e) => {
    if (e.detail && e.detail.contents) {
      const data = { [STORAGE_KEY]: e.detail.contents };
      if (e.detail.vaultId) data.vaultId = e.detail.vaultId;
      chrome.storage.session.set(data);
    }
  });

  function parseEntries(text) {
    if (!text || typeof text !== 'string') return [];
    const entries = [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const delims = [/\|/, /:/, /\t/, /,/];
    for (const line of lines) {
      let label = '', password = '';
      for (const d of delims) {
        const parts = line.split(d);
        if (parts.length >= 2) {
          label = (parts[0] || '').trim();
          password = (parts[parts.length - 1] || '').trim();
          break;
        }
      }
      if (password && password.length >= 4) entries.push({ label: label || 'Entry', password });
    }
    return entries;
  }

  function addFillButton(input) {
    if (input.dataset.mlFillAdded) return;
    input.dataset.mlFillAdded = 'true';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-block;';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '🔐 Fill';
    btn.style.cssText = 'position:absolute;right:4px;top:50%;transform:translateY(-50%);padding:4px 8px;font-size:11px;background:#00F5FF;color:#000;border:none;border-radius:4px;cursor:pointer;';
    btn.onclick = async () => {
      const r = await chrome.storage.session.get([STORAGE_KEY]);
      const contents = r[STORAGE_KEY];
      if (!contents) {
        alert('Unlock your vault at the Murderer\'s Lock app first.');
        return;
      }
      const entries = parseEntries(contents);
      if (entries.length === 0) {
        alert('No password entries in vault.');
        return;
      }
      const host = window.location.hostname;
      const match = entries.find(e => e.label.toLowerCase().includes(host)) || entries[0];
      input.value = match.password;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    wrap.appendChild(btn);
  }

  function scan() {
    const inputs = document.querySelectorAll('input[type="password"]');
    inputs.forEach(addFillButton);
  }

  const obs = new MutationObserver(scan);
  obs.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
})();
