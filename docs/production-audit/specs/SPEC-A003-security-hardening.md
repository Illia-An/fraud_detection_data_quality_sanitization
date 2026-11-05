# SPEC-A003 — Security: AuthZ, Secrets, Input Validation, OWASP Top 10

| Field | Value |
|-------|--------|
| **ID** | SPEC-A003 |
| **Track** | Production audit (SDD) |
| **Role** | Application Security Engineer (AppSec) |
| **Status** | Report ready |
| **Branch** | `audit/production-readiness` |
| **Report** | `docs/production-audit/reports/REPORT-A003-security-hardening.md` (after execution) |
| **Inputs** | Codebase as of branch tip; assessment SEC-* / related INFRA; SPEC-A001/A002 (boundaries only, no duplicate deep DB work) |

---

## 1. Goal

Провести аудит безопасности кода и конфигураций против **OWASP Top 10** (инъекции, broken access control, секреты, XSS/path issues, misconfig, vulnerable components, SSRF к upstream, и т.д.) и ответить: **как реализована проверка прав (RBAC/ABAC)?**

Итог: **Security Hardening Checklist** до internal release — с классом **блокер / отложить** и приоритетом.

## 2. Role & Focus

**Роль:** Application Security Engineer (AppSec).

**Фокус:**
- authentication & authorization (наличие/отсутствие; RBAC/ABAC);
- secrets management (no hardcode; env/gitignore; log leakage);
- input validation & sanitization (Pydantic/Zod, payload limits, `extra` fields);
- OWASP Top 10 mapping для этого стека (FastAPI + React SPA + Docker + SQLite/MSSQL read paths);
- API protection (CORS, body size, rate/DoS surface, error disclosure).

## 3. Scope

### In scope
- API surface: `backend/main.py`, schemas (`backend/schemas.py`, plan/tts schemas), `backend/static_ui.py`.
- Secrets & config: `.env*` examples, `db/config.py`, DreamFactory key usage, CORS defaults, Dockerfile USER/ports.
- PII handling: `src/fraud_guard/pii.py`, snapshot at-rest, notebooks outputs in git history.
- Frontend: trust boundary (Zod parse of API), `import.meta.env`, dependency advisories (`npm audit` evidence).
- Injection: SQL parameterization, identifier qualification regexes, path traversal on SPA static.
- Upstream clients: SQL Server / DreamFactory SSRF-like exposure of keys/URLs in errors.
- Security test gaps (auth, path traversal, payload size).

### Out of scope
- Full infra/network hardening beyond what the app/compose exposes (VPN/firewall owned by ops — note as dependency).
- Legal/incident response for historical PII in git (recommend + owner decision; do not execute filter-repo).
- Deep Python CVE tooling install if not in repo — report gap; do not add scanners unless Approved later.
- Implementing remediations in this SPEC — checklist/report only until Approved.

## 4. AI task (execution prompt)

> Проведи аудит безопасности кода и конфигураций на предмет OWASP Top 10 (инъекции, неавторизованный доступ, утечки секретов в окружении). Как реализована проверка прав доступа (RBAC/ABAC)?

При выполнении:
1. Явно ответить на RBAC/ABAC: текущее состояние + минимальная модель для internal launch.
2. Пройти OWASP Top 10 как матрицу (applicable / N/A / gap) с evidence.
3. Каждую находку: **Подтверждено** / **Потенциально** / **Рекомендация**; класс **Release blocker** | **Defer**.
4. Не эксплуатировать live systems; static/code + local config evidence only.

## 5. Expected artifact

**REPORT-A003** must contain:

1. **Ответ по authZ:** RBAC/ABAC — реализовано / нет / interim controls.
2. **OWASP Top 10 matrix** (кратко per category).
3. **Реестр findings** (SEC-… re-verified + new):

| ID | Finding | OWASP / theme | Evidence | Class | Severity | Effort | Fix |
|----|---------|---------------|----------|-------|----------|--------|-----|

4. **Security Hardening Checklist** (главный артефакт) — actionable items до релиза, grouped P0/P1/P2, each with Done criteria.
5. **Defer / accept risk** с обоснованием для internal-only launch.
6. **Открытые решения** (IdP, роль vs open LAN, git history rewrite, pepper distribution).

Seed (re-verify): SEC-01 … SEC-08; related ARCH-03 (secrets in logs), INFRA container/network.

## 6. Classification rules

| Class | Meaning |
|-------|---------|
| **Release blocker** | Unauthenticated sensitive data exposure on reachable network; secrets/PII leak in repo or at rest without control; injectable/path issues with credible impact; critical dependency if in production path. |
| **Defer** | Low likelihood with compensating control documented; research-only deps; hardening that needs IdP decision but interim network lock is in place. |

## 7. Acceptance criteria

- [ ] REPORT-A003 создан; RBAC/ABAC вопрос отвечен явно.
- [ ] OWASP matrix + Security Hardening Checklist присутствуют.
- [ ] Assessment SEC-* перепроверены.
- [ ] Каждый blocker имеет concrete fix + Done criteria в checklist.
- [ ] README index: A003 → Spec + Report + status.

## 8. Non-goals

- Не писать exploit PoC / attack scripts.
- Не force-push / history rewrite.
- Не дублировать полный DB integrity audit (A002) или architecture (A001).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Draft from audit brief #3 (Security / AppSec). |
