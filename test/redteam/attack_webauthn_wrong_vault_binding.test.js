const { BASE_URL, VAULT_ID, PASSWORD, TOTP, SUPABASE_ON } = require('./_config');
const { jfetch } = require('./_http');
const { writeTrace } = require('./_report');
const { sanitize } = require('./_secrets');

module.exports = {
  name: 'attack_webauthn_wrong_vault_binding',
  goal: 'Use a valid WebAuthn session token against a different vaultId',
  expected: 'Server must reject (token bound to vaultId)',
  async run() {
    if (!SUPABASE_ON) return { name: this.name, goal: this.goal, expected: this.expected, observed: 'SKIPPED (SUPABASE_OFF)' };

    const token = (process.env.REDTEAM_WEBAUTHN_TOKEN || '').trim();
    const otherVault = (process.env.REDTEAM_OTHER_VAULT_ID || '').trim();
    if (!token) return { name: this.name, goal: this.goal, expected: this.expected, observed: 'SKIPPED (REDTEAM_WEBAUTHN_TOKEN not set)' };
    if (!otherVault) return { name: this.name, goal: this.goal, expected: this.expected, observed: 'SKIPPED (REDTEAM_OTHER_VAULT_ID not set)' };

    const body = { vaultId: otherVault, password: PASSWORD, webauthnSessionToken: token };
    if (TOTP) body.totpCode = TOTP;

    const trace = { steps: [] };
    const r = await jfetch(`${BASE_URL}/api/unlock-vault`, { method: 'POST', body: JSON.stringify(body) });
    trace.steps.push({ step: 'unlock-wrong-vault', status: r.status, json: r.json });

    const traceFile = writeTrace(this.name, sanitize(trace, [PASSWORD, TOTP, token]));

    if (r.status !== 403) {
      const err = new Error(`Expected 403, got ${r.status}`);
      err.traceFile = traceFile; throw err;
    }
    return { name: this.name, goal: this.goal, expected: this.expected, observed: `Denied with ${r.status}`, traceFile };
  }
};
