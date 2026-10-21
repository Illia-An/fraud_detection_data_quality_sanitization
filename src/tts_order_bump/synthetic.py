"""Synthetic ``V_TTS_OrderBump`` rows for PoC (no live DB).

Calibrated to the approved mart ТЗ:
- order TTS ~200–300 s (~3–5 min serve time)
- ~8–12% valid bumps with duration &lt; 30 s
- stable ``order_tts_sec`` per ``order_key``
- ``join_match=1`` for impact-ready rows
- ≥2 months history on every preset
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Literal

from tts_order_bump.columns import (
    ORDER_BUMP_COLUMNS,
    SOURCE_MCKITI,
    SOURCE_TRANSH,
)

OrderBumpPresetName = Literal["small", "medium", "stress"]


@dataclass(frozen=True)
class OrderBumpSyntheticConfig:
    seed: int = 42
    n_stores: int = 3
    start_year: int = 2026
    start_month: int = 8
    n_months: int = 2
    orders_per_store_month: int = 25
    # Extra bumps beyond the first (~1.9 mean with these rates).
    extra_bump_rate: float = 0.55
    triple_bump_rate: float = 0.12
    # Baseline short rate for KVS 21; KVS 31 uses ``kvs31_short_tts_rate``.
    short_tts_rate: float = 0.07
    # Demo skew: KVS 31 monitors accumulate more sub-30s bumps.
    kvs31_short_tts_rate: float = 0.32
    short_tts_max_sec: int = 25
    normal_bump_mean_sec: float = 95.0
    normal_bump_jitter_sec: float = 40.0
    # Order-level serve time (TransH-like), seconds.
    order_tts_mean_sec: float = 250.0
    order_tts_jitter_sec: float = 45.0
    order_tts_min_sec: float = 150.0
    order_tts_max_sec: float = 420.0
    null_bump_rate: float = 0.02
    void_order_rate: float = 0.02
    delivery_rate: float = 0.28
    kvs31_rate: float = 0.18


ORDER_BUMP_PRESETS: dict[OrderBumpPresetName, OrderBumpSyntheticConfig] = {
    "small": OrderBumpSyntheticConfig(
        n_stores=2,
        n_months=2,
        orders_per_store_month=20,
    ),
    "medium": OrderBumpSyntheticConfig(
        n_stores=5,
        n_months=3,
        orders_per_store_month=40,
    ),
    "stress": OrderBumpSyntheticConfig(
        n_stores=12,
        n_months=4,
        orders_per_store_month=80,
    ),
}


def _month_sequence(start_year: int, start_month: int, n_months: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    year, month = start_year, start_month
    for _ in range(n_months):
        out.append((year, month))
        month += 1
        if month > 12:
            month = 1
            year += 1
    return out


def make_order_key(store_id: int, sale_date: date, order_id: str) -> str:
    return f"{store_id}|{sale_date.isoformat()}|{order_id}"


def _sample_order_tts_sec(rng: random.Random, cfg: OrderBumpSyntheticConfig) -> float:
    raw = cfg.order_tts_mean_sec + rng.gauss(0, cfg.order_tts_jitter_sec)
    clipped = min(cfg.order_tts_max_sec, max(cfg.order_tts_min_sec, raw))
    return round(clipped, 2)


def _sample_bump_tts_sec(
    rng: random.Random,
    cfg: OrderBumpSyntheticConfig,
    *,
    kvs_group: int,
) -> int:
    short_rate = (
        cfg.kvs31_short_tts_rate if int(kvs_group) == 31 else cfg.short_tts_rate
    )
    if rng.random() < short_rate:
        return rng.randint(1, cfg.short_tts_max_sec)
    value = cfg.normal_bump_mean_sec + rng.gauss(0, cfg.normal_bump_jitter_sec)
    return max(30, int(round(value)))


def _channel_and_sales_type(rng: random.Random, cfg: OrderBumpSyntheticConfig) -> tuple[str, int]:
    if rng.random() < cfg.delivery_rate:
        return "delivery", 2 if rng.random() < 0.5 else 3
    return "counter", 1


def generate_order_bump_preset(
    preset: OrderBumpPresetName,
    *,
    config: OrderBumpSyntheticConfig | None = None,
    loaded_at: datetime | None = None,
) -> list[dict[str, Any]]:
    """Return flat ``V_TTS_OrderBump``-shaped dicts (one row per bump)."""
    cfg = config if config is not None else ORDER_BUMP_PRESETS[preset]
    rng = random.Random(cfg.seed)
    months = _month_sequence(cfg.start_year, cfg.start_month, cfg.n_months)
    stamped = loaded_at or datetime(2026, 10, 20, 12, 0, 0)
    rows: list[dict[str, Any]] = []
    order_seq = 0

    for store_i in range(cfg.n_stores):
        store_id = 100 + store_i
        for year, month in months:
            for _ in range(cfg.orders_per_store_month):
                order_seq += 1
                day = rng.randint(1, 28)
                sale = date(year, month, day)
                order_id = f"W{order_seq:08d}"
                order_key = make_order_key(store_id, sale, order_id)
                order_tts = _sample_order_tts_sec(rng, cfg)
                is_void = rng.random() < cfg.void_order_rate
                channel, sales_type = _channel_and_sales_type(rng, cfg)

                n_bumps = 1 + (1 if rng.random() < cfg.extra_bump_rate else 0)
                if rng.random() < cfg.triple_bump_rate:
                    n_bumps += 1

                base_hour = rng.randint(8, 20)
                up0 = datetime(year, month, day, base_hour, rng.randint(0, 59), 0)

                # Pre-sample bump durations so seq order is by UpDatetime then sort.
                bump_plans: list[tuple[datetime, int | None, int, int]] = []
                for sort_i in range(n_bumps):
                    up = up0 + timedelta(seconds=sort_i * 8)
                    kvs = 31 if rng.random() < cfg.kvs31_rate else 21
                    if rng.random() < cfg.null_bump_rate:
                        bump_plans.append((up, None, kvs, sort_i + 1))
                    else:
                        bump_plans.append(
                            (
                                up,
                                _sample_bump_tts_sec(rng, cfg, kvs_group=kvs),
                                kvs,
                                sort_i + 1,
                            )
                        )

                bump_plans.sort(key=lambda p: (p[0], p[3]))

                for bump_seq, (up, tts_sec, kvs, meit) in enumerate(bump_plans, start=1):
                    bump_dt: datetime | None = None
                    bump_tts: float | None = None
                    bump_valid = False
                    bump_ge30 = False
                    exclude_reason: str | None = None

                    if is_void:
                        exclude_reason = "void"
                    if tts_sec is None:
                        if exclude_reason is None:
                            exclude_reason = "no_bump_time"
                    else:
                        bump_dt = up + timedelta(seconds=tts_sec)
                        bump_tts = float(tts_sec)
                        bump_valid = True
                        bump_ge30 = bump_tts >= 30.0

                    bump_uid = f"{order_key}|{bump_seq}"
                    rows.append(
                        {
                            "store_id": store_id,
                            "sale_date": sale.isoformat(),
                            "order_id": order_id,
                            "order_key": order_key,
                            "bump_seq": bump_seq,
                            "bump_uid": bump_uid,
                            "order_tts_sec": order_tts,
                            "order_tts_source": "TRHE_StoredTime",
                            "order_tts_unit_raw": "sec",
                            "order_sales_type": sales_type,
                            "order_channel": channel,
                            "order_is_void": is_void,
                            "transh_row_present": True,
                            "up_datetime": up.isoformat(timespec="seconds"),
                            "bump_datetime": (
                                bump_dt.isoformat(timespec="seconds") if bump_dt else None
                            ),
                            "bump_tts_sec": bump_tts,
                            "kvs_group": kvs,
                            "meit_number": meit,
                            "sort_order": meit,
                            "mckiti_row_present": True,
                            "bump_ge30": bump_ge30,
                            "bump_valid": bump_valid,
                            "join_match": True,
                            "exclude_reason": exclude_reason,
                            "year": year,
                            "month": month,
                            "source_view_transh": SOURCE_TRANSH,
                            "source_view_mckiti": SOURCE_MCKITI,
                            "loaded_at": stamped.isoformat(timespec="seconds"),
                        }
                    )

    # Stable column order for dumps / fixtures.
    return [{col: row[col] for col in ORDER_BUMP_COLUMNS} for row in rows]


def order_bump_preset_meta(
    preset: OrderBumpPresetName,
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    stores = {r["store_id"] for r in rows}
    months = {(r["year"], r["month"]) for r in rows}
    orders = {r["order_key"] for r in rows}
    valid = [r for r in rows if r["bump_valid"]]
    shorts = [r for r in valid if not r["bump_ge30"]]
    return {
        "preset": preset,
        "row_count": len(rows),
        "order_count": len(orders),
        "store_count": len(stores),
        "month_count": len(months),
        "valid_bump_count": len(valid),
        "short_bump_count": len(shorts),
        "short_bump_share": (len(shorts) / len(valid)) if valid else 0.0,
        "description": {
            "small": "2 stores x 2 months - quick OrderxBump PoC",
            "medium": "5 stores x 3 months - UI / chart demo scale",
            "stress": "12 stores x 4 months - volume check",
        }[preset],
    }
