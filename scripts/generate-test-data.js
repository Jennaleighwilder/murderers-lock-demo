#!/usr/bin/env node
/**
 * Test Data Generator for Murderer's Lock
 * Generates: 1000 test passwords, sample CSVs for all import formats, edge cases
 * Run: node scripts/generate-test-data.js
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../test-data');
const SITES = [
  'github.com', 'google.com', 'amazon.com', 'facebook.com', 'twitter.com',
  'linkedin.com', 'netflix.com', 'spotify.com', 'dropbox.com', 'slack.com',
  'zoom.us', 'notion.so', 'figma.com', 'stripe.com', 'vercel.com',
  'example.com', 'test.org', 'demo.net', 'login.example.co.uk'
];

function randomStr(len, charset = 'abcdefghijklmnopqrstuvwxyz0123456789') {
  let s = '';
  for (let i = 0; i < len; i++) s += charset[Math.floor(Math.random() * charset.length)];
  return s;
}

function generateEntries(count) {
  const entries = [];
  const seen = new Set();

  for (let i = 0; i < count; i++) {
    const site = SITES[i % SITES.length];
    const user = `user${i}@example.com`;
    const pass = randomStr(12) + '!Aa1';
    const key = `${site}|${user}|${pass}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ url: site, username: user, password: pass, label: site });
  }
  return entries;
}

function generateEdgeCases() {
  return [
    { url: 'weak.com', username: 'weak@test.com', password: '123', label: 'weak.com' },
    { url: 'weak2.com', username: '', password: 'password', label: 'weak2.com' },
    { url: 'weak3.com', username: 'a', password: 'a', label: 'weak3.com' },
    { url: 'duplicate.com', username: 'dup@test.com', password: 'SamePass123!', label: 'duplicate.com' },
    { url: 'duplicate2.com', username: 'dup2@test.com', password: 'SamePass123!', label: 'duplicate2.com' },
    { url: 'special.com', username: 'special@test.com', password: '!@#$%^&*()_+-=[]{}|;:\'",.<>?', label: 'special.com' },
    { url: 'unicode.com', username: '你好@test.com', password: '你好🔐密码123', label: 'unicode.com' },
    { url: 'empty-user.com', username: '', password: 'NoUsernamePass1!', label: 'empty-user.com' },
    { url: 'long.com', username: 'long@test.com', password: randomStr(256), label: 'long.com' },
    { url: 'https://' + 'a'.repeat(200) + '.example.com', username: 'longurl@test.com', password: 'LongUrlPass1!', label: 'long-url.example.com' },
  ];
}

function escapeCSV(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeGenericCSV(entries, filepath) {
  const rows = [['url', 'username', 'password']];
  entries.forEach(e => rows.push([e.url, e.username, e.password]));
  const csv = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  fs.writeFileSync(filepath, csv, 'utf8');
}

function write1PasswordCSV(entries, filepath) {
  const rows = [['title', 'website', 'username', 'password']];
  entries.forEach(e => rows.push([e.label, e.url, e.username, e.password]));
  const csv = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  fs.writeFileSync(filepath, csv, 'utf8');
}

function writeLastPassCSV(entries, filepath) {
  const rows = [['url', 'username', 'password', 'name', 'extra', 'fav', 'grouping']];
  entries.forEach(e => rows.push([e.url, e.username, e.password, e.label, '', '0', '']));
  const csv = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  fs.writeFileSync(filepath, csv, 'utf8');
}

function writeChromeCSV(entries, filepath) {
  const rows = [['name', 'url', 'username', 'password']];
  entries.forEach(e => rows.push([e.label, e.url, e.username, e.password]));
  const csv = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  fs.writeFileSync(filepath, csv, 'utf8');
}

function writeSafariCSV(entries, filepath) {
  const rows = [['website', 'login', 'username', 'password']];
  entries.forEach(e => rows.push([e.url, e.url, e.username, e.password]));
  const csv = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  fs.writeFileSync(filepath, csv, 'utf8');
}

function writeBitwardenJSON(entries, filepath) {
  const items = entries.map(e => ({
    type: 1,
    name: e.label,
    login: {
      username: e.username,
      password: e.password,
      uris: [{ uri: e.url.startsWith('http') ? e.url : `https://${e.url}` }]
    }
  }));
  fs.writeFileSync(filepath, JSON.stringify({ encrypted: false, items }, null, 2), 'utf8');
}

function writeVaultFormat(entries, filepath) {
  const lines = entries.map(e =>
    e.username ? `${e.label} | ${e.username} | ${e.password}` : `${e.label} | ${e.password}`
  );
  fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
}

// Main
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const edgeCases = generateEdgeCases();
const standard = generateEntries(100);
const large = generateEntries(1000);
const all = [...edgeCases, ...standard];

console.log('Generating test data...');

writeGenericCSV(edgeCases, path.join(OUT_DIR, 'import-generic-edge.csv'));
writeGenericCSV(standard, path.join(OUT_DIR, 'import-generic-100.csv'));
writeGenericCSV(large, path.join(OUT_DIR, 'import-generic-1000.csv'));

write1PasswordCSV(all, path.join(OUT_DIR, 'import-1password.csv'));
writeLastPassCSV(all, path.join(OUT_DIR, 'import-lastpass.csv'));
writeChromeCSV(all, path.join(OUT_DIR, 'import-chrome.csv'));
writeSafariCSV(all, path.join(OUT_DIR, 'import-safari.csv'));
writeBitwardenJSON(all, path.join(OUT_DIR, 'import-bitwarden.json'));

writeVaultFormat(all, path.join(OUT_DIR, 'vault-preload.txt'));
writeVaultFormat(large, path.join(OUT_DIR, 'vault-1000.txt'));

console.log('Done! Created in test-data/:');
fs.readdirSync(OUT_DIR).forEach(f => console.log('  -', f));
console.log('\nUse import-*.csv / import-bitwarden.json for import testing.');
console.log('Use vault-*.txt to paste into vault (or merge with existing).');
