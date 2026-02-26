#!/usr/bin/env node
/**
 * Build provenance manifest — chain of custody for releases.
 * Run: node scripts/build-provenance.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const manifest = {
  timestamp: new Date().toISOString(),
  nodeVersion: process.version,
  buildCommit: process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
  ciRunId: process.env.GITHUB_RUN_ID || process.env.VERCEL_DEPLOYMENT_ID || 'local'
};

const lockPath = path.join(__dirname, '../package-lock.json');
if (fs.existsSync(lockPath)) {
  const content = fs.readFileSync(lockPath);
  manifest.lockfileChecksum = crypto.createHash('sha256').update(content).digest('hex');
}

fs.writeFileSync(
  path.join(__dirname, '../build-manifest.json'),
  JSON.stringify(manifest, null, 2)
);
console.log('build-manifest.json written');
