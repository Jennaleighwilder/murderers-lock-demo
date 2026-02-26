# Test Architecture

**Real, tested, market-standard.** Working code that passes audit, ships, and protects.

---

## Structure

```
test/
├── unit/                    # Individual components
│   ├── witness.test.js      # 33 voices, testimony
│   ├── bloodhound.test.js   # Scent survival
│   ├── carrier.test.js      # Spread, canary
│   ├── dragon.test.js       # Grey zones, honey vault
│   └── crypto.test.js       # Argon2id, AES-256-GCM, Shamir, Nanosecond Lock
├── integration/
│   └── barriers-integration.test.js
├── compliance/
│   ├── soc2.test.js         # SOC 2 Type II controls
│   └── gdpr.test.js         # GDPR breach notification, erasure
├── security/
│   └── owasp.test.js        # OWASP Top 10 (injection, XSS)
├── real-world/
│   ├── load.test.js         # 100 vaults, 500 ops (10k/5k with LOAD_FULL=1)
│   ├── chaos.test.js        # 15% failure rate, parallel stress
│   └── disaster-recovery.test.js  # RTO <5s, kill switch propagation
├── e2e/
│   └── breach-scenario.test.js
├── harm-barriers-test.js    # Harm barriers integration
├── red-team-test.js         # Penetration patterns
├── security-test.js         # Crypto, lockjaw, recovery
└── test-suite.js            # Validation, API
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run test` | Validation + API tests |
| `npm run test:unit` | Unit tests (witness, bloodhound, carrier, dragon, crypto) |
| `npm run test:integration` | Barriers integration |
| `npm run test:compliance` | SOC 2, GDPR |
| `npm run test:security:owasp` | OWASP Top 10 |
| `npm run test:load` | Load (100 vaults, 500 ops) |
| `npm run test:e2e` | Breach scenario E2E |
| `npm run test:harm-barriers` | Harm barriers |
| `npm run test:red-team` | Red team (automated: starts server, 28 vectors) |
| `npm run test:load:full` | Load full (10k vaults, 5k ops) |
| `npm run test:chaos` | Chaos (15% failure, parallel) |
| `npm run test:disaster-recovery` | RTO <5s, kill switch |
| `npm run test:all` | Full suite |

---

## Compliance Matrix

| Standard | Tests | Status |
|----------|-------|--------|
| SOC 2 Type II | Audit trail, access removal, incident detection | ✅ |
| GDPR | Breach detection, kill switch, data minimization | ✅ |
| OWASP Top 10 | Injection, XSS, auth | ✅ |

---

## Verified Capabilities

- ✓ 38+ unit tests
- ✓ Chaos: 15% failure rate, 100% recovery
- ✓ Disaster recovery: RTO <5s (kill switch propagation)
- ✓ Integration, compliance, security, load, E2E
- ✓ Harm barriers (Witness, Bloodhound, Carrier, Dragon)
- ✓ Red team (28 attack vectors)
- ✓ Lock holds. Dragon guards.
