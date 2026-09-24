# Contract: Sanitized monthly panel → Planner (TASK-14 experiment)

**Status:** Experiment on `feat/planner-shell-handoff`  
**Metric:** Q10012 top-box % (`Answer_Value = 5`) — same as Sanitization.  
**Flow:** Sanitization `/process` success → client derives panel → Planner page may Run / export.

## Locked product rules

1. Planner **Run is blocked** until a successful Sanitization run left a `processResult` in session (empty-state A).
2. Panel scores are **cleansed** (after tiers), not raw actual.
3. v1 persist = **file export** of the panel (CSV, Excel-openable). No DB Save.
4. TTS / plan engine port / DB write-back = out of scope for this experiment.

## Panel grain (v1)

```json
{
  "period_start": "2025-01-01",
  "period_end": null,
  "echo_config": { "...PipelineConfig...": true },
  "reference_year": 2026,
  "reference_month": 8,
  "row_count": 12,
  "rows": [
    {
      "store_id": 10,
      "year": 2025,
      "month": 3,
      "five_percent": 71.2,
      "survey_volume": 140
    }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `five_percent` | Clean top-box % for store×month (prefer `after_tier4_five_pct`, else last non-null after_tier*) |
| `survey_volume` | `final_volume` after drops |
| `reference_year` / `reference_month` | Last calendar month present in rows (suggestion for planner; user may override later) |
| `period_start` / `period_end` | From `meta` when present |

## Derivation (experiment)

- **Source:** `SanitizationResponse.store_impact_series` + `echo_config` + `meta`.
- **Not yet:** dedicated backend `sanitized_monthly_panel` field (add if series coverage proves incomplete).

## Planner empty state

- No `processResult` → banner + disabled Run + link to Sanitization (`/`).
- With panel → show coverage (stores, months, suggested reference) + enable stub Run / Export.

## Non-goals

- Mixing Question_ID=1 SQL baseline into this path.
- Saving estimates to `TargetsByMetrics`.
- Merging Angular planner iframe.
