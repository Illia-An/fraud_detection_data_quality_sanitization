# Exploration report 00 — TTS (McKiti bump)

**Source:** `MC.dbo.TargetsByMetrics_McKitiBump`  
**Notebook:** `notebooks/00_schema_explore.ipynb`  
**Audience:** manager + product handoff draft

## What we think TTS is (draft)

Time from item appearing on the kitchen screen (`UpDatetime`) until bump (`BumpDateTime`), in **seconds**, at **bump-row** grain.

This is **not yet** confirmed as the official customer KPI definition.

## Baseline numbers (row-level, live ~2026-10-18)

| Statistic | Seconds | ~Minutes |
|-----------|--------:|---------:|
| Mean (all bumps with timestamp) | 213 | 3.5 |
| Median | 176 | 2.9 |
| Mean if drop TTS &lt; 30s | 231 | 3.9 |
| Mean if also drop TTS &gt; 1h | 231 | 3.9 |
| Min / Max | -264 / 6891 | — |

Business hint under test: **TTS &lt; 30 seconds is impossible** → ~8.7% of rows; removing them **raises** the network mean (shorts pull the average down).

## Network vs store

- **Row-weighted network mean** ≈ 213s (raw) / 231s (≥30s).
- **Store × month** means differ a lot (examples ~146–319s among high-volume stores).
- Equal-weight mean of store scores will **not** match row-weighted network — volumes differ. Do not copy the 5% Planner aggregation without evidence.

## KVS split

| KVSGroup | Rows | Mean TTS (raw) |
|---------|-----:|---------------:|
| 21 | 3,751,925 | ~219s |
| 31 | 850,821 | ~184s |

KVS 31 is faster on average; mix affects network.

## What failed / weak as a signal (so far)

1. Raw mean including &lt;30s — biased low if shorts are invalid.
2. Extreme max (~1.9h) — rare; barely moves mean after ≥30s filter.
3. `Grill` — label/attribute, not duration.
4. Per-row TTS as “guest wait” — orders have multiple bump rows (avg ~1.9, max 527); need order-level rule (max / last / primary KVS / …).
5. Exact duplicate rows — noise for counts, not “slow service”.

## Open questions for customer / ops

1. Confirm clock: is TTS really Up → Bump?
2. Aggregate to **order**, **store-day**, or keep bump rows?
3. Filter: `TTS < 30` strict or `≤ 30`? Units confirmed seconds?
4. Cap for long outliers (e.g. &gt; 30–60 min)?
5. Which KVSGroup(s) enter the official KPI?
6. Why view ⊂ base table (~half rows) — business filter we should reuse?

## Next research steps

1. Lock definition (units, grain, filters).
2. Notebook `01_…`: before/after ≥30s on network **and** store×month.
3. Decide order-level aggregation; re-measure.
4. Optional: compare to any official TTS report if available.
