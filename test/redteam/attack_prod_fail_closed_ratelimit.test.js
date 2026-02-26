const { BASE_URL, VAULT_ID } = require('./_config');
const { jfetch } = require('./_http');
const { writeTrace } = require('./_report');

module.exports = {
  name: 'attack_prod_fail_closed_ratelimit',
  goal: 'Verify rate limiting fails closed in production when backing store is unavailable',
  expected: 'Unlock denied (fail closed) if Supabase rate limit store is unavailable in production',
  async run() {
    const enabled = (process.env.REDTEAM_TEST_FAIL_CLOSED || '').toLowerCase() === 'true';
    if (!enabled) return { name: this.name, goal: this.goal, expected: this.expected, observed: 'SKIPPED (set REDTEAM_TEST_FAIL_CLOSED=true)' };

    const trace = { steps: [] };
    const r = await jfetch(`${BASE_URL}/api/unlock-vault`, {
      method: 'POST',
      body: JSON.stringify({ vaultId: VAULT_ID, password: 'wrong-password' }),
    });
    trace.steps.push({ step: 'unlock', status: r.status, json: r.json });

    const traceFile = writeTrace(this.name, trace);

    if (![401, 403].includes(r.status)) {
      const err = new Error(`Expected deny (401/403) under fail-closed, got ${r.status}`);
      err.traceFile = traceFile; throw err;
    }

    return { name: this.name, goal: this.goal, expected: this.expected, observed: `Denied with ${r.status}`, traceFile };
  }
};
