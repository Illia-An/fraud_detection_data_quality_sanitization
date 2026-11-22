# SPEC-M006 — Historical store allocation + linear fallback

| Field | Value |
|-------|-------|
| Status | TODO |
| Depends on | M005 |
| Meeting items | 7, 8, 9 |
| Report | `reports/REPORT-M006-historical-allocation.md` |

## Goal

Distribute the annual / monthly network target across restaurants using each
store’s **historical dynamics**, keep **linear** as an alternative, and define
fallback when history is thin. Reduce unexplained monthly chart jumps where
caused by naive equal-weight allocation.

## Locked decisions

| ID | Decision |
|----|----------|
| D-M006-1 | Modes: `historical` (default when enough history) and `linear` (explicit user alternative + auto-fallback). |
| D-M006-2 | Thin history: reuse / extend `insufficient_history` + `min_history_cap` rules; those stores use linear/equal-weight fallback. |
| D-M006-3 | Network monthly path may stay linear-cum (M002); historical dynamics primarily affect **chain→store** (and optionally seasonal month weights — choose one in implementation and lock in REPORT). |
| D-M006-4 | Audit synthetic fixtures for MoM jumps; fix only jumps caused by allocator (document residual formula jumps). |

## In scope

- Allocator mode flag + FE toggle (Advanced ok).
- Backend/FE allocate path for historical weights.
- Unit tests for thin-history fallback and jump regression fixtures.

## Out of scope

- Volume-weighted network mean.
- Point-drag editing.

## Steps

1. Spike: define weight from store MoM / seasonal profile.
2. Implement historical allocate + linear fallback.
3. Toggle in UI; default historical when eligible.
4. Jump audit fixtures + REPORT-M006.

## Acceptance

| Check | Expected |
|-------|----------|
| Toggle linear vs historical changes store paths | yes |
| Thin-history store does not crash; uses fallback | yes |
| Documented jump cases covered by tests | yes |

## Risks / rollback

- Overfitting seasonality — keep weights simple; document formula in REPORT.
- Rollback: force linear mode only.
