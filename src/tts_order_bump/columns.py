"""Column contract for synthetic ``V_TTS_OrderBump`` rows (ТЗ §3)."""

from __future__ import annotations

# Order matches docs/tts_full_view_for_proj/02_TTS_Order_Bump_Technical_Specification.md
ORDER_BUMP_COLUMNS: tuple[str, ...] = (
    # 3.1 identifiers
    "store_id",
    "sale_date",
    "order_id",
    "order_key",
    "bump_seq",
    "bump_uid",
    # 3.2 TransH / order TTS
    "order_tts_sec",
    "order_tts_source",
    "order_tts_unit_raw",
    "order_sales_type",
    "order_channel",
    "order_is_void",
    "transh_row_present",
    # 3.3 McKiti / bump
    "up_datetime",
    "bump_datetime",
    "bump_tts_sec",
    "kvs_group",
    "meit_number",
    "sort_order",
    "mckiti_row_present",
    # 3.4 quality flags
    "bump_ge30",
    "bump_valid",
    "join_match",
    "exclude_reason",
    # 3.5 technical
    "year",
    "month",
    "source_view_transh",
    "source_view_mckiti",
    "loaded_at",
)

SOURCE_TRANSH = "dbo.AABO_TransH"
SOURCE_MCKITI = "synthetic.V_TTS_OrderBump_PoC"
