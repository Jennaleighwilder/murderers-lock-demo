const { BASE_URL, VAULT_ID, PASSWORD, TOTP } = require('./_config');
const { jfetch } = require('./_http');
const { writeTrace } = require('./_report');
const { sanitize } = require('./_secrets');

module.exports = {
  name: 'attack_kdf_type_mismatch',
  goal: 'Force wrong KDF inputs (timestamp present/absent) against stored kdf_type',
  expected: 'Server rejects mismatch explicitly (400/403)',
  async run() {
    const expected = (process.env.REDTEAM_KDF_TYPE_EXPECTED || '').trim();
    if (!expected) return { name: this.name, goal: this.goal, expected: this.expected, observed: 'SKIPPED (no REDTEAM_KDF_TYPE_EXPECTED)' };

    const trace = { expected, steps: [] };

    const body = { vaultId: VAULT_ID, password: PASSWORD };
    if (TOTP) body.totpCode = TOTP;

    if (expected === 'argon2id') body.timestamp = '1730000000000.deadbeef';
    if (expected === '33gate') delete body.timestamp;

    const r = await jfetch(`${BASE_URL}/api/unlock-vault`, { method: 'POST', body: JSON.stringify(body) });
    trace.steps.push({ step: 'unlock-mismatch', status: r.status, json: r.json });

    const traceFile = writeTrace(this.name, sanitize(trace, [PASSWORD, TOTP]));

    if (![400, 403].includes(r.status)) {
      const err = new Error(`Expected 400/403 for KDF mismatch, got ${r.status}`);
      err.traceFile = traceFile; throw err;
    }

    return { name: this.name, goal: this.goal, expected: this.expected, observed: `Rejected with ${r.status}`, traceFile };
  }
};
