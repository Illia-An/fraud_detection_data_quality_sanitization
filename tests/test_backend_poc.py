"""Backend PoC pipeline tests — no live DB."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backend.schemas import PipelineConfig, ProcessRequest, SurveyAnswerRow
from backend.service import run_pipeline


def _sample_rows() -> list[SurveyAnswerRow]:
    return [
        SurveyAnswerRow(
            ParticipateNumber="p1",
            Question_ID=10012,
            Answer_Value=5,
            BlackList="לא",
            UserContact="111",
            PrintStore=1,
            AnswerTime="2025-01-01T10:00:00",
            Year=2025,
            Month=1,
        ),
        SurveyAnswerRow(
            ParticipateNumber="p2",
            Question_ID=10012,
            Answer_Value=5,
            BlackList="לא",
            UserContact="111",
            PrintStore=1,
            AnswerTime="2025-01-01T11:00:00",
            Year=2025,
            Month=1,
        ),
        SurveyAnswerRow(
            ParticipateNumber="p3",
            Question_ID=10012,
            Answer_Value=5,
            BlackList="לא",
            UserContact="111",
            PrintStore=1,
            AnswerTime="2025-01-01T12:00:00",
            Year=2025,
            Month=1,
        ),
        SurveyAnswerRow(
            ParticipateNumber="p4",
            Question_ID=10012,
            Answer_Value=4,
            BlackList="עובד",
            UserContact="222",
            PrintStore=1,
            AnswerTime="2025-01-01T13:00:00",
            Year=2025,
            Month=1,
        ),
    ]


def test_run_pipeline_tier1_drops_staff_and_freq() -> None:
    req = ProcessRequest(rows=_sample_rows(), config=PipelineConfig())
    res = run_pipeline(req)
    assert res.baseline_top_box_pct is not None
    assert len(res.steps) >= 2
    tier1 = next(s for s in res.steps if s.step_name == "1_tier1")
    assert tier1.rows_dropped >= 2
    assert len(res.store_impact_series) >= 1
    assert res.store_impact_series[0].actual_five_pct is not None


def test_empty_answers_returns_zero_out() -> None:
    req = ProcessRequest(
        rows=[
            SurveyAnswerRow(Question_ID=999, Answer_Value=None),
        ],
    )
    res = run_pipeline(req)
    assert res.steps[0].rows_out == 0
