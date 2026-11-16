# Wave 0 report — Decisions recorded

| Field | Value |
|-------|--------|
| **Branch** | `feat/prod-source-truth` |
| **Base tip when opened** | `efc2c0e` (`docs: add production wave roadmap from audit`) |
| **Date** | 2026-11-11 |
| **Code changes** | None (docs only) |
| **Decision register** | [`../decisions/WAVE-0-DECISIONS.md`](../decisions/WAVE-0-DECISIONS.md) |
| **Wave 1 blockers** | **SIGNED** (G-1, W1-MID A, W1-VIEW B) — 2026-11-11 |

## Goal

Record Wave 0 launch decisions without inventing business answers. Unblock Wave 1 only after owner sign-off on G-1 and Wave 1 policy rows.

## What we did

1. Created the decision register with every Wave 0 row from `PRODUCTION_PLAN.md`:
   - G-1 (prod source)
   - Freshness SLA
   - Network lock until auth
   - Snapshot PII path (hash vs waiver)
   - Alert channel, registry, deploy host, RPO/RTO
2. Added Wave 1 policy rows (**W1-MID**, **W1-VIEW**) so mid-month and VIEW+tiers behaviour are not invented in code.
3. Linked this track from the audit README.
4. Left all statuses as **`PENDING`** — audit recommendations are listed, not treated as signed policy.

## What changed (files)

| Path | Change |
|------|--------|
| `docs/production-audit/decisions/WAVE-0-DECISIONS.md` | **Added** — runbook / decision register |
| `docs/production-audit/wave-reports/WAVE-0-decisions.md` | **Added** — this report |
| `docs/production-audit/README.md` | **Updated** — links to `decisions/` and `wave-reports/` |

## Verification

- No application code touched.
- No tests required for Wave 0.
- Register status: **OPEN** until owner flips rows to `SIGNED` / `WAIVED`.

## Done-when checklist (plan)

| Criterion | Result |
|-----------|--------|
| Decisions written in runbook | **Yes** — register exists |
| Open decisions closed | **Partial** — G-1 + W1-* signed; ops placeholders still `PENDING` |

## Out of scope (preserved)

- Wave 1+ implementation (`resolve_process_source`, VIEW guard, mid-month, tests) — started after sign-off
- Wave 2+ (snapshot integrity, `/ready`, auth, CI tags, etc.)

## Follow-ups

Ops placeholders (FRESH, NET, PII, ALERT, REG, HOST, DR) remain `PENDING` for later waves; they do not block Wave 1.
