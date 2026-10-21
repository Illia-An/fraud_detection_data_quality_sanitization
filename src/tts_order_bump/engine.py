"""Pure Order × Bump impact engine over ``V_TTS_OrderBump`` rows.

ge30 on **bump** durations. Provisional order-TTS impact (PoC):

    order_tts_after_sec = max(0, order_tts_sec − sum(valid bumps with TTS < min))

Marked in meta as ``order_tts_policy=subtract_lt30_bumps_poc`` until product locks
a production formula.

Inclusion (ТЗ §6 v1 impact path):
- ``order_is_void`` is false
- ``join_match`` is true
- duration stats use only ``bump_valid`` rows; ge30 uses ``bump_tts_sec >= min``
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from statistics import median
from typing import Any, TypedDict

DEFAULT_TTS_MIN_SEC = 30.0

# Provisional PoC policy id (not a final product lock).
ORDER_TTS_POLICY_SUBTRACT_LT30 = "subtract_lt30_bumps_poc"
# Rule 5: no Order TTS penalty until a mart estimate exists.
ORDER_TTS_PENALTY_SEC = 0.0
ORDER_TTS_WEIGHT = 1.0


class OrderBumpOrderStats(TypedDict):
    store_id: int
    sale_date: str
    order_id: str
    order_key: str
    year: int
    month: int
    order_tts_sec: float
    order_tts_after_sec: float
    bump_tts_sum_lt30_sec: float
    order_channel: str | None
    order_is_void: bool
    bump_count: int
    bump_count_valid: int
    bump_count_ge30: int
    bump_count_lt30: int
    bump_tts_sum_raw_sec: float
    bump_tts_sum_ge30_sec: float
    bump_tts_avg_raw_sec: float | None
    bump_tts_avg_ge30_sec: float | None
    bump_tts_max_raw_sec: float | None
    bump_tts_max_ge30_sec: float | None
    pct_bumps_dropped: float | None
    has_full_join: bool
    cycle_raw_sec: float | None


class OrderBumpStoreMonthStats(TypedDict):
    store_id: int
    year: int
    month: int
    order_count: int
    order_tts_mean_sec: float
    order_tts_mean_after_sec: float
    order_tts_median_sec: float | None
    bump_volume: int
    bump_volume_ge30: int
    bump_mean_raw_sec: float | None
    bump_mean_ge30_sec: float | None
    kitchen_mean_raw_sec: float | None
    kitchen_mean_ge30_sec: float | None
    cycle_mean_sec: float | None
    order_count_raw: int
    order_count_ge30: int
    order_count_cycle: int
    pct_orders_excluded_ge30: float | None
    pct_orders_with_mckiti: float
    pct_bumps_dropped_lt30: float | None


class OrderBumpStoreAnomalyStats(TypedDict):
    """Store-level short-bump concentration (Check 3 bridge)."""

    store_id: int
    order_count: int
    bump_valid_count: int
    bump_lt30_count: int
    bump_ge30_count: int
    anomaly_pct: float
    bump_mean_raw_sec: float | None
    bump_mean_ge30_sec: float | None
    order_tts_mean_sec: float
    order_tts_mean_after_sec: float
    order_tts_delta_sec: float
    alert_high: bool


class OrderBumpKvsStats(TypedDict):
    """Bump-grain stats by monitor KVS group (21 / 31)."""

    kvs_group: int
    bump_valid_count: int
    bump_lt30_count: int
    bump_ge30_count: int
    anomaly_pct: float
    bump_mean_raw_sec: float | None
    bump_mean_ge30_sec: float | None
    bump_median_raw_sec: float | None
    lt30_tts_sum_sec: float
    pct_of_valid_network: float | None
    alert_high: bool


# Ops DQ signal from anomaly-concentration research (~20–25% suggested).
ANOMALY_ALERT_PCT = 0.20


class OrderBumpProcessResult(TypedDict):
    """Engine output: raw preserved, ge30 bumps, order + store×month grains."""

    tts_min_sec: float
    bump_rows_raw: list[dict[str, Any]]
    bump_rows_ge30: list[dict[str, Any]]
    orders: list[OrderBumpOrderStats]
    store_months: list[OrderBumpStoreMonthStats]
    store_anomaly: list[OrderBumpStoreAnomalyStats]
    kvs_stats: list[OrderBumpKvsStats]
    meta: dict[str, Any]


def _round4(value: float) -> float:
    return round(float(value), 4)


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value in (0, 0.0, "0", "false", "False", None):
        return False
    return bool(value)


def _truthy_flag(row: dict[str, Any], key: str) -> bool:
    return _as_bool(row.get(key))


def is_panel_eligible(row: dict[str, Any]) -> bool:
    """Impact-path row: matched, non-void (ТЗ §6.2–§6.3)."""
    if _truthy_flag(row, "order_is_void"):
        return False
    return _truthy_flag(row, "join_match")


def is_valid_bump(row: dict[str, Any]) -> bool:
    if not _truthy_flag(row, "bump_valid"):
        return False
    tts = row.get("bump_tts_sec")
    return tts is not None and float(tts) >= 0.0


def passes_ge30(row: dict[str, Any], tts_min_sec: float = DEFAULT_TTS_MIN_SEC) -> bool:
    """Valid bump with duration ≥ threshold (exactly 30 included)."""
    if not is_valid_bump(row):
        return False
    return float(row["bump_tts_sec"]) >= float(tts_min_sec)


def order_tts_after_from_raw(
    order_tts_sec: float,
    bump_tts_sum_lt30_sec: float,
) -> float:
    """Provisional: subtract filtered-out bump time; never negative."""
    return _round4(max(0.0, float(order_tts_sec) - float(bump_tts_sum_lt30_sec)))


def _avg(values: list[float]) -> float | None:
    if not values:
        return None
    return _round4(sum(values) / len(values))


def _max_or_none(values: list[float]) -> float | None:
    if not values:
        return None
    return _round4(max(values))


def _median_or_none(values: list[float]) -> float | None:
    if not values:
        return None
    return _round4(float(median(values)))


def _parse_dt(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def _cycle_raw_sec(valid_rows: list[dict[str, Any]]) -> float | None:
    """Wall-clock kitchen window: last bump − first up. Not a sum of lines."""
    starts: list[datetime] = []
    ends: list[datetime] = []
    for row in valid_rows:
        up = _parse_dt(row.get("up_datetime"))
        bump = _parse_dt(row.get("bump_datetime"))
        if up is None or bump is None:
            continue
        starts.append(up)
        ends.append(bump)
    if not starts:
        return None
    delta = (max(ends) - min(starts)).total_seconds()
    if delta < 0:
        return None
    return _round4(delta)


def _excluded_ge30_share(order_count_raw: int, order_count_ge30: int) -> float | None:
    """Share of orders with a raw kitchen mean that have no line ≥ threshold."""
    if order_count_raw <= 0:
        return None
    return _round4((order_count_raw - order_count_ge30) / order_count_raw)


def _order_vote_mean(
    orders: list[OrderBumpOrderStats],
    key: str,
) -> tuple[float | None, int]:
    values = [float(order[key]) for order in orders if order[key] is not None]
    return _avg(values), len(values)


def _order_stats_from_bumps(
    bumps: list[dict[str, Any]],
    tts_min_sec: float,
) -> OrderBumpOrderStats:
    head = bumps[0]
    valid = [r for r in bumps if is_valid_bump(r)]
    ge30 = [r for r in valid if float(r["bump_tts_sec"]) >= tts_min_sec]
    lt30 = [r for r in valid if float(r["bump_tts_sec"]) < tts_min_sec]

    raw_vals = [float(r["bump_tts_sec"]) for r in valid]
    ge30_vals = [float(r["bump_tts_sec"]) for r in ge30]
    lt30_vals = [float(r["bump_tts_sec"]) for r in lt30]
    n_valid = len(valid)
    order_tts = float(head["order_tts_sec"])
    bump_tts_sum_lt30 = _round4(sum(lt30_vals)) if lt30_vals else 0.0

    return {
        "store_id": int(head["store_id"]),
        "sale_date": str(head["sale_date"]),
        "order_id": str(head["order_id"]),
        "order_key": str(head["order_key"]),
        "year": int(head["year"]),
        "month": int(head["month"]),
        "order_tts_sec": order_tts,
        "bump_tts_sum_lt30_sec": bump_tts_sum_lt30,
        "order_tts_after_sec": order_tts_after_from_raw(order_tts, bump_tts_sum_lt30),
        "order_channel": head.get("order_channel"),
        "order_is_void": _truthy_flag(head, "order_is_void"),
        "bump_count": len(bumps),
        "bump_count_valid": n_valid,
        "bump_count_ge30": len(ge30),
        "bump_count_lt30": len(lt30),
        "bump_tts_sum_raw_sec": _round4(sum(raw_vals)) if raw_vals else 0.0,
        "bump_tts_sum_ge30_sec": _round4(sum(ge30_vals)) if ge30_vals else 0.0,
        "bump_tts_avg_raw_sec": _avg(raw_vals),
        "bump_tts_avg_ge30_sec": _avg(ge30_vals),
        "bump_tts_max_raw_sec": _max_or_none(raw_vals),
        "bump_tts_max_ge30_sec": _max_or_none(ge30_vals),
        "pct_bumps_dropped": (
            _round4(len(lt30) / n_valid) if n_valid else None
        ),
        "has_full_join": (
            _truthy_flag(head, "transh_row_present")
            and _truthy_flag(head, "mckiti_row_present")
        ),
        "cycle_raw_sec": _cycle_raw_sec(valid),
    }


def _store_month_from_orders(
    store_id: int,
    year: int,
    month: int,
    orders: list[OrderBumpOrderStats],
) -> OrderBumpStoreMonthStats:
    order_tts = [o["order_tts_sec"] for o in orders]
    order_tts_after = [o["order_tts_after_sec"] for o in orders]
    bump_volume = sum(o["bump_count_valid"] for o in orders)
    bump_volume_ge30 = sum(o["bump_count_ge30"] for o in orders)
    bump_volume_lt30 = sum(o["bump_count_lt30"] for o in orders)
    raw_sum = sum(o["bump_tts_sum_raw_sec"] for o in orders)
    ge30_sum = sum(o["bump_tts_sum_ge30_sec"] for o in orders)
    with_mckiti = sum(1 for o in orders if o["has_full_join"])
    kitchen_raw, order_count_raw = _order_vote_mean(orders, "bump_tts_avg_raw_sec")
    kitchen_ge30, order_count_ge30 = _order_vote_mean(orders, "bump_tts_avg_ge30_sec")
    cycle_mean, order_count_cycle = _order_vote_mean(orders, "cycle_raw_sec")

    return {
        "store_id": store_id,
        "year": year,
        "month": month,
        "order_count": len(orders),
        "order_tts_mean_sec": _avg(order_tts) or 0.0,
        "order_tts_mean_after_sec": _avg(order_tts_after) or 0.0,
        "order_tts_median_sec": _median_or_none(order_tts),
        "bump_volume": bump_volume,
        "bump_volume_ge30": bump_volume_ge30,
        "bump_mean_raw_sec": (
            _round4(raw_sum / bump_volume) if bump_volume else None
        ),
        "bump_mean_ge30_sec": (
            _round4(ge30_sum / bump_volume_ge30) if bump_volume_ge30 else None
        ),
        "kitchen_mean_raw_sec": kitchen_raw,
        "kitchen_mean_ge30_sec": kitchen_ge30,
        "cycle_mean_sec": cycle_mean,
        "order_count_raw": order_count_raw,
        "order_count_ge30": order_count_ge30,
        "order_count_cycle": order_count_cycle,
        "pct_orders_excluded_ge30": _excluded_ge30_share(
            order_count_raw, order_count_ge30
        ),
        "pct_orders_with_mckiti": (
            _round4(with_mckiti / len(orders)) if orders else 0.0
        ),
        "pct_bumps_dropped_lt30": (
            _round4(bump_volume_lt30 / bump_volume) if bump_volume else None
        ),
    }


def _store_anomaly_from_orders(
    store_id: int,
    orders: list[OrderBumpOrderStats],
    *,
    alert_pct: float = ANOMALY_ALERT_PCT,
) -> OrderBumpStoreAnomalyStats:
    bump_valid = sum(o["bump_count_valid"] for o in orders)
    bump_lt30 = sum(o["bump_count_lt30"] for o in orders)
    bump_ge30 = sum(o["bump_count_ge30"] for o in orders)
    raw_sum = sum(o["bump_tts_sum_raw_sec"] for o in orders)
    ge30_sum = sum(o["bump_tts_sum_ge30_sec"] for o in orders)
    order_tts = [o["order_tts_sec"] for o in orders]
    order_after = [o["order_tts_after_sec"] for o in orders]
    mean_raw = _avg(order_tts) or 0.0
    mean_after = _avg(order_after) or 0.0
    anomaly_pct = _round4(bump_lt30 / bump_valid) if bump_valid else 0.0

    return {
        "store_id": store_id,
        "order_count": len(orders),
        "bump_valid_count": bump_valid,
        "bump_lt30_count": bump_lt30,
        "bump_ge30_count": bump_ge30,
        "anomaly_pct": anomaly_pct,
        "bump_mean_raw_sec": (
            _round4(raw_sum / bump_valid) if bump_valid else None
        ),
        "bump_mean_ge30_sec": (
            _round4(ge30_sum / bump_ge30) if bump_ge30 else None
        ),
        "order_tts_mean_sec": mean_raw,
        "order_tts_mean_after_sec": mean_after,
        "order_tts_delta_sec": _round4(mean_after - mean_raw),
        "alert_high": anomaly_pct >= float(alert_pct),
    }


def _kvs_stats_from_rows(
    kvs_group: int,
    rows: list[dict[str, Any]],
    *,
    tts_min_sec: float,
    network_valid: int,
    alert_pct: float = ANOMALY_ALERT_PCT,
) -> OrderBumpKvsStats:
    valid = [r for r in rows if is_valid_bump(r)]
    lt30 = [r for r in valid if float(r["bump_tts_sec"]) < tts_min_sec]
    ge30 = [r for r in valid if float(r["bump_tts_sec"]) >= tts_min_sec]
    raw_vals = [float(r["bump_tts_sec"]) for r in valid]
    ge30_vals = [float(r["bump_tts_sec"]) for r in ge30]
    lt30_vals = [float(r["bump_tts_sec"]) for r in lt30]
    n_valid = len(valid)
    anomaly_pct = _round4(len(lt30) / n_valid) if n_valid else 0.0

    return {
        "kvs_group": int(kvs_group),
        "bump_valid_count": n_valid,
        "bump_lt30_count": len(lt30),
        "bump_ge30_count": len(ge30),
        "anomaly_pct": anomaly_pct,
        "bump_mean_raw_sec": _avg(raw_vals),
        "bump_mean_ge30_sec": _avg(ge30_vals),
        "bump_median_raw_sec": _median_or_none(raw_vals),
        "lt30_tts_sum_sec": _round4(sum(lt30_vals)) if lt30_vals else 0.0,
        "pct_of_valid_network": (
            _round4(n_valid / network_valid) if network_valid else None
        ),
        "alert_high": anomaly_pct >= float(alert_pct),
    }


def process_order_bump_rows(
    rows: list[dict[str, Any]],
    *,
    tts_min_sec: float = DEFAULT_TTS_MIN_SEC,
) -> OrderBumpProcessResult:
    """Aggregate ``V_TTS_OrderBump`` rows → order + store×month impact stats.

    ``bump_rows_raw`` is the input list (preserved reference).
    ``bump_rows_ge30`` are panel-eligible bumps that pass the ≥ threshold.
    """
    if tts_min_sec < 0:
        raise ValueError(f"tts_min_sec must be >= 0, got {tts_min_sec!r}")

    min_sec = float(tts_min_sec)
    panel_rows = [r for r in rows if is_panel_eligible(r)]

    by_order: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in panel_rows:
        key = row.get("order_key")
        if not key:
            raise ValueError("panel row missing required order_key")
        by_order[str(key)].append(row)

    orders: list[OrderBumpOrderStats] = []
    for order_key in sorted(by_order):
        bumps = sorted(
            by_order[order_key],
            key=lambda r: int(r.get("bump_seq") or 0),
        )
        orders.append(_order_stats_from_bumps(bumps, min_sec))

    by_store_month: dict[tuple[int, int, int], list[OrderBumpOrderStats]] = defaultdict(
        list
    )
    for order in orders:
        by_store_month[(order["store_id"], order["year"], order["month"])].append(
            order
        )

    store_months = [
        _store_month_from_orders(store_id, year, month, group)
        for (store_id, year, month), group in sorted(by_store_month.items())
    ]

    by_store: dict[int, list[OrderBumpOrderStats]] = defaultdict(list)
    for order in orders:
        by_store[order["store_id"]].append(order)

    store_anomaly = [
        _store_anomaly_from_orders(store_id, group)
        for store_id, group in sorted(by_store.items())
    ]
    # Dirtiest first (Check 3 handoff view).
    store_anomaly.sort(key=lambda s: (-s["anomaly_pct"], s["store_id"]))

    bump_rows_ge30 = [r for r in panel_rows if passes_ge30(r, min_sec)]

    n_valid = sum(1 for r in panel_rows if is_valid_bump(r))
    n_lt30 = sum(
        1
        for r in panel_rows
        if is_valid_bump(r) and float(r["bump_tts_sec"]) < min_sec
    )

    by_kvs: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in panel_rows:
        kvs_raw = row.get("kvs_group")
        if kvs_raw is None:
            continue
        by_kvs[int(kvs_raw)].append(row)

    kvs_stats = [
        _kvs_stats_from_rows(
            kvs_group,
            group,
            tts_min_sec=min_sec,
            network_valid=n_valid,
        )
        for kvs_group, group in sorted(by_kvs.items())
    ]

    raw_vals = [
        float(r["bump_tts_sec"]) for r in panel_rows if is_valid_bump(r)
    ]
    ge30_vals = [float(r["bump_tts_sec"]) for r in bump_rows_ge30]
    order_tts_raw = [o["order_tts_sec"] for o in orders]
    order_tts_after = [o["order_tts_after_sec"] for o in orders]
    kitchen_raw, order_count_raw = _order_vote_mean(orders, "bump_tts_avg_raw_sec")
    kitchen_ge30, order_count_ge30 = _order_vote_mean(orders, "bump_tts_avg_ge30_sec")
    cycle_mean, order_count_cycle = _order_vote_mean(orders, "cycle_raw_sec")
    anomaly_pct_network = _round4(n_lt30 / n_valid) if n_valid else None
    stores_alert = sum(1 for s in store_anomaly if s["alert_high"])
    kvs_alert = sum(1 for s in kvs_stats if s["alert_high"])

    meta: dict[str, Any] = {
        "input_rows": len(rows),
        "panel_rows": len(panel_rows),
        "excluded_void_or_unmatched": len(rows) - len(panel_rows),
        "order_count": len(orders),
        "store_month_count": len(store_months),
        "store_anomaly_count": len(store_anomaly),
        "stores_anomaly_alert": stores_alert,
        "kvs_group_count": len(kvs_stats),
        "kvs_anomaly_alert": kvs_alert,
        "anomaly_alert_pct": ANOMALY_ALERT_PCT,
        "bump_valid_count": n_valid,
        "bump_ge30_count": len(bump_rows_ge30),
        "bump_lt30_count": n_lt30,
        "pct_bumps_dropped_lt30": anomaly_pct_network,
        "bump_mean_raw_sec": _avg(raw_vals),
        "bump_mean_ge30_sec": _avg(ge30_vals),
        "order_tts_mean_sec": _avg(order_tts_raw),
        "order_tts_mean_after_sec": _avg(order_tts_after),
        "kitchen_mean_raw_sec": kitchen_raw,
        "kitchen_mean_ge30_sec": kitchen_ge30,
        "cycle_mean_sec": cycle_mean,
        "order_count_raw": order_count_raw,
        "order_count_ge30": order_count_ge30,
        "order_count_cycle": order_count_cycle,
        "pct_orders_excluded_ge30": _excluded_ge30_share(
            order_count_raw, order_count_ge30
        ),
        "order_tts_penalty_sec": ORDER_TTS_PENALTY_SEC,
        "order_tts_weight": ORDER_TTS_WEIGHT,
        "kitchen_mean_policy": "order_vote_ge30",
        "order_tts_policy": ORDER_TTS_POLICY_SUBTRACT_LT30,
        "order_tts_policy_note": (
            "PoC: order_tts_after = max(0, order_tts − sum(valid bumps < min_sec))"
        ),
    }

    return {
        "tts_min_sec": min_sec,
        "bump_rows_raw": rows,
        "bump_rows_ge30": bump_rows_ge30,
        "orders": orders,
        "store_months": store_months,
        "store_anomaly": store_anomaly,
        "kvs_stats": kvs_stats,
        "meta": meta,
    }
