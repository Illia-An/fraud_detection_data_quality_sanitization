"""Pure Order × Bump engine — ge30 on bumps, echo order TTS."""

from __future__ import annotations

from tts_order_bump.engine import (
    DEFAULT_TTS_MIN_SEC,
    is_panel_eligible,
    order_tts_after_from_raw,
    passes_ge30,
    process_order_bump_rows,
)
from tts_order_bump.synthetic import generate_order_bump_preset


def _base_bump(**overrides: object) -> dict:
    row = {
        "store_id": 100,
        "sale_date": "2026-08-01",
        "order_id": "W1",
        "order_key": "100|2026-08-01|W1",
        "bump_seq": 1,
        "bump_uid": "100|2026-08-01|W1|1",
        "order_tts_sec": 240.0,
        "order_tts_source": "TRHE_StoredTime",
        "order_tts_unit_raw": "sec",
        "order_sales_type": 1,
        "order_channel": "counter",
        "order_is_void": False,
        "transh_row_present": True,
        "up_datetime": "2026-08-01T12:00:00",
        "bump_datetime": "2026-08-01T12:01:30",
        "bump_tts_sec": 90.0,
        "kvs_group": 21,
        "meit_number": 1,
        "sort_order": 1,
        "mckiti_row_present": True,
        "bump_ge30": True,
        "bump_valid": True,
        "join_match": True,
        "exclude_reason": None,
        "year": 2026,
        "month": 8,
        "source_view_transh": "dbo.AABO_TransH",
        "source_view_mckiti": "synthetic.V_TTS_OrderBump_PoC",
        "loaded_at": "2026-10-20T12:00:00",
    }
    row.update(overrides)
    return row


def test_empty_input() -> None:
    result = process_order_bump_rows([])
    assert result["orders"] == []
    assert result["store_months"] == []
    assert result["store_anomaly"] == []
    assert result["kvs_stats"] == []
    assert result["bump_rows_ge30"] == []
    assert result["meta"]["order_count"] == 0
    assert result["meta"]["store_anomaly_count"] == 0
    assert result["meta"]["stores_anomaly_alert"] == 0
    assert result["meta"]["kvs_group_count"] == 0
    assert result["meta"]["kvs_anomaly_alert"] == 0
    assert result["meta"]["anomaly_alert_pct"] == 0.2
    assert result["meta"]["order_tts_policy"] == "subtract_lt30_bumps_poc"
    assert result["meta"]["order_tts_mean_after_sec"] is None


def test_ge30_boundary_exactly_30_kept() -> None:
    short = _base_bump(
        bump_seq=1,
        bump_uid="a|1",
        bump_tts_sec=29.9,
        bump_ge30=False,
        bump_datetime="2026-08-01T12:00:29",
    )
    edge = _base_bump(
        bump_seq=2,
        bump_uid="a|2",
        bump_tts_sec=30.0,
        bump_ge30=True,
        bump_datetime="2026-08-01T12:00:30",
    )
    long = _base_bump(
        bump_seq=3,
        bump_uid="a|3",
        bump_tts_sec=45.0,
        bump_ge30=True,
        bump_datetime="2026-08-01T12:00:45",
    )
    result = process_order_bump_rows([short, edge, long])
    assert len(result["bump_rows_ge30"]) == 2
    assert {r["bump_tts_sec"] for r in result["bump_rows_ge30"]} == {30.0, 45.0}
    assert passes_ge30(edge) is True
    assert passes_ge30(short) is False

    order = result["orders"][0]
    assert order["bump_count"] == 3
    assert order["bump_count_valid"] == 3
    assert order["bump_count_ge30"] == 2
    assert order["bump_count_lt30"] == 1
    assert order["pct_bumps_dropped"] == round(1 / 3, 4)
    assert order["order_tts_sec"] == 240.0
    assert order["bump_tts_sum_lt30_sec"] == 29.9
    assert order["order_tts_after_sec"] == round(240.0 - 29.9, 4)


def test_void_and_unmatched_excluded_from_panel() -> None:
    ok = _base_bump()
    voided = _base_bump(
        order_id="W2",
        order_key="100|2026-08-01|W2",
        bump_uid="void|1",
        order_is_void=True,
        exclude_reason="void",
        order_tts_sec=999.0,
    )
    unmatched = _base_bump(
        order_id="W3",
        order_key="100|2026-08-01|W3",
        bump_uid="um|1",
        join_match=False,
        order_tts_sec=111.0,
    )
    assert is_panel_eligible(ok) is True
    assert is_panel_eligible(voided) is False
    assert is_panel_eligible(unmatched) is False

    result = process_order_bump_rows([ok, voided, unmatched])
    assert result["meta"]["order_count"] == 1
    assert result["orders"][0]["order_key"] == ok["order_key"]
    assert result["meta"]["excluded_void_or_unmatched"] == 2
    assert result["meta"]["order_tts_mean_sec"] == 240.0


def test_invalid_bump_not_in_duration_stats() -> None:
    valid = _base_bump(bump_tts_sec=60.0, bump_ge30=True)
    invalid = _base_bump(
        bump_seq=2,
        bump_uid="a|2",
        bump_tts_sec=None,
        bump_datetime=None,
        bump_valid=False,
        bump_ge30=False,
        exclude_reason="no_bump_time",
    )
    result = process_order_bump_rows([valid, invalid])
    order = result["orders"][0]
    assert order["bump_count"] == 2
    assert order["bump_count_valid"] == 1
    assert order["bump_tts_sum_raw_sec"] == 60.0
    assert order["bump_tts_sum_ge30_sec"] == 60.0
    assert len(result["bump_rows_ge30"]) == 1


def test_kvs_stats_by_monitor_group() -> None:
    """KVS 21 vs 31: anomaly and volume split independently."""
    rows = [
        _base_bump(
            bump_seq=1,
            bump_uid="k|1",
            kvs_group=21,
            bump_tts_sec=60.0,
            bump_ge30=True,
        ),
        _base_bump(
            bump_seq=2,
            bump_uid="k|2",
            kvs_group=21,
            bump_tts_sec=20.0,
            bump_ge30=False,
        ),
        _base_bump(
            bump_seq=3,
            bump_uid="k|3",
            kvs_group=31,
            bump_tts_sec=10.0,
            bump_ge30=False,
        ),
        _base_bump(
            bump_seq=4,
            bump_uid="k|4",
            kvs_group=31,
            bump_tts_sec=12.0,
            bump_ge30=False,
        ),
        _base_bump(
            bump_seq=5,
            bump_uid="k|5",
            kvs_group=31,
            bump_tts_sec=90.0,
            bump_ge30=True,
        ),
    ]
    result = process_order_bump_rows(rows)
    by_kvs = {s["kvs_group"]: s for s in result["kvs_stats"]}
    assert set(by_kvs) == {21, 31}

    k21 = by_kvs[21]
    assert k21["bump_valid_count"] == 2
    assert k21["bump_lt30_count"] == 1
    assert k21["anomaly_pct"] == 0.5
    assert k21["alert_high"] is True
    assert k21["pct_of_valid_network"] == round(2 / 5, 4)
    assert k21["lt30_tts_sum_sec"] == 20.0

    k31 = by_kvs[31]
    assert k31["bump_valid_count"] == 3
    assert k31["bump_lt30_count"] == 2
    assert k31["anomaly_pct"] == round(2 / 3, 4)
    assert k31["alert_high"] is True
    assert k31["lt30_tts_sum_sec"] == 22.0
    assert result["meta"]["kvs_group_count"] == 2
    assert result["meta"]["kvs_anomaly_alert"] == 2


def test_store_anomaly_sorted_and_alert() -> None:
    """Dirtiest stores first; alert when short-bump share ≥ 20%."""
    rows = [
        # Store 200: 2/2 short → 100% anomaly, alert
        _base_bump(
            store_id=200,
            order_id="D1",
            order_key="200|2026-08-01|D1",
            bump_uid="200|D1|1",
            bump_tts_sec=10.0,
            bump_ge30=False,
            order_tts_sec=100.0,
        ),
        _base_bump(
            store_id=200,
            order_id="D2",
            order_key="200|2026-08-01|D2",
            bump_uid="200|D2|1",
            bump_tts_sec=15.0,
            bump_ge30=False,
            order_tts_sec=120.0,
        ),
        # Store 100: 0/1 short → 0%, no alert
        _base_bump(
            store_id=100,
            order_id="C1",
            order_key="100|2026-08-01|C1",
            bump_uid="100|C1|1",
            bump_tts_sec=60.0,
            bump_ge30=True,
            order_tts_sec=200.0,
        ),
        # Store 150: 1/2 short → 50%, alert
        _base_bump(
            store_id=150,
            order_id="M1",
            order_key="150|2026-08-01|M1",
            bump_uid="150|M1|1",
            bump_tts_sec=20.0,
            bump_ge30=False,
            order_tts_sec=180.0,
        ),
        _base_bump(
            store_id=150,
            bump_seq=2,
            order_id="M1",
            order_key="150|2026-08-01|M1",
            bump_uid="150|M1|2",
            bump_tts_sec=80.0,
            bump_ge30=True,
            order_tts_sec=180.0,
        ),
    ]
    result = process_order_bump_rows(rows)
    anomaly = result["store_anomaly"]
    assert [s["store_id"] for s in anomaly] == [200, 150, 100]
    assert anomaly[0]["anomaly_pct"] == 1.0
    assert anomaly[0]["alert_high"] is True
    assert anomaly[0]["bump_lt30_count"] == 2
    assert anomaly[1]["anomaly_pct"] == 0.5
    assert anomaly[1]["alert_high"] is True
    assert anomaly[1]["order_tts_delta_sec"] == round(
        anomaly[1]["order_tts_mean_after_sec"] - anomaly[1]["order_tts_mean_sec"],
        4,
    )
    assert anomaly[2]["anomaly_pct"] == 0.0
    assert anomaly[2]["alert_high"] is False
    assert result["meta"]["stores_anomaly_alert"] == 2
    assert result["meta"]["store_anomaly_count"] == 3


def test_kitchen_mean_is_order_vote_and_cycle_ignores_inner_short() -> None:
    """Short line inside a longer one does not shrink the kitchen window.

    Plan time is the mean of lines ≥ 30. An all-short order drops out of ge30.
    Store×month kitchen mean is one vote per order, not per bump row.
    """
    rows = [
        _base_bump(
            order_id="A",
            order_key="100|2026-08-01|A",
            bump_seq=1,
            bump_uid="A|1",
            bump_tts_sec=120.0,
            bump_ge30=True,
            up_datetime="2026-08-01T12:00:00",
            bump_datetime="2026-08-01T12:02:00",
            order_tts_sec=200.0,
        ),
        _base_bump(
            order_id="A",
            order_key="100|2026-08-01|A",
            bump_seq=2,
            bump_uid="A|2",
            bump_tts_sec=10.0,
            bump_ge30=False,
            up_datetime="2026-08-01T12:00:00",
            bump_datetime="2026-08-01T12:00:10",
            order_tts_sec=200.0,
        ),
        _base_bump(
            order_id="B",
            order_key="100|2026-08-02|B",
            sale_date="2026-08-02",
            bump_uid="B|1",
            bump_tts_sec=10.0,
            bump_ge30=False,
            up_datetime="2026-08-02T12:00:00",
            bump_datetime="2026-08-02T12:00:10",
            order_tts_sec=180.0,
        ),
    ]
    result = process_order_bump_rows(rows)
    by_key = {o["order_key"]: o for o in result["orders"]}
    order_a = by_key["100|2026-08-01|A"]
    order_b = by_key["100|2026-08-02|B"]
    assert order_a["bump_tts_avg_raw_sec"] == 65.0
    assert order_a["bump_tts_avg_ge30_sec"] == 120.0
    assert order_a["cycle_raw_sec"] == 120.0
    assert order_b["bump_tts_avg_ge30_sec"] is None
    assert order_b["cycle_raw_sec"] == 10.0

    sm = result["store_months"][0]
    assert sm["order_count_raw"] == 2
    assert sm["order_count_ge30"] == 1
    assert sm["kitchen_mean_raw_sec"] == 37.5
    assert sm["kitchen_mean_ge30_sec"] == 120.0
    assert sm["cycle_mean_sec"] == 65.0
    assert sm["order_count_cycle"] == 2
    assert sm["pct_orders_excluded_ge30"] == 0.5
    # Bump-row mean still weights every line; it is not the plan series.
    assert sm["bump_mean_raw_sec"] == round((120.0 + 10.0 + 10.0) / 3, 4)
    assert result["meta"]["kitchen_mean_ge30_sec"] == 120.0
    assert result["meta"]["order_count_ge30"] == 1
    assert result["meta"]["kitchen_mean_policy"] == "order_vote_ge30"
    assert result["meta"]["cycle_mean_sec"] == 65.0
    assert result["meta"]["pct_orders_excluded_ge30"] == 0.5
    assert result["meta"]["order_tts_penalty_sec"] == 0.0
    assert result["meta"]["order_tts_weight"] == 1.0


def test_store_month_aggregates() -> None:
    rows = [
        _base_bump(
            store_id=100,
            order_id="A",
            order_key="100|2026-08-01|A",
            bump_uid="100|A|1",
            order_tts_sec=200.0,
            bump_tts_sec=40.0,
            year=2026,
            month=8,
        ),
        _base_bump(
            store_id=100,
            sale_date="2026-08-15",
            order_id="B",
            order_key="100|2026-08-15|B",
            bump_uid="100|B|1",
            order_tts_sec=300.0,
            bump_tts_sec=20.0,
            bump_ge30=False,
            year=2026,
            month=8,
        ),
        _base_bump(
            store_id=101,
            order_id="C",
            order_key="101|2026-09-01|C",
            bump_uid="101|C|1",
            sale_date="2026-09-01",
            order_tts_sec=250.0,
            bump_tts_sec=50.0,
            year=2026,
            month=9,
        ),
    ]
    result = process_order_bump_rows(rows)
    assert len(result["store_months"]) == 2

    sm_aug = next(s for s in result["store_months"] if s["month"] == 8)
    assert sm_aug["store_id"] == 100
    assert sm_aug["order_count"] == 2
    assert sm_aug["order_tts_mean_sec"] == 250.0
    assert sm_aug["order_tts_median_sec"] == 250.0
    assert sm_aug["bump_volume"] == 2
    assert sm_aug["bump_volume_ge30"] == 1
    assert sm_aug["pct_bumps_dropped_lt30"] == 0.5
    assert sm_aug["bump_mean_raw_sec"] == 30.0
    assert sm_aug["bump_mean_ge30_sec"] == 40.0
    assert "order_tts_mean_cleansed_sec" not in sm_aug


def test_order_tts_after_subtracts_short_bumps_and_floors_at_zero() -> None:
    assert order_tts_after_from_raw(240.0, 20.0) == 220.0
    assert order_tts_after_from_raw(15.0, 40.0) == 0.0

    rows = [
        _base_bump(
            bump_seq=1,
            bump_uid="x|1",
            order_tts_sec=100.0,
            bump_tts_sec=25.0,
            bump_ge30=False,
        ),
        _base_bump(
            bump_seq=2,
            bump_uid="x|2",
            order_tts_sec=100.0,
            bump_tts_sec=80.0,
            bump_ge30=True,
        ),
    ]
    result = process_order_bump_rows(rows)
    order = result["orders"][0]
    assert order["bump_tts_sum_lt30_sec"] == 25.0
    assert order["order_tts_after_sec"] == 75.0
    assert result["store_months"][0]["order_tts_mean_after_sec"] == 75.0
    assert result["meta"]["order_tts_mean_after_sec"] == 75.0


def test_raw_preserved_and_default_threshold() -> None:
    rows = [_base_bump()]
    result = process_order_bump_rows(rows)
    assert result["bump_rows_raw"] is rows
    assert result["tts_min_sec"] == DEFAULT_TTS_MIN_SEC


def test_negative_threshold_rejected() -> None:
    try:
        process_order_bump_rows([], tts_min_sec=-1)
    except ValueError as exc:
        assert "tts_min_sec" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_synthetic_small_smoke() -> None:
    rows = generate_order_bump_preset("small")
    result = process_order_bump_rows(rows)
    assert result["meta"]["order_count"] > 0
    assert result["meta"]["bump_ge30_count"] > 0
    assert result["meta"]["bump_lt30_count"] > 0
    assert result["store_months"]
    assert all(o["order_tts_sec"] > 0 for o in result["orders"])
    # Dropped share matches order-level definition when rolled up.
    total_valid = sum(o["bump_count_valid"] for o in result["orders"])
    total_lt = sum(o["bump_count_lt30"] for o in result["orders"])
    assert result["meta"]["pct_bumps_dropped_lt30"] == round(total_lt / total_valid, 4)


def test_deterministic_on_preset() -> None:
    rows = generate_order_bump_preset("small")
    a = process_order_bump_rows(rows)
    b = process_order_bump_rows(rows)
    assert a["orders"] == b["orders"]
    assert a["store_months"] == b["store_months"]
    assert a["store_anomaly"] == b["store_anomaly"]
    assert a["kvs_stats"] == b["kvs_stats"]
    assert a["meta"] == b["meta"]
