/**
 * Unit test: lib/device-keys.js
 */

const crypto = require('crypto');
const { verifyDeviceSignature, validateChallenge, buildChallenge } = require('../../lib/device-keys.js');

function ok(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

async function main() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256'
  });
  const pubKeyDer = publicKey.export({ type: 'spki', format: 'der' });
  const pubKeyB64 = pubKeyDer.toString('base64');

  const challenge = 'v_default:1730000000';
  const sig = crypto.sign('sha256', Buffer.from(challenge, 'utf8'), privateKey);
  const sigB64 = sig.toString('base64');

  ok(verifyDeviceSignature(pubKeyB64, challenge, sigB64), 'valid signature verifies');
  ok(!verifyDeviceSignature(pubKeyB64, challenge + 'x', sigB64), 'tampered challenge fails');
  ok(!verifyDeviceSignature(pubKeyB64, challenge, 'invalid'), 'invalid signature fails');

  const nowSec = Math.floor(Date.now() / 1000);
  ok(validateChallenge(`v1:${nowSec}`, 'v1'), 'valid challenge');
  ok(!validateChallenge(`v1:${nowSec}`, 'v2'), 'wrong vaultId fails');
  ok(!validateChallenge('invalid', 'v1'), 'malformed challenge fails');

  const built = buildChallenge('v_test');
  ok(built.startsWith('v_test:'), 'buildChallenge format');

  console.log('Device keys: 4 passed, 0 failed');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
