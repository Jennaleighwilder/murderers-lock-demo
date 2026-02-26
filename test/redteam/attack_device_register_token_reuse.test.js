const { BASE_URL, VAULT_ID, PASSWORD, TOTP, SUPABASE_ON, REAL_VAULT } = require('./_config');
const { jfetch } = require('./_http');
const { writeTrace } = require('./_report');
const { sanitize } = require('./_secrets');

module.exports = {
  name: 'attack_device_register_token_reuse',
  goal: 'Reuse deviceRegistrationToken (single-use) to register twice',
  expected: 'Second registration attempt must be denied',
  async run() {
    if (!SUPABASE_ON) return { name: this.name, goal: this.goal, expected: this.expected, observed: 'SKIPPED (SUPABASE_OFF)' };
    if (!REAL_VAULT) return { name: this.name, goal: this.goal, expected: this.expected, observed: 'SKIPPED (REDTEAM_REAL_VAULT not set)' };

    const maybeWebauthn = (process.env.REDTEAM_WEBAUTHN_TOKEN || '').trim();

    const unlockBody = { vaultId: VAULT_ID, password: PASSWORD };
    if (TOTP) unlockBody.totpCode = TOTP;
    if (maybeWebauthn) unlockBody.webauthnSessionToken = maybeWebauthn;

    const trace = { steps: [] };

    const u = await jfetch(`${BASE_URL}/api/unlock-vault`, { method: 'POST', body: JSON.stringify(unlockBody) });
    trace.steps.push({ step: 'unlock-for-reg-token', status: u.status, json: u.json });

    const token = u.json?.deviceRegistrationToken;
    if (!token) {
      const traceFile = writeTrace(this.name, sanitize(trace, [PASSWORD, TOTP, maybeWebauthn]));
      const err = new Error(`No deviceRegistrationToken returned (status=${u.status}). Use a vault/config that issues it.`);
      err.traceFile = traceFile; throw err;
    }

    const regBody = {
      vaultId: VAULT_ID,
      deviceRegistrationToken: token,
      devicePublicKey: 'TEST_KEY_1',
    };

    const r1 = await jfetch(`${BASE_URL}/api/device-register`, { method: 'POST', body: JSON.stringify(regBody) });
    trace.steps.push({ step: 'device-register-1', status: r1.status, json: r1.json });

    const r2 = await jfetch(`${BASE_URL}/api/device-register`, { method: 'POST', body: JSON.stringify(regBody) });
    trace.steps.push({ step: 'device-register-2-reuse', status: r2.status, json: r2.json });

    const traceFile = writeTrace(this.name, sanitize(trace, [PASSWORD, TOTP, token, maybeWebauthn]));

    if (![200, 201].includes(r1.status)) {
      const err = new Error(`Expected first register 200/201, got ${r1.status}`);
      err.traceFile = traceFile; throw err;
    }
    if (![401, 403].includes(r2.status)) {
      const err = new Error(`Expected reuse denied 401/403, got ${r2.status}`);
      err.traceFile = traceFile; throw err;
    }

    return { name: this.name, goal: this.goal, expected: this.expected, observed: `First ok, reuse denied (${r2.status})`, traceFile };
  }
};
