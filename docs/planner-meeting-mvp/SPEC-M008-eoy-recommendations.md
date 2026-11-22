# SPEC-M008 — EOY recommendations + status consequences

| Field | Value |
|-------|-------|
| Status | TODO |
| Depends on | M007 |
| Meeting items | 14, 16 |
| Report | `reports/REPORT-M008-eoy-recommendations.md` |

## Goal

For behind / ahead restaurants, show **actionable recommendations** to adjust
goals through year-end, with clear status language and **consequences** of
changing targets. Replace the At-risk AI chat stub with rule-based advice
(or wire real logic behind the same panel).

## Locked decisions

| ID | Decision |
|----|----------|
| D-M008-1 | Recommendations are rule-based in MVP (mix recipes + unreachable adjust + path-to-EOY gap). LLM optional later. |
| D-M008-2 | Each recommendation states: what to change, expected network effect, and that Apply creates a **new draft / version** (never silent mutate of frozen baseline). |
| D-M008-3 | Status copy uses short sentences (Behind / On plan / Ahead + one consequence line). |
| D-M008-4 | Reuse `UnreachableRecommendationCard` / mix Apply patterns; unify entry from At-risk Path panel. |

## In scope

- Rule engine or pure helpers: suggested monthly/store target tweaks to EOY.
- UI cards + consequence copy; replace chat stub content.
- Tests for suggestion generation and Apply → draft dirty.

## Out of scope

- Production LLM backend.
- Auto-Save without user confirm.

## Steps

1. Define recommendation schema (store_id, suggested targets, rationale key).
2. Implement pure generator from monitoring + simulation unreachable.
3. Present in At-risk right column; Apply → draft / adjust sim.
4. Simplify status strings (i18n).
5. Tests + REPORT-M008.

## Acceptance

| Check | Expected |
|-------|----------|
| Behind store shows at least one EOY-oriented recommendation when data allows | yes |
| Consequence copy visible before Apply | yes |
| Apply does not mutate frozen plan version in place | yes |
| Chat stub no longer the only “advice” surface | yes |
| Tests pass | yes |

## Risks / rollback

- Over-promising lift — cap suggestions with history_cap / 100% rules.
- Rollback: restore previous mix/unreachable-only UX; hide new cards.
