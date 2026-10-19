# Contract: TTS sanitized monthly panel → planner-like (Stage 5)

**Status:** Implemented on `exp/tts-panel-handoff`  
**SPEC:** `SPEC-tts.md`  
**Metric:** Monitor dwell TTS (seconds), McKiti bump — parallel to Q10012 `sanitized_panel_handoff.md`  
**Flow:** `POST /api/v1/process-tts` success → client derives panel → session + optional CSV → Stage 6 planner gate

Q10012 `docs/contracts/sanitized_panel_handoff.md` and `/process` panel stay unchanged.

**Code:** `web/src/schemas/ttsSanitizedPanel.ts`, session via `web/src/store/ttsUiStore.ts`

---

## Locked product rules

1. Stage 6 TTS planner **Run is blocked** until a successful TTS process left a ready panel in session (`isTtsPanelReady` — at least one store×month cell). Mirror of 5% empty-state A.
2. Panel scores are **cleansed** (`after_ge30_mean_tts_sec`), not raw actual.
3. `volume` is post-clean count (`volume_after`) — bumps or orders depending on `echo_config.order_agg`.
4. v1 persist = **session** (derived panel stored with TTS UI session) + optional **CSV export**. No DB Save.
5. Do **not** mix Q10012 `five_percent` / survey panel into this path.
6. Pressure / YTD / equal-weight chain rules for seconds are **out of scope** until Stage 6 product decisions.

---

## Panel grain (v1)

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
| `tts_sec` | Cleansed mean TTS (seconds) for store×month after ge30 |
| `volume` | `volume_after` from `store_impact_series` |
| `reference_year` / `reference_month` | Last calendar month present in rows (suggestion for Stage 6) |
| `period_start` / `period_end` | From process `meta` when present |
| `echo_config` | Echoed `tts_min_sec` + `order_agg` |

---

## Derivation

- **Source:** `TtsSanitizationResponse.store_impact_series` + `echo_config` + `meta`
- **Omit** points where `after_ge30_mean_tts_sec` is null
- **Sort:** `store_id`, `year`, `month`
- **Not yet:** dedicated backend `tts_sanitized_monthly_panel` field (add only if series coverage proves incomplete)

```ts
buildTtsSanitizedPanelFromProcess(result) → TtsSanitizedPanel
isTtsPanelReady(panel) → boolean
ttsSanitizedPanelToCsv(panel) → string
```

---

## Stage 6 empty state (contract preview)

- No ready TTS panel → banner + disabled Run + link to `/tts`
- With panel → show coverage (cells, suggested reference) + enable plan Run / Export

---

## Non-goals

- Changing Q10012 SanitizedPanel or Planner five-percent path
- Writing TTS back to `TargetsByMetrics` / ERP
- Shipping TTS planner engine / Pressure analogue in Stage 5
- Assuming seconds share 5% equal-weight chain aggregation without a product lock
