# REPORT-A004 — Тестирование и качество: Core Journeys, Smoke & Regression

| Поле | Значение |
|------|----------|
| **Spec** | [SPEC-A004](../specs/SPEC-A004-testing-quality.md) |
| **Branch** | `audit/production-readiness` |
| **Date** | 2026-11-04 |
| **Method** | Статический разбор `tests/`, `web/src/**/*.test.*`, `web/tests/e2e/`, `ci.yml`, `playwright.config.ts`, `vite.config.ts`. pytest / vitest / Playwright / Docker **not executed in audit run**. |
| **Status** | Report ready (зависит от G-1; Approve на код тестов не давался) |

> **Method note.** Индекс поиска Cursor устарел (показывает удалённые файлы из `3df409e`,
> напр. `tests/test_tts_guard.py`, `test_tts_order_bump_*`). Каждый путь проверен через
> `Test-Path` / `git ls-files`.
> Ссылки: [REPORT-A001](./REPORT-A001-architecture-coupling.md) (A-01/A-02/A-03),
> [REPORT-A002](./REPORT-A002-db-data-integrity.md) (D-03/D-04/D-05),
> [REPORT-A003](./REPORT-A003-security-hardening.md) (S-02/S-03/S-06).

**Базовые цифры (статика).**

- Backend: 26 `test_*.py`, **129** функций `def test_` (совпадает с assessment: 129 passed на 2026-11-03).
- Frontend: 72 tracked test-файла (assessment: 290 тестов).
- E2E: 2 spec (`sanitization.spec.ts`, `planner.spec.ts`) плюс helper `dismissOnboarding.ts`.
- CI: `backend` (pytest, Py 3.12), `frontend` (lint, vitest, build, Node 22), `e2e` (Playwright, `needs` обоих).

---

## 1. Core User Journeys

| ID | Journey | Happy | Negative |
|----|---------|-------|----------|
| **J1** | Sanitization на synthetic (small/medium/stress) → KPI cards | Загрузка пресета, Run, Network delta, Baseline/Final 5% | Неверный конфиг, пустые rows, `from_date > to_date`, oversized |
| **J2** | Sanitization `source=db` через **snapshot** (production-путь, ARCH-01) | `/process` из snapshot, meta `snapshot_*` | Нет файла 503, пустой период/снимок, mid-month custom range, VIEW + tiers 2–3 |
| **J3** | 5%-планировщик: baseline → plan → inspect | Run → hero / at-risk → Inspect sandbox | Target ниже текущего → 422, границы planBounds |
| **J4** | TTS-планировщик (AP KPI) | `/tts-kpi/ap` из snapshot/sql, план минут | `synthetic` → 503, нет snapshot → 503, цель выше текущей → 422 |
| **J5** | TTS Kitchen before/after (в UI «coming soon», endpoint live) | Фиксированное окно, fold/report | Отрицательный cut → 422, SQL read error → 503 |
| **J6** | Boot / health / статический SPA (Docker monolith) | `/health`, `/`, asset, SPA-route | Path traversal, отсутствие `web/dist`, readiness по snapshot |
| **J7** | Ops: refresh snapshot (по A002) | Pull → файл → контейнер читает | Пустой pull, crash, schema mismatch, meta mismatch |
| **J8** | Доступ/аутентификация (появится после A003 P1-1) | 401 без identity, `/health` открыт | N/A сейчас |

---

## 2. Coverage map

Статусы: **Covered** / **Partial** / **Gap**. `—` значит, слоя нет.

| Journey | Unit / pure | API (TestClient) | FE component | E2E | CI | Статус | Evidence |
|---------|-------------|------------------|--------------|-----|----|--------|----------|
| J1 | tiers, pipeline | `test_process_api`, `test_backend_poc` | `SanitizationPage`, `KpiCards`, `ConfigForm` | `sanitization.spec.ts` (3 теста) | да | **Covered** (negative — Partial) | `tests/test_process_api.py:49,88,102`; пустые rows: `test_backend_poc.py:74` проверяет pipeline, а не 422 на API |
| J2 | `build_*_sql`, pushdown parity | `test_snapshot.py:176,205,232`, `test_query_b_phase2` | `SampleDataPanel`, `usePipelineRunner` | **нет** (только synthetic) | да | **Partial** | Custom period = целый месяц (`test_snapshot.py:205-228`, Feb 1–28); **нет mid-month** (A001 A-02); нет VIEW-guard (A-01); нет пустого snapshot |
| J3 | `test_planner_five_percent` | `test_plans_api` | `PlannerPage`, chart-тесты | `planner.spec.ts` (1 smoke) | да | **Covered** | `test_plans_api.py:10,35` |
| J4 | `test_planner_tts`, `test_tts_kpi_ap`, `test_tts_kpi_baseline` | `test_plans_tts_api`, `test_tts_kpi_snapshot.py:83` | `TtsPlannerPage.test.tsx` | **нет** | да | **Partial** | Без e2e и без Docker-проверки snapshot |
| J5 | `test_tts_kitchen_fold/report/queries` | `test_tts_kitchen_api` | `TtsKitchenPage.test.tsx` | — | да | **Covered** (feature gated) | `test_tts_kitchen_api.py:41,72,78` |
| J6 | `test_static_ui` | **нет теста backend `/health`** (`test_health.py` бьёт legacy `api.main`) | `ApiStatusChip` | `API: ok` в e2e (косвенно) | да | **Partial** | `tests/test_health.py:5,10`; `tests/test_static_ui.py:26-44` (traversal нет) |
| J7 | — | refresh TTS: happy (`test_tts_kpi_snapshot.py:104`) | — | — | да | **Gap** | Для Q10012 refresh тестов нет; `schema_version` / empty / crash нет |
| J8 | — | — | — | — | — | **N/A → Gap после auth** | A003 S-02 |

Метрики покрытия: **не измеряются** (нет `pytest-cov`, нет `@vitest/coverage-*` в `web/package.json`).

---

## 3. Сценарии, которые чаще всего валят систему или дают неверный KPI

| # | Сценарий | Почему рискованно | Связь | Покрытие тестом |
|---|----------|-------------------|-------|------------------|
| F-1 | Custom range с середины месяца на snapshot (Query A месяц vs Query B день) | Тихо неверные агрегаты | A001 **A-02** | **Gap** |
| F-2 | Запуск без Docker: дефолт `SANITIZATION_SOURCE=view`, tiers 2–3 «включены» в echo, не применяются | Неверный смысл «Sanitized 5%» | A001 **A-01** | Частично (`test_query_b.py:159,230` фиксируют `blacklist_only`; guard не проверяется) |
| F-3 | Пустой / частичный refresh Q10012 затирает хороший снимок и отдаётся | Тихие нули | A002 **D-04** | **Gap** |
| F-4 | Schema drift / meta mismatch после refresh | Crash на query time | A002 **D-03, D-05** | **Gap** |
| F-5 | Snapshot отсутствует / битый | 503 (ожидаемо) | A002 | **Covered** (`test_snapshot.py:232`, TTS `:73`) |
| F-6 | Path traversal в SPA catch-all | Раскрытие секретов, под root | A003 **S-03** | **Gap** |
| F-7 | Oversized payload (500k строк + `extra=allow`) | DoS | A003 **S-06** | **Gap** |
| F-8 | Нет auth | Утечка данных | A003 **S-02** | N/A сейчас |
| F-9 | VIEW-путь: engine на запрос, нет таймаутов | Зависание threadpool | A001 **A-03** / A002 **D-15** | **Gap** (live SQL в CI нет) |
| F-10 | Hardcoded даты (`ytd_2026`, kitchen окно) после 2027-01-01 | Устаревшая семантика | A001 **A-11** | **Gap** (time-bomb test) |
| F-11 | Docker образ не стартует / не root-safe / нет `/health` | Деплой «зелёный» в CI, красный в проде | INFRA-02, A003 **S-07** | **Gap** (образ в CI не собирается) |

---

## 4. План Smoke & Regression Test Suite

Владельцы указаны ролями и **предложены**; конкретные люди — решение команды (O-1).

| Suite | When | Cases (IDs) | Pass criteria | Owner |
|-------|------|-------------|---------------|-------|
| **CI-Regression (existing)** | Каждый PR в `main` | `RG-E01` pytest all (129); `RG-E02` eslint; `RG-E03` vitest run; `RG-E04` `npm run build`; `RG-E05` Playwright synthetic | Всё зелёное; 0 errors (warnings по CODE-05) | Dev |
| **CI-Regression (new, must-add)** | Каждый PR | `RG-N01` mid-month parity snapshot (J2, F-1); `RG-N02` empty snapshot / 0 rows (F-3); `RG-N03` refresh Q10012: crash/rollback, meta in-transaction (F-4); `RG-N04` `schema_version` mismatch → 503 (F-4); `RG-N05` static path traversal + absolute-style → index/404 (F-6); `RG-N06` oversized / row-cap → 413/422 (F-7); `RG-N07` backend `GET /health` (не `api.main`); `RG-N08` inline `rows=[]` → 422 на API; `RG-N09` VIEW + tiers 2–3 guard (после G-1, F-2) | Все кейсы зелёные; каждый падает до соответствующего фикса | QA + Backend |
| **E2E-DB (new)** | PR + nightly | `RG-N10` Playwright против committed synthetic SQLite (`SANITIZATION_SOURCE=snapshot`): выбор `db`, Run, `meta.sanitization_source=snapshot`; `RG-N11` TTS planner e2e (опционально P1) | KPI cards + источник «snapshot» на экране | QA + FE |
| **Smoke-Pre-Deploy** | Перед выкладкой тега | `SM-01` образ собран (нужен INFRA-02); `SM-02` старт non-root (`id`), `/health` 200 за ≤ start-period; `SM-03` `schema_version` обоих snapshot совпадает; `SM-04` `snapshot_meta.row_count` > порога; `SM-05` возраст `loaded_at` ≤ SLA (O-1 из A002) | Все 5 pass; иначе деплой блокируется | Ops + Backend |
| **Smoke-Post-Deploy** | Сразу после выкладки (≤ 5 мин) | `SM-10` `GET /health` = 200; `SM-11` `GET /` отдаёт HTML; `SM-12` `GET` path-traversal-пробы → 404/index; `SM-13` `POST /api/v1/process` с `source=db`, фиксированный полный месяц → 200, `meta.sanitization_source=snapshot`; `SM-14` `GET /api/v1/tts-kpi/ap` → 200 и непустая панель; `SM-15` (после auth) 401 без токена | Все pass; на fail rollback по runbook | Ops |
| **Manual UAT (минимум)** | Перед first release | `UAT-01` пройти J1, J2, J3, J4 вручную на целевом окружении; `UAT-02` сверить Network delta и Baseline с golden export | Подпись бизнес-владельца KPI | Product / Analyst |

---

## 5. Gap backlog (до релиза)

### Release blocker (минимум для internal launch)

| ID | Gap | Покрывает | Класс | Effort | Условие |
|----|-----|-----------|-------|--------|---------|
| **T-01** | Committed synthetic SQLite snapshot fixture + API-тест `source=db` (empty / normal) | J2, F-3, `RG-N02`, `RG-N10` | **Release blocker** | M | — |
| **T-02** | Mid-month parity test Query A vs B (на snapshot) | F-1, `RG-N01` | **Release blocker** | S | Связан с фиксом A001 A-02 |
| **T-03** | Тесты refresh Q10012 (crash, meta в транзакции, 0 rows, schema_version) | J7, F-3, F-4, `RG-N03/N04` | **Release blocker** | M | Вместе с A002 D-01…D-05 |
| **T-04** | Security regression: traversal, payload limit | F-6, F-7, `RG-N05/N06` | **Release blocker** | S | Вместе с A003 S-03 / S-06 |
| **T-05** | Backend `/health` тест (не legacy) | J6, `RG-N07` | **Release blocker** (дёшево, smoke опирается) | S | — |
| **T-06** | VIEW guard / tier flag тест | F-2, `RG-N09` | **Blocker\*** | S | После решения G-1 |
| **T-07** | Docker image smoke в CI (`SM-01/02`) | F-11 | **Release blocker** (доказательство «deploy health») | M | После INFRA-02 |

### Defer

| ID | Gap | Почему можно отложить |
|----|-----|------------------------|
| **T-08** | Coverage thresholds (`pytest-cov`, vitest coverage) | Метрика, не поведение; ввести после T-01…T-07 |
| **T-09** | Kitchen e2e | Фича в UI «coming soon» |
| **T-10** | Python lint/type (CODE-04) | Нужен Approve на dev-зависимости |
| **T-11** | Time-bomb тест на `ytd_2026` (F-10) | Срок 2027-01-01, можно в P2 |
| **T-12** | Live MSSQL в CI | README: «No live SQL Server in CI»; mitigated T-01 + parity |
| **T-13** | Исправить FE lint warnings (9) и TestClient deprecation (TEST-03) | Низкий риск |

---

## 6. Flaky / stability, рекомендации по CI

| # | Наблюдение | Риск | Рекомендация |
|---|------------|------|--------------|
| ST-1 | E2E: `retries: 2` в CI, `timeout` 60 с в config и `120_000` в spec, `workers: 1` | Ретраи маскируют нестабильность | Репортить flaky-rate; без retries на PR или `--repeat-each` nightly |
| ST-2 | E2E идёт на Vite dev (`npm run dev`, порт 5173) и uvicorn 8001 с `API_CORS_ORIGINS=5173` | Не проверяет prod-бандл и same-origin (Docker, порт 8000) | Добавить e2e/smoke против собранного `web/dist` через backend (`RG-N10` / `SM-*`) |
| ST-3 | Локально e2e с `channel: 'msedge'`, в CI bundled Chromium | Разное окружение | Зафиксировать в `README`/CONTRIBUTING; один браузер для обязательного прогона |
| ST-4 | Ожидания по тексту (`API: ok`, regex `…·\d+ rows`, `Running…`) | Хрупкие к копирайту / i18n | Стабильные `data-testid` (как уже `kpi-network-delta`) |
| ST-5 | Тесты API на `os.environ` / `monkeypatch`; refresh TTS мутирует `os.environ` напрямую (`tts_kpi_snapshot.py:227`, A001 A-05) | **Потенциально**: утечка между тестами | Проверить порядок/изоляцию при random-order прогоне (не запускалось) |
| ST-6 | `lru_cache` у `get_settings` | **Потенциально**: кэш между тестами | Сбрасывать кэш в фикстуре, если тест меняет env |
| ST-7 | CI: ветки `push` включают устаревшие (`feat/react-ui-v2`, `feat/db-sample-2026`); Node 22 в CI vs 20 в Docker; Python 3.12 | Дрейф окружения | INFRA-03/04 |
| ST-8 | `test_health.py` проверяет legacy `api.main` | Ложное чувство покрытия `/health` | Заменить или дополнить (T-05) |

---

## 7. Перепроверка TEST-*

| Seed | Вердикт | Заметка |
|------|---------|---------|
| TEST-01 (сильное unit-покрытие) | **Подтверждено** | 129 backend `def test_`, 72 FE test-файла, e2e в CI. Сильное для чистой логики; не покрывает ops/security/db-путь |
| TEST-02 (регрессионные пробелы) | **Подтверждено, расширено** | Нет coverage-метрик; MSSQL только string-assert; e2e только synthetic; `test_health` — legacy. Добавлено: нет mid-month, нет refresh Q10012, нет traversal/payload, нет Docker smoke |
| TEST-03 (Starlette TestClient deprecation) | **Не перепроверено** | Требует запуска pytest; в audit-run не запускался |

---

## 8. Открытые вопросы

- **O-1.** Кто owner smoke/UAT (имена вместо ролей)?
- **O-2.** Приемлем ли нулевой retry для e2e в PR?
- **O-3.** Формат golden-данных для `UAT-02` (какой export считается эталоном)?

---

## 9. Ограничения

- pytest, vitest, Playwright, Docker **не запускались**; результаты 2026-11-03 взяты из assessment.
- Подсчёт тестов статический (`def test_`), параметризация не раскрыта.
- Frontend страницы читались выборочно; FE-покрытие оценено по именам файлов и `grep` по e2e.
- Устаревший индекс поиска: удалённые тесты исключены по `Test-Path` / `git ls-files`.

---

## Acceptance check (SPEC-A004 §7)

- [x] REPORT-A004: Core Journeys + coverage map (§1–§2).
- [x] Smoke & Regression plan с case IDs и pass criteria (§4).
- [x] Gaps до релиза помечены blocker / defer (§5).
- [x] Assessment TEST-* перепроверены (§7; TEST-03 явно «не перепроверено»).
- [x] README index: A004 → Spec + Report + status.
