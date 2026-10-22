"""Sum pre-aggregated kitchen bump groups into network, store, and item code.

A group is one ``StoreIndex`` × ``MeitNumber`` cell. The caller already counted
positions that have a bump time: shorter than 30 seconds are dropped, exactly
30 seconds stay. This module does not see orders and does not read a database.

A missing item code stays in the network and in its store. It is omitted from
the item-code list.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

KITCHEN_TTS_MIN_SEC = 30


@dataclass(frozen=True)
class KitchenBumpGroup:
    """One store × item-code cell after the 30-second split."""

    store_id: int
    meit_number: int | None
    rows_in: int
    rows_dropped: int
    sum_before_sec: float
    sum_after_sec: float
    rows_after: int

    def __post_init__(self) -> None:
        if self.rows_in < 0 or self.rows_dropped < 0 or self.rows_after < 0:
            raise ValueError("kitchen group counts must be non-negative")
        if self.rows_dropped + self.rows_after != self.rows_in:
            raise ValueError(
                "rows_dropped + rows_after must equal rows_in "
                f"({self.rows_dropped} + {self.rows_after} != {self.rows_in})"
            )
        if self.rows_after == 0 and self.sum_after_sec != 0:
            raise ValueError("sum_after_sec must be 0 when no rows remain")


@dataclass(frozen=True)
class KitchenLevelStats:
    """Counts and means for one level (network, one store, or one item code)."""

    rows_in: int
    rows_dropped: int
    rows_after: int
    pct_dropped: float | None
    mean_before_sec: float | None
    mean_after_sec: float | None


@dataclass(frozen=True)
class KitchenStoreStats(KitchenLevelStats):
    store_id: int


@dataclass(frozen=True)
class KitchenMeitStats(KitchenLevelStats):
    meit_number: int


@dataclass(frozen=True)
class KitchenFoldResult:
    network: KitchenLevelStats
    by_store: tuple[KitchenStoreStats, ...]
    by_meit: tuple[KitchenMeitStats, ...]


def _round4(value: float) -> float:
    return round(float(value), 4)


def kitchen_level_from_sums(
    rows_in: int,
    rows_dropped: int,
    rows_after: int,
    sum_before_sec: float,
    sum_after_sec: float,
) -> KitchenLevelStats:
    """Means are row-weighted. An empty cell leaves the means empty."""
    if rows_in == 0:
        return KitchenLevelStats(0, 0, 0, None, None, None)
    mean_after = _round4(sum_after_sec / rows_after) if rows_after else None
    return KitchenLevelStats(
        rows_in=rows_in,
        rows_dropped=rows_dropped,
        rows_after=rows_after,
        pct_dropped=_round4(rows_dropped / rows_in),
        mean_before_sec=_round4(sum_before_sec / rows_in),
        mean_after_sec=mean_after,
    )


def kitchen_delta_sec(level: KitchenLevelStats) -> float | None:
    """After minus before, in seconds. Empty when either mean is empty."""
    if level.mean_before_sec is None or level.mean_after_sec is None:
        return None
    return _round4(level.mean_after_sec - level.mean_before_sec)


def _level_fields(
    rows_in: int,
    rows_dropped: int,
    rows_after: int,
    sum_before_sec: float,
    sum_after_sec: float,
) -> dict[str, int | float | None]:
    level = kitchen_level_from_sums(
        rows_in,
        rows_dropped,
        rows_after,
        sum_before_sec,
        sum_after_sec,
    )
    return {
        "rows_in": level.rows_in,
        "rows_dropped": level.rows_dropped,
        "rows_after": level.rows_after,
        "pct_dropped": level.pct_dropped,
        "mean_before_sec": level.mean_before_sec,
        "mean_after_sec": level.mean_after_sec,
    }


def kitchen_group_from_positions(
    store_id: int,
    meit_number: int | None,
    durations_sec: Sequence[float],
) -> KitchenBumpGroup:
    """Count one cell from position durations. ``< 30`` dropped, ``>= 30`` kept.

    Each duration is one monitor position. There is no order key.
    """
    rows_in = 0
    rows_dropped = 0
    rows_after = 0
    sum_before = 0.0
    sum_after = 0.0
    for raw in durations_sec:
        seconds = float(raw)
        if seconds != seconds or seconds in (float("inf"), float("-inf")):
            raise ValueError(f"duration must be finite, got {raw!r}")
        rows_in += 1
        sum_before += seconds
        if seconds < KITCHEN_TTS_MIN_SEC:
            rows_dropped += 1
        else:
            rows_after += 1
            sum_after += seconds
    return KitchenBumpGroup(
        store_id=store_id,
        meit_number=meit_number,
        rows_in=rows_in,
        rows_dropped=rows_dropped,
        sum_before_sec=sum_before,
        sum_after_sec=sum_after,
        rows_after=rows_after,
    )


class _Cell:
    def __init__(self) -> None:
        self.rows_in = 0
        self.rows_dropped = 0
        self.rows_after = 0
        self.sum_before_sec = 0.0
        self.sum_after_sec = 0.0

    def add(self, group: KitchenBumpGroup) -> None:
        self.rows_in += group.rows_in
        self.rows_dropped += group.rows_dropped
        self.rows_after += group.rows_after
        self.sum_before_sec += group.sum_before_sec
        self.sum_after_sec += group.sum_after_sec


def fold_kitchen_groups(groups: Sequence[KitchenBumpGroup]) -> KitchenFoldResult:
    """Sum cells into network, per store, and per non-null item code."""
    network = _Cell()
    stores: dict[int, _Cell] = {}
    meits: dict[int, _Cell] = {}
    for group in groups:
        network.add(group)
        store = stores.get(group.store_id)
        if store is None:
            store = _Cell()
            stores[group.store_id] = store
        store.add(group)
        if group.meit_number is None:
            continue
        meit = meits.get(group.meit_number)
        if meit is None:
            meit = _Cell()
            meits[group.meit_number] = meit
        meit.add(group)

    by_store = tuple(
        KitchenStoreStats(
            store_id=store_id,
            **_level_fields(
                cell.rows_in,
                cell.rows_dropped,
                cell.rows_after,
                cell.sum_before_sec,
                cell.sum_after_sec,
            ),
        )
        for store_id, cell in sorted(stores.items())
        if cell.rows_in > 0
    )
    by_meit = tuple(
        KitchenMeitStats(
            meit_number=meit_number,
            **_level_fields(
                cell.rows_in,
                cell.rows_dropped,
                cell.rows_after,
                cell.sum_before_sec,
                cell.sum_after_sec,
            ),
        )
        for meit_number, cell in sorted(meits.items())
        if cell.rows_in > 0
    )
    return KitchenFoldResult(
        network=KitchenLevelStats(
            **_level_fields(
                network.rows_in,
                network.rows_dropped,
                network.rows_after,
                network.sum_before_sec,
                network.sum_after_sec,
            )
        ),
        by_store=by_store,
        by_meit=by_meit,
    )
