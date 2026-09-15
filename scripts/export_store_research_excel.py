"""Export per-store sanitization research workbook (Excel).

Sheets:
  איך_לקרוא / סיכום_מנהל / טופ_השפעה / טופ_חריגים — Hebrew manager summary (RTL)
  Flagged, All_store_months, Impact, Network_KPI, Config — detailed analytic sheets

Usage (repo root):
  uv run python scripts/export_store_research_excel.py
  uv run python scripts/export_store_research_excel.py --preset medium
  uv run python scripts/export_store_research_excel.py --source db --from-date 2026-01-01 --to-date 2026-09-14
  uv run python scripts/export_store_research_excel.py --source db --always-five --always-five-min-n 20
"""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

import pandas as pd

from backend.db_sample import DbSampleError, DbSampleQuery, load_db_sample_from_settings
from backend.schemas import PipelineConfig, ProcessRequest, SurveyAnswerRow
from backend.service import run_pipeline
from fraud_guard.synthetic import PRESETS, generate_preset

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "research"

_MANAGER_TOP_N = 20


def _he_driver(row: pd.Series) -> str:
    """One-line Hebrew conclusion: what mainly moved the KPI."""
    actual = row.get("actual_five_pct")
    t1 = row.get("after_tier1_five_pct")
    t2 = row.get("after_tier2_five_pct")
    final_vol = row.get("final_volume")
    dropped = int(row.get("rows_dropped") or 0)

    if pd.isna(actual):
        return "אין נתונים מספיקים"

    if final_vol == 0 or (pd.notna(t1) and pd.isna(t2) and (final_vol or 0) == 0):
        return "חודש חריג (Tier2): כל התשובות לחודש זה הוסרו — שיעור גבוה במיוחד של 5"

    d1 = (t1 - actual) if pd.notna(t1) else 0.0
    d2 = (t2 - t1) if (pd.notna(t2) and pd.notna(t1)) else 0.0

    if abs(d1) >= abs(d2) and abs(d1) >= 1.0:
        return (
            f"עיקר הירידה ב-Tier1 (איכות משיבים/BlackList/תדירות): "
            f"{actual:.1f}% → {t1:.1f}% (−{abs(d1):.1f} נק'), הוסרו {dropped} תשובות"
        )
    if abs(d2) >= 1.0 and pd.notna(t2):
        return (
            f"עיקר השינוי ב-Tier2 (חודש חריג של הסניף): "
            f"אחרי ניקוי משיבים {t1:.1f}% → אחרי הסרת חודש חריג {t2:.1f}%"
        )
    if abs(d1) < 1.0 and abs(d2) < 1.0:
        return "שינוי קטן לאחר ניקוי — הסניף יציב יחסית לפי הכללים הנוכחיים"
    return "יש לבדוק ידנית: שילוב של איכות משיבים ו/או חודש חריג"


def _manager_summary_he(
    *,
    impact: pd.DataFrame,
    flagged: pd.DataFrame,
    kpi_row: dict,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Build Hebrew manager sheets: network blurb, top impact, top flagged."""
    period = f"{kpi_row.get('period_from') or '—'} עד {kpi_row.get('period_to') or '—'}"
    network = pd.DataFrame(
        [
            {
                "נושא": "תקופה",
                "ערך": period,
                "הסבר": "חלון AnswerTime לניתוח (כולל תאריכי הקצה)",
            },
            {
                "נושא": "% חמישיות לפני ניקוי (Baseline)",
                "ערך": round(float(kpi_row["baseline_top_box_pct"]), 2),
                "הסבר": "שיעור תשובות 5 מתוך כל התשובות — לפני סינון",
            },
            {
                "נושא": "% חמישיות אחרי ניקוי (Final)",
                "ערך": round(float(kpi_row["final_top_box_pct"]), 2),
                "הסבר": "אחרי Tier1 (משיבים) ואחרי Tier2 (חודשים חריגים)",
            },
            {
                "נושא": "פער רשת (נקודות אחוז)",
                "ערך": round(float(kpi_row["network_delta_pp"]), 2),
                "הסבר": "Final − Baseline. שלילי = המדד יורד אחרי ניקוי נתונים חשודים",
            },
            {
                "נושא": "מספר תשובות בתקופה",
                "ערך": kpi_row.get("input_rows"),
                "הסבר": "נפח סקרים שנכנסו לניתוח",
            },
            {
                "נושא": "סניף×חודש שסומנו כחריגים",
                "ערך": kpi_row.get("flagged_store_months"),
                "הסבר": "חודשים עם % חמישיות גבוה מאוד / z גבוה — לבדיקה תפעולית",
            },
        ]
    )

    guide = pd.DataFrame(
        [
            {
                "שלב": "1",
                "מה לפתוח": "סיכום_מנהל",
                "איך לקרוא": "ראו את פער הרשת — כמה המדד משתנה אחרי ניקוי בכל הרשת",
            },
            {
                "שלב": "2",
                "מה לפתוח": "טופ_השפעה",
                "איך לקרוא": "סניפים/חודשים עם הירידה הכי חזקה ב-% חמישיות — עדיפות לבירור",
            },
            {
                "שלב": "3",
                "מה לפתוח": "טופ_חריגים",
                "איך לקרוא": "חודשים 'טובים מדי' (קרוב ל-100% חמישיות) — לא האשמה, אלא דגל לבדיקה",
            },
            {
                "שלב": "4",
                "מה לפתוח": "Impact",
                "איך לקרוא": "פירוט מלא: Actual ואז אחרי משיבים (Tier1) ואז אחרי חודשים חריגים (Tier2)",
            },
            {
                "שלב": "הערה",
                "מה לפתוח": "—",
                "איך לקרוא": (
                    "ירידה גדולה כבר ב-Tier1 = בעיית איכות משיבים. "
                    "שינוי/הסרה ב-Tier2 = חודש חריג של הסניף"
                ),
            },
        ]
    )

    top_impact = pd.DataFrame()
    if not impact.empty and "delta_pp" in impact.columns:
        top = impact.nsmallest(_MANAGER_TOP_N, "delta_pp", keep="all").copy()
        top_impact = pd.DataFrame(
            {
                "סניף": top["store_id"],
                "חודש": top["period_label"],
                "%_לפני": top["actual_five_pct"].round(2),
                "%_אחרי_משיבים_Tier1": top["after_tier1_five_pct"].round(2),
                "%_אחרי_חריגים_Tier2": top["after_tier2_five_pct"].round(2),
                "פער_נקודות": top["delta_pp"].round(2),
                "תשובות_לפני": top["actual_volume"],
                "תשובות_אחרי": top["final_volume"],
                "הוסרו": top["rows_dropped"],
                "מסקנה": [_he_driver(r) for _, r in top.iterrows()],
            }
        )

    top_flagged = pd.DataFrame()
    if not flagged.empty:
        f = flagged.sort_values("z", ascending=False).head(_MANAGER_TOP_N).copy()
        top_flagged = pd.DataFrame(
            {
                "סניף": f["store_id"],
                "שנה": f["year"],
                "חודש": f["month"],
                "%_חמישיות": f["five_pct"].round(2),
                "נפח_תשובות": f["volume"],
                "z": f["z"].round(3),
                "מסקנה": [
                    f"חודש חריג כלפי מעלה: {pct:.1f}% חמישיות על {int(vol)} תשובות (z={zv:.2f}) — מומלץ לבדוק מקור המשיבים"
                    for pct, vol, zv in zip(f["five_pct"], f["volume"], f["z"], strict=True)
                ],
            }
        )

    return guide, network, top_impact, top_flagged


def _set_sheet_rtl(writer: pd.ExcelWriter, sheet_name: str) -> None:
    ws = writer.sheets.get(sheet_name)
    if ws is not None:
        ws.sheet_view.rightToLeft = True


def _write_workbook(
    *,
    label: str,
    rows: list[SurveyAnswerRow],
    config: PipelineConfig,
    out_path: Path,
    period_from: str | None = None,
    period_to: str | None = None,
) -> None:
    # Research exports can exceed API ProcessRequest.rows max_length (500k);
    # bypass HTTP payload validation for offline workbook generation.
    res = run_pipeline(
        ProcessRequest.model_construct(source="inline", rows=rows, config=config)
    )

    panel = pd.DataFrame(res.high_store_months)
    if panel.empty:
        panel = pd.DataFrame(
            columns=["store_id", "year", "month", "volume", "five_pct", "z", "flagged"]
        )
    else:
        panel = panel.sort_values(["flagged", "z"], ascending=[False, False])

    flagged = (
        panel.loc[panel["flagged"] == True].copy()  # noqa: E712
        if "flagged" in panel.columns
        else panel.iloc[0:0]
    )

    impact = pd.DataFrame(res.store_impact_series)
    if not impact.empty:
        impact["final_five_pct"] = impact["after_tier2_five_pct"]
        no_t2 = impact["after_tier2_five_pct"].isna() & impact["after_tier1_five_pct"].notna()
        still_has_rows = impact["final_volume"] > 0
        impact.loc[no_t2 & still_has_rows, "final_five_pct"] = impact.loc[
            no_t2 & still_has_rows, "after_tier1_five_pct"
        ]
        impact["delta_pp"] = impact["final_five_pct"] - impact["actual_five_pct"]
        impact = impact.sort_values("delta_pp", na_position="last")

    kpi_row = {
        "source": label,
        "period_from": period_from,
        "period_to": period_to,
        "baseline_top_box_pct": res.baseline_top_box_pct,
        "final_top_box_pct": res.final_top_box_pct,
        "network_delta_pp": res.network_delta_pp,
        "flagged_store_months": int(flagged.shape[0]),
        "store_months_in_impact": int(impact.shape[0]),
        "input_rows": res.meta.get("input_rows"),
        "answered_rows": res.meta.get("answered_rows"),
    }
    kpi = pd.DataFrame([kpi_row])
    config_df = pd.DataFrame([res.echo_config.model_dump()])
    guide_he, network_he, top_impact_he, top_flagged_he = _manager_summary_he(
        impact=impact, flagged=flagged, kpi_row=kpi_row
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(out_path, engine="openpyxl") as writer:
        guide_he.to_excel(writer, sheet_name="איך_לקרוא", index=False)
        network_he.to_excel(writer, sheet_name="סיכום_מנהל", index=False)
        top_impact_he.to_excel(writer, sheet_name="טופ_השפעה", index=False)
        top_flagged_he.to_excel(writer, sheet_name="טופ_חריגים", index=False)
        flagged.to_excel(writer, sheet_name="Flagged", index=False)
        panel.to_excel(writer, sheet_name="All_store_months", index=False)
        impact.to_excel(writer, sheet_name="Impact", index=False)
        kpi.to_excel(writer, sheet_name="Network_KPI", index=False)
        config_df.to_excel(writer, sheet_name="Config", index=False)
        for name in ("איך_לקרוא", "סיכום_מנהל", "טופ_השפעה", "טופ_חריגים"):
            _set_sheet_rtl(writer, name)

    print(f"Wrote {out_path}")
    print(
        f"  source={label} network_delta_pp={res.network_delta_pp} "
        f"flagged={len(flagged)} impact_rows={len(impact)} "
        f"rows_in={res.meta.get('input_rows')}"
    )


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


def main() -> None:
    parser = argparse.ArgumentParser(description="Export store research Excel workbook")
    parser.add_argument(
        "--source",
        choices=["synthetic", "db"],
        default="synthetic",
        help="synthetic preset or live SQL Server period",
    )
    parser.add_argument(
        "--preset",
        choices=list(PRESETS.keys()),
        default="small",
        help="synthetic preset when --source=synthetic (default: small)",
    )
    parser.add_argument(
        "--from-date",
        type=_parse_date,
        default=date(2026, 1, 1),
        help="DB period start (inclusive), ISO date",
    )
    parser.add_argument(
        "--to-date",
        type=_parse_date,
        default=date(2026, 9, 14),
        help="DB period end (inclusive), ISO date",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="output .xlsx path",
    )
    parser.add_argument(
        "--always-five",
        action="store_true",
        help="enable Tier1 always-top-box rule (tier1_always_five_enabled=True)",
    )
    parser.add_argument(
        "--always-five-min-n",
        type=int,
        default=10,
        metavar="N",
        help="always-top-box min history size (tier1_always_five_min_n, default: 10)",
    )
    args = parser.parse_args()
    if args.always_five_min_n < 1:
        raise SystemExit("--always-five-min-n must be >= 1")
    config = PipelineConfig(
        tier1_always_five_enabled=args.always_five,
        tier1_always_five_min_n=args.always_five_min_n,
    )

    def _suffix() -> str:
        if not args.always_five:
            return ""
        return f"_always5_min{args.always_five_min_n}"

    if args.source == "synthetic":
        raw = generate_preset(args.preset)  # type: ignore[arg-type]
        rows = [SurveyAnswerRow.model_validate(r) for r in raw]
        out = args.out or (OUT_DIR / f"store_research_{args.preset}{_suffix()}.xlsx")
        _write_workbook(label=args.preset, rows=rows, config=config, out_path=out)
        return

    query = DbSampleQuery(from_date=args.from_date, to_date=args.to_date)
    try:
        sample = load_db_sample_from_settings(query)
    except DbSampleError as exc:
        raise SystemExit(f"DB load failed: {exc}") from exc

    if not sample.rows:
        raise SystemExit(
            f"No Q10012 rows for {args.from_date.isoformat()} .. {args.to_date.isoformat()}"
        )

    out = args.out or (
        OUT_DIR
        / (
            f"store_research_{args.from_date.isoformat()}_to_"
            f"{args.to_date.isoformat()}{_suffix()}.xlsx"
        )
    )
    _write_workbook(
        label="db",
        rows=sample.rows,
        config=config,
        out_path=out,
        period_from=args.from_date.isoformat(),
        period_to=args.to_date.isoformat(),
    )


if __name__ == "__main__":
    main()
