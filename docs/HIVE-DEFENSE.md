# Hive Defense — Biologically-Inspired Security

The Murderer's Lock uses a hive model: 33 gates as sensory nodes, 3 drones in reserve, three sensor lines as tripwires.

## Architecture

| Component | Role |
|-----------|------|
| **33 Gates** | Worker bees. Each evaluates threat from request signature. |
| **3 Drones** | Hidden reserves. Activated only when hive absconds. |
| **Sensor Lines** | Tripwires. Perimeter → Warning → Lethal. |

## Sensor Lines

| Line | Threshold | Response |
|------|-----------|----------|
| **Perimeter** | 0.1 | Log, slight delay |
| **Warning** | 0.5 | Swarm: escalate lockjaw, full lockdown |
| **Lethal** | 0.9 | Abscond: scatter, time-lock 30 days, DMS |

## Threat Signature

Each request is scored from:
- `murderCount` (failed attempts)
- `timingEntropy` (request cadence)
- `parallelRequests` (concurrent attempts)
- Per-gate bias (deterministic from gate ID)

Consensus: max across 33 gates. Any gate alarmed = hive alarmed.

## The Bloodhound / The Carrier (Harm Barriers)

When we return **poisoned** data (panic code used), we deploy the harm barriers:

- **The Bloodhound** embeds a forensic scent: `<!--blot:scent_abc123...-->`
- **The Carrier** registers the payload for spread tracking

If the attacker reuses that data (e.g. encrypt-vault to save it), we detect the scent and log `bloodhound_detected` in the audit log. The chain is tracked. See `docs/HARM-BARRIERS.md`.

## Defensive Only

The hive does not attack. Swarm = harden (lockjaw, escalate). Abscond = hide (scatter, time-lock). No DDOS, no hacking back.
