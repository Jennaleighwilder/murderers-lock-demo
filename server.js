#!/usr/bin/env node
/**
 * Local dev server: static files + API routes (Vercel-compatible handlers)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const API_ROUTES = {
  'create-vault': './api/create-vault.js',
  'unlock-vault': './api/unlock-vault.js',
  'encrypt-vault': './api/encrypt-vault.js',
  'audit-log': './api/audit-log.js',
  'import-passwords': './api/import-passwords.js',
  '2fa-status': './api/2fa-status.js',
  '2fa-setup': './api/2fa-setup.js',
  '2fa-verify': './api/2fa-verify.js',
  '2fa-disable': './api/2fa-disable.js',
  'webauthn': './api/webauthn-vault.js',
  'webauthn-status': './api/webauthn-status.js',
  'webauthn-register-options': './api/webauthn-register-options.js',
  'webauthn-register-verify': './api/webauthn-register-verify.js',
  'webauthn-auth-options': './api/webauthn-auth-options.js',
  'webauthn-auth-verify': './api/webauthn-auth-verify.js',
  'health': './api/health.js',
  'recover-vault': './api/recover-vault.js',
  'checkout': './api/checkout.js',
  'stripe-webhook': './api/stripe-webhook.js',
  'device-register': './api/device-register.js',
  'device-verify': './api/device-verify.js',
  'panic-setup': './api/panic-setup.js',
  'enterprise-auth': './api/enterprise-auth.js',
  'enterprise-contact': './api/enterprise-contact.js',
  'victim-kill-switch': './api/victim-kill-switch.js'
};

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function parseQuery(reqUrl) {
  const u = url.parse(reqUrl, true);
  return u.query;
}

function createRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };
  return res;
}

async function handleApi(pathname, req, res) {
  const base = pathname.replace(/^\/api\//, '').split('/')[0];
  const handlerPath = API_ROUTES[base];
  if (!handlerPath) return false;
  const handler = require(handlerPath);
  const body = req.method === 'POST' || req.method === 'PUT' ? await parseBody(req) : {};
  const query = parseQuery(req.url);
  const apiReq = {
    method: req.method,
    url: req.url,
    body,
    query,
    headers: req.headers
  };
  const apiRes = createRes(res);
  try {
    await handler(apiReq, apiRes);
  } catch (err) {
    console.error('API error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Internal error' }));
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const u = url.parse(req.url, true);
  const pathname = u.pathname;

  if (pathname.startsWith('/api/')) {
    const handled = await handleApi(pathname, req, res);
    if (handled) return;
  }

  let p = path.join(ROOT, pathname === '/' ? 'index.html' : pathname.split('?')[0]);
  if (!p.startsWith(ROOT)) p = path.join(ROOT, 'index.html');
  fs.readFile(p, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(p);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server at http://127.0.0.1:${PORT}`);
});
