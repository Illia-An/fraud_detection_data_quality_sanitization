"""Schema → feature mapping.

Fill `ColumnMapping` after the prepared DB source / columns are known.
Do not invent business field names here.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ColumnMapping(BaseModel):
    """Logical feature → physical column name in the source table/view."""

    model_config = ConfigDict(frozen=True)

    entity_key: str | None = None
    store_id: str | None = None
    event_ts: str | None = None
    survey_id: str | None = None
    question_id: str | None = None
    answer_value: str | None = None
    channel: str | None = None
    checkout_ts: str | None = None
    blacklist: str | None = None
    phone_from_log: str | None = None
    ext_user_id: str | None = None


def require_mapping(mapping: ColumnMapping, *fields: str) -> None:
    """Raise if required logical fields are still unset."""
    missing = [name for name in fields if getattr(mapping, name) is None]
    if missing:
        raise ValueError(
            "ColumnMapping incomplete; set after schema is known: "
            + ", ".join(missing)
        )
