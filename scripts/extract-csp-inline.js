#!/usr/bin/env node
/**
 * Extract inline <style> and <script> from HTML files for CSP compliance.
 * Creates external .css and .js files, updates HTML to use them.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const APP_PAGES = [
  'app/index.html',
  'app/vault.html',
  'app/dashboard.html',
  'app/settings.html',
  'app/dms.html',
  'app/security.html',
  'app/recovery.html',
];

function extractBetween(html, startTag, endTag) {
  const start = html.indexOf(startTag);
  if (start === -1) return null;
  const contentStart = start + startTag.length;
  const end = html.indexOf(endTag, contentStart);
  if (end === -1) return null;
  return { content: html.slice(contentStart, end).trim(), start, end: end + endTag.length };
}

function processFile(filePath) {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) return;
  let html = fs.readFileSync(fullPath, 'utf8');

  const dir = path.dirname(filePath);
  const base = path.basename(filePath, '.html');
  const cssDir = dir === 'app' ? 'app/css' : 'css';
  const jsDir = dir === 'app' ? 'app/js' : 'js';
  const cssPath = path.join(ROOT, cssDir, base + '.css');
  const jsPath = path.join(ROOT, jsDir, base + '.js');
  const cssRel = dir === 'app' ? 'css/' + base + '.css' : 'css/' + base + '.css';
  const jsRel = dir === 'app' ? 'js/' + base + '.js' : 'js/' + base + '.js';

  let modified = false;

  // Extract inline styles
  const styleMatch = extractBetween(html, '<style>', '</style>');
  if (styleMatch && styleMatch.content) {
    fs.mkdirSync(path.dirname(cssPath), { recursive: true });
    fs.writeFileSync(cssPath, styleMatch.content);
    html = html.slice(0, html.indexOf('<style>')) +
      '<link rel="stylesheet" href="' + cssRel + '">' +
      html.slice(styleMatch.end);
    modified = true;
  }

  // Extract inline scripts (find <script> without src=)
  const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/;
  const scriptMatch = html.match(scriptRegex);
  if (scriptMatch && scriptMatch[1] && scriptMatch[1].trim()) {
    fs.mkdirSync(path.dirname(jsPath), { recursive: true });
    fs.writeFileSync(jsPath, scriptMatch[1].trim());
    html = html.replace(scriptRegex, '<script src="' + jsRel + '"></script>');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, html);
    console.log('Processed:', filePath);
  }
}

APP_PAGES.forEach(processFile);
