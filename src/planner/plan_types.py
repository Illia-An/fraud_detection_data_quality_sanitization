"""Neutral plan value types shared by the allocator and its callers.

Kept free of planner imports so ``planner.allocate`` does not depend on
``planner.five_percent`` / ``planner.tts``. The name is ``plan_types`` (not
``types``) to avoid shadowing the stdlib ``types`` module.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Direction = Literal["higher_is_better", "lower_is_better"]


@dataclass(frozen=True)
class MonthScore:
    year: int
    month: int
    score: float


@dataclass(frozen=True)
class StoreProjection:
    store_id: int
    months: tuple[MonthScore, ...]
