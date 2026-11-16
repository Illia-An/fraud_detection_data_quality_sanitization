# Snapshot refresh runbook (Wave 5 / CD-05)

| Field | Value |
|-------|--------|
| **Owners** | Primary: **HOST PENDING** (fill when Wave 0 HOST is signed). Secondary: **second operator — name TBD** |
| **Purpose** | Refresh Q10012 (+ TTS KPI) snapshots on the deploy host without SPOF on one person |
| **Related** | Wave 2 atomic publish + `.prev`; Wave 4 `/ready`; Wave 0 FRESH (14d proposed) |

## Preconditions

1. VPN / network access to the AnswerTime source (ODBC) as required by `scripts/refresh_*.py`.
2. Write access to the host `data/` directory mounted into the container.
3. `uv` + project deps on the **host** (refresh does not run inside the read-only container mount).
4. Know how to page the **ALERT** channel (Wave 0 still PENDING — record who to call).

## Q10012 refresh

```powershell
cd <repo-or-deploy-checkout>
uv run python scripts/refresh_q10012_snapshot.py
```

Expect: gates pass → atomic replace → `data/q10012_snapshot.sqlite` + `.prev` retained.

Verify:

```powershell
curl http://127.0.0.1:8000/ready
# HTTP 200, reasons=[], schema_ok true, age within SNAPSHOT_MAX_AGE_DAYS
```

## TTS KPI refresh

```powershell
uv run python scripts/refresh_tts_kpi_snapshot.py
curl http://127.0.0.1:8000/api/v1/tts-kpi/ap
```

## Failure

1. Do **not** manually copy a half-written file over the live snapshot.
2. Keep `.prev`; restore with `Copy-Item data\q10012_snapshot.sqlite.prev data\q10012_snapshot.sqlite` (or `scripts/rollback_deploy.* -RestoreSnapshotPrev`).
3. Re-check `/ready` and SM-13 (`scripts/smoke_post_deploy.py`).
4. Page ALERT channel; note exit code / gate name from the refresh log.

## Second operator drill

At least once before go-live, a **second** person runs this runbook end-to-end on a non-prod copy and records date + name below.

| Date | Operator | Result |
|------|----------|--------|
| _TBD_ | _TBD_ | _TBD_ |
