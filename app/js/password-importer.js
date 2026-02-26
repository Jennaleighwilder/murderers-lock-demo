/**
 * password-importer.js
 * Universal import: 1Password, Bitwarden, LastPass, Chrome, Firefox, Safari, generic CSV
 * Client-side only. No server round-trip for parsing.
 */

(function (global) {
  'use strict';

  const FORMATS = {
    BITWARDEN_JSON: 'bitwarden',
    ONEPASSWORD_CSV: '1password',
    LASTPASS_CSV: 'lastpass',
    CHROME_CSV: 'chrome',
    FIREFOX_CSV: 'firefox',
    SAFARI_CSV: 'safari',
    GENERIC_CSV: 'generic'
  };

  function parseCSV(text) {
    const rows = [];
    let inQuotes = false;
    let current = [];
    let cell = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === ',' || c === '\t') && !inQuotes) {
        current.push(cell.trim());
        cell = '';
      } else if ((c === '\n' || (c === '\r' && text[i + 1] === '\n')) && !inQuotes) {
        current.push(cell.trim());
        cell = '';
        if (current.some(x => x)) rows.push(current);
        current = [];
        if (c === '\r') i++;
      } else {
        cell += c;
      }
    }
    if (cell || current.length) {
      current.push(cell.trim());
      if (current.some(x => x)) rows.push(current);
    }
    return rows;
  }

  function detectFormat(rows, raw) {
    if (!rows || rows.length < 2) return null;
    const header = rows[0].map(h => (h || '').toLowerCase());
    if (header.includes('url') && header.includes('username') && header.includes('password')) {
      if (header.includes('fav') || header.includes('grouping')) return FORMATS.LASTPASS_CSV;
      if (header.includes('name') && header.length <= 5) return FORMATS.CHROME_CSV;
    }
    if (header.includes('title') && header.includes('website') && header.includes('username')) return FORMATS.ONEPASSWORD_CSV;
    if (header.includes('website') && header.includes('login')) return FORMATS.SAFARI_CSV;
    if (header.includes('url') && header.includes('username')) return FORMATS.GENERIC_CSV;
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      try {
        const j = JSON.parse(raw);
        if (j.encrypted !== undefined && Array.isArray(j.items)) return FORMATS.BITWARDEN_JSON;
      } catch (_) {}
    }
    return FORMATS.GENERIC_CSV;
  }

  function parse1PasswordCSV(rows) {
    const header = rows[0].map(h => (h || '').toLowerCase());
    const idx = (name) => header.indexOf(name) >= 0 ? header.indexOf(name) : -1;
    const titleIdx = idx('title') >= 0 ? idx('title') : idx('name');
    const urlIdx = idx('website') >= 0 ? idx('website') : idx('url');
    const userIdx = idx('username') >= 0 ? idx('username') : idx('login');
    const passIdx = idx('password') >= 0 ? idx('password') : -1;
    const entries = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const password = passIdx >= 0 ? (r[passIdx] || '').trim() : '';
      if (!password || password.length < 2) continue;
      const label = (r[titleIdx] || r[urlIdx] || r[0] || 'Imported').trim();
      const url = urlIdx >= 0 ? (r[urlIdx] || '').trim() : '';
      const username = userIdx >= 0 ? (r[userIdx] || '').trim() : '';
      const display = url || label;
      entries.push({ label: display, username, password });
    }
    return entries;
  }

  function parseLastPassCSV(rows) {
    const header = rows[0].map(h => (h || '').toLowerCase());
    const urlIdx = header.indexOf('url') >= 0 ? header.indexOf('url') : 0;
    const userIdx = header.indexOf('username') >= 0 ? header.indexOf('username') : 1;
    const passIdx = header.indexOf('password') >= 0 ? header.indexOf('password') : 2;
    const nameIdx = header.indexOf('name') >= 0 ? header.indexOf('name') : -1;
    const entries = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const password = (r[passIdx] || '').trim();
      if (!password || password.length < 2) continue;
      const url = (r[urlIdx] || '').trim();
      const username = (r[userIdx] || '').trim();
      const name = nameIdx >= 0 ? (r[nameIdx] || '').trim() : '';
      const label = url || name || 'Imported';
      entries.push({ label, username, password });
    }
    return entries;
  }

  function parseChromeCSV(rows) {
    const header = rows[0].map(h => (h || '').toLowerCase());
    const nameIdx = header.indexOf('name') >= 0 ? header.indexOf('name') : 0;
    const urlIdx = header.indexOf('url') >= 0 ? header.indexOf('url') : 1;
    const userIdx = header.indexOf('username') >= 0 ? header.indexOf('username') : 2;
    const passIdx = header.indexOf('password') >= 0 ? header.indexOf('password') : 3;
    const entries = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const password = (r[passIdx] || '').trim();
      if (!password || password.length < 2) continue;
      const label = (r[urlIdx] || r[nameIdx] || r[0] || 'Imported').trim();
      const username = (r[userIdx] || '').trim();
      entries.push({ label, username, password });
    }
    return entries;
  }

  function parseGenericCSV(rows) {
    const header = rows[0].map(h => (h || '').toLowerCase());
    const urlIdx = header.findIndex(h => /url|website|site|domain/.test(h));
    const userIdx = header.findIndex(h => /username|login|email|user/.test(h));
    const passIdx = header.findIndex(h => /password|pass|pwd|secret/.test(h));
    const nameIdx = header.findIndex(h => /name|title|label/.test(h));
    const entries = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const passCol = passIdx >= 0 ? passIdx : (r.length >= 2 ? r.length - 1 : 1);
      const password = (r[passCol] || '').trim();
      if (!password || password.length < 2) continue;
      const label = (urlIdx >= 0 ? r[urlIdx] : nameIdx >= 0 ? r[nameIdx] : r[0]) || 'Imported';
      const username = userIdx >= 0 ? (r[userIdx] || '').trim() : '';
      entries.push({ label: String(label).trim(), username, password });
    }
    return entries;
  }

  function parseBitwardenJSON(raw) {
    let data;
    try {
      data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_) {
      return { entries: [], error: 'Invalid JSON' };
    }
    if (!data.items || !Array.isArray(data.items)) return { entries: [], error: 'Invalid Bitwarden format' };
    const entries = [];
    for (const item of data.items) {
      if (item.type !== 1 && item.type !== 2) continue; // 1=login, 2=secure note
      if (item.type === 1 && item.login) {
        const password = (item.login.password || '').trim();
        if (!password) continue;
        const uri = item.login.uris && item.login.uris[0] ? (item.login.uris[0].uri || '').trim() : '';
        const username = (item.login.username || '').trim();
        const name = (item.name || '').trim();
        const label = uri || name || 'Imported';
        entries.push({ label, username, password });
      }
    }
    return { entries, format: FORMATS.BITWARDEN_JSON };
  }

  function parse1PIF(raw) {
    const entries = [];
    const blocks = raw.split(/\*\*\*\*\*[^*]+\*\*\*\*\*/);
    for (const block of blocks) {
      const m = block.match(/^(.+?):(.+)$/s);
      if (!m) continue;
      const [, type, content] = m;
      if (!/^Login|^Secure Note/i.test(type)) continue;
      const fields = {};
      content.split(/\r?\n/).forEach(line => {
        const [key, ...rest] = line.split(':');
        if (key) fields[key.trim()] = rest.join(':').trim();
      });
      const password = fields.Password || fields.password || '';
      if (!password) continue;
      const label = fields.URL || fields.Title || fields.title || 'Imported';
      const username = fields.Username || fields.username || '';
      entries.push({ label, username, password });
    }
    return entries;
  }

  function toVaultFormat(entries) {
    return entries.map(e => {
      if (e.username) return `${e.label} | ${e.username} | ${e.password}`;
      return `${e.label} | ${e.password}`;
    }).join('\n');
  }

  function deduplicate(entries, existingMap) {
    const seen = new Set();
    const out = [];
    for (const e of entries) {
      const key = `${(e.label || '').toLowerCase()}|${(e.username || '').toLowerCase()}|${e.password}`;
      if (seen.has(key)) continue;
      if (existingMap && existingMap.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
    return out;
  }

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = reader.result;
          const isJSON = typeof raw === 'string' && raw.trim().startsWith('{');
          if (isJSON) {
            const { entries, error } = parseBitwardenJSON(raw);
            if (error) return resolve({ entries: [], format: null, error });
            return resolve({ entries, format: FORMATS.BITWARDEN_JSON });
          }
          const rows = parseCSV(raw);
          const format = detectFormat(rows, raw);
          if (!format) return resolve({ entries: [], format: null, error: 'Could not detect format' });
          let entries;
          if (format === FORMATS.ONEPASSWORD_CSV) entries = parse1PasswordCSV(rows);
          else if (format === FORMATS.LASTPASS_CSV) entries = parseLastPassCSV(rows);
          else if (format === FORMATS.CHROME_CSV) entries = parseChromeCSV(rows);
          else entries = parseGenericCSV(rows);
          if (raw.includes('*****') && raw.includes('Account:')) {
            const pif = parse1PIF(raw);
            if (pif.length > entries.length) entries = pif;
          }
          resolve({ entries, format });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      if (file.name.toLowerCase().endsWith('.json')) reader.readAsText(file, 'UTF-8');
      else reader.readAsText(file, 'UTF-8');
    });
  }

  global.PasswordImporter = {
    parseFile,
    parseCSV,
    parseBitwardenJSON,
    toVaultFormat,
    deduplicate,
    FORMATS
  };
})(typeof window !== 'undefined' ? window : globalThis);
