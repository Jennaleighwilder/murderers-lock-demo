# The Dragon — Grey Zones

**Principle:** Maximum aggression within legal bounds. We protect the client. We do not hack. We do not destroy.

---

## Phase 1 (Implemented)

| Mechanism | Status | Legal Basis |
|-----------|--------|-------------|
| **Honey vault** | ✅ Implemented | Deceptive defense, no real value taken. Misrepresentation, not theft. |
| **Fire credentials** | ✅ Alert-only | Defensive. Credentials that trigger service alerts when used. No lockout, no DoS. |
| **Passive pursuit** | ✅ Incentives only | Economic incentive design. We embed incentives; criminals choose to follow. |
| **Guard hoard** | ✅ State only | Registers vault for protection. No active action. |

---

## Phase 2 (Deferred — Client + Legal Sign-off Required)

| Mechanism | Status | Risk |
|-----------|--------|------|
| **Scorched earth** | ⏸ Deferred | Flooding channels with fake data could be DoS. Volume and targets need legal review. |
| **Persona infiltration** | ⏸ Deferred | Buying stolen data = possession. Social engineering = wire fraud risk. |

---

## Phase 3 (Do Not Implement)

| Mechanism | Status | Reason |
|-----------|--------|--------|
| **Data that crashes tools** | ❌ Not implemented | Sabotage, CFAA risk. |
| **Credentials that trigger lockout** | ❌ Not implemented | Could be abuse of third-party systems. |

---

## API

```javascript
const dragon = require('./lib/the-dragon.js');

// Guard a vault
dragon.guardHoard(victimId, vaultId, context);

// Honey vault for duress path
const honey = dragon.openHoneyVault({ incidentId, origin });

// Passive pursuit (embed in carrier)
const enhanced = dragon.embedPursuitIncentives(payload, incidentId);

// Record threat when canary sings
dragon.recordThreat(incidentId, canarySong, coalMine);
```

---

## The Dragon's Oath

> We do not ask the wolf why he hunts.
> We do not negotiate with the thief.
> We protect so aggressively that attack becomes economically irrational.
>
> Fire is friction. The client is safe. The hoard is guarded.
