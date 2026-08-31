# Отчёт: Tier 3 — IsolationForest на entity-профилях

**Дата:** 2026-08-31  
**Проект:** Fraud Detection & Data Quality Sanitization  
**Источник:** `SummerCampain.dbo.TargetsByMetrics_RateGetAnswers`  
**Notebook:** `notebooks/03_tier3_experiments.ipynb`  
**Предшествующие отчёты:** `docs/report_exploration_00.md`, `docs/report_tier1.md`, `docs/report_tier2.md`

---

## Зачем

После Tier 1 MVP + Tier 2 проверить **ML-слой** на остаточной панели: ловит ли IsolationForest **новые** паттерны (high-volume / cross-store entity), которые правила и z-score по store×month не видят.

База: ответы Q10012 после Tier1 (blacklist + freq store-day) и Tier2 (z>2 или five_pct≥90).

---

## Что сделали

1. Воспроизвели pipeline Tier1 → Tier2 на полной выгрузке (~1.22M строк).
2. Построили **entity-профили** (`entity_key`, n≥3): volume, topbox_rate, score_variance, latency, n_stores, store-days.
3. Обучили `sklearn.ensemble.IsolationForest` на 8 фичах (log-scale для count-признаков).
4. Сравнили `contamination`: 0.005 … 0.10.
5. Измерили impact на network 5%, overlap с Tier2 и always-5 pool.

---

## Entity pool (после Tier1+Tier2)

| Метрика | Значение |
|---|---|
| Уникальных entity | **276 330** |
| Entity с n≥3 (пул IF) | **69 266** (25.1%) |
| Строк под IF (n≥3) | **659 999** (73.4% eligible) |
| Always-5 при n≥3 | **19 850** |
| `entity_key` известен | **99.56%** строк |

У выживших после Tier1 `max_answers_store_day ≤ 2` — rule 2 уже убрал «3+ в store×day»; IF не может просто повторить Tier1.

---

## Sweep contamination

| contam | entities | rows dropped | % rows | top-box dropped | network after | Δ Tier2→T3 |
|---|---|---|---|---|---|---|
| **0.005** | 347 | 25 564 | 2.83% | **76.4%** | **66.15%** | **−0.29 п.п.** |
| 0.010 | 693 | 41 390 | 4.60% | 75.2% | 66.15% | −0.30 п.п. |
| **0.020** | 1 386 | 61 670 | 6.83% | **70.5%** | **66.15%** | **−0.30 п.п.** |
| 0.050 | 3 464 | 106 433 | 11.83% | 68.0% | 66.14% | −0.30 п.п. |

При 0.02 удаляется **в 2.4× больше строк**, чем при 0.005, но KPI почти тот же — дополнительные entity близки к среднему score сети.

---

## Pipeline (сеть)

| Шаг | Строк | Top-box |
|---|---|---|
| 0 Ответы Q10012 | 962 799 | **68.13%** |
| 1 Tier1 MVP | 928 487 | **67.15%** |
| 2 Tier2 | 903 430 | **66.44%** |
| 3 Tier3 IF @0.005 | 877 866 | **66.15%** |
| 3 Tier3 IF @0.02 | 841 760 | **66.15%** |

- Tier3 @0.005: **−25 564** строк, top-box у удалённых **76.4%**
- Tier3 @0.02: **−61 670** строк, top-box у удалённых **70.5%**
- Суммарно raw→Tier3 @0.005: **−1.98 п.п.** (68.13 → 66.15)
- MVP raw→Tier2: **−1.69 п.п.** (68.13 → 66.44)

---

## Overlap и профиль аномалий

| Проверка | Результат |
|---|---|
| Tier3 vs Tier2 на residual panel | **0%** overlap (Tier2 уже убрал high store-months) |
| Tier3 vs always-5 (n≥3) | **251 / 19 850** (1.3%) — IF ловит **volume**, не rule 3 |
| Top anomaly | entity `c:1`: **4322** ответа, **223** store, topbox **98.3%** |

IF дополняет Tier1+2, а не дублирует их на текущей панели.

---

## Рекомендации

| | |
|---|---|
| **MVP prod** | **Tier1 + Tier2** (без Tier3) |
| **Tier3 v2 / research** | IF @ **contamination=0.005** или rule-based cap на mega-entity (n>100, n_stores>10) |
| **Не брать @0.02+** | много drops при marginal KPI (−0.3 п.п. vs Tier2) |
| **Stakeholder review** | обязателен — ML менее объясним, чем правила |
| **Код** | `src/fraud_guard/tier3.py` |

---

## Единый вывод Tier 1 + 2 + 3

| Tier | Метод | Drop (от prev.) | Δ network | Top-box dropped | MVP? |
|---|---|---|---|---|---|
| **1** | staff + freq≥3/store/day | 3.6% | −0.98 п.п. | ~93.5% | **Да** |
| **2** | store-month z>2 / ≥90% | 2.7% | −0.71 п.п. | ~92.7% | **Да** |
| **3** | IsolationForest entity | 2.8% @0.005 | −0.29 п.п. | ~76% | **Нет** |

**MVP:** 68.13% → **66.44%** (−1.69 п.п., ~6.2% rows)  
**Full stack (+Tier3 @0.005):** → **66.15%** (−1.98 п.п., ~8.8% rows)

---

## Простыми словами

После правил и z-score по ресторанам ML смотрит на **поведение клиентов в целом**: кто отвечает слишком часто, в слишком многих store, с подозрительно «красивым» профилем.  
Находит явные аномалии (тысячи ответов с одного id), но **слабо двигает общий 5%** по сети.  
Для planning/KPI достаточно Tier1+Tier2; Tier3 — опциональное усиление после согласования с бизнесом.
