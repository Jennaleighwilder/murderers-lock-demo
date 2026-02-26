const { BASE_URL, VAULT_ID, PASSWORD, TOTP, SUPABASE_ON } = require('./_config');
const { jfetch } = require('./_http');
const { writeTrace } = require('./_report');
const { sanitize } = require('./_secrets');

module.exports = {
  name: 'attack_webauthn_token_reuse',
  goal: 'Reuse a webauthnSessionToken to unlock twice',
  expected: 'Second use must be denied (token single-use)',
  async run() {
    if (!SUPABASE_ON) return { name: this.name, goal: this.goal, expected: this.expected, observed: 'SKIPPED (SUPABASE_OFF)' };

    const token = (process.env.REDTEAM_WEBAUTHN_TOKEN || '').trim();
    if (!token) return { name: this.name, goal: this.goal, expected: this.expected, observed: 'SKIPPED (REDTEAM_WEBAUTHN_TOKEN not set)' };

    const body = {
      vaultId: VAULT_ID,
      password: PASSWORD,
      webauthnSessionToken: token,
    };
    if (TOTP) body.totpCode = TOTP;

    const trace = { steps: [] };

    const r1 = await jfetch(`${BASE_URL}/api/unlock-vault`, { method: 'POST', body: JSON.stringify(body) });
    trace.steps.push({ step: 'unlock-1', status: r1.status, json: r1.json });

    const r2 = await jfetch(`${BASE_URL}/api/unlock-vault`, { method: 'POST', body: JSON.stringify(body) });
    trace.steps.push({ step: 'unlock-2-reuse', status: r2.status, json: r2.json });

    const traceFile = writeTrace(this.name, sanitize(trace, [PASSWORD, TOTP, token]));

    if (r1.status !== 200) {
      const err = new Error(`Expected first unlock 200, got ${r1.status}`);
      err.traceFile = traceFile; throw err;
    }
    if (r2.status !== 403) {
      const err = new Error(`Expected reuse to be 403, got ${r2.status}`);
      err.traceFile = traceFile; throw err;
    }

    return { name: this.name, goal: this.goal, expected: this.expected, observed: `First 200, second ${r2.status}`, traceFile };
  }
};
