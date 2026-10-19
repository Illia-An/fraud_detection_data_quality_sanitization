"""Synthetic McKitiBump rows for TTS demos/CI (no live DB).

Calibrated to research orders of magnitude:
- ~8–10% of bumps with TTS &lt; 30s (pull network mean down)
- typical dwell ~3–4 minutes after ge30
- ~1.9 bumps per order on average
- KVSGroup mix 21 (majority) / 31 (faster)
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Literal

TtsPresetName = Literal["small", "medium", "stress"]


@dataclass(frozen=True)
class TtsSyntheticConfig:
    seed: int = 42
    n_stores: int = 10
    start_year: int = 2026
    start_month: int = 9
    n_months: int = 2
    orders_per_store_month: int = 80
    # Mean bumps per order (~research 1.92); geometric-ish via 1 + extra.
    extra_bump_rate: float = 0.55
    short_tts_rate: float = 0.09
    short_tts_max_sec: int = 25
    normal_tts_mean_sec: float = 200.0
    normal_tts_jitter_sec: float = 80.0
    kvs31_rate: float = 0.18
    null_bump_rate: float = 0.0


TTS_PRESETS: dict[TtsPresetName, TtsSyntheticConfig] = {
    "small": TtsSyntheticConfig(
        n_stores=2,
        n_months=2,
        orders_per_store_month=40,
    ),
    "medium": TtsSyntheticConfig(
        n_stores=8,
        n_months=4,
        orders_per_store_month=70,
    ),
    "stress": TtsSyntheticConfig(
        n_stores=20,
        n_months=6,
        orders_per_store_month=100,
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


def _sale_date(year: int, month: int, day: int) -> str:
    day = min(max(day, 1), 28)
    return f"{year}-{month:02d}-{day:02d}T00:00:00"


def _sample_tts_sec(rng: random.Random, cfg: TtsSyntheticConfig) -> int:
    if rng.random() < cfg.short_tts_rate:
        return rng.randint(1, cfg.short_tts_max_sec)
    # Occasional negative (rare; research had a handful) — keep ~0.1%
    if rng.random() < 0.001:
        return -rng.randint(1, 30)
    value = cfg.normal_tts_mean_sec + rng.gauss(0, cfg.normal_tts_jitter_sec)
    return max(30, int(round(value)))


def generate_tts_preset(
    preset: TtsPresetName,
    *,
    config: TtsSyntheticConfig | None = None,
) -> list[dict[str, Any]]:
    """Return McKitiBump-shaped dicts for ``source=inline`` / sample endpoint."""
    cfg = config if config is not None else TTS_PRESETS[preset]
    rng = random.Random(cfg.seed)
    months = _month_sequence(cfg.start_year, cfg.start_month, cfg.n_months)
    rows: list[dict[str, Any]] = []
    order_seq = 0

    for store_i in range(cfg.n_stores):
        store_id = 100 + store_i
        for year, month in months:
            for _ in range(cfg.orders_per_store_month):
                order_seq += 1
                day = rng.randint(1, 28)
                sale = _sale_date(year, month, day)
                weborder = f"W{order_seq:08d}"
                n_bumps = 1 + (1 if rng.random() < cfg.extra_bump_rate else 0)
                if rng.random() < 0.15:
                    n_bumps += 1
                base_hour = rng.randint(8, 20)
                up = datetime(year, month, day, base_hour, rng.randint(0, 59), 0)

                for sort_i in range(n_bumps):
                    kvs = 31 if rng.random() < cfg.kvs31_rate else 21
                    tts_sec = _sample_tts_sec(rng, cfg)
                    bump_up = up + timedelta(seconds=sort_i * 5)
                    bump_dt: str | None = None
                    if rng.random() >= cfg.null_bump_rate:
                        bump_dt = (bump_up + timedelta(seconds=tts_sec)).isoformat(
                            timespec="seconds"
                        )
                    rows.append(
                        {
                            "StoreIndex": store_id,
                            "SaleDate": sale,
                            "WeborderID": weborder,
                            "KVSGroup": kvs,
                            "MeitNumber": sort_i + 1,
                            "SortOrder": sort_i + 1,
                            "UpDatetime": bump_up.isoformat(timespec="seconds"),
                            "BumpDateTime": bump_dt,
                        }
                    )
    return rows


def tts_preset_meta(preset: TtsPresetName, rows: list[dict[str, Any]]) -> dict[str, Any]:
    stores = {r["StoreIndex"] for r in rows}
    months = {
        (int(str(r["SaleDate"])[0:4]), int(str(r["SaleDate"])[5:7])) for r in rows
    }
    return {
        "preset": preset,
        "row_count": len(rows),
        "store_count": len(stores),
        "month_count": len(months),
        "description": {
            "small": "2 stores × 2 months — quick TTS ge30 demo",
            "medium": "8 stores × 4 months — UI / chart demo",
            "stress": "20 stores × 6 months — volume test",
        }[preset],
    }
