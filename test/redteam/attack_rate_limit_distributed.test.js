const { BASE_URL, VAULT_ID, SUPABASE_ON, REAL_VAULT } = require('./_config');
const { jfetch } = require('./_http');
const { writeTrace } = require('./_report');

module.exports = {
  name: 'attack_rate_limit_distributed',
  goal: 'Simulate many incorrect unlock attempts to trigger per-IP and global limits',
  expected: 'Server rate-limits with 429 (or equivalent) before allowing brute-force',
  async run() {
    if (!SUPABASE_ON) return { name: this.name, goal: this.goal, expected: this.expected, observed: 'SKIPPED (SUPABASE_OFF)' };
    if (!REAL_VAULT) return { name: this.name, goal: this.goal, expected: this.expected, observed: 'SKIPPED (REDTEAM_REAL_VAULT not set)' };

    const attempts = Number(process.env.REDTEAM_RATE_ATTEMPTS || 60);
    const trace = { attempts, results: [] };

    // Use single IP to trigger per-IP limit (50 per hour default)
    const headers = { 'x-forwarded-for': '203.0.113.1' };
    let sawLimited = false;

    for (let i = 0; i < attempts; i++) {
      const body = { vaultId: VAULT_ID, password: `wrong-${i}` };
      const r = await jfetch(`${BASE_URL}/api/unlock-vault`, { method: 'POST', body: JSON.stringify(body), headers });
      trace.results.push({ i, status: r.status, err: r.json?.error || r.json?.message });

      if (r.status === 429) sawLimited = true;

      if (sawLimited && i > 5) break;
    }

    const traceFile = writeTrace(this.name, trace);

    if (!sawLimited) {
      const err = new Error('Did not observe 429 rate limiting; check RATE_LIMIT_PER_IP / RATE_LIMIT_GLOBAL and status codes');
      err.traceFile = traceFile; throw err;
    }

    return { name: this.name, goal: this.goal, expected: this.expected, observed: 'Observed 429 rate limiting', traceFile };
  }
};
