# Contract: TTS process API & panel handoff (draft)

**Status:** Draft — Stage 0 (`exp/tts-spec-contract`)  
**SPEC:** `SPEC-tts.md`  
**Metric:** Monitor dwell TTS (seconds), McKiti bump view  
**Flow (target):** UI/API `POST /api/v1/process-tts` → cleansed series → (Stage 5) panel → (Stage 6) planner-like  

Q10012 `/process` and `docs/contracts/sanitized_panel_handoff.md` stay unchanged.

---

## Locked product rules

1. **Separate endpoint** from five-percent sanitization (name: `/api/v1/process-tts` unless Stage 3 renames with SPEC update).
2. **TTS clock:** `TTS_sec = seconds(UpDatetime → BumpDateTime)`; rows with null `BumpDateTime` excluded from TTS math.
3. **Sanitization step `ge30`:** keep `TTS_sec >= tts_min_sec` (default **30**). This is mandatory for v1 “clean” KPI.
4. **`order_agg` is a second layer**, not a substitute for ge30:
   - `none` (v1 default) — bump-row means
   - `avg` — order mean of bump TTS
   - `max` — order max of bump TTS (stricter)
5. **Order key** (when `order_agg != none`): `StoreIndex` + `CAST(SaleDate AS date)` + `WeborderID`.
6. **Network delta:** `network_delta_sec = final_mean_tts_sec - baseline_mean_tts_sec`.
7. **Read-only** SQL; no `SELECT *`.
8. Planner Run for TTS (Stage 6) will be blocked until a successful TTS process left a panel in session — mirror of 5% empty-state A (detail in Stage 5/6).

---

## Request sketch (Stage 3)

```json
{
  "source": "db",
  "from_date": "2026-09-01",
  "to_date": "2026-10-17",
  "store_ids": null,
  "config": {
    "tts_min_sec": 30,
    "order_agg": "none"
  }
}
```

| Field | Notes |
|-------|--------|
| `source` | v1: `db` only; snapshot backlog |
| `from_date` / `to_date` | Inclusive **SaleDate** business-day window (Stage 1 lock) |
| `config` | Omitted → defaults from `TtsPipelineConfig` |
| `store_ids` | Optional filter |

---

## Response sketch (Stage 3)

```json
{
  "baseline_mean_tts_sec": 212.6,
  "final_mean_tts_sec": 231.4,
  "network_delta_sec": 18.8,
  "steps": [
    {
      "step_name": "actual",
      "rows_in": 4602746,
      "rows_out": 4602746,
      "rows_dropped": 0,
      "mean_tts_sec": 212.6,
      "median_tts_sec": 176.0
    },
    {
      "step_name": "ge30",
      "rows_in": 4602746,
      "rows_out": 4201978,
      "rows_dropped": 400768,
      "mean_tts_sec": 231.4,
      "median_tts_sec": 193.0
    }
  ],
  "store_impact_series": [
    {
      "store_id": 10,
      "year": 2026,
      "month": 9,
      "actual_mean_tts_sec": 200.0,
      "after_ge30_mean_tts_sec": 218.0,
      "volume_before": 1200,
      "volume_after": 1100
    }
  ],
  "echo_config": {
    "tts_min_sec": 30,
    "order_agg": "none"
  },
  "meta": {
    "period_start": "2026-09-01",
    "period_end": "2026-10-17",
    "execution_time_ms": 0,
    "peak_memory_mb": 0,
    "rows_scanned": 0,
    "source_view": "MC.dbo.TargetsByMetrics_McKitiBump"
  }
}
```

Numbers above are **illustrative** (aligned with research order of magnitude), not CI fixtures.

### Step semantics

| Step | Meaning |
|------|---------|
| `actual` | Baseline mean TTS on included bump rows (valid timestamps), before ge30 |
| `ge30` | After applying `TTS_sec >= tts_min_sec` |

**Stage 2 lock:** ge30 applies on **bump rows** first; then `order_agg` avg/max collapses to order grain.  
Echoed in result `meta`: `order_agg_applied_after_ge30`, `grain_final` (`bump` | `order`).

---

## Panel draft (Stage 5)

```json
{
  "period_start": "2026-09-01",
  "period_end": "2026-10-17",
  "echo_config": { "tts_min_sec": 30, "order_agg": "none" },
  "reference_year": 2026,
  "reference_month": 10,
  "row_count": 2,
  "rows": [
    {
      "store_id": 10,
      "year": 2026,
      "month": 9,
      "tts_sec": 218.0,
      "volume": 1100
    }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `tts_sec` | Cleansed mean for store×month (after ge30; grain per `order_agg`) |
| `volume` | Count of bumps or orders after clean |
| `reference_*` | Suggested last month in panel (planner later) |

Full Stage 5 doc: `docs/contracts/tts_sanitized_panel_handoff.md` (create when implementing panel).

---

## Non-goals (this contract)

- Changing Q10012 `SanitizationResponse` or Planner five-percent panel
- Writing TTS back to `TargetsByMetrics` / ERP
- Shipping MAX/AVG UI in Stage 4 (config may accept enums; UI can hide)
- Pressure/YTD semantics for seconds without a later product decision

---

## Implementation checklist

| Stage | Uses this contract |
|-------|--------------------|
| 1 DB read | Columns, period, view name |
| 2 Engine | `tts_min_sec`, `order_agg`, step metrics |
| 3 API | Request/response models + echo_config |
| 4 UI | Bind to response; default config |
| 5 Panel | Derive rows from `store_impact_series` + echo |
| 6 Planner | Gate on TTS panel (not 5% panel) |
