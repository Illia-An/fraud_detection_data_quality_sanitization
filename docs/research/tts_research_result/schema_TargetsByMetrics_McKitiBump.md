# Schema: dbo.TargetsByMetrics_McKitiBump

- **Database:** MC
- **Object:** VIEW `dbo.TargetsByMetrics_McKitiBump`
- **Base table (from VIEW_TABLE_USAGE):** `dbo.AABO_McKitiBumpTimes`
- **Related:** `dbo.vAABO_McKitiBumpTimes` (also on same table)
- **Notebook:** `notebooks/00_schema_explore.ipynb`
- **Explored:** 2026-10-18 (live extract; row counts drift)

## Columns

| # | Column | Type | Nullable | Notes |
|---|--------|------|----------|-------|
| 1 | StoreIndex | int | NO | store id |
| 2 | SaleDate | datetime | NO | business day (time usually 00:00) |
| 3 | WeborderID | nvarchar(50) | NO | order id |
| 4 | KVSGroup | int | NO | observed values: 21, 31 |
| 5 | MeitNumber | int | NO | meat / item channel? |
| 6 | SortOrder | int | NO | sequence within order/station |
| 7 | UpDatetime | datetime | NO | candidate TTS start |
| 8 | BumpDateTime | datetime | YES | candidate TTS end |
| 9 | Grill | nvarchar(MAX) | YES | attribute; not a duration |

`OBJECT_DEFINITION` not readable (no VIEW DEFINITION permission). View filters subset of base table (~4.6M vs ~11M historically).

## Grain

One row ≈ **one KVS bump event** (store × sale day × order × KVS × meat × sort × timestamps), **not** one order.

- Partial key (store, SaleDate, WeborderID, KVSGroup, MeitNumber, SortOrder): many duplicates (up to 23+ in samples)
- Even full key including Up/Bump: rows 4,602,770 vs distinct 4,581,257 → exact duplicate rows exist
- Rows per order (store×date×WeborderID): avg ~1.92, max 527

## Coverage (snapshot 2026-10-18)

| Metric | Value |
|--------|-------|
| Rows | 4,602,770 |
| Stores | 236 |
| Sale days | 47 |
| Distinct orders | 697,579 |
| SaleDate | 2026-09-01 → 2026-10-17 |
| UpDatetime | 2026-09-01 01:58 → 2026-10-18 10:18 |
| BumpDateTime | 2026-09-01 02:07 → 2026-10-18 10:21 |

## Null / sentinel (BumpDateTime present unless noted)

| Check | Count |
|-------|------:|
| BumpDateTime NULL | 24 |
| bump &lt; up (negative TTS) | 9 |
| bump = up (0 sec) | 281 |
| TTS &lt; 30 sec | 400,768 (~8.7%) |

## Draft TTS field

`TTS_sec = DATEDIFF(SECOND, UpDatetime, BumpDateTime)` — **hypothesis**, not locked.
