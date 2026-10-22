"""Pure kitchen fold: position durations already split at 30 seconds. No SQL."""

from __future__ import annotations

import pytest

from tts_kitchen.fold import (
    KitchenBumpGroup,
    fold_kitchen_groups,
    kitchen_group_from_positions,
)


def test_exactly_30_stays_and_shorter_is_dropped() -> None:
    group = kitchen_group_from_positions(1, 100, [29, 30])
    folded = fold_kitchen_groups([group])

    assert group.rows_in == 2
    assert group.rows_dropped == 1
    assert group.rows_after == 1
    assert folded.network.rows_dropped == 1
    assert folded.network.rows_after == 1
    assert folded.network.mean_before_sec == 29.5
    assert folded.network.mean_after_sec == 30.0
    assert folded.network.pct_dropped == 0.5


def test_two_positions_of_one_order_are_counted_separately() -> None:
    """No order key: a short position leaves, the other position stays."""
    group = kitchen_group_from_positions(7, 200, [10, 90])
    folded = fold_kitchen_groups([group])

    assert folded.network.rows_in == 2
    assert folded.network.rows_dropped == 1
    assert folded.network.rows_after == 1
    assert folded.network.mean_after_sec == 90.0
    assert not hasattr(group, "order_id")


def test_empty_input_does_not_divide() -> None:
    folded = fold_kitchen_groups([])

    assert folded.network.rows_in == 0
    assert folded.network.rows_dropped == 0
    assert folded.network.pct_dropped is None
    assert folded.network.mean_before_sec is None
    assert folded.network.mean_after_sec is None
    assert folded.by_store == ()
    assert folded.by_meit == ()


def test_empty_group_is_omitted_from_store_and_item_lists() -> None:
    empty = kitchen_group_from_positions(3, 50, [])
    kept = kitchen_group_from_positions(4, 60, [40])
    folded = fold_kitchen_groups([empty, kept])

    assert empty.rows_in == 0
    assert [row.store_id for row in folded.by_store] == [4]
    assert [row.meit_number for row in folded.by_meit] == [60]
    assert folded.network.rows_in == 1


def test_store_counts_sum_to_network() -> None:
    groups = [
        kitchen_group_from_positions(1, 10, [29, 30, 90]),
        kitchen_group_from_positions(2, 10, [10, 10, 120, 180]),
    ]
    folded = fold_kitchen_groups(groups)

    assert sum(row.rows_in for row in folded.by_store) == folded.network.rows_in
    assert sum(row.rows_dropped for row in folded.by_store) == folded.network.rows_dropped
    assert sum(row.rows_after for row in folded.by_store) == folded.network.rows_after
    # Unequal store volumes: network mean is row-weighted, not the mean of store means.
    assert folded.by_store[0].mean_before_sec != folded.by_store[1].mean_before_sec
    assert folded.network.mean_before_sec == round((29 + 30 + 90 + 10 + 10 + 120 + 180) / 7, 4)


def test_null_item_code_stays_in_network_and_store_only() -> None:
    named = kitchen_group_from_positions(5, 77, [40])
    unnamed = kitchen_group_from_positions(5, None, [10])
    folded = fold_kitchen_groups([named, unnamed])

    assert folded.network.rows_in == 2
    assert folded.network.rows_dropped == 1
    assert len(folded.by_store) == 1
    assert folded.by_store[0].store_id == 5
    assert folded.by_store[0].rows_in == 2
    assert [row.meit_number for row in folded.by_meit] == [77]
    assert folded.by_meit[0].rows_in == 1
    assert folded.by_meit[0].rows_dropped == 0


def test_same_cell_groups_add_together() -> None:
    first = kitchen_group_from_positions(1, 8, [29])
    second = kitchen_group_from_positions(1, 8, [30])
    folded = fold_kitchen_groups([first, second])

    assert len(folded.by_store) == 1
    assert len(folded.by_meit) == 1
    assert folded.by_meit[0].rows_in == 2
    assert folded.by_meit[0].rows_dropped == 1
    assert folded.by_meit[0].rows_after == 1


def test_all_dropped_leaves_mean_after_empty() -> None:
    group = kitchen_group_from_positions(1, 1, [0, 29])
    folded = fold_kitchen_groups([group])

    assert folded.network.pct_dropped == 1.0
    assert folded.network.mean_before_sec == 14.5
    assert folded.network.mean_after_sec is None


def test_group_rejects_counts_that_do_not_add_up() -> None:
    with pytest.raises(ValueError, match="rows_dropped"):
        KitchenBumpGroup(
            store_id=1,
            meit_number=1,
            rows_in=2,
            rows_dropped=2,
            sum_before_sec=10,
            sum_after_sec=0,
            rows_after=1,
        )
