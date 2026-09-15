"""Generate Hebrew Word request for DB team: Q10012 physical tables."""

from __future__ import annotations

from pathlib import Path

from scripts.export_tier_manager_doc_he import (
    DocLayout,
    _bullet,
    _h,
    _p,
    _table,
    write_docx,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "research" / "db_request_q10012_table_he.docx"


def _wrap_body(blocks: list[str], layout: DocLayout) -> str:
    body = "".join(blocks)
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


def build_document_xml(layout: DocLayout) -> str:
    blocks: list[str] = []

    blocks.append(_h("בקשה למחלקת DB: טבלה פיזית עבור Survey KPI Sanitization", 0, layout))
    blocks.append(_p("אפליקציית ניקוי סקרים — מדד 5% (Q10012 / Top-Box)", layout, italic=True))
    blocks.append(_p("מסמך לבקשת יצירת Dataset מוכן לקריאה (read-only)", layout, italic=True))
    blocks.append("<w:p/>")

    blocks.append(_h("1. למה זה נדרש?", 1, layout))
    blocks.append(
        _p(
            "האפליקציה מחשבת את השפעת ניקוי תשובות הסקר על מדד אחוז החמישיות (שאלה 10012).",
            layout,
        )
    )
    blocks.append(
        _p(
            "כיום הקריאה נעשית מ-VIEW: "
            "SummerCampain.dbo.TargetsByMetrics_RateGetAnswers — "
            "וכל הרצה לוקחת כ־דקה בגלל עלות ה-VIEW.",
            layout,
        )
    )
    blocks.append(
        _p(
            "נדרשת טבלה פיזית מוכנה עם השורות והעמודות הנחוצות בלבד, "
            "כדי שהאפליקציה תעבוד במהירות וביציבות.",
            layout,
        )
    )
    blocks.append(
        _p(
            "האפליקציה תבצע SELECT בלבד (read-only). אין כתיבה לטבלאות המקור.",
            layout,
            bold=True,
        )
    )

    blocks.append(_h("2. מה ליצור", 1, layout))
    blocks.append(_h("2.1 טבלת עובדות (חובה)", 2, layout))
    blocks.append(_p("שם מוצע: dbo.Q10012_Sanitization_Answers", layout, mono=True))
    blocks.append(_p("סינון בעת המילוי / הרענון:", layout, bold=True))
    blocks.append(_bullet("Question_ID = 10012", layout))
    blocks.append(_bullet("Answer_Value IS NOT NULL", layout))
    blocks.append(
        _bullet("AnswerTime >= '2026-01-01' (חלון הזמן לתיאום בהמשך)", layout)
    )
    blocks.append(_p("עמודות נדרשות:", layout, bold=True))
    blocks.append(
        _table(
            ["עמודה", "תפקיד"],
            [
                ["ParticipateNumber", "מזהה השתתפות"],
                ["Question_ID", "בקרה (=10012)"],
                ["Answer_Value", "ציון 1–5; Top-box = 5"],
                ["BlackList", "Tier1: לקוח רגיל = לא"],
                ["UserContact", "זהות (PII)"],
                ["PhoneFromLog", "זהות חלופית (PII)"],
                ["ext_user_id", "זהות חלופית"],
                ["PrintStore", "סניף"],
                ["AnswerTime", "תקופה / יום לכלל תדירות"],
                ["Year", "סניף × חודש"],
                ["Month", "סניף × חודש"],
            ],
            layout,
        )
    )
    blocks.append(
        _p(
            "מקור המילוי: ה-VIEW הקיים או טבלאות הבסיס שלו — "
            "לאסוף ולרענן לטבלה ייעודית, ולא לחשוף את ה-VIEW ישירות לאפליקציה.",
            layout,
        )
    )

    blocks.append(_h("2.2 טבלת אגרגציה (מומלץ — מאיץ baseline)", 2, layout))
    blocks.append(_p("שם מוצע: dbo.Q10012_Sanitization_StoreMonth", layout, mono=True))
    blocks.append(
        _p(
            "עמודות: PrintStore, Year, Month, total_count, top_box_count "
            "(= אגרגציה מטבלת העובדות).",
            layout,
        )
    )
    blocks.append(
        _p(
            "טבלה זו תאפשר חישוב מהיר של Actual / baseline בלי סריקה מלאה של כל השורות בכל הרצה.",
            layout,
        )
    )

    blocks.append(_h("3. אינדקסים", 1, layout))
    blocks.append(_bullet("על AnswerTime (או AnswerTime, PrintStore)", layout))
    blocks.append(_bullet("(PrintStore, Year, Month)", layout))
    blocks.append(_bullet("(BlackList) או (BlackList, AnswerTime)", layout))
    blocks.append(_bullet("בטבלת האגרגציה: ייחודי (PrintStore, Year, Month)", layout))

    blocks.append(_h("4. רענון (ETL)", 1, layout))
    blocks.append(_bullet("Job פעם ביום (או לעיתים קרובות יותר — לפי SLA)", layout))
    blocks.append(
        _bullet("Full rebuild של חלון הזמן, או incremental לפי AnswerTime", layout)
    )
    blocks.append(_bullet("אחרי רענון — חישוב מחדש של טבלת האגרגציה", layout))
    blocks.append(_bullet("רצוי עמודה LoadedAt / תאריך Snapshot לבקרת טריות", layout))

    blocks.append(_h("5. הרשאות", 1, layout))
    blocks.append(
        _p(
            "חשבון read-only של האפליקציה עם SELECT על הטבלאות החדשות בלבד.",
            layout,
        )
    )

    blocks.append(_h("6. קריטריון הצלחה", 1, layout))
    blocks.append(
        _p(
            "קריאת התקופה מ-2026-01-01 לחישוב KPI — בשניות, "
            "ולא כ־40–60 שניות כמו ב-VIEW כיום.",
            layout,
            bold=True,
        )
    )

    blocks.append(_h("7. הערות", 1, layout))
    blocks.append(
        _bullet(
            "העמודות מכילות PII (UserContact / PhoneFromLog) — גישה מוגבלת לחשבון השירות בלבד.",
            layout,
        )
    )
    blocks.append(
        _bullet(
            "לאחר זמינות הטבלאות האפליקציה תועבר מה-VIEW למקור החדש.",
            layout,
        )
    )

    return _wrap_body(blocks, layout)


def main() -> None:
    layout = DocLayout(
        rtl=True,
        lang="he-IL",
        title="בקשה ל-DB: טבלת Q10012 Sanitization",
    )
    xml = build_document_xml(layout)
    write_docx(OUT, xml, layout)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
