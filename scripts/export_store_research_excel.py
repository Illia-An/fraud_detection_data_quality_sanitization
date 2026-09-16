"""Export per-store sanitization research workbook (Excel).

Sheets:
  איך_לקרוא / סיכום_מנהל / טופ_השפעה / טופ_חריגים — Hebrew manager summary (RTL)
  Pipeline_steps — sequential tier metrics (actual → tier1 → … → tier4)
  Flagged, All_store_months, Impact, Network_KPI, Config — detailed analytic sheets

Usage (repo root):
  uv run python scripts/export_store_research_excel.py
  uv run python scripts/export_store_research_excel.py --preset medium
  uv run python scripts/export_store_research_excel.py --source snapshot --from-date 2026-01-01 --to-date 2026-09-14 --all-tiers
  uv run python scripts/export_store_research_excel.py --source db --from-date 2026-01-01 --to-date 2026-09-14 --all-tiers
"""

from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

from backend.db_sample import DbSampleError, DbSampleQuery, load_db_sample_from_settings, redact_row
from backend.schemas import PipelineConfig, ProcessRequest, SurveyAnswerRow
from backend.service import run_pipeline
from backend.snapshot import ANSWERS_TABLE, DEFAULT_SNAPSHOT_PATH
from fraud_guard.synthetic import PRESETS, generate_preset

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "research"

_MANAGER_TOP_N = 20

STEP_LABELS = {
    "actual": "Actual (baseline)",
    "tier1": "Tier 1 — BlackList",
    "tier2": "Tier 2 — Frequency",
    "tier3": "Tier 3 — Always top-box",
    "tier4": "Tier 4 — Store×month",
}


def all_tiers_config(*, always_five_min_n: int = 10) -> PipelineConfig:
    """All four sequential tiers enabled (current app defaults + Tier 3 on)."""
    return PipelineConfig(
        tier1_blacklist_enabled=True,
        tier2_freq_enabled=True,
        tier2_freq_threshold=3,
        tier3_always_five_enabled=True,
        tier3_always_five_min_n=always_five_min_n,
        tier4_enabled=True,
        tier4_min_volume=30,
        tier4_z_threshold=2.0,
        tier4_pct_threshold=90.0,
    )


def _load_snapshot_rows(query: DbSampleQuery) -> list[SurveyAnswerRow]:
    if not DEFAULT_SNAPSHOT_PATH.is_file():
        raise SystemExit(f"Snapshot missing: {DEFAULT_SNAPSHOT_PATH}")

    end_exclusive = (
        datetime.combine(query.to_date, datetime.min.time()) + timedelta(days=1)
        if query.to_date
        else None
    )
    from_ts = datetime.combine(query.from_date, datetime.min.time())
    sql = f"""
SELECT
    ParticipateNumber, Question_ID, Answer_Value, BlackList,
    UserContact, PhoneFromLog, ext_user_id, PrintStore,
    AnswerTime, Year, Month
FROM {ANSWERS_TABLE}
WHERE Question_ID = 10012
  AND Answer_Value IS NOT NULL
  AND AnswerTime >= :from_ts
"""
    params: dict = {"from_ts": from_ts.isoformat()}
    if end_exclusive is not None:
        sql += "  AND AnswerTime < :to_ts\n"
        params["to_ts"] = end_exclusive.isoformat()
    sql += "ORDER BY AnswerTime ASC"

    engine = create_engine(f"sqlite:///{DEFAULT_SNAPSHOT_PATH.as_posix()}")
    with engine.connect() as conn:
        raw = [dict(m) for m in conn.execute(text(sql), params).mappings()]
    return [SurveyAnswerRow.model_validate(redact_row(r)) for r in raw]


def _he_driver(row: pd.Series) -> str:
    """One-line Hebrew conclusion: what mainly moved the KPI (4-tier sequential)."""
    actual = row.get("actual_five_pct")
    t1 = row.get("after_tier1_five_pct")
    t2 = row.get("after_tier2_five_pct")
    t3 = row.get("after_tier3_five_pct")
    t4 = row.get("after_tier4_five_pct")
    final_vol = row.get("final_volume")
    dropped = int(row.get("rows_dropped") or 0)

    if pd.isna(actual):
        return "אין נתונים מספיקים"

    t_final = t4 if pd.notna(t4) else (t3 if pd.notna(t3) else t2)
    if final_vol == 0 or (pd.notna(t1) and pd.isna(t_final) and (final_vol or 0) == 0):
        return "חודש חריג (Tier4): כל התשובות לחודש זה הוסרו — שיעור גבוה במיוחד של 5"

    deltas = []
    if pd.notna(t1):
        deltas.append(("Tier1 BlackList", float(t1 - actual)))
    if pd.notna(t2):
        deltas.append(("Tier2 Frequency", float(t2 - (t1 if pd.notna(t1) else actual))))
    if pd.notna(t3):
        deltas.append(("Tier3 Always-5", float(t3 - (t2 if pd.notna(t2) else actual))))
    if pd.notna(t4):
        prev = t3 if pd.notna(t3) else (t2 if pd.notna(t2) else t1)
        deltas.append(("Tier4 Store×month", float(t4 - (prev if pd.notna(prev) else actual))))

    if not deltas:
        return "שינוי קטן לאחר ניקוי — הסניף יציב יחסית לפי הכללים הנוכחיים"

    stage, d = max(deltas, key=lambda x: abs(x[1]))
    if abs(d) >= 1.0:
        if stage.startswith("Tier4"):
            return (
                f"עיקר השינוי ב-{stage}: "
                f"אחרי Tier3 {t3 if pd.notna(t3) else t2:.1f}% → אחרי Tier4 {t4:.1f}%"
            )
        return (
            f"עיקר הירידה ב-{stage}: {actual:.1f}% → {t_final:.1f}% "
            f"(−{abs(actual - t_final):.1f} נק'), הוסרו {dropped} תשובות"
        )
    return "שינוי קטן לאחר ניקוי — הסניף יציב יחסית לפי הכללים הנוכחיים"


def _pipeline_steps_df(res) -> pd.DataFrame:
    rows = []
    prev_pct: float | None = None
    for step in res.steps:
        delta = None if prev_pct is None else round(step.top_box_pct - prev_pct, 4)
        rows.append(
            {
                "step_name": step.step_name,
                "step_label": STEP_LABELS.get(step.step_name, step.step_name),
                "rows_in": step.rows_in,
                "rows_out": step.rows_out,
                "rows_dropped": step.rows_dropped,
                "top_box_pct": round(step.top_box_pct, 4),
                "delta_vs_prev_pp": delta,
            }
        )
        prev_pct = step.top_box_pct
    return pd.DataFrame(rows)


def _manager_summary_he(
    *,
    impact: pd.DataFrame,
    flagged: pd.DataFrame,
    kpi_row: dict,
    steps: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Build Hebrew manager sheets: network blurb, top impact, top flagged."""
    period = f"{kpi_row.get('period_from') or '—'} עד {kpi_row.get('period_to') or '—'}"
    network_rows = [
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
            "הסבר": "אחרי Tier4 (store×month) — כל השלבים ברצף",
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
            "נושא": "סניף×חודש שסומנו כחריגים (Tier4)",
            "ערך": kpi_row.get("flagged_store_months"),
            "הסבר": "חודשים עם % חמישיות גבוה מאוד / z גבוה — לבדיקה תפעולית",
        },
    ]
    for _, s in steps.iterrows():
        if s["step_name"] == "actual":
            continue
        network_rows.append(
            {
                "נושא": f"אחרי {s['step_label']}",
                "ערך": round(float(s["top_box_pct"]), 2),
                "הסבר": f"הוסרו {int(s['rows_dropped'])} תשובות בשלב זה",
            }
        )
    network = pd.DataFrame(network_rows)

    guide = pd.DataFrame(
        [
            {
                "שלב": "1",
                "מה לפתוח": "סיכום_מנהל",
                "איך לקרוא": "ראו את פער הרשת — כמה המדד משתנה אחרי ניקוי בכל הרשת",
            },
            {
                "שלב": "2",
                "מה לפתוח": "Pipeline_steps",
                "איך לקרוא": "שלבי actual → Tier1 → Tier2 → Tier3 → Tier4 ברצף (כל tier מופעל)",
            },
            {
                "שלב": "3",
                "מה לפתוח": "טופ_השפעה",
                "איך לקרוא": "סניפים/חודשים עם הירידה הכי חזקה ב-% חמישיות — עדיפות לבירור",
            },
            {
                "שלב": "4",
                "מה לפתוח": "טופ_חריגים",
                "איך לקרוא": "חודשים 'טובים מדי' (Tier4) — לא האשמה, אלא דגל לבדיקה",
            },
            {
                "שלב": "5",
                "מה לפתוח": "Impact",
                "איך לקרוא": (
                    "פירוט מלא: Actual → Tier1 BlackList → Tier2 Freq → "
                    "Tier3 Always-5 → Tier4 Store×month"
                ),
            },
            {
                "שלב": "הערה",
                "מה לפתוח": "—",
                "איך לקרוא": (
                    "כל tier מופעל ורץ ברצף. Tier1=BlackList, Tier2=תדירות, "
                    "Tier3=Always top-box, Tier4=חודש חריג של הסניף"
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
                "%_אחרי_Tier1_BlackList": top["after_tier1_five_pct"].round(2),
                "%_אחרי_Tier2_Freq": top["after_tier2_five_pct"].round(2),
                "%_אחרי_Tier3_Always5": top["after_tier3_five_pct"].round(2),
                "%_אחרי_Tier4_StoreMonth": top["after_tier4_five_pct"].round(2),
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
                    f"Tier4 — חודש חריג: {pct:.1f}% חמישיות על {int(vol)} תשובות (z={zv:.2f})"
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
        impact["final_five_pct"] = impact["after_tier4_five_pct"]
        no_final = impact["final_five_pct"].isna() & impact["after_tier3_five_pct"].notna()
        still_has_rows = impact["final_volume"] > 0
        impact.loc[no_final & still_has_rows, "final_five_pct"] = impact.loc[
            no_final & still_has_rows, "after_tier3_five_pct"
        ]
        impact["delta_pp"] = impact["final_five_pct"] - impact["actual_five_pct"]
        impact = impact.sort_values("delta_pp", na_position="last")

    steps_df = _pipeline_steps_df(res)

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
        "pipeline_model": "4-tier sequential (all enabled)",
    }
    kpi = pd.DataFrame([kpi_row])
    config_df = pd.DataFrame([res.echo_config.model_dump()])
    drop_reasons = res.meta.get("drop_reasons", {})
    if isinstance(drop_reasons, dict):
        config_df["drop_reasons_json"] = [str(drop_reasons)]

    guide_he, network_he, top_impact_he, top_flagged_he = _manager_summary_he(
        impact=impact, flagged=flagged, kpi_row=kpi_row, steps=steps_df
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(out_path, engine="openpyxl") as writer:
        guide_he.to_excel(writer, sheet_name="איך_לקרוא", index=False)
        network_he.to_excel(writer, sheet_name="סיכום_מנהל", index=False)
        steps_df.to_excel(writer, sheet_name="Pipeline_steps", index=False)
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
        f"  source={label} baseline={res.baseline_top_box_pct:.4f} "
        f"final={res.final_top_box_pct:.4f} delta={res.network_delta_pp:.4f} "
        f"flagged={len(flagged)} impact_rows={len(impact)} rows_in={res.meta.get('input_rows')}"
    )
    for _, s in steps_df.iterrows():
        print(
            f"  {s['step_label']}: dropped={s['rows_dropped']} "
            f"pct={s['top_box_pct']:.4f} delta={s['delta_vs_prev_pp']}"
        )


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


def _resolve_config(args: argparse.Namespace) -> PipelineConfig:
    if args.all_tiers:
        return all_tiers_config(always_five_min_n=args.always_five_min_n)
    return PipelineConfig(
        tier3_always_five_enabled=args.always_five,
        tier3_always_five_min_n=args.always_five_min_n,
    )


def _output_suffix(args: argparse.Namespace) -> str:
    parts: list[str] = []
    if args.all_tiers:
        parts.append("4tier_all")
    elif args.always_five:
        parts.append(f"always5_min{args.always_five_min_n}")
    return f"_{'_'.join(parts)}" if parts else ""


def main() -> None:
    parser = argparse.ArgumentParser(description="Export store research Excel workbook")
    parser.add_argument(
        "--source",
        choices=["synthetic", "db", "snapshot"],
        default="snapshot",
        help="data source: snapshot (local SQLite), db (SQL Server VIEW), or synthetic preset",
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
        help="period start (inclusive), ISO date",
    )
    parser.add_argument(
        "--to-date",
        type=_parse_date,
        default=date(2026, 9, 14),
        help="period end (inclusive), ISO date",
    )
    parser.add_argument("--out", type=Path, default=None, help="output .xlsx path")
    parser.add_argument(
        "--all-tiers",
        action="store_true",
        help="enable all four sequential tiers (Tier1–4 including always-top-box)",
    )
    parser.add_argument(
        "--always-five",
        action="store_true",
        help="enable Tier3 always-top-box only (ignored when --all-tiers)",
    )
    parser.add_argument(
        "--always-five-min-n",
        type=int,
        default=10,
        metavar="N",
        help="Tier3 always-top-box min history (tier3_always_five_min_n, default: 10)",
    )
    args = parser.parse_args()
    if args.always_five_min_n < 1:
        raise SystemExit("--always-five-min-n must be >= 1")

    config = _resolve_config(args)
    suffix = _output_suffix(args)

    if args.source == "synthetic":
        raw = generate_preset(args.preset)  # type: ignore[arg-type]
        rows = [SurveyAnswerRow.model_validate(r) for r in raw]
        out = args.out or (OUT_DIR / f"store_research_{args.preset}{suffix}.xlsx")
        _write_workbook(label=args.preset, rows=rows, config=config, out_path=out)
        return

    query = DbSampleQuery(from_date=args.from_date, to_date=args.to_date)

    if args.source == "snapshot":
        rows = _load_snapshot_rows(query)
        label = "snapshot"
    else:
        try:
            sample = load_db_sample_from_settings(query)
        except DbSampleError as exc:
            raise SystemExit(f"DB load failed: {exc}") from exc
        if not sample.rows:
            raise SystemExit(
                f"No Q10012 rows for {args.from_date.isoformat()} .. {args.to_date.isoformat()}"
            )
        rows = sample.rows
        label = "db"

    out = args.out or (
        OUT_DIR
        / (
            f"he_store_research_{args.from_date.isoformat()}_to_"
            f"{args.to_date.isoformat()}{suffix}.xlsx"
        )
    )
    _write_workbook(
        label=label,
        rows=rows,
        config=config,
        out_path=out,
        period_from=args.from_date.isoformat(),
        period_to=args.to_date.isoformat(),
    )


if __name__ == "__main__":
    main()
