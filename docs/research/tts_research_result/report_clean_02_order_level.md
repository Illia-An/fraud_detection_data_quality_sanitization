# Clean report 02 — order-level TTS (+ ≥ 30s)

**Source:** `MC.dbo.TargetsByMetrics_McKitiBump`  
**Notebook:** `notebooks/02_order_level_tts.ipynb`  
**Order key:** `StoreIndex` + `CAST(SaleDate AS date)` + `WeborderID`  
**Primary order TTS (draft):** `tts_max = MAX(DATEDIFF(SECOND, UpDatetime, BumpDateTime))` over bumps  
**Also tracked:** `tts_avg` per order (comparison only)  
**Filter under test:** keep orders with `tts_max >= 30`  
**Status:** candidate grain + candidate rule (not customer-locked)

Prerequisite: `docs/report_exploration_00.md`, `docs/report_clean_01_ge30.md`.

## Order panel (before filter)

| Metric | Value |
|--------|------:|
| Orders | 2,391,164 |
| Avg bumps / order | 1.92 |
| Min / max bumps | 1 / 527 |
| Mean `tts_max` | 216.7 sec |
| Mean `tts_avg` | 196.3 sec |
| Min / max `tts_max` | −106 / 6891 |
| Orders with `tts_max` &lt; 30 | 221,011 (**9.24%**) |

Note: distinct `WeborderID` alone (~0.7M in exploration) undercounts; store×day×id is the safer order grain.

## Network before / after (order grain, filter on `tts_max`)

| Metric | Before | After ≥30 | Delta |
|--------|-------:|----------:|------:|
| Orders | 2,391,164 | 2,170,153 | −221,011 (−9.2%) |
| Mean `tts_max` | 216 | 237 | +21 sec (~+9.7%) |
| Median `tts_max` | 181 | 200 | +19 |
| Mean `tts_avg` | 196.3 | 214.9 | +18.5 |
| Min `tts_max` | −106 | 30 | — |

Same qualitative story as bump-row rule 01: dropping short durations **raises** network mean and median.

## Store × month (order `tts_max`)

| Metric | Value |
|--------|------:|
| Store×month cells | 472 |
| Mean delta (after − before) | +20.7 sec |
| Median delta | +18.8 sec |
| Share of cells with mean ↑ | **100%** |
| Share with mean ↓ | 0% |
| Equal-weight network before | 216.3 sec |
| Equal-weight network after | 237.0 sec |

High-volume stores: typically **+5…+22 sec**. Dirty tail: up to **~+111 sec** (e.g. store 266 / 2026-09), same pattern as in 01.

## Vs bump-row baseline (01)

| Grain | Mean before | Mean after ≥30 | Median before → after |
|-------|------------:|---------------:|----------------------|
| Bump row (01) | ~213 | ~231 | 176 → 193 |
| Order MAX (02) | 216 | 237 | 181 → 200 |
| Order AVG (ref.) | 196 | 215 | — |

### How MAX compares (percent)

| Contrast | Effect |
|----------|--------|
| Order MAX vs bump mean | MAX ~**+1–3%** higher |
| Order AVG vs order MAX | AVG ~**−9%** lower than MAX |
| ≥30 filter on order MAX | mean **+~10%**; orders **−9.2%** |

MAX does **not** lower the metric vs bump rows; it slightly raises it. AVG is the softer aggregator.

## Decision (research)

1. **Order grain is a credible KPI unit** — matches “wait per order” better than raw bumps; bump multiplicity (avg ~1.9, max 527) otherwise distorts row-means.  
2. **`tts_max` is the stricter candidate**; `tts_avg` is ~9% lower — needs customer preference.  
3. **≥30s remains a strong candidate** on order panel: ~9% orders dropped, 100% store×month means rise, aligns with 01.  

**Not locked:** MAX vs AVG vs “last bump”; whether to filter bumps ≥30 *before* taking MAX; KVS 21/31 mix.

## Still open

1. Apply ≥30 on bumps first, then MAX (vs filter on order max only)  
2. KVSGroup = 21 only  
3. Long-tail cap (&gt; 30–60 min)  
4. Reconcile against any official TTS report  

## Related docs

- `docs/schema_TargetsByMetrics_McKitiBump.md`  
- `docs/report_exploration_00.md`  
- `docs/report_clean_01_ge30.md`  
