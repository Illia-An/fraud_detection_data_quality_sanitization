"""Internal research export: entities flagged by always-top-box (raw PII).

WARNING: Output contains identifiable contact/phone data. For internal use only.
Do not commit the generated workbook (gitignored via *_internal_pii*).

Usage (repo root):
  uv run python scripts/export_always5_entities.py
  uv run python scripts/export_always5_entities.py --min-n 20 --from-date 2026-01-01 --to-date 2026-09-14
"""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

import pandas as pd
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from backend.db_sample import (
    VIEW_NAME,
    DbSampleError,
    DbSampleQuery,
    _SELECT_COLUMNS,
    _build_sql,
    _engine_from_settings,
)
from fraud_guard.tier1 import (
    ENTITY_COL,
    FLAG_COL,
    RATE_GET_ANSWERS_MAPPING,
    REASON_ALWAYS_TOPBOX,
    REASON_COL,
    Tier1Config,
    build_entity_key,
    filter_answered_metric_rows,
    _flag_always_topbox,
)

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "research"


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


def _load_raw_frame(query: DbSampleQuery) -> pd.DataFrame:
    """Load Q10012 period rows WITHOUT hashing PII (internal research only)."""
    engine = _engine_from_settings()
    sql, params = _build_sql(query)
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            raw_rows = [dict(mapping) for mapping in result.mappings()]
    except SQLAlchemyError as exc:
        raise DbSampleError("Database query failed") from exc
    if not raw_rows:
        return pd.DataFrame(columns=list(_SELECT_COLUMNS))
    return pd.DataFrame(raw_rows)


def _flag_always5_only(df: pd.DataFrame, *, min_n: int) -> pd.DataFrame:
    """Apply only always-top-box on raw (unhashed) identity fields."""
    out = df.copy()
    out[FLAG_COL] = False
    out[REASON_COL] = ""
    out[ENTITY_COL] = build_entity_key(out)
    cfg = Tier1Config(
        enable_blacklist=False,
        enable_freq_store_day=False,
        enable_always_topbox=True,
        always_topbox_min_n=min_n,
    )
    return _flag_always_topbox(out, mapping=RATE_GET_ANSWERS_MAPPING, config=cfg)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export always-top-box entities with raw PII (internal only)"
    )
    parser.add_argument("--from-date", type=_parse_date, default=date(2026, 1, 1))
    parser.add_argument("--to-date", type=_parse_date, default=date(2026, 9, 14))
    parser.add_argument("--min-n", type=int, default=20, help="always_topbox_min_n")
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()
    if args.min_n < 1:
        raise SystemExit("--min-n must be >= 1")

    query = DbSampleQuery(from_date=args.from_date, to_date=args.to_date)
    print("Loading raw rows from VIEW (no PII hash)...", flush=True)
    try:
        raw = _load_raw_frame(query)
    except DbSampleError as exc:
        raise SystemExit(f"DB load failed: {exc}") from exc

    answered = filter_answered_metric_rows(raw)
    print(f"Answered Q10012 rows: {len(answered)}", flush=True)

    flagged = _flag_always5_only(answered, min_n=args.min_n)
    hit = flagged.loc[
        flagged[FLAG_COL].astype(bool)
        & flagged[REASON_COL].astype(str).str.contains(REASON_ALWAYS_TOPBOX, na=False)
    ].copy()
    print(f"Rows flagged always_topbox (min_n={args.min_n}): {len(hit)}", flush=True)

    if hit.empty:
        raise SystemExit("No always-top-box entities found for this period/threshold.")

    # Prefer readable identity columns for internal review.
    hit["AnswerTime"] = pd.to_datetime(hit["AnswerTime"], errors="coerce")

    entity_rows: list[dict] = []
    for entity, grp in hit.groupby(ENTITY_COL, dropna=False):
        stores = sorted({int(s) for s in grp["PrintStore"].dropna().unique()})
        entity_rows.append(
            {
                "entity_key": entity,
                "UserContact": grp["UserContact"].dropna().astype(str).iloc[0]
                if grp["UserContact"].notna().any()
                else None,
                "PhoneFromLog": grp["PhoneFromLog"].dropna().astype(str).iloc[0]
                if grp["PhoneFromLog"].notna().any()
                else None,
                "ext_user_id": grp["ext_user_id"].dropna().iloc[0]
                if grp["ext_user_id"].notna().any()
                else None,
                "answer_count": int(len(grp)),
                "all_answers_are_5": bool((grp["Answer_Value"] == 5).all()),
                "first_answer_time": grp["AnswerTime"].min(),
                "last_answer_time": grp["AnswerTime"].max(),
                "store_count": len(stores),
                "stores": ",".join(str(s) for s in stores),
                "participate_numbers": ",".join(
                    sorted({str(x) for x in grp["ParticipateNumber"].dropna().unique()})
                ),
            }
        )

    entities = pd.DataFrame(entity_rows).sort_values(
        ["answer_count", "entity_key"], ascending=[False, True]
    )

    detail = hit[
        [
            ENTITY_COL,
            "ParticipateNumber",
            "UserContact",
            "PhoneFromLog",
            "ext_user_id",
            "PrintStore",
            "AnswerTime",
            "Year",
            "Month",
            "Answer_Value",
            "BlackList",
            REASON_COL,
        ]
    ].sort_values([ENTITY_COL, "AnswerTime"])

    # Store×entity rollup for ops review
    store_entity = (
        hit.groupby([ENTITY_COL, "PrintStore", "Year", "Month"], dropna=False)
        .agg(
            answers=("Answer_Value", "count"),
            UserContact=("UserContact", "first"),
            PhoneFromLog=("PhoneFromLog", "first"),
            ext_user_id=("ext_user_id", "first"),
        )
        .reset_index()
        .sort_values(["PrintStore", "Year", "Month", ENTITY_COL])
    )

    out = args.out or (
        OUT_DIR
        / (
            f"always5_entities_min{args.min_n}_"
            f"{args.from_date.isoformat()}_to_{args.to_date.isoformat()}"
            f"_internal_pii.xlsx"
        )
    )
    out.parent.mkdir(parents=True, exist_ok=True)

    readme = pd.DataFrame(
        [
            {
                "note": "INTERNAL ONLY — contains raw UserContact / PhoneFromLog. Do not commit or share externally.",
                "rule": f"always_topbox: answer_count >= {args.min_n} AND 100% Answer_Value=5",
                "period_from": args.from_date.isoformat(),
                "period_to": args.to_date.isoformat(),
                "source_view": VIEW_NAME,
                "entity_count": int(len(entities)),
                "flagged_answer_rows": int(len(detail)),
            }
        ]
    )

    with pd.ExcelWriter(out, engine="openpyxl") as writer:
        readme.to_excel(writer, sheet_name="README", index=False)
        entities.to_excel(writer, sheet_name="Entities", index=False)
        store_entity.to_excel(writer, sheet_name="Store_Entity_Months", index=False)
        detail.to_excel(writer, sheet_name="Answer_Rows", index=False)

    print(f"Wrote {out}")
    print(f"  entities={len(entities)} answer_rows={len(detail)}")


if __name__ == "__main__":
    main()
