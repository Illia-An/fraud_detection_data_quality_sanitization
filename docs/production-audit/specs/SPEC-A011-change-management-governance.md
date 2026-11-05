# SPEC-A011 — Change Management & Post-Release Governance

| Field | Value |
|-------|--------|
| **ID** | SPEC-A011 |
| **Track** | Production audit (SDD) |
| **Role** | Engineering Manager / Release Governance |
| **Status** | Report ready |
| **Branch** | `audit/production-readiness` |
| **Report** | `docs/production-audit/reports/REPORT-A011-change-management-governance.md` (after execution) |
| **Inputs** | `docs/BRANCHING.md`, CI, Docker/compose deploy practice, assessment INFRA-02/03; SPEC-A004/A006/A010; product “coming soon” / env toggles |

---

## 1. Goal

Гарантировать, что **после релиза** любые изменения (FE, дизайн, бизнес-логика, конфиг) не разрушат работающую систему: процесс правок, окружения, совместимость контрактов, безопасный rollout.

Итог: заполненный **чек-лист governance** + минимальный **post-release change policy** (blocker vs defer).

## 2. Focus (brief + extensions)

**Из брифа:**
- запрет правок «на живом проде»;
- изоляция Dev / Staging / Production;
- backward compatibility («сначала бэкенд, потом фронтенд»);
- feature flags.

**Дополнения для этого репо:**
- immutable artifacts (deploy by image/git tag only);
- host `.env` / snapshot path as controlled change (not ad-hoc SSH edit);
- contract safety net (Zod + API tests / OpenAPI golden) as compatibility gate;
- link change process to smoke/regression (A004) and rollback (A006).

## 3. Scope

### In scope
- As-is change path: branch → PR → CI → merge `main` → tag? → manual compose on host.
- Evidence of (or against) live-server code/config edits.
- Environment topology: only local/Docker vs real Staging; Production definition for internal launch.
- API/UI compatibility practice when schemas change; monolith same-image deploy implications (BE+FE often ship together — document exception to “BE first”).
- Feature flags / kill-switches: real flags vs `coming soon` / env (`SANITIZATION_SOURCE`, etc.).
- Proposed minimal governance for internal prod (who approves, what must pass).

### Out of scope
- Implementing LaunchDarkly/Unleash in this SPEC.
- Full multi-tenant staging infra build-out (design + gap only).
- Security policy deep-dive (A003) beyond change access to prod host.

### Reality check
Сейчас часто **один хост + `:local` image** и **монолитный образ (API+SPA)**. «BE first then FE» для раздельного деплоя может быть N/A; тогда policy = **совместимость внутри одного tagged build** + optional API versioning for future split. Зафиксировать as-is.

## 4. AI task (execution prompt)

Проверить чек-лист и ответить evidence-based:

1. Исключена ли практика ручного редактирования кода/конфигов на боевом сервере?
2. Чётко ли разделены Development / Staging / Production?
3. Есть ли стратегия обратной совместимости контрактов при смене структуры данных?
4. Используются ли feature flags для безопасного раскатывания?

Дополнительно: описать **минимальную post-release policy** (что обязательно до merge в prod path).

Class gaps **Release blocker** | **Defer**.

## 5. Expected artifact

**REPORT-A011** must contain:

1. **Checklist results** (4 brief items + optional extensions): Pass / Partial / Fail + evidence.
2. **As-is vs target change workflow** (diagram or steps).
3. **Environment matrix** (Dev / Staging / Prod — exists? data? who accesses?).
4. **Compatibility policy** recommendation (monolith co-deploy vs BE-first; Zod/OpenAPI gates).
5. **Feature-flag stance** — need for v1 internal / defer; map existing soft gates.
6. **Minimal governance backlog** before/after go-live.
7. Open questions (staging host owner, who may touch prod `.env`, freeze windows).

## 6. Classification rules

| Class | Meaning |
|-------|---------|
| **Release blocker** | Prod changes happen by hand on server; no Staging or equivalent pre-prod check for risky changes; breaking contract changes can ship without safety net; no rollback-linked change process. |
| **Defer** | Full feature-flag platform; third environment polish; formal CAB — after internal launch with tagged immutable deploys. |

## 7. Acceptance criteria

- [x] REPORT-A011 создан; 4 checklist items answered with evidence.
- [x] Post-release change policy sketch present.
- [x] README index A011 updated.

## 8. Non-goals

- Не дублировать полный CI/CD design (A006) — только governance поверх него.
- Не требовать enterprise feature-flag SaaS для маленькой внутренней аудитории без нужды.

---

## Checklist (copy into report)

- [x] **No live-prod edits** — Fail. Deploy is `compose build` of `:local` from the host tree.
- [x] **Env isolation** — Fail. Dev vs one Docker host; no Staging.
- [x] **Backward-compatible contract changes** — Partial. Monolith co-deploy; legacy key migration; no Zod parity CI.
- [x] **Feature flags** — Fail as a platform; Partial via env source switches and `KITCHEN_RUN_ENABLED`.
- [x] *(ext)* **Immutable tagged deploys** — Fail (A006 CD-01/02).
- [x] *(ext)* **Prod config change control** — Fail. No named owner for `.env.docker` / refresh.
- [x] *(ext)* **Mandatory CI + smoke before promote** — Partial. CI on PR; image build and post-deploy smoke are not required.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Draft from audit brief #11 (+ repo-specific extensions). |
| 2026-11-05 | Executed → REPORT-A011 (EN); status Report ready. |
