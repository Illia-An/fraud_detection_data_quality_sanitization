# SPEC-M007 — Network gap attribution

| Field | Value |
|-------|-------|
| Status | TODO |
| Depends on | M005 |
| Meeting items | 13 |
| Report | `reports/REPORT-M007-network-gap-attribution.md` |

## Goal

When the user selects / focuses a **network deviation**, show the
**restaurants and months** that formed the gap (attribution), not only as-of
Behind/Ahead lists.

## Locked decisions

| ID | Decision |
|----|----------|
| D-M007-1 | Entry: click network Δ on glance / period row (M005) or dedicated “Drivers” control. |
| D-M007-2 | Surface store contribution using existing `gapShare` / related metrics where available; add month drivers from monitoring insights. |
| D-M007-3 | Selecting a driver store may navigate to Inspect or highlight At-risk row — one consistent behaviour recorded in REPORT. |
| D-M007-4 | Empty drivers state when all on-plan — clear copy, no fake rows. |

## In scope

- Attribution panel/drawer.
- Wire unused row metrics into UI.
- Tests for driver list ordering and empty state.

## Out of scope

- Changing allocate math (M006).
- AI narrative (M008).

## Steps

1. Expose gapShare/streak (or equivalent) in Exception or Drivers panel.
2. Add month-level contributors for selected network period.
3. Click-through to Inspect.
4. Tests + REPORT-M007.

## Acceptance

| Check | Expected |
|-------|----------|
| From network Δ, user sees contributing stores | yes |
| Month contributors visible for selected period | yes |
| Tests pass | yes |

## Risks / rollback

- Performance on large n stores — top-N drivers only.
- Rollback: hide Drivers entry; At-risk remains.
