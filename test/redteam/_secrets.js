// Ensure artifacts never accidentally contain secrets
function sanitize(obj, secrets) {
  const s = JSON.stringify(obj);
  let out = s;
  for (const sec of secrets.filter(Boolean)) {
    out = out.split(sec).join('[REDACTED]');
  }
  return JSON.parse(out);
}

module.exports = { sanitize };
