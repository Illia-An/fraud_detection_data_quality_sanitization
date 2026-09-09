"""Scenario-based synthetic survey rows (RateGetAnswers shape, no PII).

Mirrors research findings: staff BlackList segments, store-day farming,
inflated store×months, always-5 entities, mega-entity for Tier 3.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Literal

from fraud_guard.tier1 import CUSTOMER_BLACKLIST_VALUE, SATISFACTION_QUESTION_ID

PresetName = Literal["small", "medium", "stress"]

STAFF_BLACKLIST = "עובד"
OTHER_BLACKLIST = "הפחתות בקופה"


@dataclass(frozen=True)
class SyntheticConfig:
    """Controls volume and which fraud scenarios are injected."""

    seed: int = 42
    n_stores: int = 10
    start_year: int = 2026
    n_months: int = 6
    rows_per_store_month: int = 45
    topbox_rate_normal: float = 0.67
    null_answer_rate: float = 0.08
    wrong_question_rate: float = 0.03
    staff_rate: float = 0.03
    include_farming: bool = True
    include_inflated_months: bool = True
    include_always5: bool = True
    include_mega_entity: bool = True
    farming_answers_per_day: int = 4
    always5_min_answers: int = 12
    inflated_topbox_rate: float = 0.96
    inflated_store_months: int = 3


PRESETS: dict[PresetName, SyntheticConfig] = {
    "small": SyntheticConfig(
        n_stores=2,
        n_months=2,
        rows_per_store_month=40,
        inflated_store_months=1,
        include_mega_entity=False,
    ),
    "medium": SyntheticConfig(
        n_stores=10,
        n_months=6,
        rows_per_store_month=45,
        inflated_store_months=3,
    ),
    "stress": SyntheticConfig(
        n_stores=20,
        n_months=12,
        rows_per_store_month=50,
        inflated_store_months=6,
    ),
}


def _month_sequence(start_year: int, n_months: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    year, month = start_year, 1
    for _ in range(n_months):
        out.append((year, month))
        month += 1
        if month > 12:
            month = 1
            year += 1
    return out


def _answer_time(year: int, month: int, day: int, hour: int = 12) -> str:
    day = min(max(day, 1), 28)
    return f"{year}-{month:02d}-{day:02d}T{hour:02d}:00:00"


def _checkout_time(answer_time: str, latency_min: int = 15) -> str:
    dt = datetime.fromisoformat(answer_time)
    return (dt - timedelta(minutes=latency_min)).isoformat(timespec="seconds")


def _score(rng: random.Random, topbox_rate: float) -> int:
    return 5 if rng.random() < topbox_rate else rng.randint(1, 4)


def _base_row(
    rng: random.Random,
    *,
    participate: str,
    store: int,
    year: int,
    month: int,
    day: int,
    contact: str | None,
    blacklist: str = CUSTOMER_BLACKLIST_VALUE,
    answer: int | None = 5,
    question_id: int = SATISFACTION_QUESTION_ID,
    ext_user_id: int = 0,
    phone: str | None = None,
) -> dict[str, Any]:
    answer_time = _answer_time(year, month, day)
    row: dict[str, Any] = {
        "ParticipateNumber": participate,
        "Question_ID": question_id,
        "Answer_Value": answer,
        "BlackList": blacklist,
        "UserContact": contact,
        "PhoneFromLog": phone,
        "ext_user_id": ext_user_id,
        "PrintStore": store,
        "AnswerTime": answer_time,
        "PrintDateTime": _checkout_time(answer_time),
        "Year": year,
        "Month": month,
        "ContactType": "SMS",
    }
    return row


def _normal_block(
    rng: random.Random,
    cfg: SyntheticConfig,
    store: int,
    year: int,
    month: int,
    *,
    topbox_rate: float,
    count: int,
    contact_prefix: str,
    seq_start: int,
) -> tuple[list[dict[str, Any]], int]:
    rows: list[dict[str, Any]] = []
    seq = seq_start
    for i in range(count):
        if rng.random() < cfg.null_answer_rate:
            rows.append(
                _base_row(
                    rng,
                    participate=f"p-{store}-{year}{month:02d}-n{seq}",
                    store=store,
                    year=year,
                    month=month,
                    day=1 + (i % 20),
                    contact=f"{contact_prefix}-{seq}",
                    answer=None,
                )
            )
            seq += 1
            continue
        if rng.random() < cfg.wrong_question_rate:
            rows.append(
                _base_row(
                    rng,
                    participate=f"p-{store}-{year}{month:02d}-w{seq}",
                    store=store,
                    year=year,
                    month=month,
                    day=1 + (i % 20),
                    contact=f"{contact_prefix}-{seq}",
                    answer=_score(rng, topbox_rate),
                    question_id=99999,
                )
            )
            seq += 1
            continue
        if rng.random() < cfg.staff_rate:
            rows.append(
                _base_row(
                    rng,
                    participate=f"p-{store}-{year}{month:02d}-s{seq}",
                    store=store,
                    year=year,
                    month=month,
                    day=1 + (i % 20),
                    contact=f"staff-{store}-{seq}",
                    blacklist=STAFF_BLACKLIST if rng.random() < 0.7 else OTHER_BLACKLIST,
                    answer=5,
                )
            )
            seq += 1
            continue
        rows.append(
            _base_row(
                rng,
                participate=f"p-{store}-{year}{month:02d}-{seq}",
                store=store,
                year=year,
                month=month,
                day=1 + (i % 20),
                contact=f"{contact_prefix}-{seq}",
                answer=_score(rng, topbox_rate),
            )
        )
        seq += 1
    return rows, seq


def _farming_block(
    rng: random.Random,
    store: int,
    year: int,
    month: int,
    *,
    n_per_day: int,
    seq_start: int,
) -> tuple[list[dict[str, Any]], int]:
    rows: list[dict[str, Any]] = []
    seq = seq_start
    contact = f"farmer-{store}-{year}{month:02d}"
    for day in (5, 12, 19):
        for _ in range(n_per_day):
            rows.append(
                _base_row(
                    rng,
                    participate=f"p-{store}-{year}{month:02d}-f{seq}",
                    store=store,
                    year=year,
                    month=month,
                    day=day,
                    contact=contact,
                    answer=5,
                )
            )
            seq += 1
    return rows, seq


def _always5_block(
    rng: random.Random,
    store: int,
    year: int,
    month: int,
    *,
    n_answers: int,
    seq_start: int,
) -> tuple[list[dict[str, Any]], int]:
    rows: list[dict[str, Any]] = []
    seq = seq_start
    contact = f"always5-{store}"
    for i in range(n_answers):
        rows.append(
            _base_row(
                rng,
                participate=f"p-{store}-{year}{month:02d}-a{seq}",
                store=store,
                year=year,
                month=month,
                day=1 + (i % 15),
                contact=contact,
                answer=5,
            )
        )
        seq += 1
    return rows, seq


def _mega_entity_block(
    rng: random.Random,
    stores: list[int],
    months: list[tuple[int, int]],
    *,
    n_answers: int,
    seq_start: int,
) -> tuple[list[dict[str, Any]], int]:
    rows: list[dict[str, Any]] = []
    seq = seq_start
    contact = "mega-entity-001"
    for i in range(n_answers):
        store = stores[i % len(stores)]
        year, month = months[i % len(months)]
        rows.append(
            _base_row(
                rng,
                participate=f"p-mega-{seq}",
                store=store,
                year=year,
                month=month,
                day=1 + (i % 20),
                contact=contact,
                answer=5,
            )
        )
        seq += 1
    return rows, seq


def _inflated_targets(cfg: SyntheticConfig, stores: list[int], months: list[tuple[int, int]]) -> set[tuple[int, int, int]]:
    pairs = [(s, y, m) for s in stores for y, m in months]
    if not pairs or cfg.inflated_store_months <= 0:
        return set()
    rng = random.Random(cfg.seed + 999)
    rng.shuffle(pairs)
    return set(pairs[: min(cfg.inflated_store_months, len(pairs))])


def generate_synthetic_rows(cfg: SyntheticConfig | None = None) -> list[dict[str, Any]]:
    """Build synthetic answered + noise rows for pipeline demos."""
    cfg = cfg or PRESETS["medium"]
    rng = random.Random(cfg.seed)
    stores = list(range(1, cfg.n_stores + 1))
    months = _month_sequence(cfg.start_year, cfg.n_months)
    inflated = _inflated_targets(cfg, stores, months) if cfg.include_inflated_months else set()

    rows: list[dict[str, Any]] = []
    seq = 0

    for store in stores:
        for year, month in months:
            topbox = (
                cfg.inflated_topbox_rate
                if (store, year, month) in inflated
                else cfg.topbox_rate_normal + rng.uniform(-0.05, 0.05)
            )
            topbox = min(max(topbox, 0.05), 0.99)
            block, seq = _normal_block(
                rng,
                cfg,
                store,
                year,
                month,
                topbox_rate=topbox,
                count=cfg.rows_per_store_month,
                contact_prefix=f"c{store}",
                seq_start=seq,
            )
            rows.extend(block)

            if cfg.include_farming and store % 3 == 1:
                farm, seq = _farming_block(
                    rng,
                    store,
                    year,
                    month,
                    n_per_day=cfg.farming_answers_per_day,
                    seq_start=seq,
                )
                rows.extend(farm)

            if cfg.include_always5 and store == stores[0] and month == months[0]:
                always, seq = _always5_block(
                    rng,
                    store,
                    year,
                    month,
                    n_answers=cfg.always5_min_answers,
                    seq_start=seq,
                )
                rows.extend(always)

    if cfg.include_mega_entity and stores and months:
        mega, _seq = _mega_entity_block(
            rng,
            stores,
            months,
            n_answers=min(120, cfg.n_stores * cfg.n_months * 2),
            seq_start=seq,
        )
        rows.extend(mega)

    rng.shuffle(rows)
    return rows


def generate_preset(preset: PresetName) -> list[dict[str, Any]]:
    """Return rows for a named preset (small | medium | stress)."""
    if preset not in PRESETS:
        raise ValueError(f"unknown preset: {preset}")
    return generate_synthetic_rows(PRESETS[preset])
