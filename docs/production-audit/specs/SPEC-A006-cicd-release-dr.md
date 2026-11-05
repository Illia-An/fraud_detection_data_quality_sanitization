# SPEC-A006 — CI/CD: Deploy Pipeline, Rollback & Disaster Recovery

| Field | Value |
|-------|--------|
| **ID** | SPEC-A006 |
| **Track** | Production audit (SDD) |
| **Role** | DevOps / Release Engineer |
| **Status** | Report ready |
| **Branch** | `audit/production-readiness` |
| **Report** | `docs/production-audit/reports/REPORT-A006-cicd-release-dr.md` (after execution) |
| **Inputs** | `.github/workflows/ci.yml`, `Dockerfile`, `docker-compose.yml`, env examples, README deploy notes; assessment INFRA-*; SPEC-A002 (snapshot integrity), A003 (secrets), A005 (health/ready) |

---

## 1. Goal

Спроектировать **безопасный и воспроизводимый** процесс деплоя для этого MVP (internal production). Явно ответить:
- что происходит, если новый билд **падает при старте**;
- как устроены **откат** и **резервное копирование / восстановление** данных (snapshot + ops).

Итог: **пошаговый пайплайн деплоя** + **Disaster Recovery Plan**, с blocker vs defer.

## 2. Role & Focus

**Роль:** DevOps / Release Engineer.

**Фокус:**
- процесс деплоя (build → tag → promote → run);
- стратегия и автоматизация rollback;
- изоляция конфигураций окружений (dev/stage/prod);
- безопасная доставка секретов;
- автоматические проверки в пайплайне (tests + image smoke);
- бэкапы и DR (для данного продукта = snapshot files + ability to rebuild from source).

## 3. Scope

### In scope
- Current CI: what gates exist; branch filters; Node/Python/uv pin drift.
- Container deliverable: multi-stage `Dockerfile`, compose, `:local` tagging gap.
- Boot-failure behavior: HEALTHCHECK, restart policy, failed container vs previous revision.
- Rollback: image tag/SHA redeploy; git tag mapping; data compatibility (schema_version).
- Env isolation: `.env` / `.env.docker.example` / compose overrides; no secret in image.
- Secrets delivery model (host env / secret store) — design, not vendor lock-in.
- Backup/restore of Q10012 + TTS KPI SQLite snapshots; retention; restore drill.
- Refresh-job host as DR dependency (INFRA-01) — document SPOF and mitigations.
- Post-deploy smoke (align with A004 smoke suite).

### Out of scope
- Multi-region HA / K8s redesign unless already chosen (open question G-5/hosting).
- Implementing full registry/CD in this SPEC — design + checklist until Approved.
- SQL Server DBA backup of upstream warehouses (note as external dependency).
- Auth IdP setup (A003) beyond “secrets for SSO client” placeholders.

### Reality check (must state in report)
Нет классической app-БД. **DR/backup** = целостность и копирование **snapshot-файлов** + процедура refresh из SQL Server; контейнер read-mostly.

## 4. AI task (execution prompt)

> Спроектируй безопасный и воспроизводимый процесс деплоя для этого MVP. Что происходит, если новый билд падает при старте? Как устроен процесс отката и резервного копирования базы данных?

При выполнении:
1. Inventory current CI/CD & deploy as-is (evidence).
2. Answer boot-failure and rollback explicitly (today vs target).
3. Answer backup/restore for “database” in product terms (snapshots).
4. Propose target pipeline steps + DR runbook.
5. Class findings **Release blocker** | **Defer**; mark **Подтверждено** / **Потенциально** / **Рекомендация**.

## 5. Expected artifact

**REPORT-A006** must contain:

1. **As-is vs to-be** deploy diagram/list.
2. **Step-by-step deploy pipeline** (главный артефакт, часть 1):

| Step | Action | Gate / check | On failure |
|------|--------|--------------|------------|

   Include: CI tests → image build → tag (git SHA/semver) → push → deploy host pull → migrate/refresh notes → smoke → promote.
3. **Boot failure & rollback procedure** — exact commands/ops sequence; RTO target (propose if unknown).
4. **Disaster Recovery Plan** (главный артефакт, часть 2):
   - what to back up (images tags, compose/env templates without secrets, snapshot files, refresh scripts);
   - schedule/retention;
   - restore steps;
   - loss scenarios (bad deploy, corrupt snapshot, lost refresh host, registry outage).
5. **Secrets & env isolation** checklist.
6. **Findings registry** (INFRA-* re-verify + new); blocker/defer backlog.
7. **Open questions** (registry, host, who operates refresh, RPO/RTO sign-off).

Seed: INFRA-01 … INFRA-05; P1-6/P1-7; SEC-08; OBS readiness hooks.

## 6. Classification rules

| Class | Meaning |
|-------|---------|
| **Release blocker** | No reproducible deploy artifact; no documented rollback; no snapshot backup/restore; boot failure leaves service down with no prior-good path; secrets baked into image/repo. |
| **Defer** | Full progressive delivery (canary); multi-env promotion automation; image CVE scanning polish; DR drills cadence after first restore documented. |

## 7. Acceptance criteria

- [ ] REPORT-A006 создан; вопросы про boot-fail, rollback, backup отвечены явно (as-is + target).
- [ ] Deploy pipeline steps + DR plan присутствуют.
- [ ] INFRA-* перепроверены; README index A006 updated.

## 8. Non-goals

- Не выполнять production deploy из аудита.
- Не дублировать полный observability design (A005) или DB schema audit (A002) — только release/DR hooks.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Draft from audit brief #6 (CI/CD / Release / DR). |
