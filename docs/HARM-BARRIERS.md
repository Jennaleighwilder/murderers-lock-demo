# The Three Harm Barriers

**Purpose:** Protect real people from real damage. Not theater — victim protection.

| Barrier | Function | Harm Prevention |
|---------|----------|-----------------|
| **The Witness** | Forces attacker to process actively, reveals their methods | Creates evidence for victim protection |
| **The Bloodhound** | Forensic trace that survives all transformation | Tracks stolen data to alert victims |
| **The Carrier** | Data that spreads tracing through criminal networks | Maps entire harm infrastructure |

---

## The Witness

The 33 gates require active engagement. Automated consumption fails. Every choice reveals cognition. Every hesitation reveals sophistication.

- **Implementation:** `lib/the-witness.js` + `lib/hive-mind.js`
- **Evidence:** Testimony (interaction patterns, sophistication, infrastructure hints)
- **Harm connection:** Delay and exposure. During that time, The Bloodhound activates.

## The Bloodhound

Once data is witnessed and taken, the Bloodhound follows it everywhere. Invisible, unshakeable, always reporting back.

- **Implementation:** `lib/the-bloodhound.js`
- **Scent layers:** Structural (comment marker), typographic (zero-width)
- **Harm connection:** Every detection → audit log → victim can be alerted
- **Action:** `bloodhound_detected` in audit_log

## The Carrier

Stolen data that carries its own tracing. When attackers share, trade, or process it, they spread the scent without knowing.

- **Implementation:** `lib/the-carrier.js`
- **Spread tracking:** Each detection location logged, generations mapped
- **Canary trap:** Per-recipient variation (`<!--canary:hash-->`). Same data, different canary per origin. If we see canary A at marketplace X and canary B at forum Y, we know resale occurred.
- **Harm connection:** Reveals buyers, resellers, tools — the machine that profits from harm

---

## Victim Experience (Target State)

```
═══════════════════════════════════════════════════════
  HARM BARRIERS ACTIVATED — YOUR PROTECTION STATUS
═══════════════════════════════════════════════════════

BREACH DETECTED: [timestamp]
Vault: [vaultId]
Incident: [packId]

┌─────────────────────────────────────────────────────┐
│  THE WITNESS  —  Evidence Gathered                  │
│  └── Attacker sophistication: [level]              │
│  └── Testimony logged: [patterns]                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  THE BLOODHOUND  —  Active Tracking                 │
│  └── Detections: [count] locations found            │
│  └── ALERTS: [status]                               │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  THE CARRIER  —  Network Mapping                    │
│  └── Spread generations: [n]                        │
│  └── Locations: [list]                              │
└─────────────────────────────────────────────────────┘

YOUR ACTIONS:
[Change Passwords]  [Credit Freeze]  [Police Report]

═══════════════════════════════════════════════════════
  The barriers remember. The barriers follow.
  The barriers protect.
═══════════════════════════════════════════════════════
```

---

## Victim Kill Switch

**POST /api/victim-kill-switch** — Emergency stop. Body: `{ victimId, incidentId }`

When victim triggers: All scented data invalidated. Carrier strains deactivated. Audit log records `kill_switch_activated`. Victim acknowledges data is fully compromised; system stops tracking, starts containing.

---

## Honest Limitations

| Claim | Reality |
|-------|---------|
| "Scent survives all transformation" | Survives: base64, URL encoding, JSON, trim. Fails: manual retyping, image OCR, audio dictation. |
| "Maps entire harm network" | Maps digital infrastructure (endpoints, tools). Misses: in-person handoffs, air-gapped systems. |
| "Protects victims" | Alerts and evidence. Cannot: undo identity theft, recover funds, arrest criminals. |

**The barriers are force multipliers for victim defense, not magic shields.**

### Scent Survival (Tested)

- ✓ Base64 encode/decode
- ✓ JSON stringify/parse
- ✓ Trim, whitespace
- ✗ Manual retyping (scent lost)
- ✗ CyberChef "Remove comments" (scent stripped)
- ✗ Forum paste that strips HTML comments

**CyberChef note:** To verify scent stripping, use [CyberChef](https://gchq.github.io/CyberChef/) with recipe `Remove HTML comments`. The structural scent (`<!--blot:scent_xxx-->`) and canary (`<!--canary:hash-->`) are HTML comments; this recipe removes them. Use this to test that your detection logic correctly handles both scented and stripped payloads.

---

## The Poetry of Harm Prevention

> They came to take.
> We could not stop the taking.
> But we made them **witness** what they stole,
> forced them to **see** and **choose** and **reveal**.
>
> The **Bloodhound** follows what they carry,
> not to punish, but to **warn** —
> every victim alerted before the wound,
> every harm mapped while it spreads.
>
> The **Carrier** rides with their trade,
> mapping the machine that profits from pain,
> the buyers, the tools, the whole architecture of harm.
>
> Three barriers.
> One purpose:
> **Protect the wounded.**
> **Illuminate the shadow.**
> **Stop the spread.**
