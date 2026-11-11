# Оценка готовности к production и технического долга

**Репозиторий:** `Fraud_Fetection_Data_Quality_Sanitization` (`main` @ `cd22d52`, релизы до `v1.30.0-tts-kpi-snapshot`)  
**Дата:** 2026-11-03  
**Объём работ:** только оценка — код приложения не изменялся.  
**Оригинал (EN):** [`production-readiness-assessment-2026-11-03.md`](./production-readiness-assessment-2026-11-03.md)

## Что реально просмотрено и запущено

| Действие | Сделано | Комментарий |
|---|---|---|
| Структура репозитория, git-история, теги, ветки, remotes | Да | 338 отслеживаемых файлов; remote `github.com/Illia-An/...` |
| Backend (`backend/`, `db/`, `api/`, `src/`) | Да, runtime-модули прочитаны целиком | `fraud_guard/tier3.py`, `synthetic.py`, `aggregate.py`, `tts_kitchen/*` — только поверхностно |
| Скрипты (`scripts/refresh_*_snapshot.py`) | Да | Остальные export-скрипты только перечислены |
| Frontend (`web/`) | Частично | `api/`, `providers/`, `schemas/period.ts`, `App.tsx`, e2e, Playwright. Страницы — только по размеру, не построчно |
| Docker, compose, CI, шаблоны env, ignore | Да | |
| `uv run python -m pytest tests/ -q` | Запущено | **129 passed**, 1 deprecation warning |
| `npm run lint` | Запущено | **0 errors, 9 warnings** |
| `npm run test:run` | Запущено | **70 файлов / 290 тестов passed** |
| `npm audit --omit=dev` | Запущено | **4 critical, 1 high** |
| `uv lock --check` | Запущено | Lock согласован с `pyproject.toml` |
| Playwright e2e | **Не запускался** | |
| Docker build / run | **Не запускался** | |
| Скан CVE Python-зависимостей | **Не выполнялся** | В проекте нет сканера; по инструкции ничего не добавлялось |
| Живой SQL Server / AP / DreamFactory | **Не трогались** | |

Находки помечены как **Подтверждено** (есть в коде/выводе), **Потенциально** (рисковый паттерн без доказанного эффекта) или **Рекомендация**.

---

## A. Краткое резюме для руководства

### Текущее архитектурное состояние

Однопроцессный **монолит FastAPI + React (Vite)** для внутренней аналитики: what-if движок очистки опросов Q10012 («5% top-box»), два KPI-планировщика (five_percent и TTS в минутах) и экран kitchen TTS before/after, который в UI пока помечен как «coming soon». Весь доступ к данным — **только чтение**. В Docker приложение читает **два локальных SQLite-снимка**, которые вручную готовят refresh-скрипты на хосте с доступом к SQL Server; сам контейнер к SQL Server достучаться не может (в образе нет ODBC-драйвера).

### Общее техническое здоровье

**Хороший MVP, к production не готов.** Ядровая доменная логика — чистая, хорошо прокомментированная и хорошо покрыта тестами. Пробелы почти целиком в «производственной оболочке»: безопасность, работа с ПДн, наблюдаемость, эксплуатация и несколько shortcut’ов, влияющих на корректность цифр.

### Главные сильные стороны

- Чёткое разделение чистой доменной логики (`src/fraud_guard`, `src/planner`, `src/tts_kitchen`) и HTTP-слоя (`backend/`).
- Сильные автотесты: 129 backend, 290 frontend unit, Playwright e2e в CI — всё зелёное.
- Параметризованный SQL; имена view/table из env проверяются regex’ами идентификаторов (`planner/tts_kpi_ap.qualify_table`, `tts_kitchen_queries._require_view_name`).
- Явный design Query A / Query B (pushdown без вытягивания всех сырых строк периода) + тесты паритета KPI (`tests/test_query_b.py`, `tests/test_query_b_phase2.py`).
- Гигиена секретов в рабочем дереве хорошая: `.env*` в `.gitignore` и не в git; сообщения об ошибках намеренно не утекают URL/ключами (`backend/tts_kpi_ap.py`).
- Zod-схемы на фронте зеркалят Pydantic-контракты и валидируют каждый ответ API.

### Главные слабости

- **Нет аутентификации и авторизации** ни на одном endpoint.
- **ПДн:** сырые телефоны в закоммиченных outputs ноутбуков; сырые ПДн в plaintext SQLite; хеширование без соли.
- **Бизнес-результат зависит от источника данных:** путь через SQL Server VIEW гоняет только blacklist; путь через snapshot — все правила. Один и тот же API — разные KPI.
- **Операции вручную:** refresh снимков, деплой, rollback, контроль свежести — всё людьми, без процедур.
- **Наблюдаемость минимальна:** нет конфигурации логирования, нет метрик, health только «живой процесс».

### Крупнейшие production-риски

1. ПДн уже в git-истории, запушенной на GitHub (SEC-01).
2. Неаутентифицированный API отдаёт данные, производные от ПДн, на контейнере в LAN (SEC-02, SEC-04).
3. Стейкхолдеры видят разный «sanitized 5%» в зависимости от env-переменной деплоя (ARCH-01).
4. Устаревшие данные без детекции: снимки обновляют руками, нет алерта по свежести, даты захардкожены (DATA-04, ARCH-09).

---

## B. Обзор архитектуры

### Стек

| Слой | Технологии | Доказательство |
|---|---|---|
| Backend | Python 3.12, FastAPI, Pydantic v2, pandas, SQLAlchemy 2, pyodbc, httpx | `pyproject.toml`, `.python-version` |
| Research-зависимости в runtime | scikit-learn, openpyxl | `pyproject.toml` `dependencies` |
| Frontend | React 19, Vite 6, MUI 6, TanStack Query/Table, Zustand, Zod 3, Plotly 3, react-router 7 | `web/package.json` |
| Источники данных | VIEW `dbo.TargetsByMetrics_RateGetAnswers`; MC `dbo.TargetsByMetrics_McKitiBump`; AP `AP.dbo.T_KPITrendAlerts` (SQL или DreamFactory); локальные SQLite | `backend/db_sample.py`, `backend/tts_kitchen_queries.py`, `src/planner/tts_kpi_ap.py` |
| Упаковка | uv + hatchling; Docker multi-stage (node 20 → python 3.12-slim) | `Dockerfile` |
| CI | GitHub Actions: pytest, eslint, vitest, vite build, Playwright | `.github/workflows/ci.yml` |

### Компоненты

```text
web/ (React SPA)  ──fetch──►  backend/main.py (FastAPI, create_app)
                                 │
   ┌─────────────────────────────┼───────────────────────────────┬──────────────────────┐
   │ /api/v1/process             │ /api/v1/plans, /plans-tts     │ /api/v1/tts-kpi/ap   │ /api/v1/tts-kitchen/before-after
   ▼                             ▼                               ▼                      ▼
backend/service.py          src/planner/five_percent.py    backend/tts_kpi_ap.py   backend/tts_kitchen_service.py
 run_pipeline (inline)      src/planner/tts.py              ├ snapshot (SQLite)     └ tts_kitchen_queries.py (MSSQL only)
 run_pipeline_pushdown(db)  (pure, stateless)               ├ sql (MSSQL)              src/tts_kitchen/{fold,report}.py
   │                                                        └ dreamfactory (HTTP)
   ├ backend/queries.py  Query A (aggregates) + Query B (candidates)
   ├ backend/db_sample.py  period filters, PII redaction, engine selection
   ├ backend/snapshot.py   SQLite Q10012 snapshot
   └ src/fraud_guard/tier1.py, tier2.py  (pure pandas rules)

backend/static_ui.py  ── SPA catch-all serving web/dist (Docker monolith)
api/main.py           ── legacy second FastAPI app (health only, port 8000)
scripts/refresh_*     ── manual SQL Server / AP → SQLite full reloads
notebooks/            ── research (tracked, with outputs)
```

### Основные потоки данных

1. **Sanitization, `source=db`** (`backend/main.py` `process`):
   `_process_engine()` выбирает VIEW (MSSQL) или SQLite snapshot по `SANITIZATION_SOURCE` → Query A возвращает итоги store×month → Query B возвращает только строки-кандидаты → ПДн хешируются в `redact_row` → `run_pipeline_pushdown` вычитает drop’ы кандидатов из ячеек Query A → Tier 4 на агрегатах → `SanitizationResponse` (только агрегаты, без строк).
2. **Sanitization, inline:** браузер берёт синтетику с `/sample/{preset}`, шлёт обратно в `/process` → `run_pipeline` гоняет все tiers в pandas.
3. **Планировщики:** браузер шлёт baseline (из sanitization или TTS panel) → чистая функция аллокации → проекции. На сервере ничего не сохраняется; UI держит состояние в `sessionStorage` (`web/src/store/sessionPersist.ts`).
4. **Refresh снимков (вне процесса):** разработчик запускает `scripts/refresh_q10012_snapshot.py` / `refresh_tts_kpi_snapshot.py` на хосте с доступом к SQL Server; файлы монтируются в контейнер read-only.

### Персистентность

**Прикладной БД «источника истины» нет.** Пишутся только SQLite-снимки (скриптами) и браузерный `sessionStorage`.

---

## C. Реестр технического долга

**Severity:** Critical / High / Medium / Low.  
**Effort:** S (≤1 дня), M (2–5 дней), L (1–3 недели), XL (>3 недель).

### Безопасность

**SEC-01 — Сырые телефоны в outputs ноутбуков** *(Подтверждено)*

- **Описание:** `notebooks/03_tier3_experiments.ipynb` содержит 15 отрисованных строк DataFrame, где entity key = `c:<мобильный номер>` — нехешированные контакты. Есть с первого коммита `c4c5fb4` и уже запушено на GitHub remote.
- **Доказательства:** `git grep -E "\b05[0-9]-?[0-9]{7}\b" notebooks/03_tier3_experiments.ipynb` → строки 149–155, 294–298 (значения при обзоре маскировались). Все четыре notebooks закоммичены с outputs (17/14/6/4 ячеек с выводом).
- **Impact:** утечка ПДн всем с доступом к репо, включая forks/клоны; вероятно инцидент по персональным данным в зависимости от видимости репо.
- **Likelihood:** уже произошло. **Severity:** Critical.
- **Рекомендуемое действие:** уточнить видимость репо и кто клонировал; убрать outputs; вычистить историю (`git filter-repo`) с согласованным force-push (нужно явное одобрение владельца — переписывает `main`); pre-commit hook или CI-проверка на outputs; так же просканировать остальные notebooks и `docs/`.
- **Effort:** M. **Dependencies:** решение owner/legal по rewrite истории. **Confidence:** High.

**SEC-02 — Нет аутентификации и авторизации** *(Подтверждено)*

- **Описание:** нет auth dependency, middleware или проверки API key ни на одном маршруте. Контейнер слушает `0.0.0.0:8000` (`Dockerfile` CMD); README описывает LAN-использование.
- **Доказательства:** маршруты в `backend/main.py` без `Depends`/security; grep по `auth|token|Depends(` в `backend/` находит только исходящий DreamFactory key.
- **Impact:** любой в сети может читать KPI по опросам, store-level результаты, AP KPI и запускать тяжёлые запросы к production SQL Server (когда `SANITIZATION_SOURCE=view`).
- **Likelihood:** High при деплое шире одного ноутбука. **Severity:** High.
- **Рекомендуемое действие:** поставить приложение за SSO организации (reverse proxy с OIDC или FastAPI dependency с проверкой токенов). Решить, нужен ли доступ по ролям (открытый вопрос G-2).
- **Effort:** M. **Dependencies:** выбор identity provider. **Confidence:** High.

**SEC-03 — Сырые ПДн в plaintext SQLite snapshot** *(Подтверждено)*

- **Описание:** таблица `answers` хранит `UserContact` и `PhoneFromLog` как сырой текст; хеширование только после чтения. Локальный файл ~190 MB.
- **Доказательства:** `backend/snapshot.py` `_SCHEMA_SQL`; `scripts/refresh_q10012_snapshot.py` строки 163–164 вставляют сырые значения; docstring модуля: «PII may be stored locally».
- **Impact:** потеря ноутбука/хоста или компрометация контейнера = полная утечка ПДн; противоречит смыслу SPEC Invariant 1 («hash before grouping»).
- **Likelihood:** Medium. **Severity:** High.
- **Рекомендуемое действие:** хешировать (с ключом, см. SEC-04) уже на refresh, чтобы снимок никогда не держал сырые ПДн. SQLite CASE для entity key в `backend/queries.py` тогда работает на хешах — поведение сохраняется, т.к. для группировки нужна только equality.
- **Effort:** S–M. **Dependencies:** SEC-04 (выбрать схему хеша один раз). **Confidence:** High.

**SEC-04 — Псевдонимизация телефонов через SHA-256 без соли** *(Паттерн подтверждён / эффект потенциальный)*

- **Описание:** `hash_pii_value` — обычный SHA-256, обрезанный до 32 hex-символов. Пространство телефонов достаточно мало для перебора → хеши обратимы.
- **Доказательства:** `src/fraud_guard/pii.py` строка 25.
- **Impact:** сейчас `/process` хеши не отдаёт (только агрегаты), поэтому экспозиция ограничена памятью и будущими логами/экспортами. Становится существенным, если hashed keys экспортируются (напр. `scripts/export_always5_entities.py` — глубоко не разбирался).
- **Likelihood:** Low сегодня. **Severity:** Medium.
- **Рекомендуемое действие:** перейти на HMAC-SHA256 с секретным pepper из env. Длину 32 символа сохранить, чтобы контракты не менялись.
- **Effort:** S. **Dependencies:** раздача секретов. **Confidence:** High по паттерну.

**SEC-05 — SPA catch-all без проверки границ пути** *(Потенциально)*

- **Описание:** `spa_fallback` отдаёт `root / full_path`, если это файл, без проверки, что resolved path остаётся внутри `root`. У Starlette `StaticFiles` такая проверка есть; у кастомного handler — нет.
- **Доказательства:** `backend/static_ui.py` строки 38–43.
- **Impact:** если путь с сегментами `..` дойдёт до handler без нормализации, могут отдаться произвольные читаемые файлы контейнера (включая смонтированные snapshot). В рамках обзора не эксплуатировалось и не тестировалось.
- **Likelihood:** неизвестна (зависит от нормализации сервером/прокси). **Severity:** High, если эксплуатируемо.
- **Рекомендуемое действие:** resolve кандидата и требовать `candidate.resolve().is_relative_to(root)`, либо `StaticFiles(html=True)` + fallback 404→index. Добавить регрессионный тест с encoded `..`.
- **Effort:** S. **Dependencies:** нет. **Confidence:** Medium.

**SEC-06 — Уязвимые frontend-зависимости** *(Подтверждено)*

- **Описание:** `npm audit --omit=dev`: `maplibre-gl` (critical XSS, через `plotly.js`), `seroval`/`solid-js` (critical, через `@tanstack/react-query-devtools`), `zod <4.6.6` (high, memory exhaustion).
- **Доказательства:** вывод audit; `web/package.json`.
- **Impact:** практическая эксплуатируемость выглядит низкой: devtools рендерятся только при `import.meta.env.DEV` (`web/src/providers/AppProviders.tsx`), maplibre нужен Plotly map-трейсам (не наблюдались), Zod работает client-side на доверенных ответах API. Тем не менее — compliance-блокер на большинстве production gates.
- **Likelihood:** Low. **Severity:** Medium.
- **Рекомендуемое действие:** перенести `@tanstack/react-query-devtools` в `devDependencies`; оценить Plotly 4 / `plotly.js-basic-dist` (без maplibre); миграцию Zod 4 планировать отдельно (breaking).
- **Effort:** S (devtools) / M (Plotly) / M (Zod). **Confidence:** High.

**SEC-07 — Нет лимитов размера запросов на неаутентифицированных endpoint** *(Подтверждено)*

- **Описание:** `ProcessRequest.rows` допускает до 500 000 строк, у `SurveyAnswerRow` стоит `extra="allow"`; у plan `baseline_rows` нет верхней границы; на уровне сервера нет body-size limit.
- **Доказательства:** `backend/schemas.py` строки 70, 100; `backend/tts_plan_schemas.py` строка 42; `backend/plan_schemas.py`.
- **Impact:** один запрос может исчерпать память/CPU единственного процесса (DoS).
- **Likelihood:** Medium вместе с SEC-02. **Severity:** Medium.
- **Рекомендуемое действие:** снизить `max_length` до нужд UI (крупнейший synthetic preset), поставить `extra="ignore"` или ограничить extra fields, ограничить `baseline_rows`, задать body limit на прокси.
- **Effort:** S. **Dependencies:** подтвердить максимумы UI. **Confidence:** High.

**SEC-08 — Контейнер работает от root** *(Подтверждено)*

- **Доказательства:** в `Dockerfile` нет директивы `USER`.
- **Impact/Severity:** Low–Medium (усиливает SEC-05).
- **Действие:** добавить non-root user. **Effort:** S. **Confidence:** High.

### Архитектура и дизайн

**ARCH-01 — Результат очистки зависит от источника данных** *(Подтверждено, намеренно, но пользователям не видно)*

- **Описание:** при `SANITIZATION_SOURCE=view` (SQL Server) Query B — «blacklist only»; frequency (tier 2) и always-5 (tier 3) молча пропускаются, даже если включены в запросе. При `snapshot` работают все tiers. Один и тот же UI/config даёт разный «final 5%».
- **Доказательства:** `backend/queries.py` `query_b_mode_for_dialect` (строка 276); `backend/service.py` строки 475, 510, 522 (`tiers_23_on_candidates and ...`); `tests/test_query_b_phase2.py::test_mssql_v1_still_blacklist_only_no_freq` это закрепляет; SPEC §5.2 документирует как v1.
- **Impact:** несогласованность бизнес-KPI между окружениями; переключатели tiers выглядят рабочими, но на VIEW-пути не действуют.
- **Likelihood:** High, если production использует VIEW. **Severity:** High.
- **Рекомендуемое действие:** бизнес-решение (G-1). Варианты: (a) production только snapshot/физические таблицы, VIEW mode выключен; (b) 422 или видимое предупреждение, когда tiers 2–3 включены на VIEW; (c) физические таблицы под DBA по SPEC §5.4.
- **Effort:** S для (a)/(b), L для (c). **Confidence:** High.

**ARCH-02 — Разный гранулярность периода Query A и Query B на snapshot** *(Подтверждено в коде; масштаб не измерен)*

- **Описание:** на SQLite Query A читает предзагрегированный `store_month`, фильтруя по **календарному месяцу**, а Query B фильтрует `answers` по **дню** (`AnswerTime`). При mid-month `from_date`/`to_date` Query A включает весь месяц, а drop’ы вычитаются только за частичный диапазон.
- **Доказательства:** docstring `_store_month_period_clause` в `backend/queries.py` (строки 119–123) vs `_period_params` в `backend/db_sample.py`; UI шлёт mid-month даты для `ytd_2026` (`to_date` = сегодня) и custom ranges (`web/src/schemas/period.ts`).
- **Impact:** baseline и sanitized % считаются по разным популяциям на граничных месяцах. Для `ytd_2026` эффект мал (будущих дней нет); для custom ranges может быть существенным.
- **Likelihood:** Medium. **Severity:** Medium.
- **Рекомендуемое действие:** либо ограничить snapshot-даты границами месяцев, либо считать Query A из `answers` для частичных граничных месяцев. Добавить parity-тест с mid-month диапазоном.
- **Effort:** S–M. **Confidence:** High по механизму.

**ARCH-03 — Конфигурация размазана и противоречива** *(Подтверждено)*

- **Описание:** env читаются напрямую через `os.environ.get` минимум в 7 модулях; `load_dotenv` вызывается в `backend/main.py`, `db/config.py`, `api/main.py` и скриптах; дефолты расходятся (CORS `5173,4201` в `backend/main.py` vs `4200` в `db/config.py` и `api/main.py`). `db/config.get_settings()` падает, если `DATABASE_URL` пуст, даже когда нужен только `TTS_DATABASE_URL` (`backend/tts_kitchen_queries.py` строка 176). Скрипты мутируют `os.environ` в runtime (`refresh_tts_kpi_snapshot` строка 227).
- **Impact:** трудно понять эффективный конфиг деплоя; misconfiguration проявляется только в момент запроса.
- **Severity:** Medium. **Рекомендуемое действие:** один typed settings-объект при старте, с валидацией и логом (без секретов). **Effort:** M. **Confidence:** High.

**ARCH-04 — Engine создаётся на каждый запрос; нет таймаутов и гигиены пула** *(Паттерн подтверждён / эффект потенциальный)*

- **Описание:** `db.connection.get_engine()` и `get_tts_engine()` вызывают `create_engine` на каждый запрос; Q10012 snapshot engine тоже пересоздаётся на каждый вызов (`require_snapshot_engine`) и никогда не dispose (TTS-пути dispose делают). Нет `pool_pre_ping`, нет query/login timeouts на SQL Server.
- **Доказательства:** `db/connection.py`; `backend/db_sample.py` `_engine_from_settings`; `backend/snapshot.py` `require_snapshot_engine`.
- **Impact:** churn соединений к SQL Server, нет reuse, пулы живут до GC; медленный VIEW-запрос может держать worker thread бесконечно.
- **Severity:** Medium (High, если VIEW mode в production). **Действие:** кэшировать один engine на URL на время жизни процесса, dispose на shutdown (FastAPI lifespan), задать ODBC/statement timeouts. **Effort:** S–M. **Confidence:** High.

**ARCH-05 — Дрейф имён tier между модулями и шагами пайплайна** *(Подтверждено)*

- **Описание:** `fraud_guard/tier1.py` реализует pipeline tiers 1–3; `fraud_guard/tier2.py` — pipeline tier 4; `fraud_guard/tier3.py` — research IsolationForest, не используется API. Legacy-ключи конфига мигрируются в `src/schemas/pipeline.py`.
- **Impact:** дорогой onboarding и риск подключить не то правило. **Severity:** Medium. **Действие:** переименовать/реэкспортировать модули под шаги пайплайна, сохранив старые import path как aliases. **Effort:** M. **Confidence:** High.

**ARCH-06 — Research-зависимости грузятся в API-процесс** *(Подтверждено)*

- **Описание:** `src/fraud_guard/__init__.py` импортирует `tier3`, который тянет scikit-learn. Любой `from fraud_guard.x import ...` в backend (напр. `fraud_guard.synthetic`, `fraud_guard.pii`) выполняет package `__init__`, поэтому sklearn грузится при старте API. `scikit-learn` и `openpyxl` — runtime dependencies, хотя нужны только `tier3.py` и скриптам.
- **Impact:** больше образ, медленнее старт, шире attack surface зависимостей. **Severity:** Low–Medium. **Действие:** сделать `__init__` lazy или перестать реэкспортировать tier3; вынести sklearn/openpyxl/matplotlib в optional `research` extra. **Effort:** S. **Confidence:** High.

**ARCH-07 — Дрейф packaging и манифестов** *(Подтверждено)*

- **Описание:** в `pyproject.toml` wheel packages перечислены `src/tts_guard` и `src/tts_order_bump`, которых больше нет (удалены в «product trim», `3df409e`). `backend/requirements.txt` не содержит `sqlalchemy`, `pyodbc`, `httpx`, `openpyxl`. Top-level имена пакетов `schemas`, `planner`, `db`, `backend` — слишком общие и склонны к коллизиям. Приложение сообщает версию `0.1.0`, тогда как релизы тегированы до `v1.30.0`.
- **Impact:** запутанные сборки; установка через `requirements.txt` ломается; версия в `/health` бесполезна для triage инцидентов. **Severity:** Low–Medium. **Действие:** убрать stale entries, удалить или пересобрать `requirements.txt`, single-source версию. **Effort:** S. **Confidence:** High (влияние отсутствующих hatch paths на builds не проверялось).

**ARCH-08 — Legacy второе API** *(Подтверждено)*

- **Описание:** `api/main.py` — отдельное FastAPI-приложение только с `/api/v1/health`; всё ещё в README и покрыто `tests/test_health.py`.
- **Severity:** Low. **Действие:** удалить после подтверждения отсутствия потребителей (G-6). **Effort:** S.

**ARCH-09 — Захардкоженные бизнес-даты** *(Подтверждено)*

- **Описание:** окно kitchen `2026-09-01..2026-10-20` (`backend/tts_kitchen_queries.py` строки 24–25); `DEFAULT_FROM_DATE = 2025-01-01` (`backend/db_sample.py`); UI preset `ytd_2026` хардкодит `2026-01-01` (`web/src/schemas/period.ts`).
- **Impact:** 2027-01-01 «2026 YTD» станет прошлым диапазоном с вводящей в заблуждение подписью; kitchen-данные никогда не сдвигаются. **Severity:** Medium. **Действие:** выводить из текущей даты или конфига. **Effort:** S. **Confidence:** High.

**ARCH-10 — `_private` хелперы используются между модулями** *(Подтверждено)*

- **Доказательства:** `backend/queries.py` импортирует `_period_params`, `_process_engine` из `backend/db_sample.py`; `scripts/refresh_q10012_snapshot.py` импортирует `_engine_from_settings`. Есть function-local imports против circular imports (`backend/db_sample.py` строки 242, 256, 265).
- **Severity:** Low. **Действие:** выделить небольшой модуль `data_access` с публичными функциями. **Effort:** S–M.

### Качество кода и сопровождаемость

**CODE-01 — Дублирование логики planner и snapshot** *(Подтверждено)*

- **Доказательства:** `src/planner/tts.py` почти построчно зеркалит `src/planner/five_percent.py` с перевёрнутым знаком; `backend/main.py` дублирует маппинг plan→response для обоих планировщиков (строки 386–406 vs 435–455); `backend/snapshot.py` vs `backend/tts_kpi_snapshot.py` дублируют path resolution, meta R/W и engine setup. Frontend страницы `PlannerPage.tsx` (1 221 строк) и `TtsPlannerPage.tsx` (1 163 строк) выглядят параллельными реализациями (только размеры; diff не делался).
- **Impact:** фиксы нужно вносить дважды; дрейф уже виден (TTS валидирует `floor >= ceiling`, five_percent — нет). **Severity:** Medium. **Действие:** вынести direction-aware allocator, общий для обоих планировщиков, под существующими тестами. **Effort:** M. **Confidence:** High (backend), Medium (frontend).

**CODE-02 — Крупные модули с несколькими ответственностями** *(Подтверждено)*

- **Доказательства:** `backend/main.py` определяет все маршруты внутри `create_app` (460 строк); `backend/service.py` 645 строк; frontend `StoreAuditDrawer.tsx` 823, `HeroSimulationChart.tsx` 691 строк.
- **Severity:** Medium. **Действие:** разнести маршруты по `APIRouter` на домен (sanitization, planners, tts); без смены поведения. **Effort:** M.

**CODE-03 — Повторный хеш ПДн на каждом tier-шаге** *(Подтверждено)*

- **Описание:** `_prepare_tier_frame` вызывает `ensure_pii_hashed` в каждом `apply_*_tier`; пайплайн вызывает три таких подряд, а pushdown-путь уже хешировал в `redact_row`. Значения хешируются 2–4 раза. Результаты стабильны, потому что все строки шага получают одинаковое число хешей, но это противоречит docstring («call once at pipeline entry») и тратит CPU.
- **Доказательства:** `src/fraud_guard/tier1.py` строки 204–213, 216–255; `src/fraud_guard/pii.py` строки 28–36; `backend/service.py` строки 493–526.
- **Impact:** скрытая ловушка корректности, если будущий код смешает строки разных шагов или сравнит с внешне захешированными ключами. **Severity:** Low–Medium. **Действие:** хешировать один раз на входе и передавать уже подготовленный frame. **Effort:** S. **Confidence:** High.

**CODE-04 — Нет Python static analysis в CI** *(Подтверждено)*

- **Доказательства:** нет конфигурации ruff/flake8/mypy/pyright в `pyproject.toml` или `ci.yml`; нетипизированные `apply_fn` и `# type: ignore` в `backend/service.py`.
- **Severity:** Low–Medium. **Действие:** добавить ruff + type checker как dev tools (нужно одобрение новых dev deps). **Effort:** S.

**CODE-05 — Frontend lint warnings** *(Подтверждено)*

- **Доказательства:** 9 warnings, включая `react-hooks/exhaustive-deps` на трёх страницах.
- **Severity:** Low. **Действие:** исправить или обосновать; затем падать в CI на warnings. **Effort:** S.

### Слой данных

**DATA-01 — Refresh snapshot in-place и без валидации** *(Подтверждено)*

- **Описание:** оба refresh-скрипта делают `DELETE` и re-insert внутри живого файла (одна транзакция — хорошо), без write-to-temp-and-swap, без бэкапа предыдущей версии и без валидации (row count vs source, минимум строк) до того, как новые данные станут видимы.
- **Доказательства:** `scripts/refresh_q10012_snapshot.py` строки 147–180; `backend/tts_kpi_snapshot.py` строки 260–283.
- **Impact:** частичный/пустой pull из источника (VIEW вернул 0 строк) молча затирает хорошие данные; длинная write-транзакция блокирует readers в работающем контейнере. **Severity:** Medium. **Действие:** писать в `*.tmp`, валидировать, затем atomic rename (важно: single-file bind mount фиксирует inode — лучше монтировать каталог `data/`). Хранить N предыдущих файлов. **Effort:** S–M. **Confidence:** High.

**DATA-02 — Нет стратегии миграций схемы snapshot** *(Подтверждено)*

- **Доказательства:** только `CREATE TABLE IF NOT EXISTS` (`backend/snapshot.py`, `backend/tts_kpi_snapshot.py`); в `snapshot_meta` нет schema version.
- **Impact:** добавление колонки не применится к существующим файлам; приложение упадёт на query time. Смягчается полным reload. **Severity:** Low. **Действие:** писать ключ `schema_version` и проверять в `require_*_snapshot_engine`. **Effort:** S.

**DATA-03 — Индексация под Query B phase 2** *(Потенциально)*

- **Доказательства:** индексы `answers`: `(AnswerTime)`, `(BlackList, AnswerTime)`, `(PrintStore, Year, Month)` (`backend/snapshot.py`). Query B phase 2 фильтрует по `Question_ID` + `AnswerTime` и группирует по вычисляемому entity key за весь период. Тайминги не измерялись.
- **Severity:** Low. **Действие:** решать по существующей telemetry `db_query_b_time_ms`; рассмотреть precomputed колонку `entity_key` на refresh. **Effort:** S.

**DATA-04 — Нет enforcement свежести** *(Подтверждено)*

- **Описание:** `loaded_at` snapshot показывается в meta, но ничего не алертит и не блокирует при устаревании. Docker `HEALTHCHECK` бьёт в `/health`, который возвращает статический `{"status":"ok"}`.
- **Доказательства:** `backend/schemas.py` `HealthResponse`; `Dockerfile` `HEALTHCHECK`.
- **Severity:** Medium. **Действие:** readiness endpoint с наличием snapshot, возрастом и row counts; алерт выше порога. **Effort:** S.

**DATA-05 — Нет persistence планов или прогонов** *(Подтверждено; возможно by design)*

- **Описание:** планы и конфиги sanitization живут только в браузерном `sessionStorage`; нет audit trail, какие пороги дали какую опубликованную цифру.
- **Severity:** зависит от G-4. **Effort:** L, если потребуется.

N+1 запросов: **не найдено**. Каждый endpoint делает максимум два запроса (Query A + B) или один (kitchen, TTS).

### Производительность и масштабируемость

**PERF-01 — Глобальный `tracemalloc` на каждый вызов `/process`** *(Подтверждено)*

- **Описание:** `profile_block` стартует/останавливает process-global `tracemalloc` на каждый запрос. FastAPI гоняет sync endpoints в thread pool, поэтому concurrent-запросы делят tracing state: один запрос может остановить tracing, пока другой измеряет, и все потоки платят overhead аллокаций tracemalloc, пока любой запрос в полёте.
- **Доказательства:** `backend/profiler.py` строки 31–51; `backend/main.py` строка 266.
- **Impact:** медленнее `/process`, ненадёжный `peak_memory_mb` под concurrency. **Severity:** Medium. **Действие:** оставить wall-clock timing; `tracemalloc` — за debug-флагом. **Effort:** S. **Confidence:** High по механизму; overhead не измерялся.

**PERF-02 — Построчные pandas-циклы на inline-пути** *(Подтверждено)*

- **Доказательства:** `backend/service.py` `_build_store_impact_series._lookup` фильтрует весь panel для каждой ячейки × 4 стадии (квадратично по store×month); `iterrows` в `_drop_counts_by_cell` и `_store_month_cells`; list comprehension по всем строкам в `tier2.apply_tier2` строка 111.
- **Severity:** Low (synthetic presets маленькие). **Действие:** заменить merges/groupby, если inline-объёмы вырастут. **Effort:** S.

**PERF-03 — Неограниченный результат Query B на VIEW-пути** *(Потенциально)*

- **Описание:** VIEW-mode Query B грузит в память все non-customer-segment строки периода, затем pandas. Нет row cap, нет timeout (см. ARCH-04).
- **Severity:** Medium, если используется VIEW. **Действие:** timeouts + потолок строк с 422/503 и понятным сообщением. **Effort:** S.

**PERF-04 — Нет кэша детерминированных snapshot-результатов** *(Рекомендация)*

Данные snapshot меняются раз за refresh; одинаковые запросы `(config, period)` можно мемоизировать по ключу `loaded_at`. **Effort:** S–M. Имеет смысл только если latency — жалоба.

Модель concurrency: один uvicorn-процесс, без `--workers`, sync handlers на дефолтном thread pool. Для небольшой внутренней аудитории достаточно; разделяемого мутабельного состояния нет, кроме PERF-01.

### Наблюдаемость и надёжность

**OBS-01 — Нет конфигурации логирования** *(Подтверждено)*

- **Описание:** backend никогда не конфигурирует logging. У application loggers (`backend.*`) нет handlers; INFO (напр. «Mounted frontend SPA») теряется, а `logger.exception` уходит в last-resort stderr Python без timestamp и контекста. Нет request ID, нет structured format.
- **Доказательства:** нет `basicConfig`/`dictConfig` в `backend/`, `db/`, `src/`; скрипты logging конфигурируют.
- **Severity:** High для production. **Действие:** настроить logging при старте (JSON в stdout), request-ID middleware, логировать route, status и duration. Сохранить правило «no PII in logs». **Effort:** S–M.

**OBS-02 — Нет error tracking и метрик** *(Подтверждено)*

Нет Sentry/OpenTelemetry/Prometheus. Полезная telemetry из `meta` (`execution_time_ms`, `db_query_*_time_ms`) доходит только до браузера.
- **Severity:** Medium. **Действие:** сначала эмитить как server-side logs/metrics; добавить tracker после выбора платформы (G-5). **Effort:** M.

**OBS-03 — Только liveness; нет readiness и lifecycle hooks** *(Подтверждено)*

`/health` статичен; нет FastAPI lifespan для валидации при старте и dispose engine. uvicorn по умолчанию корректно обрабатывает SIGTERM — для stateless-запросов этого достаточно.
- **Severity:** Medium. **Действие:** см. DATA-04; добавить lifespan для валидации конфига + cleanup engine. **Effort:** S.

Обработка ошибок в целом здравая: DB → 503 с generic message, validation → 422, unexpected → 500 с `logger.exception` (`backend/main.py` строки 352–360, 476–487).

### Инфраструктура и деплой

**INFRA-01 — Контейнер не достаёт до SQL Server; production data path — ручной snapshot** *(Подтверждено)*

- **Описание:** в runtime-образе нет ODBC-драйвера (`python:3.12-slim` без `msodbcsql`/`unixodbc`), поэтому режимы `view`, `sql` и kitchen в Docker не работают. Данные попадают только через человека, запускающего refresh-скрипты на хосте с VPN/Trusted Connection.
- **Доказательства:** `Dockerfile`; раздел README «Docker»; `.env.docker.example`.
- **Impact:** single point of failure (один человек/хост), нет расписания, устаревание данных. **Severity:** High. **Действие:** решить целевой data path (G-3). Краткосрочно: scheduled refresh с алертами; долгосрочно: физические таблицы под DBA (SPEC §5.4) или service account из контейнера. **Effort:** M–L.

**INFRA-02 — Нет deploy pipeline, релиза и процедуры rollback** *(Подтверждено)*

- **Описание:** CI тестирует, но не собирает Docker-образ, не сканирует и не публикует его. Деплой — `docker compose build && up` на хосте; тег образа всегда `:local`. Rollback = пересборка старого git tag.
- **Доказательства:** `.github/workflows/ci.yml`, `docker-compose.yml`, README.
- **Severity:** High. **Действие:** CI job, который собирает образ, тегирует git tag/SHA, пушит в registry; деплой по тегу; rollback документировать как «redeploy previous tag». **Effort:** M.

**INFRA-03 — Несогласованность окружений** *(Подтверждено)*

CI использует Node 22, Dockerfile — Node 20. CI push только для `main`, `feat/react-ui-v2`, `feat/db-sample-2026` (две из них stale). `uv` pinned на `0.6.14` в Docker, в CI — нет. Правила проекта просят Python 3.13+, проект на 3.12 (`.python-version`, `requires-python >=3.12`).
- **Severity:** Low–Medium. **Действие:** выровнять Node; урезать список веток CI; решить версию Python. **Effort:** S.

**INFRA-04 — Гигиена репозитория** *(Подтверждено)*

В git лежит Word lock-файл: `docs/tts_full_view_for_proj/~$cument 2. Technical Specification.docx`. Неотслеживаемый leftover `frontend/` с `node_modules`. 48 локальных веток (44 merged). В корне — planning docs (`TASKS.md`, `SPEC-*.md`, `COLUMN_AUDIT_*.md`).
- **Severity:** Low. **Действие:** убрать lock-файл, почистить merged-ветки, перенести planning docs в `docs/`. **Effort:** S.

**INFRA-05 — Нет backup/restore для snapshot** *(Подтверждено)*

Снимки пересобираемы из источника, поэтому потеря — downtime, а не data loss, пока source доступен. См. DATA-01 про хранение предыдущих версий.

### Тестирование

**TEST-01 — Сильное unit-покрытие чистой логики** *(Подтверждённая сильная сторона)*

129 backend-тестов покрывают tiers, pushdown parity, query builders, snapshot, TTS, kitchen, API contracts; 290 frontend-тестов; Playwright e2e для sanitization и planner.

**TEST-02 — Пробелы в регрессионной защите** *(Подтверждено)*

- Нет измерения coverage (нет `pytest-cov`/vitest coverage thresholds в CI).
- MSSQL SQL только string-assert’ится; в CI не исполняется (README: «No live SQL Server in CI»).
- Нет security regression tests (path traversal, payload size, auth).
- E2E покрывает только synthetic presets; нет e2e для `source=db` через snapshot fixture, TTS planner или Docker image.
- Нет теста mid-month boundary (ARCH-02).
- `tests/test_health.py` тестирует legacy `api/`, не `backend.main` `/health` (backend health покрыт косвенно).
- **Severity:** Medium. **Действие:** добавить маленький закоммиченный synthetic SQLite snapshot fixture и гонять e2e/Docker smoke против него; добавить перечисленные регрессионные тесты. **Effort:** M.

**TEST-03 — Deprecation Starlette TestClient** *(Подтверждено)*

Warning: «Using `httpx` with `starlette.testclient` is deprecated». **Severity:** Low. **Effort:** S.

---

## D. Оценка готовности к production

| Область | Оценка | Доказательства |
|---|---|---|
| 1. Архитектура и дизайн | **Нужны улучшения** | Чистый split pure-logic/HTTP и pushdown (сильные стороны). Результаты зависят от источника (ARCH-01), mismatch гранулярности (ARCH-02), размазанный конфиг (ARCH-03), engine-per-request (ARCH-04). |
| 2. Качество кода и сопровождаемость | **Нужны улучшения** | Хорошие docstring и типизация в домене; дублирование (CODE-01), крупные модули (CODE-02), дрейф имён (ARCH-05), нет Python linting (CODE-04). |
| 3. База данных и слой данных | **Нужны улучшения** | Read-only, параметризовано, без N+1. In-place refresh без валидации (DATA-01), нет проверки свежести (DATA-04), нет таймаутов (ARCH-04). Прикладной БД нет — schema/migration касаются только snapshot. |
| 4. Безопасность | **Не готово** | ПДн в git-истории (SEC-01), нет auth (SEC-02), plaintext PII at rest (SEC-03), хеш без соли (SEC-04), возможный path traversal (SEC-05), critical npm advisories (SEC-06). Python CVE scan не оценивался. |
| 5. Стратегия тестирования | **Нужны улучшения** | Все сьюты зелёные и широкие по логике; нет coverage metrics, DB-path e2e, security и boundary tests (TEST-02). Playwright в этом обзоре не запускался. |
| 6. Performance и масштабируемость | **Нужны улучшения** | Приемлемо для небольшой внутренней аудитории; глобальный tracemalloc (PERF-01), неограниченный VIEW Query B (PERF-03). Load testing нет и не выполнялся. |
| 7. Observability и надёжность | **Не готово** | Нет logging config (OBS-01), нет metrics/error tracking (OBS-02), статический health check (OBS-03). Маппинг ошибок в статусы — хороший. |
| 8. Инфраструктура и деплой | **Не готово** | Нет build/publish образа в CI, нет процедуры rollback (INFRA-02), ручной data path с одним оператором (INFRA-01), контейнер от root (SEC-08). Docker build в этом обзоре не выполнялся. |
| 9. Итоговая готовность к production | **Не готово** | Блокируют пункты security/PII и отсутствие operational envelope. Доменное ядро здраво и rewrite не требует. |

Шкала оценок: Ready / Needs improvement (Нужны улучшения) / Not ready (Не готово) / Not assessed.

---

## E. Приоритетный roadmap

### P0 — Критично (до всего остального)

**P0-1 Локализация ПДн в репозитории (SEC-01)**

- Ожидаемый итог: нет сырых ПДн в рабочем дереве и достижимой истории; повтор предотвращён.
- Effort: M. Dependencies: owner + privacy/legal sign-off; согласованный force-push (нужно явное одобрение).
- Критерии приёмки: скан всей истории по phone-pattern пуст; notebooks коммитятся без outputs; CI-шаг падает на notebooks с outputs.
- Риски внедрения: rewrite истории инвалидирует каждый clone, открытую ветку и тег; коллеги должны переклонировать. Уже существующие клоны и forks отозвать нельзя.

**P0-2 Ограничить сетевой доступ до появления auth (SEC-02 interim)**

- Ожидаемый итог: контейнер доступен только целевым пользователям.
- Effort: S. Dependencies: нет.
- Критерии приёмки: порт на `127.0.0.1` или firewall allow-list; задокументировано.
- Риски: может сломать текущий LAN-demo доступ — согласовать с пользователями заранее.

### P1 — Блокеры production

**P1-1 Аутентификация через SSO (SEC-02)** — Effort M; зависит от IdP (G-2). Приёмка: каждый `/api/v1/*` возвращает 401 без валидной identity; `/health` остаётся открытым; e2e использует test identity. Риск: изменения CORS/credentials в SPA.

**P1-2 Убрать сырые ПДн из snapshot; keyed hashing (SEC-03, SEC-04)** — Effort M; зависит от раздачи секретов. Приёмка: в `answers` нет сырых contact/phone; parity-тесты проходят; KPI на тех же данных идентичны прежним. Риск: смена хеша инвалидирует ранее экспортированные hashed keys — подтвердить, что на них никто не опирается.

**P1-3 Решить и закрепить семантику sanitization по источнику (ARCH-01)** — Effort S (enforce/warn) до L (физические таблицы). Приёмка: либо VIEW mode выключен в production config, либо API отклоняет/помечает tiers, которые не может применить; UI это показывает. Риск: пользователи, опирающиеся на VIEW-цифры, увидят изменение — коммуницировать.

**P1-4 Исправить path containment SPA (SEC-05)** — Effort S. Приёмка: регрессионный тест с encoded `..` возвращает index или 404, никогда файл вне `web/dist`. Риск: минимальный.

**P1-5 Логирование, request ID, readiness endpoint (OBS-01, OBS-03, DATA-04)** — Effort S–M. Приёмка: structured logs с request ID, route, status, duration; `/ready` сообщает возраст/строки snapshot и возвращает non-200 при отсутствии; Docker healthcheck использует его. Риск: логи не должны включать тела запросов (ПДн).

**P1-6 Воспроизводимый build и rollback (INFRA-02, SEC-08)** — Effort M. Приёмка: CI собирает и пушит образ с тегом git tag/SHA, запускается non-root, smoke-тестирует `/health` и один synthetic `/process`; rollback задокументирован как redeploy предыдущего тега. Риск: доступ/credentials registry.

**P1-7 Scheduled, validated refresh snapshot (INFRA-01, DATA-01)** — Effort M. Приёмка: refresh по расписанию под service account, пишет во temp, валидирует row counts против порогов, атомарно меняет, хранит предыдущий файл и алертит при сбое. Риск: нужен хост с постоянным доступом к SQL Server (G-3).

**P1-8 Ограничить размеры запросов (SEC-07)** — Effort S. Приёмка: oversized payload → 413/422; максимум UI всё ещё работает. Риск: выбрать лимиты ниже реального кейса.

### P2 — Улучшения высокой ценности

- **P2-1 Центральный typed settings, валидация на старте (ARCH-03).** Effort M. Приёмка: один settings-модуль; app fail-fast при невалидном конфиге; эффективный конфиг логируется без секретов. Риск: тонкие смены дефолтов — сохранить текущие.
- **P2-2 Lifecycle engine + timeouts (ARCH-04, PERF-03).** Effort S–M. Приёмка: один engine на URL на процесс, dispose в lifespan; query timeout настроен; медленный запрос → 503 в пределах лимита. Риск: слишком низкий timeout для легитимных тяжёлых запросов.
- **P2-3 Исправить mid-month mismatch Query A/B (ARCH-02).** Effort S–M. Приёмка: новый тест с mid-month диапазоном показывает Query A и Query B над одной популяцией. Риск: меняются цифры для custom ranges — ожидаемо, коммуницировать.
- **P2-4 Убрать hardcoded даты (ARCH-09).** Effort S. Приёмка: «YTD» из текущего года; kitchen window из конфига. Риск: минимальный.
- **P2-5 Remediation frontend-зависимостей (SEC-06).** Effort S–M. Приёмка: `npm audit --omit=dev` без critical. Риск: major Plotly может изменить рендер графиков — частично покрыто chart-тестами; нужен visual check.
- **P2-6 Пробелы тестов (TEST-02).** Effort M. Приёмка: coverage в CI; synthetic SQLite fixture включает `source=db` e2e; есть security regression tests. Риск: flaky e2e при дрейфе fixtures.
- **P2-7 `tracemalloc` только за debug-флагом (PERF-01).** Effort S. Приёмка: `peak_memory_mb` отсутствует или null, пока не включено; latency не хуже. Риск: frontend может ждать поле — сделать optional.

### P3 — Средний приоритет

- **P3-1 Общий direction-aware allocator планировщиков (CODE-01).** Effort M. Приёмка: оба planner test suites проходят без изменений. Риск: мелкие numeric differences — сравнить outputs на фиксированных fixtures до/после.
- **P3-2 Разнести `backend/main.py` по routers (CODE-02).** Effort M. Приёмка: OpenAPI schema идентична до/после (diff `/openapi.json`). Риск: порядок маршрутов — `/sample/db` до `/sample/{preset}` сохранить.
- **P3-3 Выровнять имена tier-модулей с шагами пайплайна (ARCH-05).** Effort M. Приёмка: старые imports работают через aliases; тесты зелёные. Риск: notebooks со старыми именами.
- **P3-4 Хеш один раз за pipeline run (CODE-03).** Effort S. Приёмка: идентичные KPI на всех fixtures. Риск: низкий.
- **P3-5 Lazy-load research code; sklearn/openpyxl → extra (ARCH-06).** Effort S. Приёмка: `import backend.main` не импортирует sklearn; образ меньше. Риск: скриптам нужен `--extra research`.
- **P3-6 Python lint/type checks в CI (CODE-04).** Effort S. Нужно одобрение dev-only tools.
- **P3-7 Server-side telemetry/metrics и error tracking (OBS-02).** Effort M. Зависит от платформы (G-5).

### P4 — Опциональная зачистка

- Убрать stale package paths в `pyproject.toml` и `backend/requirements.txt`; single-source версию (ARCH-07). S.
- Удалить legacy `api/` после подтверждения отсутствия потребителей (ARCH-08). S.
- Публичные data-access helpers вместо `_private` imports (ARCH-10). S–M.
- Snapshot `schema_version` (DATA-02). S.
- Гигиена репо: lock-файл, merged-ветки, root docs, stale CI branch filters, выравнивание Node (INFRA-03, INFRA-04). S.
- Исправить lint warnings и TestClient deprecation (CODE-05, TEST-03). S.
- Опциональный кэш результатов по `loaded_at` snapshot (PERF-04). S–M.

---

## F. Рекомендуемая стратегия исполнения

Принципы: ядро домена не трогать; менять оболочку вокруг него; каждый шаг — независимо шиппабелен и проверяем существующими тест-сьютами плюс точечным новым тестом.

1. **Неделя 0 — containment (P0).** Ограничить доступ; решить и выполнить purge ПДн из истории; добавить CI-проверку notebook outputs. Без смены поведения приложения.
2. **Страховочная сетка перед изменениями.** Снять «золотые» ответы: `/openapi.json`, а также `/process` + `/plans` + `/plans-tts` для каждого synthetic preset и маленького synthetic SQLite snapshot fixture. Любой последующий рефактор должен воспроизводить их byte-for-byte (кроме timestamps/telemetry).
3. **Security envelope (P1-1, P1-4, P1-8, SEC-08).** Сначала path containment и лимиты запросов (маленько, тестируемо), потом SSO. После каждого — полный CI + e2e.
4. **Data path (P1-2, P1-3, P1-7).** Получить бизнес-решение по ARCH-01, затем перенести хеширование в refresh job и сделать refresh scheduled/atomic/validated. Проверить паритет KPI против golden outputs.
5. **Operability (P1-5, P1-6).** Логирование + readiness, затем CI build/publish образа и задокументированный rollback. Одна репетиция: задеплоить тег N, откатиться на N-1.
6. **Hardening (P2).** Центральный settings и lifecycle engine вместе (трогают один и тот же код), затем mid-month fix (ожидать осознанное изменение цифр — объявить), затем апгрейды зависимостей, затем пробелы тестов.
7. **Maintainability (P3/P4)** по возможности, каждый шаг под golden outputs; никогда не смешивать с behaviour-change в одном PR.

Чего не делать: rewrite пайплайна или планировщиков; новая прикладная БД, пока G-4 этого не требует; смена frontend-фреймворка.

---

## G. Открытые вопросы

1. **ARCH-01:** Какие цифры авторитетны в production — VIEW (только blacklist) или snapshot/физические таблицы (все tiers)? Нужен ли VIEW mode в production вообще?
2. **Доступ:** кто пользователи, сколько их, какой identity provider должен закрывать доступ? Нужны ли кому-то ограниченные views (по региону/магазину)?
3. **Data path:** сделает ли DBA физические таблицы из SPEC §5.4? Если нет — какой хост и service account будут гонять scheduled refresh, и какая нужна свежесть (сутки? час)?
4. **Persistence/audit:** нужно ли хранить и аудитировать планы, конфигурации или опубликованные KPI, или достаточно session-only состояния?
5. **Хостинг и платформа:** где будет production (on-prem Docker host, Kubernetes, cloud)? Какая стандартная платформа логирования/мониторинга/error tracking?
6. **Legacy-поверхности:** использует ли что-то ещё `api/main.py` (порт 8000) или Angular PoC-тег?
7. **Видимость репозитория:** GitHub-репозиторий private? У кого доступ, были ли forks или внешние клоны? (Определяет масштаб ответа на SEC-01.)
8. **Compliance:** какой privacy-режим применяется к контактным данным опроса (напр. израильский Privacy Protection Law / GDPR), и какой retention у локальных snapshot-файлов?
9. **Kitchen TTS:** должен ли endpoint `/tts-kitchen/before-after` быть live в production, если UI показывает «coming soon», а окно дат фиксировано?
10. **Версия Python:** правила проекта говорят Python 3.13+, проект pinned на 3.12. Какой таргет?
11. **Exports:** экспортируются ли сегодня hashed entity keys (напр. `scripts/export_always5_entities.py`)? Влияет на то, сломает ли смена схемы хеша (P1-2) downstream-потребителей.

---

**Итог одной фразой:** хороший, тестируемый MVP с чистым ядром; к production мешают ПДн/безопасность и отсутствие operational envelope, а не необходимость переписывать приложение.
