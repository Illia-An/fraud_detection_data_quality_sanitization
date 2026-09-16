"""Compare live pipeline output to a store_research Excel reference workbook.

Usage (repo root):
  python scripts/verify_research_excel.py
  python scripts/verify_research_excel.py --excel docs/research/he_store_research_2026-01-01_to_2026-09-14.xlsx
"""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

from backend.db_sample import DbSampleQuery, redact_row
from backend.queries import (
    get_actual_baseline_aggregates,
    get_tier_candidate_rows,
    query_b_mode_for_dialect,
)
from backend.schemas import PipelineConfig, ProcessRequest, SurveyAnswerRow
from backend.service import run_pipeline, run_pipeline_pushdown
from backend.snapshot import ANSWERS_TABLE, DEFAULT_SNAPSHOT_PATH

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EXCEL = ROOT / "docs" / "research" / "he_store_research_2026-01-01_to_2026-09-14.xlsx"


def _load_snapshot_rows(from_date: date, to_date: date) -> list[SurveyAnswerRow]:
    if not DEFAULT_SNAPSHOT_PATH.is_file():
        raise SystemExit(f"Snapshot missing: {DEFAULT_SNAPSHOT_PATH}")

    engine = create_engine(f"sqlite:///{DEFAULT_SNAPSHOT_PATH.as_posix()}")
    end_exclusive = to_date.toordinal() + 1
    from datetime import datetime

    end_dt = datetime.fromordinal(end_exclusive)
    sql = f"""
SELECT
    ParticipateNumber, Question_ID, Answer_Value, BlackList,
    UserContact, PhoneFromLog, ext_user_id, PrintStore,
    AnswerTime, Year, Month
FROM {ANSWERS_TABLE}
WHERE Question_ID = 10012
  AND Answer_Value IS NOT NULL
  AND AnswerTime >= :from_ts
  AND AnswerTime < :to_ts
ORDER BY AnswerTime ASC
"""
    params = {"from_ts": datetime(from_date.year, from_date.month, from_date.day), "to_ts": end_dt}
    with engine.connect() as conn:
        raw = [dict(m) for m in conn.execute(text(sql), params).mappings()]
    return [SurveyAnswerRow.model_validate(redact_row(r)) for r in raw]


def _config_from_excel(config_df: pd.DataFrame) -> PipelineConfig:
    row = config_df.iloc[0].to_dict()
    # Old export column names → migrated by PipelineConfig validator.
    legacy = {
        "tier1_blacklist_enabled": bool(int(row.get("tier1_blacklist_enabled", 1))),
        "tier1_freq_threshold": int(row.get("tier1_freq_threshold", 3)),
        "tier1_always_five_enabled": bool(int(row.get("tier1_always_five_enabled", 0))),
        "tier1_always_five_min_n": int(row.get("tier1_always_five_min_n", 10)),
        "tier2_min_volume": int(row.get("tier2_min_volume", 30)),
        "tier2_z_threshold": float(row.get("tier2_z_threshold", 2.0)),
        "tier2_pct_threshold": float(row.get("tier2_pct_threshold", 90.0)),
    }
    return PipelineConfig.model_validate(legacy)


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify pipeline vs research Excel")
    parser.add_argument("--excel", type=Path, default=DEFAULT_EXCEL)
    parser.add_argument("--from-date", type=date.fromisoformat, default=date(2026, 1, 1))
    parser.add_argument("--to-date", type=date.fromisoformat, default=date(2026, 9, 14))
    parser.add_argument("--tolerance-pp", type=float, default=0.05)
    parser.add_argument(
        "--strict-rows",
        action="store_true",
        help="fail when snapshot row count differs from Excel input_rows",
    )
    args = parser.parse_args()

    if not args.excel.is_file():
        raise SystemExit(f"Excel not found: {args.excel}")

    kpi_xl = pd.read_excel(args.excel, sheet_name="Network_KPI").iloc[0]
    config_xl = pd.read_excel(args.excel, sheet_name="Config")
    impact_xl = pd.read_excel(args.excel, sheet_name="Impact")
    flagged_xl = pd.read_excel(args.excel, sheet_name="Flagged")

    cfg = _config_from_excel(config_xl)
    rows = _load_snapshot_rows(args.from_date, args.to_date)
    row_diff = abs(len(rows) - int(kpi_xl["input_rows"]))
    if row_diff:
        print(
            f"Note: row count diff vs Excel = {row_diff} "
            "(snapshot may differ from original SQL VIEW export)"
        )

    inline = run_pipeline(ProcessRequest.model_construct(source="inline", rows=rows, config=cfg))

    engine = create_engine(f"sqlite:///{DEFAULT_SNAPSHOT_PATH.as_posix()}")
    baseline = get_actual_baseline_aggregates(
        engine, args.from_date, args.to_date, dialect="sqlite"
    )
    candidates = get_tier_candidate_rows(
        engine, args.from_date, args.to_date, cfg, dialect="sqlite"
    )
    push = run_pipeline_pushdown(
        baseline, candidates.rows, cfg, query_b_mode=query_b_mode_for_dialect("sqlite")
    )

    checks: list[tuple[str, float, float, bool]] = []

    def _chk(name: str, expected: float, actual: float, tol: float | None = None) -> None:
        t = args.tolerance_pp if tol is None else tol
        ok = abs(expected - actual) <= t
        checks.append((name, expected, actual, ok))

    _chk("baseline_top_box_pct", float(kpi_xl["baseline_top_box_pct"]), inline.baseline_top_box_pct)
    _chk("final_top_box_pct", float(kpi_xl["final_top_box_pct"]), inline.final_top_box_pct)
    _chk("network_delta_pp", float(kpi_xl["network_delta_pp"]), inline.network_delta_pp)
    flagged_app = sum(1 for c in inline.high_store_months if c.get("flagged"))
    _chk(
        "flagged_store_months",
        float(kpi_xl["flagged_store_months"]),
        float(flagged_app),
        tol=0.0,
    )
    if args.strict_rows:
        _chk(
            "input_rows",
            float(kpi_xl["input_rows"]),
            float(len(rows)),
            tol=0.0,
        )
    _chk("pushdown final", float(kpi_xl["final_top_box_pct"]), push.final_top_box_pct)
    _chk(
        "inline vs push final",
        inline.final_top_box_pct,
        push.final_top_box_pct,
        tol=0.001,
    )

    print(f"Excel: {args.excel.name}")
    print(f"Period: {args.from_date} .. {args.to_date}")
    print(f"Rows loaded from snapshot: {len(rows)} (excel {int(kpi_xl['input_rows'])})")
    print()
    print("Network KPI comparison (inline vs Excel):")
    print(f"  {'metric':<24} {'excel':>10} {'inline':>10} {'ok':>5}")
    for name, exp, act, ok in checks[:6]:
        print(f"  {name:<24} {exp:>10.4f} {act:>10.4f} {'OK' if ok else 'FAIL':>5}")

    print()
    print("Pipeline steps (inline):")
    for s in inline.steps:
        print(
            f"  {s.step_name:6} in={s.rows_in:>7} out={s.rows_out:>7} "
            f"dropped={s.rows_dropped:>6} pct={s.top_box_pct:.4f}"
        )

    impact = pd.DataFrame(inline.store_impact_series)
    merged = impact_xl.merge(
        impact,
        on=["store_id", "year", "month"],
        suffixes=("_xl", "_app"),
        how="inner",
    )
    xl_t2_col = "after_tier2_five_pct_xl" if "after_tier2_five_pct_xl" in merged.columns else "after_tier2_five_pct"
    app_t4_col = "after_tier4_five_pct_app" if "after_tier4_five_pct_app" in merged.columns else "after_tier4_five_pct"
    merged["tier4_vs_xl_t2"] = merged[app_t4_col] - merged[xl_t2_col]
    actual_xl = "actual_five_pct_xl" if "actual_five_pct_xl" in merged.columns else "actual_five_pct"
    actual_app = "actual_five_pct_app" if "actual_five_pct_app" in merged.columns else "actual_five_pct"
    merged["actual_diff"] = merged[actual_xl] - merged[actual_app]

    tier4_mae = float(merged["tier4_vs_xl_t2"].abs().mean()) if not merged.empty else float("nan")
    actual_mae = float(merged["actual_diff"].abs().mean()) if not merged.empty else float("nan")
    tier4_max = float(merged["tier4_vs_xl_t2"].abs().max()) if not merged.empty else float("nan")

    print()
    print(f"Impact rows matched: {len(merged)} / {len(impact_xl)} excel rows")
    print(f"  MAE actual_five_pct: {actual_mae:.6f} pp")
    print(f"  MAE after_tier4 vs excel after_tier2: {tier4_mae:.6f} pp")
    print(f"  MAX |after_tier4 - excel after_tier2|: {tier4_max:.6f} pp")

    sample_keys = [(254, 2026, 7), (154, 2026, 3)]
    print()
    print("Spot checks (store, year, month):")
    for store, year, month in sample_keys:
        xl_row = impact_xl[
            (impact_xl["store_id"] == store)
            & (impact_xl["year"] == year)
            & (impact_xl["month"] == month)
        ]
        app_row = impact[
            (impact["store_id"] == store)
            & (impact["year"] == year)
            & (impact["month"] == month)
        ]
        if xl_row.empty or app_row.empty:
            print(f"  ({store}, {year}-{month:02d}): missing in xl or app")
            continue
        xr = xl_row.iloc[0]
        ar = app_row.iloc[0]
        print(
            f"  store {store} {year}-{month:02d}: "
            f"actual xl={xr['actual_five_pct']:.4f} app={ar['actual_five_pct']:.4f} | "
            f"final xl_t2={xr['after_tier2_five_pct']:.4f} app_t4={ar['after_tier4_five_pct']:.4f}"
        )

    failed = [c for c in checks if not c[3]]
    print()
    if failed:
        print(f"FAILED checks: {len(failed)}")
        for name, exp, act, _ in failed:
            print(f"  - {name}: expected {exp}, got {act}")
        raise SystemExit(1)
    print("All network KPI checks PASSED within tolerance.")


if __name__ == "__main__":
    main()
