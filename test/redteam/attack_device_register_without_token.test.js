const { BASE_URL, VAULT_ID } = require('./_config');
const { jfetch } = require('./_http');
const { writeTrace } = require('./_report');

module.exports = {
  name: 'attack_device_register_without_token',
  goal: 'Register a device key without providing deviceRegistrationToken',
  expected: 'Server must deny registration',
  async run() {
    const trace = { steps: [] };

    const body = {
      vaultId: VAULT_ID,
      devicePublicKey: 'INVALID_TEST_KEY',
    };

    const r = await jfetch(`${BASE_URL}/api/device-register`, { method: 'POST', body: JSON.stringify(body) });
    trace.steps.push({ step: 'device-register-no-token', status: r.status, json: r.json });

    const traceFile = writeTrace(this.name, trace);

    if (![401, 403, 503].includes(r.status)) {
      const err = new Error(`Expected 401/403, got ${r.status}`);
      err.traceFile = traceFile; throw err;
    }

    return { name: this.name, goal: this.goal, expected: this.expected, observed: `Denied with ${r.status}`, traceFile };
  }
};
