"""Turn one month-grain read into network, store, and item-code stats.

The SQL read is grouped by store, item code, and month. This module sums
those cells. It does not read or write a database.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from tts_kitchen.fold import (
    KitchenBumpGroup,
    KitchenLevelStats,
    KitchenMeitStats,
    fold_kitchen_groups,
    kitchen_level_from_sums,
)


@dataclass(frozen=True)
class KitchenMonthCell:
    """One store × item code × calendar month from the read-only aggregate."""

    store_id: int
    meit_number: int | None
    year: int
    month: int
    rows_in: int
    rows_dropped: int
    sum_before_sec: float
    sum_after_sec: float
    rows_after: int

    def __post_init__(self) -> None:
        KitchenBumpGroup(
            store_id=self.store_id,
            meit_number=self.meit_number,
            rows_in=self.rows_in,
            rows_dropped=self.rows_dropped,
            sum_before_sec=self.sum_before_sec,
            sum_after_sec=self.sum_after_sec,
            rows_after=self.rows_after,
        )
        if self.year < 1:
            raise ValueError("year must be positive")
        if not 1 <= self.month <= 12:
            raise ValueError("month must be 1..12")


@dataclass(frozen=True)
class KitchenMonthMeans:
    year: int
    month: int
    mean_before_sec: float | None
    mean_after_sec: float | None


@dataclass(frozen=True)
class KitchenStoreReport:
    store_id: int
    stats: KitchenLevelStats
    months: tuple[KitchenMonthMeans, ...]


@dataclass(frozen=True)
class KitchenBeforeAfter:
    network: KitchenLevelStats
    network_months: tuple[KitchenMonthMeans, ...]
    by_store: tuple[KitchenStoreReport, ...]
    by_meit: tuple[KitchenMeitStats, ...]


class _Sums:
    def __init__(self) -> None:
        self.rows_in = 0
        self.rows_dropped = 0
        self.rows_after = 0
        self.sum_before_sec = 0.0
        self.sum_after_sec = 0.0

    def add(self, cell: KitchenMonthCell) -> None:
        self.rows_in += cell.rows_in
        self.rows_dropped += cell.rows_dropped
        self.rows_after += cell.rows_after
        self.sum_before_sec += cell.sum_before_sec
        self.sum_after_sec += cell.sum_after_sec

    def level(self) -> KitchenLevelStats:
        return kitchen_level_from_sums(
            self.rows_in,
            self.rows_dropped,
            self.rows_after,
            self.sum_before_sec,
            self.sum_after_sec,
        )


def assemble_kitchen_before_after(
    cells: Sequence[KitchenMonthCell],
) -> KitchenBeforeAfter:
    """Sum month cells into the before/after report.

    A null item code stays in the network, its store, and that store's month.
    It is left out of the item-code list.
    """
    by_item: dict[tuple[int, int | None], _Sums] = {}
    by_store_month: dict[tuple[int, int, int], _Sums] = {}
    by_network_month: dict[tuple[int, int], _Sums] = {}
    for cell in cells:
        item_key = (cell.store_id, cell.meit_number)
        item = by_item.get(item_key)
        if item is None:
            item = _Sums()
            by_item[item_key] = item
        item.add(cell)

        month_key = (cell.store_id, cell.year, cell.month)
        month = by_store_month.get(month_key)
        if month is None:
            month = _Sums()
            by_store_month[month_key] = month
        month.add(cell)

        net_key = (cell.year, cell.month)
        network_month = by_network_month.get(net_key)
        if network_month is None:
            network_month = _Sums()
            by_network_month[net_key] = network_month
        network_month.add(cell)

    groups = [
        KitchenBumpGroup(
            store_id=store_id,
            meit_number=meit_number,
            rows_in=sums.rows_in,
            rows_dropped=sums.rows_dropped,
            sum_before_sec=sums.sum_before_sec,
            sum_after_sec=sums.sum_after_sec,
            rows_after=sums.rows_after,
        )
        for (store_id, meit_number), sums in by_item.items()
    ]
    folded = fold_kitchen_groups(groups)

    months_by_store: dict[int, list[KitchenMonthMeans]] = {}
    for store_id, year, month in sorted(by_store_month):
        level = by_store_month[(store_id, year, month)].level()
        if level.rows_in == 0:
            continue
        months_by_store.setdefault(store_id, []).append(
            KitchenMonthMeans(
                year=year,
                month=month,
                mean_before_sec=level.mean_before_sec,
                mean_after_sec=level.mean_after_sec,
            )
        )

    by_store = tuple(
        KitchenStoreReport(
            store_id=store.store_id,
            stats=KitchenLevelStats(
                rows_in=store.rows_in,
                rows_dropped=store.rows_dropped,
                rows_after=store.rows_after,
                pct_dropped=store.pct_dropped,
                mean_before_sec=store.mean_before_sec,
                mean_after_sec=store.mean_after_sec,
            ),
            months=tuple(months_by_store.get(store.store_id, ())),
        )
        for store in folded.by_store
    )
    network_months = []
    for year, month in sorted(by_network_month):
        level = by_network_month[(year, month)].level()
        if level.rows_in == 0:
            continue
        network_months.append(
            KitchenMonthMeans(
                year=year,
                month=month,
                mean_before_sec=level.mean_before_sec,
                mean_after_sec=level.mean_after_sec,
            )
        )
    return KitchenBeforeAfter(
        network=folded.network,
        network_months=tuple(network_months),
        by_store=by_store,
        by_meit=folded.by_meit,
    )
