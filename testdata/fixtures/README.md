# CI / smoke snapshot fixtures

Synthetic SQLite files for Wave 5 image smoke, post-deploy smoke, and E2E `RG-N10`.

| File | Role |
|------|------|
| `q10012_snapshot.sqlite` | Sanitization snapshot (`schema_version=1`) |
| `tts_kpi_snapshot.sqlite` | TTS KPI AP panel offline source |

**No real PII** — contacts are `*@example.test`.

Regenerate (refreshes `loaded_at`):

```powershell
.venv\Scripts\python.exe scripts\build_ci_fixtures.py
```

When mounting committed fixtures older than the FRESH SLA, set `SNAPSHOT_MAX_AGE_DAYS=36500` (CI/smoke default for fixtures only — not production).
