"""Month cells fold into network, store months, and item codes. No SQL."""

from __future__ import annotations

from tts_kitchen.fold import kitchen_delta_sec
from tts_kitchen.report import KitchenMonthCell, assemble_kitchen_before_after


def _cell(
    store: int,
    meit: int | None,
    year: int,
    month: int,
    rows_in: int,
    rows_dropped: int,
    sum_before: float,
    sum_after: float,
    rows_after: int,
) -> KitchenMonthCell:
    return KitchenMonthCell(
        store_id=store,
        meit_number=meit,
        year=year,
        month=month,
        rows_in=rows_in,
        rows_dropped=rows_dropped,
        sum_before_sec=sum_before,
        sum_after_sec=sum_after,
        rows_after=rows_after,
    )


def test_month_cells_sum_to_network_store_and_item() -> None:
    cells = [
        _cell(1, 10, 2026, 9, 2, 1, 59, 30, 1),
        _cell(1, 10, 2026, 10, 1, 0, 90, 90, 1),
        _cell(1, None, 2026, 9, 1, 1, 10, 0, 0),
        _cell(2, 10, 2026, 10, 1, 0, 40, 40, 1),
    ]
    report = assemble_kitchen_before_after(cells)

    assert report.network.rows_in == 5
    assert report.network.rows_dropped == 2
    assert report.network.rows_after == 3
    assert sum(store.stats.rows_in for store in report.by_store) == report.network.rows_in
    assert report.by_meit[0].meit_number == 10
    assert report.by_meit[0].rows_in == 4
    assert report.by_meit[0].rows_dropped == 1

    store_1 = report.by_store[0]
    assert store_1.store_id == 1
    assert store_1.stats.rows_in == 4
    assert [(m.year, m.month) for m in store_1.months] == [(2026, 9), (2026, 10)]
    assert store_1.months[0].mean_before_sec == round((59 + 10) / 3, 4)
    assert store_1.months[0].mean_after_sec == 30.0
    assert store_1.months[1].mean_before_sec == 90.0
    assert [(m.year, m.month) for m in report.network_months] == [(2026, 9), (2026, 10)]
    assert report.network_months[0].mean_before_sec == round((59 + 10) / 3, 4)
    assert report.network_months[1].mean_before_sec == round((90 + 40) / 2, 4)
    assert kitchen_delta_sec(report.network) == round(
        (report.network.mean_after_sec or 0) - (report.network.mean_before_sec or 0),
        4,
    )
