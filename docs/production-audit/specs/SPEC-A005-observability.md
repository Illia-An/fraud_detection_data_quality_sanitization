# SPEC-A005 — Observability: Logging, Metrics, Alerting, Incident Diagnosability

| Field | Value |
|-------|--------|
| **ID** | SPEC-A005 |
| **Track** | Production audit (SDD) |
| **Role** | Site Reliability Engineer (SRE) |
| **Status** | Report ready |
| **Branch** | `audit/production-readiness` |
| **Report** | `docs/production-audit/reports/REPORT-A005-observability.md` (after execution) |
| **Inputs** | Codebase (`backend/` logging, `/health`, Docker HEALTHCHECK); assessment OBS-*, DATA-04; SPEC-A001…A004 (cross-links only) |

---

## 1. Goal

Оценить текущую **прозрачность** системы для production: достаточно ли логов для расследования падения; какие **минимальные метрики и алерты** нужны, чтобы узнать о проблеме до пользователей.

Итог: **спецификация логирования** + **схема мониторинга/алертинга** для internal launch (blocker vs defer).

## 2. Role & Focus

**Роль:** Site Reliability Engineer (SRE).

**Фокус:**
- структурированное логирование (JSON, уровни, request correlation);
- трекинг ошибок (server-side + optional client);
- ключевые метрики: Latency, Error Rate, RPS (и data freshness);
- tracing (минимум: request ID; full distributed tracing — оценить необходимость);
- принципиальная возможность диагностировать инцидент в продакшене без угадываний.

## 3. Scope

### In scope
- App logging today: `logging.getLogger` usage in `backend/*`, startup config (or lack thereof).
- Health vs readiness: `/health`, Docker `HEALTHCHECK`, snapshot freshness signals (`loaded_at`, row counts).
- Error paths: `logger.exception` coverage vs silent failures; HTTP status mapping.
- Metrics surface: what exists vs what to emit (HTTP, process, snapshot age, refresh job).
- Alert catalogue (minimal for internal prod): when page / when ticket.
- PII/secrets redaction rules for logs (align with A003).
- Diagnosability walkthrough: sample incident → what evidence exists today → gaps.
- Client telemetry (OBS-02) — classify; platform choice as open question.

### Out of scope
- Choosing/buying a specific SaaS (Datadog/Grafana Cloud/etc.) — recommend options; leave G-5 open.
- Full OpenTelemetry rollout if not needed for single-host internal monolith — justify defer vs minimal request-ID.
- Implementing collectors/dashboards in this SPEC — spec + report only until Approved.
- Infra deploy pipeline details (INFRA-02) beyond observability hooks (version in logs/ready).

## 4. AI task (execution prompt)

> Оцени текущий уровень прозрачности системы. Достаточно ли логов для расследования падения? Какие минимальные метрики и алерты нужно настроить, чтобы узнать о проблеме до того, как о ней напишут пользователи?

При выполнении:
1. Inventory current logs/metrics/health with evidence.
2. Answer explicitly: **достаточны ли логи для расследования падения?** (Yes / Partial / No) + gaps.
3. Define minimal metric set + alert rules for internal launch.
4. Class: **Release blocker** | **Defer**.
5. Findings: **Подтверждено** / **Потенциально** / **Рекомендация**.

## 5. Expected artifact

**REPORT-A005** must contain:

1. **Current transparency scorecard** (logging / metrics / tracing / health / freshness).
2. **Logging specification** (главный артефакт, часть 1):
   - format (JSON fields), levels, where emitted (stdout);
   - required fields per request (request_id, route, status, duration_ms, version);
   - redaction rules (no PII, no secrets, no raw bodies);
   - startup/shutdown / refresh job logging.
3. **Monitoring & alerting scheme** (главный артефакт, часть 2):

| Signal | Type (metric/log/ready) | Threshold / condition | Severity | Notify |
|--------|-------------------------|------------------------|----------|--------|

   Cover at least: process down, error rate, latency SLO (internal), snapshot missing/stale, refresh failure.
4. **Incident diagnosability** — 2–3 scenarios (API 500, wrong KPI / stale data, container restart) and evidence trail.
5. **Findings registry** (OBS-… re-verify + new); blocker vs defer backlog.
6. **Open questions** (platform G-5, alert channel, freshness SLA).

Seed: OBS-01, OBS-02, OBS-03, DATA-04; related PERF profiling notes if they affect diagnosability.

## 6. Classification rules

| Class | Meaning |
|-------|---------|
| **Release blocker** | Cannot tell service is unhealthy before users complain; cannot correlate a request failure; no readiness for data dependency; logs useless/default-only for triage. |
| **Defer** | Full distributed tracing; rich APM dashboards; client RUM; advanced SLO burn alerts — after platform choice. |

## 7. Acceptance criteria

- [ ] REPORT-A005 создан; вопрос «хватает ли логов?» отвечен явно.
- [ ] Logging spec + monitoring/alerting scheme присутствуют.
- [ ] Minimal pre-user alerts listed with thresholds (or “TBD with SLA” marked).
- [ ] OBS-* перепроверены; README index A005 updated.

## 8. Non-goals

- Не внедрять стек мониторинга в код в рамках этой спеки.
- Не дублировать security hardening (A003) или DB refresh design (A002) — только observability hooks.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Draft from audit brief #5 (Observability / SRE). |
