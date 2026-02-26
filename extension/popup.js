/**
 * The Murderer's Lock - Popup script
 * Vault status, app URL config, quick actions
 */

const DEFAULTS = {
  appUrl: 'http://localhost:3000',
  appUrlProd: 'https://your-app.vercel.app'
};

const STORAGE_KEYS = {
  appUrl: 'ml_app_url',
  vaultContents: 'vaultContents',
  vaultId: 'vaultId'
};

// Parse vault entries for count
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

async function getAppUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.appUrl], (r) => {
      const url = r[STORAGE_KEYS.appUrl] || DEFAULTS.appUrl;
      resolve(url.replace(/\/$/, ''));
    });
  });
}

async function init() {
  const [vaultData, appUrl] = await Promise.all([
    new Promise((r) => chrome.storage.session.get([STORAGE_KEYS.vaultContents, STORAGE_KEYS.vaultId], r)),
    getAppUrl()
  ]);

  const contents = vaultData[STORAGE_KEYS.vaultContents];
  const entries = parseEntries(contents || '');
  const synced = !!contents;

  // Status card
  const card = document.getElementById('status-card');
  const statusEl = document.getElementById('status-value');
  const countEl = document.getElementById('entry-count');

  card.classList.remove('synced', 'locked');
  if (synced) {
    card.classList.add('synced');
    statusEl.textContent = '✓ Vault synced';
    statusEl.classList.add('synced');
    countEl.textContent = `${entries.length} password${entries.length !== 1 ? 's' : ''} ready to fill`;
  } else {
    card.classList.add('locked');
    statusEl.textContent = 'Vault locked';
    statusEl.classList.remove('synced');
    countEl.textContent = 'Open the app and unlock your vault';
  }

  // Links
  const base = appUrl || DEFAULTS.appUrl;
  const vaultId = vaultData[STORAGE_KEYS.vaultId];
  document.getElementById('open-vault').href = vaultId
    ? `${base}/vault.html?id=${encodeURIComponent(vaultId)}`
    : base + '/dashboard.html';
  document.getElementById('open-dashboard').href = base + '/dashboard.html';

  // Settings
  document.getElementById('app-url').value = appUrl;
}

// Settings toggle
document.getElementById('settings-toggle').addEventListener('click', () => {
  document.getElementById('settings-panel').classList.toggle('open');
});

document.getElementById('save-settings').addEventListener('click', async () => {
  const url = document.getElementById('app-url').value.trim();
  if (!url) return;
  const normalized = url.replace(/\/$/, '');
  await chrome.storage.local.set({ [STORAGE_KEYS.appUrl]: normalized });
  init();
  document.getElementById('settings-panel').classList.remove('open');
});

// Listen for storage changes (vault sync from another tab)
chrome.storage.session.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes[STORAGE_KEYS.vaultContents]) {
    init();
  }
});

init();
