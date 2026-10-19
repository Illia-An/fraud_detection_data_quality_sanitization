# Clean report 01 — drop TTS &lt; 30 seconds

**Source:** `MC.dbo.TargetsByMetrics_McKitiBump`  
**Notebook:** `notebooks/01_rule_tts_ge30.ipynb`  
**Rule under test:** keep rows with `BumpDateTime IS NOT NULL` and  
`TTS_sec = DATEDIFF(SECOND, UpDatetime, BumpDateTime) >= 30`  
**Basis:** business hint that TTS under 30 seconds is impossible  
**Status:** candidate rule (not customer-locked)

## Before vs after — network (row-level)

| Metric | Before | After ≥30 | Delta |
|--------|-------:|----------:|------:|
| Rows | 4,602,746 | 4,201,978 | −400,768 (−8.7%) |
| Mean sec | 212.6 | 231.4 | +18.9 |
| Median sec | 176 | 193 | +17 |
| Min sec | −264 | 30 | — |
| Max sec | 6891 | 6891 | 0 |

Short rows pull the network average **down**. Removing them raises both mean and median by ~17–19 seconds.

## Before vs after — store × month

| Metric | Value |
|--------|------:|
| Store×month cells | 472 |
| Mean delta (after − before) | +18.7 sec |
| Median delta | +17.3 sec |
| Share of cells with mean ↑ | **100%** |
| Share with mean ↓ | 0% |
| Equal-weight network mean before | 212.9 sec |
| Equal-weight network mean after | 231.6 sec |

Equal-weight (mean of store×month means) moves almost the same as row-weighted network (~213 → ~232).

High-volume stores typically shift **+5…+20 sec**. A minority with many short events shift much more (examples up to **~+100 sec**, with large row drop — e.g. store 266 / 2026-09: 8871 → 5842 rows, mean 206 → 307).

## Sanity

| Check | Result |
|-------|--------|
| Negative TTS before filter | 9 |
| Negative TTS after ≥30 | 0 |

## Decision (research)

**Keep as candidate sanitization rule.**

- Aligns with stated business constraint  
- Material but not extreme drop (~9% of bump rows)  
- Improves network and **every** observed store×month mean in this window  
- Removes impossible negative durations as a side effect  

**Not locked** until customer confirms: strict `&lt; 30` vs `≤ 30`, units = seconds, and whether bump-row grain is the KPI grain.

## Still open (next experiments)

1. Order-level aggregation (max / last / primary KVS) — then re-run ≥30  
2. Optional long-tail cap (e.g. &gt; 1h) — low impact on mean so far  
3. KVSGroup 21 vs 31 inclusion in official KPI  
4. Confirm Up→Bump clock definition with ops  

## Related docs

- `docs/schema_TargetsByMetrics_McKitiBump.md`  
- `docs/report_exploration_00.md`  
