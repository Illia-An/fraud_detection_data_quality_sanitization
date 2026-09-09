# Аудит 35 колонок VIEW для KPI-сервиса

**Дата разведки:** 2026-09-06 … 2026-09-07  
**Источник:** `SummerCampain.dbo.TargetsByMetrics_RateGetAnswers`  
**Срез KPI:** `AnswerTime >= 2026-01-01 AND AnswerTime < 2027-01-01` **и** `Question_ID = 10012`  
**Цель:** понять каждую колонку и решить, что грузить в MVP what-if (Actual → Tier1 → Tier2), а что отложить.

Числа ниже — снимок на момент проверки (VIEW живой, объём чуть растёт день ото дня). Порядок колонок = схема DB-team (`docs/schema_TargetsByMetrics_RateGetAnswers.md`).

---

## Якоря среза (до колонок)

| Проверка | Результат |
|----------|-----------|
| Период AnswerTime | 2026-01-01 → latest (~сен 2026); колонка Year только 2026 |
| Весь 2026 (любой Question_ID) | ~442k строк |
| Q10012 | ~350k (~79%) |
| Question_ID IS NULL | ~93k — **не** для KPI |
| Title у 10012 | всегда «חווית הקנייה» |
| Actual five_pct (доля оценок = 5) | ~**72.6%** |

**Фильтр загрузки сервиса:** период + `Question_ID = 10012` (+ при желании явно `Answer_Value IS NOT NULL`; на срезе у 10012 оценки уже заполнены).

**Продуктовая рамка:** очистка / what-if 5% KPI, не доказательство fraud. Язык: suspicious / flagged / excluded.

---

## Итог: что грузить в MVP SELECT

### Must-have

| Колонка | Зачем |
|---------|--------|
| `Answer_Value` | KPI (доля пятёрок) |
| `AnswerTime` | период, день для частоты |
| `PrintStore` | место (частота, Tier2, impact) |
| `Year`, `Month` | store×month (или считать из AnswerTime) |
| `BlackList` | Tier1: оставлять только `לא` |
| `UserContact` | entity-ключ (мир контакта); в API — hash |
| `ext_user_id` | entity-ключ (мир app, если ≠ 0) |

Опционально: `ParticipateNumber`, `PrintDateTime` (контекст; latency в MVP не правило).  
`Question_ID` можно только в `WHERE`.

### Не грузить в MVP

Остальные колонки — см. таблицы ниже (`skip` / `later`).

---

## Сводная таблица по всем 35 полям

| # | Колонка | Вердикт | Краткий вывод разведки |
|---|---------|---------|-------------------------|
| 1 | ParticipateNumber | optional | Почти уникален (ID участия в опросе), не человек |
| 2 | AnswerDate | **skip** | Дубль календарного дня из AnswerTime (mismatch = 0) |
| 3 | AnswerTime | **must** | Время ответа; период и день частоты |
| 4 | DiscountTypeDesc | later | mccoins / no discount / льготы RateGet; разный 5%; не правило MVP |
| 5 | BlackList | **must** | Сегмент: `לא` ~71.6%; сотрудники/льготы ~93–98%. Правило: только `לא` |
| 6 | PrintStore | **must** | ~238 ресторанов; база «места» |
| 7 | PrintDate | **skip** | Дата покупки; хуже PrintDateTime (есть mismatch) |
| 8 | PrintPos | later | Касса; есть точки с 100% пятёрок; расширение «касса×время» |
| 9 | PrintOrder | **skip** | Короткий номер чека (~291 значений), не уникальный id |
| 10 | PrintDateTime | optional | Время покупки; лаг ответа мин~6 мин, ср~32 мин, почти всё &lt;3 ч |
| 11 | EmpIdNumber | **skip** | Заполнен ~1%; почти всегда уже non-customer по BlackList |
| 12 | EmpStore | **skip** | Редко; часто ≠ PrintStore; высокий 5% |
| 13 | EmpName | **skip** | PII; не для правил |
| 14 | EmpLastName | **skip** | PII; не для правил |
| 15 | EmpStartDate | **skip** | nvarchar; скорее период работы, не смена |
| 16 | EmpEndDate | **skip** | Гипотеза «уволенные» не подтверждена (~56 строк, ~73% пятёрок) |
| 17 | EmpRole | **skip** | Роли на ~1% строк (FTM, מדריך, מנהל…); later-флаги |
| 18 | Year | **must** | Всегда заполнен; = YEAR(AnswerTime) |
| 19 | Month | **must** | Всегда заполнен; = MONTH(AnswerTime) |
| 20 | PhoneFromLog | **skip** | Бывает заполнен, но как единственный entity-ключ = **0** |
| 21 | ContactType | later | APP / טלפון / Email / null ≈ два мира + без ключа |
| 22 | UserName | **skip** | PII; имена не уникальны; без entity ~96.5% пятёрок |
| 23 | UserContact | **must** | ~46% строк; ~73.5k уникальных; остерегаться заглушки `'1'` |
| 24 | ext_user_id | **must** | `0` = неизвестен; иначе ~59k уникальных app id |
| 25 | OveringDone | **skip** | На KPI всегда `לא` — нет вариации |
| 26 | Reprinted | later | `כן` ~8.8k, ~88.5% пятёрок |
| 27 | PrintSource | later | Канал заказа (McTouch высокий 5%, многие app ниже) |
| 28 | TakeChanel | later | Коды получения; частично = PrintSource |
| 29 | PayChanel | later | Коды оплаты; 2≈app/~60%; 1 экстремален |
| 30 | OrderChanel | later | Коды оформления; пути Pay×Order (см. ниже) |
| 31 | GreenReceipt | later | Код `0` ~40k, ~98% пятёрок |
| 32 | IdentifiedCustomer | later | ERP-флаг ≠ наш entity; `=0` ~35k с ~98% пятёрок |
| 33 | Question_ID | **must (WHERE)** | Только 10012 для KPI |
| 34 | Title | **skip** | Дубль вопроса 10012 |
| 35 | Answer_Value | **must** | Оценка 1–5; основа 5% KPI |

---

## Детали по блокам

### 1. Опрос / оценка

- **ParticipateNumber:** total≈distinct; ~10 «лишних» строк на сотни тысяч — ID участия.
- **Question_ID / Title:** на 2026 только `10012` и NULL; у 10012 один Title.
- **Answer_Value:** только 1…5 на срезе 10012; Actual ~72.6%.
- **AnswerDate / AnswerTime:** согласованы; достаточно AnswerTime.
- **DiscountTypeDesc:** награды за ответ; в SELECT не брать.

### 2. Кто клиент (entity)

Два почти непересекающихся мира на KPI-срезе:

| Мир | Условие | Порядок величины |
|-----|---------|------------------|
| Контакт | `UserContact` непустой | ~162k строк, ~73.5k уникальных |
| App | нет контакта, `ext_user_id ≠ 0` | ~185k строк, ~59k уникальных |
| Нет ключа | иначе | ~3.3k, five_pct ~96.5% |

Каскад entity для частоты: `UserContact` → иначе `PhoneFromLog` (на практике 0) → иначе `ext_user_id ≠ 0`.

**Частота (Tier1):** entity × PrintStore × день(AnswerTime) ≥ N (обычно 3).  
Мир контактов — жёсткие пачки (десятки ответов/день, часто 100% пятёрок).  
Мир app — мягче (топ ~8; сотни групп ≥3).

**BlackList:** `לא` / `עובד` / `הפחתות בקופה` / `הטבת עובד קבוע`.  
Правило MVP: оставить только `לא` (~−1 п.п. сети на этом срезе).

**ContactType** объясняет миры: APP ↔ app id; טלפון ↔ контакт; null ↔ без ключа.

**IdentifiedCustomer:** не путать с entity-ключом; смысл кодов уточнять у DB.

### 3. Покупка / касса

- **PrintStore:** must; разброс five_pct по ресторанам большой.
- **PrintDateTime:** покупка → ответ (мин ~6 мин). Гипотезы «лаг 3–6 ч» и «пакет ответов после разнесённых покупок» на срезе почти пустые.
- **PrintPos:** later — drill-down касса×время для менеджера / видео.
- **PrintOrder:** не уникальный чек; без PrintPos ложные «много ответов на один заказ».
- **Каналы (PrintSource, Take/Pay/OrderChanel):** коррелируют с 5%; пути жизни заказа, напр. Pay×Order:
  - `2→2` ~185k, ~60% пятёрок  
  - `3→3` ~149k, ~86%  
  - `1→3` ~12k, ~99% пятёрок, тянет сеть ~**1 п.п.** (72.64 → 71.68)  
  - `1→1` ~4k, ~94%  
- **OveringDone:** всегда `לא` на KPI.
- **Reprinted / GreenReceipt:** интересные сегменты с высоким 5%; не MVP.

### 4. Сотрудник (Emp*)

- Emp-поля заполнены ~**1%** строк.
- EmpId почти всегда уже в BlackList ≠ `לא`; BlackList ловит ещё ~11k staff/льгот **без** EmpId.
- EmpEndDate «конец до ответа»: мало строк, five_pct не завышен → гипотеза «крутят на уволенных» не поддержана.
- EmpRole: FTM, מדריך, תחזוקה, מנהל מסעדה, FIRST/SECOND и др. — справочно.
- **Вердикт блока:** весь Emp* = **skip** для MVP; later — флаги расследования.

### 5. Календарь

- Year/Month всегда заполнены и **совпадают** с AnswerTime (mismatch = 0).
- Объём по месяцам 2026 стабилен; сентябрь неполный; five_pct растёт к лету (~68% → ~75–79%).

---

## Правила MVP (из research + эта разведка)

1. Срез: период + Q10012.  
2. **BlackList** = только обычный клиент (`לא`).  
3. **Частота:** один entity (контакт или app id) ≥ N раз в одном PrintStore за один день AnswerTime.  
4. **Always-5:** опция, по умолчанию выкл.  
5. **Tier2:** store × year × month, volume ≥ 30, z > 2 или five_pct ≥ 90.  

Сеть может сдвинуться умеренно; **store×month** показывает точечные искажения сильнее.

---

## Отложенные гипотезы (later)

| Тема | Статус |
|------|--------|
| Касса × время → разбор / видео | Расширение UI, не MVP |
| Путь Pay1×Order3 (~1 п.п. сети) | Нужен словарь кодов |
| GreenReceipt=0, IdentifiedCustomer=0, Reprinted=כן | Сегменты с высоким 5%; словарь + пересечения |
| Длинный лаг / пакет после смены | На данных 2026 почти не видно |
| Emp* флаги (смена, уволенные) | EmpEnd не подтвердил; нужны данные смены |
| Без entity (~3.3k, ~96% пятёрок) | Частота не ловит; отдельное исследование |

---

## Пример минимального SELECT для Data Access

```sql
SELECT
    ParticipateNumber,  -- optional
    Answer_Value,
    AnswerTime,
    PrintStore,
    [Year],
    [Month],
    BlackList,
    UserContact,
    ext_user_id
    -- , PrintDateTime  -- optional
FROM SummerCampain.dbo.TargetsByMetrics_RateGetAnswers
WHERE Question_ID = 10012
  AND AnswerTime >= '2026-01-01'
  AND AnswerTime <  '2027-01-01';
```

PII (`UserContact`) хэшировать на сервере до API; сырые контакты в UI/git не выносить.

---

## Связанные документы

- `docs/schema_TargetsByMetrics_RateGetAnswers.md` — канон колонок  
- `docs/report_exploration_00.md` — первичная разведка  
- `docs/report_tier1.md` / `report_tier2.md` — правила и эффекты  
- `backend/ARCHITECTURE.md` — контракт PoC API  

---

## Статус

Разведка **всех 35 признаков** для текущей задачи KPI sanitization PoC **завершена**.  
Следующий инженерный шаг: зафиксировать must-have в Data Access (фаза 0–1: SQL aggregates Actual + candidate rows) без переписывания `tier1.py` / `tier2.py`.
