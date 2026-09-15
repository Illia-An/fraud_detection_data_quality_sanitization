"""Generate manager Word reports for Tier 1 & Tier 2 methodology (stdlib only)."""

from __future__ import annotations

import argparse
import html
import zipfile
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_HE = ROOT / "docs" / "research" / "tier1_tier2_manager_he.docx"
OUT_RU = ROOT / "docs" / "research" / "tier1_tier2_manager_ru.docx"
OUT_HE_ALWAYS5 = ROOT / "docs" / "research" / "tier1_tier2_manager_he_always5.docx"
OUT_RU_ALWAYS5 = ROOT / "docs" / "research" / "tier1_tier2_manager_ru_always5.docx"


@dataclass(frozen=True)
class DocLayout:
    rtl: bool
    lang: str
    title: str


def _esc(text: str) -> str:
    return html.escape(text, quote=False)


def _align(layout: DocLayout) -> str:
    return "right" if layout.rtl else "left"


def _p(
    text: str,
    layout: DocLayout,
    *,
    bold: bool = False,
    italic: bool = False,
    mono: bool = False,
) -> str:
    rpr = "<w:rPr>"
    if layout.rtl:
        rpr += "<w:rtl/>"
    if bold:
        rpr += "<w:b/>"
    if italic:
        rpr += "<w:i/>"
    if mono:
        rpr += '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>'
    else:
        rpr += '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>'
    rpr += "</w:rPr>"
    ppr = f'<w:pPr><w:jc w:val="{_align(layout)}"/>'
    if layout.rtl:
        ppr += "<w:bidi/>"
    ppr += "</w:pPr>"
    return (
        f"<w:p>{ppr}<w:r>{rpr}<w:t xml:space=\"preserve\">{_esc(text)}</w:t></w:r></w:p>"
    )


def _h(text: str, level: int, layout: DocLayout) -> str:
    size = {0: 32, 1: 28, 2: 24}.get(level, 28)
    ppr = f'<w:pPr><w:jc w:val="{_align(layout)}"/>'
    if layout.rtl:
        ppr += "<w:bidi/>"
    ppr += f'<w:pStyle w:val="Heading{level}"/></w:pPr>'
    rtl = "<w:rtl/>" if layout.rtl else ""
    return (
        f"<w:p>{ppr}<w:r><w:rPr>{rtl}<w:b/>"
        f'<w:sz w:val="{size}"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>'
        f"</w:rPr><w:t>{_esc(text)}</w:t></w:r></w:p>"
    )


def _bullet(text: str, layout: DocLayout) -> str:
    ppr = f'<w:pPr><w:jc w:val="{_align(layout)}"/>'
    if layout.rtl:
        ppr += "<w:bidi/>"
    ppr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'
    rtl = "<w:rtl/>" if layout.rtl else ""
    return (
        f"<w:p>{ppr}<w:r><w:rPr>{rtl}"
        '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>'
        f"</w:rPr><w:t>{_esc(text)}</w:t></w:r></w:p>"
    )


def _table(headers: list[str], rows: list[list[str]], layout: DocLayout) -> str:
    col_count = len(headers)
    bidi_visual = "<w:bidiVisual/>" if layout.rtl else ""
    tbl_pr = (
        f"<w:tbl><w:tblPr>{bidi_visual}<w:tblW w:w=\"5000\" w:type=\"pct\"/>"
        "<w:tblBorders>"
        "<w:top w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:left w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:bottom w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:right w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:insideH w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:insideV w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"auto\"/>"
        "</w:tblBorders></w:tblPr>"
    )
    grid = "".join(f"<w:gridCol w:w=\"{5000 // col_count}\"/>" for _ in range(col_count))
    parts = [tbl_pr, f"<w:tblGrid>{grid}</w:tblGrid>"]

    def row(cells: list[str], header: bool = False) -> str:
        tr = "<w:tr>"
        for cell in cells:
            rpr = "<w:rPr>"
            if layout.rtl:
                rpr += "<w:rtl/>"
            if header:
                rpr += "<w:b/>"
            rpr += '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr>'
            ppr = f'<w:pPr><w:jc w:val="{_align(layout)}"/>'
            if layout.rtl:
                ppr += "<w:bidi/>"
            ppr += "</w:pPr>"
            tr += (
                "<w:tc><w:tcPr><w:tcW w:w=\"0\" w:type=\"auto\"/></w:tcPr>"
                f"<w:p>{ppr}<w:r>{rpr}<w:t>{_esc(cell)}</w:t></w:r></w:p></w:tc>"
            )
        tr += "</w:tr>"
        return tr

    parts.append(row(headers, header=True))
    for r in rows:
        parts.append(row(r))
    parts.append("</w:tbl>")
    return "".join(parts)


def build_document_xml_he(layout: DocLayout) -> str:
    blocks: list[str] = []

    blocks.append(_h("דוח למנהל: איך עובדים Tier 1 ו-Tier 2", 0, layout))
    blocks.append(_p("מנוע What-If לניקוי נתוני סקר — Q10012 (Top-Box)", layout, italic=True))
    blocks.append(_p("תקופה לדוגמה: 01.01.2026 – 14.09.2026", layout, italic=True))
    blocks.append("<w:p/>")

    blocks.append(_h("1. מה אנחנו מודדים?", 1, layout))
    blocks.append(
        _p(
            "המערכת בודקת שאלה אחת מסקר שביעות הרצון (Q10012). "
            "מדד Top-Box = אחוז התשובות עם ציון 5 מתוך 5.",
            layout,
        )
    )
    blocks.append(
        _p(
            "השאלה שהמערכת עונה עליה: "
            "«אם נסיר תשובות חשודות — בכמה נקודות אחוז ישתנה אחוז החמישיות ברשת?»",
            layout,
            italic=True,
        )
    )

    blocks.append(_h("2. שלושת שלבי החישוב", 1, layout))
    blocks.append(_p("Actual (כפי שזה היום)  →  Tier 1  →  Tier 2  →  Final", layout, bold=True))
    blocks.append(
        _table(
            ["שלב", "משמעות"],
            [
                ["Actual", "KPI כפי שהוא — לפני כל ניקוי"],
                ["Tier 1", "הסרת תשובות מ-respondents חשודים"],
                ["Tier 2", "הסרת חודשים חריגים ברמת מסעדה"],
                ["Final", "KPI סופי אחרי שני שלבי הניקוי"],
            ],
            layout,
        )
    )
    blocks.append(_p("דלתת הרשת (network_delta_pp) = Final − Baseline (בנקודות אחוז)", layout))
    blocks.append(_p("דוגמה מהנתונים:", layout, bold=True))
    blocks.append(
        _table(
            ["מדד", "ערך"],
            [
                ["Baseline (Actual)", "72.70%"],
                ["Final (אחרי Tier 1 + Tier 2)", "69.87%"],
                ["שינוי", "−2.83 נק' אחוז"],
            ],
            layout,
        )
    )

    blocks.append(_h("3. שלב 0: Actual — «כפי שזה היום»", 1, layout))
    blocks.append(_bullet("נלקחות כל התשובות ל-Q10012 בתקופה שנבחרה.", layout))
    blocks.append(_bullet("מחושב Baseline — אחוז החמישיות ברשת לפני כל ניקוי.", layout))
    blocks.append(_bullet("זו נקודת ההשוואה לכל השלבים הבאים.", layout))

    blocks.append(_h("4. Tier 1 — ניקוי respondents חשודים", 1, layout))
    blocks.append(
        _p(
            "רעיון מרכזי: Tier 1 בודק כל תשובה בנפרד ומסיר תשובות מאנשים "
            "שלא נראים כמו לקוחות רגילים, או שמתנהגים בצורה חשודה.",
            layout,
        )
    )

    blocks.append(_h("כלל 1: BlackList (סגמנט לקוח)", 2, layout))
    blocks.append(_bullet("בנתונים יש שדה BlackList.", layout))
    blocks.append(_bullet("נשמרים רק לקוחות «רגילים» — ערך «לא» (לקוח רגיל).", layout))
    blocks.append(_bullet("כל שאר הסגמנטים מוסרים.", layout))
    blocks.append(_p("במילים פשוטות: «זה לא לקוח טיפוסי — התשובה שלו לא נספרת».", layout, italic=True))

    blocks.append(_h("כלל 2: תדירות גבוהה (Frequency)", 2, layout))
    blocks.append(_bullet("המערכת מזהה אדם אחד לפי: איש קשר → טלפון → מזהה משתמש.", layout))
    blocks.append(_bullet("נספר: כמה פעמים אותו אדם ענה באותה מסעדה, באותו יום.", layout))
    blocks.append(_bullet("אם 3 פעמים ומעלה (ברירת מחדל) — כל תשובותיו באותו יום באותה מסעדה מוסרות.", layout))
    blocks.append(
        _p(
            "במילים פשוטות: «אדם אחד לא יכול לענות 3+ פעמים באותו מקום באותו יום — "
            "זה רעש או ניצול לרעה».",
            layout,
            italic=True,
        )
    )

    blocks.append(_h("כלל 3 (אופציונלי): «תמיד נותן 5»", 2, layout))
    blocks.append(_bullet("כבוי כברירת מחדל.", layout))
    blocks.append(_bullet("אם מופעל: מי שיש לו ≥10 תשובות וכולן ציון 5 — מסומן כחשוד.", layout))
    blocks.append(_p("במילים פשוטות: «respondent מושלם מדי — ייתכן מניפולציה».", layout, italic=True))

    blocks.append(_h("מה קורה אחרי Tier 1?", 2, layout))
    blocks.append(_bullet("תשובות חשודות מוסרות.", layout))
    blocks.append(_bullet("מחושב מחדש אחוז החמישיות.", layout))
    blocks.append(_bullet("בנתונים שלכם — Tier 1 עשה את רוב ההשפעה (יותר מ-Tier 2).", layout))

    blocks.append(_h("5. Tier 2 — ניקוי מסעדה × חודש חריג", 1, layout))
    blocks.append(
        _p(
            "רעיון מרכזי: Tier 1 מנקה אנשים. Tier 2 מחפש חריגות ברמת מסעדה לחודש — "
            "כשאחוז החמישיות נראה גבוה מדי.",
            layout,
        )
    )

    blocks.append(_h("איך זה עובד?", 2, layout))
    blocks.append(_bullet("אחרי Tier 1 — הנתונים מקובצים לפי מסעדה × שנה × חודש.", layout))
    blocks.append(_bullet("לכל «תא»: volume (מספר תשובות, מינימום 30) ו-five_pct (אחוז חמישיות).", layout))
    blocks.append(_bullet("מחושבים ממוצע הרשת וסטיית תקן על כל התאים עם מספיק נפח.", layout))
    blocks.append(_bullet("לכל תא — z-score: עד כמה אחוז החמישיות גבוה/נמוך מה«נורמה» ברשת.", layout))

    blocks.append(_h("מתי תא מסומן כחריג?", 2, layout))
    blocks.append(_p("לפחות אחד מהתנאים:", layout, bold=True))
    blocks.append(
        _table(
            ["תנאי", "ברירת מחדל", "משמעות"],
            [
                ["Z-score", "> 2.0", "אחוז חמישיות גבוה משמעותית מהממוצע ברשת"],
                ["סף ישיר", "≥ 90%", "כמעט כל התשובות — חמישיות"],
            ],
            layout,
        )
    )

    blocks.append(_h("מה קורה אחרי Tier 2?", 2, layout))
    blocks.append(_bullet("אם מסעדה×חודש מסומן — כל התשובות מאותו תא מוסרות (החודש כולו לאותה מסעדה).", layout))
    blocks.append(_bullet("מחושב KPI סופי.", layout))
    blocks.append(
        _p(
            "במילים פשוטות: «במסעדה הזו בחודש הזה יותר מדי חמישיות — "
            "נראה כמו מניפולציה שיטתית, מסירים את כל הבלוק».",
            layout,
            italic=True,
        )
    )
    blocks.append(_p("בנתונים שלכם: 92 תאים (מסעדה×חודש) סומנו כחריגים.", layout, bold=True))

    blocks.append(_h("6. תרשים זרימה", 1, layout))
    for line in [
        "כל התשובות ל-Q10012",
        "         ↓",
        "     ACTUAL — % חמישיות «כפי שזה» (72.7%)",
        "         ↓",
        "     TIER 1 — מסירים:",
        "         • לא-לקוחות (BlackList ≠ «לא»)",
        "         • respondents תכופים (3+ פעמים/יום/מסעדה)",
        "         • (אופצ.) «תמיד חמישיות»",
        "         ↓",
        "     אחרי Tier 1 — % חמישיות מחושב מחדש",
        "         ↓",
        "     TIER 2 — מסירים תאי מסעדה×חודש שבהם:",
        "         • z > 2 (גבוה מדי מול הרשת)",
        "         • או ≥ 90% חמישיות",
        "         ↓",
        "     FINAL — % סופי (69.9%), דלתא = −2.83 נק' אחוז",
    ]:
        blocks.append(_p(line, layout, mono=True))

    blocks.append(_h("7. נקודות חשובות למנהל", 1, layout))
    for item in [
        "זו מודל What-If — לא מחיקה אוטומטית מה-DB. מראה כמה ה-KPI היה משתנה לפי כללים אלה.",
        "Tier 1 = איכות respondents (מי ענה).",
        "Tier 2 = איכות מסעדה×חודש (איפה ומתי אחוז החמישיות חשוד).",
        "ספים ניתנים לכיוון (תדירות, z-score, 90%, מינימום 30 תשובות).",
        "Tier 2 תמיד פעיל בגרסה הנוכחית — אפשר לשנות ספים, לא לכבות.",
    ]:
        blocks.append(_bullet(item, layout))

    blocks.append(_h("8. משפט אחד לסיכום", 1, layout))
    blocks.append(
        _p(
            "«לוקחים את כל התשובות לשאלת שביעות הרצון, קודם מסירים respondents חשודים "
            "(לא לקוחות, תכופים מדי, תמיד חמישיות), אחר כך מסירים מסעדות עם אחוז חמישיות "
            "חריג לחודש — ומראים בכמה נקודות אחוז ה-KPI של הרשת היה משתנה.»",
            layout,
            italic=True,
        )
    )

    blocks.append(_h("הגדרות מפתח", 1, layout))
    blocks.append(
        _table(
            ["מונח", "הסבר"],
            [
                ["Top-Box", "אחוז תשובות עם ציון 5"],
                ["Baseline", "KPI לפני ניקוי"],
                ["Final", "KPI אחרי Tier 1 + Tier 2"],
                ["network_delta_pp", "Final − Baseline (נק' אחוז)"],
                ["z-score", "כמה סטיות תקן התא מעל/מתחת לממוצע הרשת"],
            ],
            layout,
        )
    )
    blocks.append(
        _p(
            "מסמך זה מתאר את המתודולוגיה של מנוע Sanitization — גרסת Prototype 1.0.0",
            layout,
            italic=True,
        )
    )
    return _wrap_body("".join(blocks), layout)


def build_document_xml_ru(layout: DocLayout) -> str:
    blocks: list[str] = []

    blocks.append(_h("Отчёт для менеджера: как работают Tier 1 и Tier 2", 0, layout))
    blocks.append(_p("What-If движок очистки данных опроса — Q10012 (Top-Box)", layout, italic=True))
    blocks.append(_p("Пример периода: 01.01.2026 – 14.09.2026", layout, italic=True))
    blocks.append("<w:p/>")

    blocks.append(_h("1. Что мы измеряем", 1, layout))
    blocks.append(
        _p(
            "Система анализирует один вопрос опроса удовлетворённости (Q10012). "
            "Метрика Top-Box = доля ответов с оценкой 5 из 5.",
            layout,
        )
    )
    blocks.append(
        _p(
            "Вопрос, на который отвечает система: "
            "«Если убрать подозрительные ответы — на сколько процентных пунктов "
            "изменится доля пятёрок по всей сети?»",
            layout,
            italic=True,
        )
    )

    blocks.append(_h("2. Три шага расчёта", 1, layout))
    blocks.append(_p("Actual (как есть)  →  Tier 1  →  Tier 2  →  Final", layout, bold=True))
    blocks.append(
        _table(
            ["Шаг", "Смысл"],
            [
                ["Actual", "KPI как есть — до любой очистки"],
                ["Tier 1", "Удаление ответов от подозрительных респондентов"],
                ["Tier 2", "Удаление аномальных месяцев на уровне ресторана"],
                ["Final", "Итоговый KPI после двух этапов очистки"],
            ],
            layout,
        )
    )
    blocks.append(_p("Дельта сети (network_delta_pp) = Final − Baseline (в п.п.)", layout))
    blocks.append(_p("Пример из ваших данных:", layout, bold=True))
    blocks.append(
        _table(
            ["Метрика", "Значение"],
            [
                ["Baseline (Actual)", "72.70%"],
                ["Final (после Tier 1 + Tier 2)", "69.87%"],
                ["Изменение", "−2.83 п.п."],
            ],
            layout,
        )
    )

    blocks.append(_h("3. Шаг 0: Actual — «как есть сейчас»", 1, layout))
    blocks.append(_bullet("Берутся все ответы на Q10012 за выбранный период.", layout))
    blocks.append(_bullet("Считается Baseline — % пятёрок по сети до любой очистки.", layout))
    blocks.append(_bullet("Это точка сравнения для всех следующих шагов.", layout))

    blocks.append(_h("4. Tier 1 — очистка подозрительных респондентов", 1, layout))
    blocks.append(
        _p(
            "Основная идея: Tier 1 проверяет каждый ответ отдельно и убирает ответы "
            "от людей, которые не похожи на обычных клиентов или ведут себя подозрительно.",
            layout,
        )
    )

    blocks.append(_h("Правило 1: BlackList (сегмент клиента)", 2, layout))
    blocks.append(_bullet("В данных есть поле BlackList.", layout))
    blocks.append(_bullet("Остаются только «обычные» клиенты — значение «לא» (ивр. «нет»).", layout))
    blocks.append(_bullet("Все остальные сегменты удаляются.", layout))
    blocks.append(
        _p("Простыми словами: «Это не типичный клиент — его ответ не учитываем».", layout, italic=True)
    )

    blocks.append(_h("Правило 2: Высокая частота (Frequency)", 2, layout))
    blocks.append(_bullet("Система определяет одного человека по цепочке: контакт → телефон → ID пользователя.", layout))
    blocks.append(_bullet("Считается: сколько раз один человек ответил в одном ресторане за один день.", layout))
    blocks.append(
        _bullet(
            "Если 3 раза и более (по умолчанию) — все его ответы в этот день в этом ресторане удаляются.",
            layout,
        )
    )
    blocks.append(
        _p(
            "Простыми словами: «Один человек не может честно пройти опрос 3+ раз "
            "в одном месте за день — это шум или злоупотребление».",
            layout,
            italic=True,
        )
    )

    blocks.append(_h("Правило 3 (опционально): «Всегда ставит 5»", 2, layout))
    blocks.append(_bullet("По умолчанию выключено.", layout))
    blocks.append(_bullet("Если включить: человек с ≥10 ответами, все — пятёрки, помечается как подозрительный.", layout))
    blocks.append(
        _p("Простыми словами: «Слишком идеальный респондент — возможно, накрутка».", layout, italic=True)
    )

    blocks.append(_h("Что происходит после Tier 1?", 2, layout))
    blocks.append(_bullet("Подозрительные ответы удаляются.", layout))
    blocks.append(_bullet("Пересчитывается % пятёрок.", layout))
    blocks.append(_bullet("В ваших данных Tier 1 дал основной эффект (больше, чем Tier 2).", layout))

    blocks.append(_h("5. Tier 2 — очистка аномальных «ресторан × месяц»", 1, layout))
    blocks.append(
        _p(
            "Основная идея: Tier 1 чистит людей. Tier 2 ищет аномалии на уровне "
            "ресторана за месяц — когда % пятёрок выглядит нереалистично высоким.",
            layout,
        )
    )

    blocks.append(_h("Как это работает?", 2, layout))
    blocks.append(_bullet("После Tier 1 данные группируются по ресторан × год × месяц.", layout))
    blocks.append(
        _bullet("Для каждой «ячейки»: volume (число ответов, минимум 30) и five_pct (% пятёрок).", layout)
    )
    blocks.append(_bullet("Считаются среднее по сети и стандартное отклонение по ячейкам с достаточным объёмом.", layout))
    blocks.append(
        _bullet("Для каждой ячейки — z-score: насколько её % пятёрок выше/ниже «нормы» сети.", layout)
    )

    blocks.append(_h("Когда ячейка помечается как аномальная?", 2, layout))
    blocks.append(_p("Срабатывает хотя бы одно условие:", layout, bold=True))
    blocks.append(
        _table(
            ["Условие", "По умолчанию", "Смысл"],
            [
                ["Z-score", "> 2.0", "% пятёрок значительно выше среднего по сети"],
                ["Прямой порог", "≥ 90%", "Почти все ответы — пятёрки"],
            ],
            layout,
        )
    )

    blocks.append(_h("Что происходит после Tier 2?", 2, layout))
    blocks.append(
        _bullet(
            "Если ресторан×месяц помечен — удаляются все ответы из этой ячейки (весь месяц для ресторана).",
            layout,
        )
    )
    blocks.append(_bullet("Считается итоговый KPI.", layout))
    blocks.append(
        _p(
            "Простыми словами: «В этом ресторане в этом месяце слишком много пятёрок — "
            "похоже на системную накрутку, убираем весь блок».",
            layout,
            italic=True,
        )
    )
    blocks.append(_p("В ваших данных: 92 ячейки (ресторан×месяц) помечены как аномальные.", layout, bold=True))

    blocks.append(_h("6. Блок-схема", 1, layout))
    for line in [
        "Все ответы на Q10012",
        "         ↓",
        "     ACTUAL — % пятёрок «как есть» (72.7%)",
        "         ↓",
        "     TIER 1 — убираем:",
        "         • не-клиентов (BlackList ≠ «לא»)",
        "         • частых респондентов (3+ раз/день/ресторан)",
        "         • (опц.) «всегда пятёрки»",
        "         ↓",
        "     после Tier 1 — % пятёрок пересчитан",
        "         ↓",
        "     TIER 2 — убираем ячейки ресторан×месяц, где:",
        "         • z > 2 (слишком высоко vs сеть)",
        "         • или ≥ 90% пятёрок",
        "         ↓",
        "     FINAL — итоговый % (69.9%), delta = −2.83 п.п.",
    ]:
        blocks.append(_p(line, layout, mono=True))

    blocks.append(_h("7. Важные моменты для менеджера", 1, layout))
    for item in [
        "Это What-If модель — не автоматическое удаление из БД. Показывает, насколько изменился бы KPI.",
        "Tier 1 = качество респондентов (кто отвечал).",
        "Tier 2 = качество ресторан×месяц (где и когда % пятёрок подозрителен).",
        "Пороги настраиваемые (частота, z-score, 90%, минимум 30 ответов).",
        "Tier 2 всегда включён в текущей версии — можно менять пороги, но не отключить.",
    ]:
        blocks.append(_bullet(item, layout))

    blocks.append(_h("8. Одно предложение для презентации", 1, layout))
    blocks.append(
        _p(
            "«Берём все ответы на вопрос удовлетворённости, сначала убираем подозрительных "
            "респондентов (не клиенты, слишком частые, всегда пятёрки), затем убираем рестораны "
            "с аномально высоким % пятёрок за месяц — и показываем, на сколько процентных "
            "пунктов изменился бы KPI сети».",
            layout,
            italic=True,
        )
    )

    blocks.append(_h("Ключевые определения", 1, layout))
    blocks.append(
        _table(
            ["Термин", "Пояснение"],
            [
                ["Top-Box", "Доля ответов с оценкой 5"],
                ["Baseline", "KPI до очистки"],
                ["Final", "KPI после Tier 1 + Tier 2"],
                ["network_delta_pp", "Final − Baseline (п.п.)"],
                ["z-score", "На сколько σ ячейка выше/ниже среднего по сети"],
            ],
            layout,
        )
    )
    blocks.append(
        _p(
            "Документ описывает методологию движка Sanitization — Prototype 1.0.0",
            layout,
            italic=True,
        )
    )
    return _wrap_body("".join(blocks), layout)


def _wrap_body(body: str, layout: DocLayout) -> str:
    sect = "<w:sectPr>"
    if layout.rtl:
        sect += "<w:bidi/>"
    sect += (
        '<w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" '
        'w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<w:body>{body}{sect}</w:body></w:document>"
    )


def write_docx(out_path: Path, document_xml: str, layout: DocLayout) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    align = _align(layout)
    bidi_doc = "<w:rtl/>" if layout.rtl else ""
    bidi_p = "<w:bidi/>" if layout.rtl else ""
    bidi_settings = "<w:bidi/>" if layout.rtl else ""

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""
    doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>"""
    styles = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr>{bidi_doc}<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr></w:rPrDefault>
  <w:pPrDefault><w:pPr>{bidi_p}</w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Heading0"><w:name w:val="Heading 0"/><w:pPr>{bidi_p}<w:jc w:val="{align}"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:pPr>{bidi_p}<w:jc w:val="{align}"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:pPr>{bidi_p}<w:jc w:val="{align}"/></w:pPr></w:style>
</w:styles>"""
    numbering = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/>
    <w:lvlText w:val="•"/><w:lvlJc w:val="{align}"/>
    <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>"""
    settings = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  {bidi_settings}
  <w:themeFontLang w:val="{layout.lang}"/>
</w:settings>"""
    core = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{_esc(layout.title)}</dc:title>
  <dc:creator>Sanitization Engine</dc:creator>
  <dc:language>{layout.lang}</dc:language>
</cp:coreProperties>"""
    app = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Python stdlib</Application>
</Properties>"""

    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document_xml)
        zf.writestr("word/_rels/document.xml.rels", doc_rels)
        zf.writestr("word/styles.xml", styles)
        zf.writestr("word/numbering.xml", numbering)
        zf.writestr("word/settings.xml", settings)
        zf.writestr("docProps/core.xml", core)
        zf.writestr("docProps/app.xml", app)


def build_document_xml_he_always5(layout: DocLayout) -> str:
    blocks: list[str] = []

    blocks.append(_h("נספח: Always top-box מופעל", 0, layout))
    blocks.append(_p("מסמך משלים לדוח המתודולוגיה של Tier 1 ו-Tier 2", layout, italic=True))
    blocks.append(
        _p(
            "קובץ Excel מקביל: store_research_2026-01-01_to_2026-09-14_he_always5.xlsx",
            layout,
            italic=True,
        )
    )
    blocks.append(_p("תקופה: 01.01.2026 – 14.09.2026", layout, italic=True))
    blocks.append("<w:p/>")

    blocks.append(_h("1. מה משתנה?", 1, layout))
    blocks.append(
        _p(
            "בדוח הבסיסי (_he.xlsx) כלל «תמיד נותן 5» כבוי. "
            "בנספח זה — אותו מנוע, אותה תקופה, אבל Always top-box מופעל.",
            layout,
        )
    )
    blocks.append(
        _table(
            ["פרמטר", "ערך"],
            [
                ["tier1_always_five_enabled", "True"],
                ["tier1_always_five_min_n", "10"],
            ],
            layout,
        )
    )
    blocks.append(_p("שאר הכללים לא משתנים: BlackList, Frequency (≥3), Tier 2.", layout))

    blocks.append(_h("2. איך עובד הכלל?", 1, layout))
    blocks.append(
        _p(
            "רעיון: מזהים respondent שתמיד נותן ציון מושלם — ואין לו «תשובות רגילות» מספיק.",
            layout,
        )
    )
    blocks.append(_bullet("מזהה אדם אחד (איש קשר → טלפון → מזהה משתמש).", layout))
    blocks.append(_bullet("סופרת כמה תשובות יש לו בתקופה.", layout))
    blocks.append(_bullet("בודקת אם כל התשובות הן ציון 5.", layout))
    blocks.append(_p("מסומן כחשוד אם:", layout, bold=True))
    blocks.append(_bullet("מספר תשובות ≥ 10, וגם", layout))
    blocks.append(_bullet("100% מהתשובות = 5 (חייב להיות תמיד חמישיות).", layout))
    blocks.append(_p("אז כל תשובותיו מוסרות ב-Tier 1.", layout))
    blocks.append(
        _p(
            "במילים פשוטות: «מי שתמיד נותן 5, ובמספיק תשובות — נראה כמו מניפולציה או רעש, "
            "לא לקוח רגיל».",
            layout,
            italic=True,
        )
    )

    blocks.append(_h("3. למה זה משפיע חזק?", 1, layout))
    blocks.append(
        _p(
            "אנשים כאלה נוטים להעלות את אחוז החמישיות ברשת. "
            "כשמסירים אותם — ה-KPI יורד יותר מאשר רק עם BlackList + Frequency.",
            layout,
        )
    )

    blocks.append(_h("4. תוצאות בתקופה (השוואה)", 1, layout))
    blocks.append(
        _table(
            ["מדד", "בלי Always5 (_he.xlsx)", "עם Always5 (_he_always5.xlsx)"],
            [
                ["network_delta_pp", "≈ −2.83 נק' אחוז", "−6.82 נק' אחוז"],
                ["Flagged (מסעדה×חודש, Tier 2)", "92", "49"],
            ],
            layout,
        )
    )
    blocks.append(_p("פירוש למנהל:", layout, bold=True))
    blocks.append(
        _bullet(
            "Always top-box מגביר משמעותית את אפקט Tier 1 (דלתא כמעט ×2.5).",
            layout,
        )
    )
    blocks.append(
        _bullet(
            "מספר חודשים חריגים ב-Tier 2 יורד (92 → 49): אחרי ניקוי חזק יותר של respondents, "
            "פחות חודשים נשארים «חריגים» לפי z / 90%.",
            layout,
        )
    )

    blocks.append(_h("5. איפה לראות ב-Excel?", 1, layout))
    blocks.append(_bullet("גיליון Config → tier1_always_five_enabled = True", layout))
    blocks.append(
        _bullet(
            "גיליונות סיכום_מנהל / טופ_השפעה / Impact — אותה מבנה, מספרים מחושבים מחדש",
            layout,
        )
    )
    blocks.append(
        _bullet(
            "בסיבות drop תופיע סיבה always_topbox (בנוסף ל-blacklist / frequency)",
            layout,
        )
    )

    blocks.append(_h("6. מתי מומלץ להפעיל?", 1, layout))
    blocks.append(
        _table(
            ["מצב", "המלצה"],
            [
                ["ניתוח שמרני / ברירת מחדל", "כבוי (כמו _he.xlsx)"],
                ["בדיקת What-If «מה אם נסיר גם תמיד-חמישיות»", "מופעל (כמו _he_always5.xlsx)"],
                ["החלטה עסקית קבועה", "לדון עם stakeholders — הכלל אגרסיבי"],
            ],
            layout,
        )
    )

    blocks.append(_h("7. משפט אחד לסיכום", 1, layout))
    blocks.append(
        _p(
            "«כש-Always top-box מופעל, בנוסף ל-BlackList ולתדירות, מסירים גם respondents עם "
            "≥10 תשובות שכולן ציון 5 — ובנתונים של התקופה הזו זה מעמיק את ירידת ה-KPI "
            "מכ־−2.8 לכ־−6.8 נקודות אחוז.»",
            layout,
            italic=True,
        )
    )
    blocks.append(
        _p(
            "נספח למתודולוגיית Sanitization — Prototype 1.0.0 (Always top-box ON)",
            layout,
            italic=True,
        )
    )
    return _wrap_body("".join(blocks), layout)


def build_document_xml_ru_always5(layout: DocLayout) -> str:
    blocks: list[str] = []

    blocks.append(_h("Приложение: Always top-box включён", 0, layout))
    blocks.append(_p("Дополнение к отчёту по методологии Tier 1 и Tier 2", layout, italic=True))
    blocks.append(
        _p(
            "Параллельный Excel: store_research_2026-01-01_to_2026-09-14_he_always5.xlsx",
            layout,
            italic=True,
        )
    )
    blocks.append(_p("Период: 01.01.2026 – 14.09.2026", layout, italic=True))
    blocks.append("<w:p/>")

    blocks.append(_h("1. Что меняется?", 1, layout))
    blocks.append(
        _p(
            "В базовом отчёте (_he.xlsx) правило «всегда ставит 5» выключено. "
            "В этом приложении — тот же движок, тот же период, но Always top-box включён.",
            layout,
        )
    )
    blocks.append(
        _table(
            ["Параметр", "Значение"],
            [
                ["tier1_always_five_enabled", "True"],
                ["tier1_always_five_min_n", "10"],
            ],
            layout,
        )
    )
    blocks.append(_p("Остальные правила без изменений: BlackList, Frequency (≥3), Tier 2.", layout))

    blocks.append(_h("2. Как работает правило?", 1, layout))
    blocks.append(
        _p(
            "Идея: находим респондента, который всегда ставит идеальную оценку — "
            "и у него достаточно истории ответов.",
            layout,
        )
    )
    blocks.append(_bullet("Определяется один человек (контакт → телефон → ID пользователя).", layout))
    blocks.append(_bullet("Считается число его ответов за период.", layout))
    blocks.append(_bullet("Проверяется, все ли ответы — оценка 5.", layout))
    blocks.append(_p("Помечается как подозрительный, если:", layout, bold=True))
    blocks.append(_bullet("число ответов ≥ 10, и", layout))
    blocks.append(_bullet("100% ответов = 5 (строго всегда пятёрки).", layout))
    blocks.append(_p("Тогда все его ответы удаляются на Tier 1.", layout))
    blocks.append(
        _p(
            "Простыми словами: «Кто всегда ставит 5 и имеет достаточно ответов — "
            "похоже на накрутку или шум, не на обычного клиента».",
            layout,
            italic=True,
        )
    )

    blocks.append(_h("3. Почему эффект сильный?", 1, layout))
    blocks.append(
        _p(
            "Такие люди обычно завышают долю пятёрок по сети. "
            "После их удаления KPI падает сильнее, чем только с BlackList + Frequency.",
            layout,
        )
    )

    blocks.append(_h("4. Результаты за период (сравнение)", 1, layout))
    blocks.append(
        _table(
            ["Метрика", "Без Always5 (_he.xlsx)", "С Always5 (_he_always5.xlsx)"],
            [
                ["network_delta_pp", "≈ −2.83 п.п.", "−6.82 п.п."],
                ["Flagged (ресторан×месяц, Tier 2)", "92", "49"],
            ],
            layout,
        )
    )
    blocks.append(_p("Интерпретация для менеджера:", layout, bold=True))
    blocks.append(
        _bullet(
            "Always top-box заметно усиливает эффект Tier 1 (дельта почти ×2.5).",
            layout,
        )
    )
    blocks.append(
        _bullet(
            "Число аномальных месяцев Tier 2 падает (92 → 49): после более жёсткой очистки "
            "респондентов меньше месяцев остаются «аномальными» по z / 90%.",
            layout,
        )
    )

    blocks.append(_h("5. Где смотреть в Excel?", 1, layout))
    blocks.append(_bullet("Лист Config → tier1_always_five_enabled = True", layout))
    blocks.append(
        _bullet(
            "Листы סיכום_מנהל / טופ_השפעה / Impact — та же структура, цифры пересчитаны",
            layout,
        )
    )
    blocks.append(
        _bullet(
            "В причинах drop появится always_topbox (вдобавок к blacklist / frequency)",
            layout,
        )
    )

    blocks.append(_h("6. Когда включать?", 1, layout))
    blocks.append(
        _table(
            ["Ситуация", "Рекомендация"],
            [
                ["Консервативный анализ / по умолчанию", "Выкл. (как _he.xlsx)"],
                ["What-If «что если убрать и всегда-пятёрки»", "Вкл. (как _he_always5.xlsx)"],
                ["Постоянное бизнес-решение", "Обсудить со stakeholders — правило агрессивное"],
            ],
            layout,
        )
    )

    blocks.append(_h("7. Одно предложение для презентации", 1, layout))
    blocks.append(
        _p(
            "«Когда Always top-box включён, помимо BlackList и частоты удаляются также "
            "респонденты с ≥10 ответами, все из которых — пятёрки; на данных этого периода "
            "это углубляет падение KPI примерно с −2.8 до −6.8 процентных пунктов».",
            layout,
            italic=True,
        )
    )
    blocks.append(
        _p(
            "Приложение к методологии Sanitization — Prototype 1.0.0 (Always top-box ON)",
            layout,
            italic=True,
        )
    )
    return _wrap_body("".join(blocks), layout)


def export_he() -> Path:
    layout = DocLayout(rtl=True, lang="he-IL", title="Tier 1 & Tier 2 — דוח למנהל")
    write_docx(OUT_HE, build_document_xml_he(layout), layout)
    return OUT_HE


def export_ru() -> Path:
    layout = DocLayout(rtl=False, lang="ru-RU", title="Tier 1 & Tier 2 — отчёт для менеджера")
    write_docx(OUT_RU, build_document_xml_ru(layout), layout)
    return OUT_RU


def export_he_always5() -> Path:
    layout = DocLayout(
        rtl=True,
        lang="he-IL",
        title="נספח Always top-box — דוח למנהל",
    )
    write_docx(OUT_HE_ALWAYS5, build_document_xml_he_always5(layout), layout)
    return OUT_HE_ALWAYS5


def export_ru_always5() -> Path:
    layout = DocLayout(
        rtl=False,
        lang="ru-RU",
        title="Приложение Always top-box — отчёт для менеджера",
    )
    write_docx(OUT_RU_ALWAYS5, build_document_xml_ru_always5(layout), layout)
    return OUT_RU_ALWAYS5


def main() -> None:
    parser = argparse.ArgumentParser(description="Export Tier 1/2 manager Word reports.")
    parser.add_argument(
        "--lang",
        choices=("he", "ru", "all"),
        default="all",
        help="Language: he, ru, or all (default: all)",
    )
    parser.add_argument(
        "--variant",
        choices=("base", "always5", "all"),
        default="always5",
        help="base methodology, Always5 supplement, or all (default: always5)",
    )
    args = parser.parse_args()
    want_he = args.lang in ("he", "all")
    want_ru = args.lang in ("ru", "all")
    want_base = args.variant in ("base", "all")
    want_always5 = args.variant in ("always5", "all")

    if want_base and want_he:
        print(f"Wrote {export_he()}")
    if want_base and want_ru:
        print(f"Wrote {export_ru()}")
    if want_always5 and want_he:
        print(f"Wrote {export_he_always5()}")
    if want_always5 and want_ru:
        print(f"Wrote {export_ru_always5()}")


if __name__ == "__main__":
    main()
