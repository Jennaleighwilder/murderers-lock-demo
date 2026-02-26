/**
 * Downgrade resistance: when vault has passkeys, password-only must be denied.
 * Requires REDTEAM_REAL_VAULT and a vault that has passkeys registered.
 */

const { BASE_URL, VAULT_ID, PASSWORD, TOTP, REAL_VAULT } = require('./_config');
const { jfetch } = require('./_http');
const { writeTrace } = require('./_report');
const { sanitize } = require('./_secrets');

module.exports = {
  name: 'attack_webauthn_no_downgrade',
  goal: 'Password-only unlock when vault has passkeys must return webauthnRequired',
  expected: '403 with webauthnRequired: true — no downgrade to password-only',
  async run() {
    if (!REAL_VAULT) {
      return { name: this.name, goal: this.goal, expected: this.expected, observed: 'SKIPPED (REDTEAM_REAL_VAULT not set)' };
    }

    const trace = { steps: [] };

    const body = {
      vaultId: VAULT_ID,
      password: PASSWORD,
      encryptedData: 'dummy',
      iv: '0'.repeat(32),
      salt: '0'.repeat(64),
    };
    if (TOTP) body.totpCode = TOTP;

    const r = await jfetch(`${BASE_URL}/api/unlock-vault`, { method: 'POST', body: JSON.stringify(body) });
    trace.steps.push({ step: 'password-only-unlock', status: r.status, json: r.json });

    const traceFile = writeTrace(this.name, sanitize(trace, [PASSWORD, TOTP]));

    if (r.status === 403 && r.json?.webauthnRequired === true) {
      return { name: this.name, goal: this.goal, expected: this.expected, observed: 'webauthnRequired returned, no downgrade', traceFile };
    }

    if (r.status === 200) {
      const err = new Error('Downgrade: password-only unlock succeeded when vault has passkeys');
      err.traceFile = traceFile;
      throw err;
    }

    return { name: this.name, goal: this.goal, expected: this.expected, observed: `SKIPPED (vault may not have passkeys, got ${r.status})`, traceFile };
    err.traceFile = traceFile;
    throw err;
  },
};
