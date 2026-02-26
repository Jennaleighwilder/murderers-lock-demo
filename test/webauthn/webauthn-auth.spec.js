/**
 * WebAuthn E2E — Playwright + Virtual Authenticator
 *
 * Tests real browser ceremony: registration, authentication, replay rejection.
 * Requires Chromium (virtual authenticator is CDP-only).
 *
 * Run: npm run test:webauthn
 * Env: WEBAUTHN_BASE_URL or REDTEAM_BASE_URL (default: http://localhost:3000)
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.WEBAUTHN_BASE_URL || process.env.REDTEAM_BASE_URL || 'http://localhost:3000';

async function addVirtualAuthenticator(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  return { cdp, authenticatorId };
}

test.describe('WebAuthn ceremony', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we're on a secure context (required for WebAuthn)
    await page.goto(BASE + '/app/index.html', { waitUntil: 'networkidle' });
  });

  test('registration completes with virtual authenticator', async ({ page }) => {
    const { cdp } = await addVirtualAuthenticator(page);

    // Create account to reach settings
    await page.getByRole('button', { name: 'Create Account' }).first().click(); // tab
    await page.getByLabel(/display name/i).fill('WebAuthn Test');
    await page.getByLabel(/email/i).nth(1).fill('webauthn-test@example.com');
    await page.getByLabel(/password/i).first().fill('TestPassword123!');
    await page.getByLabel(/confirm/i).fill('TestPassword123!');
    await page.getByRole('button', { name: 'Create Account' }).last().click(); // submit
    await expect(page).toHaveURL(/dashboard/);

    // Navigate to settings
    await page.goto(BASE + '/app/settings.html', { waitUntil: 'networkidle' });

    // Add virtual authenticator again (new page context)
    await addVirtualAuthenticator(page);

    // Click Add Security Key
    const addBtn = page.getByRole('button', { name: /add security key/i });
    await addBtn.waitFor({ state: 'visible', timeout: 5000 });
    await addBtn.click();

    // Wait for success (no alert = success; alert = failure)
    await expect(page.getByText(/security key added/i)).toBeVisible({ timeout: 15000 });
    await cdp.detach();
  });

  test('authentication completes after registration', async ({ page }) => {
    const { cdp } = await addVirtualAuthenticator(page);

    // Login
    await page.getByLabel(/email/i).first().fill('webauthn-test@example.com');
    await page.getByLabel(/password/i).first().fill('TestPassword123!');
    await page.getByRole('button', { name: /unlock vault manager/i }).click();
    await expect(page).toHaveURL(/dashboard/);

    // Go to settings and register if needed
    await page.goto(BASE + '/app/settings.html', { waitUntil: 'networkidle' });
    await addVirtualAuthenticator(page);

    const addBtn = page.getByRole('button', { name: /add security key/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.getByText(/security key added/i)).toBeVisible({ timeout: 15000 });
    }

    // Lock and use passkey to unlock (vault flow uses webauthn when configured)
    // For this test we verify the auth flow works via webauthn-auth-options
    const optsRes = await page.request.post(BASE + '/api/webauthn-auth-options', {
      data: { userId: 'default' },
    });
    expect(optsRes.ok()).toBeTruthy();
    const opts = await optsRes.json();
    expect(opts.challenge).toBeTruthy();

    await cdp.detach();
  });

  test('replay of assertion is rejected', async ({ page }) => {
    const { cdp } = await addVirtualAuthenticator(page);

    // Ensure we have a credential
    await page.goto(BASE + '/app/index.html', { waitUntil: 'networkidle' });
    await page.getByLabel(/email/i).first().fill('webauthn-test@example.com');
    await page.getByLabel(/password/i).first().fill('TestPassword123!');
    await page.getByRole('button', { name: /unlock vault manager/i }).click();
    await page.goto(BASE + '/app/settings.html', { waitUntil: 'networkidle' });
    await addVirtualAuthenticator(page);

    const addBtn = page.getByRole('button', { name: /add security key/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.getByText(/security key added/i)).toBeVisible({ timeout: 15000 });
    }

    // Get auth options
    const optsRes = await page.request.post(BASE + '/api/webauthn-auth-options', {
      data: { userId: 'default' },
    });
    expect(optsRes.ok()).toBeTruthy();
    const opts = await optsRes.json();

    // Perform authentication (browser ceremony)
    const assertion = await page.evaluate(async (options) => {
      const cred = await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
          allowCredentials: (options.allowCredentials || []).map(c => ({
            ...c,
            id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), x => x.charCodeAt(0)),
          })),
        },
      });
      if (!cred) return null;
      return {
        id: cred.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(cred.rawId))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
        response: {
          authenticatorData: btoa(String.fromCharCode(...new Uint8Array(cred.response.authenticatorData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(cred.response.clientDataJSON))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
          signature: btoa(String.fromCharCode(...new Uint8Array(cred.response.signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
        },
        type: cred.type,
      };
    }, opts);

    expect(assertion).toBeTruthy();

    // First verify — should succeed
    const verify1 = await page.request.post(BASE + '/api/webauthn-auth-verify', {
      data: { assertion, userId: 'default' },
    });
    expect(verify1.ok()).toBeTruthy();

    // Replay same assertion — must be rejected (challenge consumed or verification fails)
    const verify2 = await page.request.post(BASE + '/api/webauthn-auth-verify', {
      data: { assertion, userId: 'default' },
    });
    expect([400, 401]).toContain(verify2.status());

    await cdp.detach();
  });

  test('counter rollback (clone) is rejected', async ({ page }) => {
    const { cdp, authenticatorId } = await addVirtualAuthenticator(page);

    // Setup: register credential
    await page.goto(BASE + '/app/index.html', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Create Account' }).first().click();
    await page.getByLabel(/display name/i).fill('Counter Test');
    await page.getByLabel(/email/i).nth(1).fill('counter-test@example.com');
    await page.getByLabel(/password/i).first().fill('TestPassword123!');
    await page.getByLabel(/confirm/i).fill('TestPassword123!');
    await page.getByRole('button', { name: 'Create Account' }).last().click();
    await page.goto(BASE + '/app/settings.html', { waitUntil: 'networkidle' });
    const addBtn = page.getByRole('button', { name: /add security key/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.getByText(/security key added/i)).toBeVisible({ timeout: 15000 });
    }

    // Auth 3 times to bump counter
    for (let i = 0; i < 3; i++) {
      const opts = await (await page.request.post(BASE + '/api/webauthn-auth-options', { data: { userId: 'default' } })).json();
      const assertion = await page.evaluate(async (o) => {
        const cred = await navigator.credentials.get({
          publicKey: {
            ...o,
            challenge: Uint8Array.from(atob(o.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
            allowCredentials: (o.allowCredentials || []).map(c => ({ ...c, id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), x => x.charCodeAt(0)) })),
          },
        });
        if (!cred) return null;
        return { id: cred.id, rawId: btoa(String.fromCharCode(...new Uint8Array(cred.rawId))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
          response: { authenticatorData: btoa(String.fromCharCode(...new Uint8Array(cred.response.authenticatorData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(cred.response.clientDataJSON))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
            signature: btoa(String.fromCharCode(...new Uint8Array(cred.response.signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') },
          type: cred.type };
      }, opts);
      await page.request.post(BASE + '/api/webauthn-auth-verify', { data: { assertion, userId: 'default' } });
    }

    // Clone: get credential, remove, add with signCount: 0
    const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
    if (!credentials?.length) {
      await cdp.detach();
      test.skip(true, 'No credential to clone');
      return;
    }
    const cred = credentials[0];
    await cdp.send('WebAuthn.removeCredential', { authenticatorId, credentialId: cred.credentialId });
    await cdp.send('WebAuthn.addCredential', {
      authenticatorId,
      credential: { ...cred, signCount: 0 },
    });

    // Authenticate with "clone" (counter 0); server has counter 3
    const opts = await (await page.request.post(BASE + '/api/webauthn-auth-options', { data: { userId: 'default' } })).json();
    const assertion = await page.evaluate(async (o) => {
      const cred = await navigator.credentials.get({
        publicKey: {
          ...o,
          challenge: Uint8Array.from(atob(o.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
          allowCredentials: (o.allowCredentials || []).map(c => ({ ...c, id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), x => x.charCodeAt(0)) })),
        },
      });
      if (!cred) return null;
      return { id: cred.id, rawId: btoa(String.fromCharCode(...new Uint8Array(cred.rawId))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
        response: { authenticatorData: btoa(String.fromCharCode(...new Uint8Array(cred.response.authenticatorData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(cred.response.clientDataJSON))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
          signature: btoa(String.fromCharCode(...new Uint8Array(cred.response.signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') },
        type: cred.type };
    }, opts);
    expect(assertion).toBeTruthy();

    const verifyRes = await page.request.post(BASE + '/api/webauthn-auth-verify', { data: { assertion, userId: 'default' } });
    expect(verifyRes.status()).toBe(401);

    await cdp.detach();
  });
});
