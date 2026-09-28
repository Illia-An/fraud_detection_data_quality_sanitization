"""Plan API contracts (TASK-15 Phase A — five_percent only)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class PlanBaselineRow(BaseModel):
    store_id: int
    five_percent: float = Field(ge=0.0, le=100.0)


class PlanParams(BaseModel):
    trajectory: Literal["uniform", "front_loaded", "accelerated"] = "uniform"
    trajectory_power: float = Field(default=2.0, ge=0.1)
    priority_power: float = Field(default=1.0, ge=0.1)
    max_monthly_improve: float = Field(default=4.0, ge=0.01)
    growth_factor: float = Field(default=0.5, ge=0.0, le=1.0)


class PlanRequest(BaseModel):
    """Run five_percent plan on a cleansed baseline snapshot."""

    reference_year: int = Field(ge=2000, le=2100)
    reference_month: int = Field(ge=1, le=12)
    horizon: int = Field(default=6, ge=1, le=60)
    target: float = Field(default=75.0, ge=0.0, le=100.0)
    params: PlanParams = Field(default_factory=PlanParams)
    baseline_rows: list[PlanBaselineRow] = Field(min_length=1)

    @model_validator(mode="after")
    def _target_must_improve(self) -> PlanRequest:
        scores = [row.five_percent for row in self.baseline_rows]
        current = sum(scores) / len(scores)
        if self.target < current - 1e-9:
            raise ValueError(
                "Target must improve in the selected metric direction "
                f"(current chain {current:.2f}%, target {self.target:.2f}%)."
            )
        return self


class MonthScoreOut(BaseModel):
    year: int
    month: int
    score: float


class StoreProjectionOut(BaseModel):
    store_id: int
    months: list[MonthScoreOut]


class FivePercentPlanOut(BaseModel):
    metric_id: Literal["five_percent"] = "five_percent"
    unit: Literal["%"] = "%"
    direction: Literal["higher_is_better"] = "higher_is_better"
    target: float
    current_chain: float
    required_change: float
    final_chain: float
    feasible: bool
    chain_trajectory: list[MonthScoreOut]
    projections: list[StoreProjectionOut]


class PlanResponse(BaseModel):
    metrics: dict[str, FivePercentPlanOut]
