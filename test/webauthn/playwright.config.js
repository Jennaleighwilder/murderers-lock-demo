const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : 'list',
  use: {
    browserName: 'chromium',
    headless: true,
    baseURL: process.env.WEBAUTHN_BASE_URL || process.env.REDTEAM_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'off',
  },
  projects: [{ name: 'webauthn', testMatch: /webauthn.*\.spec\.js/ }],
});
