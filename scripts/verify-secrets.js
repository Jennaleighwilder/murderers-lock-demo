#!/usr/bin/env node
/**
 * Secret scanning — fail if credential-like patterns in tracked files.
 * Run: node scripts/verify-secrets.js
 */

const fs = require('fs');
const path = require('path');

const PATTERNS = [
  { regex: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/, msg: 'Supabase service key in source' },
  { regex: /sk_live_[a-zA-Z0-9]{24,}/, msg: 'Stripe secret key in source' },
  { regex: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, msg: 'Private key in source' }
];

const IGNORE = ['node_modules', '.git', 'build-manifest.json', 'sbom.json', '.env.example', 'docs', 'test/', 'scripts/'];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (IGNORE.some(x => p.includes(x))) continue;
    if (e.isDirectory()) walk(p, files);
    else if (e.isFile() && /\.(js|ts|json|env)$/.test(e.name)) files.push(p);
  }
  return files;
}

let failed = 0;
const root = path.join(__dirname, '..');
const files = walk(root);

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  for (const { regex, msg } of PATTERNS) {
    if (regex.test(content)) {
      console.error(`FAIL: ${msg} in ${path.relative(root, f)}`);
      failed++;
    }
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log('OK: No credential patterns detected');
