"""Generate before/after 5% comparison charts (saved to docs/charts/)."""

from __future__ import annotations

from pathlib import Path
import sys

import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / "src")]

from db.config import get_settings

get_settings.cache_clear()
from db.connection import get_engine
from fraud_guard.tier1 import (
    Tier1Config,
    apply_tier1,
    filter_answered_metric_rows,
    keep_clean_rows,
    top_box_rate,
)
from fraud_guard.tier2 import Tier2Config, apply_tier2
from fraud_guard.tier2 import keep_clean_rows as keep_clean_rows_tier2
from fraud_guard.tier3 import Tier3Config, apply_tier3
from fraud_guard.tier3 import keep_clean_rows as keep_clean_rows_tier3

OUT_DIR = ROOT / "docs" / "charts"
VIEW = "dbo.TargetsByMetrics_RateGetAnswers"


def _pct(rate: float) -> float:
    return round(rate * 100, 2)


def monthly_five_pct(df: pd.DataFrame) -> pd.Series:
    return (
        df.groupby(["Year", "Month"])["Answer_Value"]
        .apply(lambda s: 100.0 * (s == 5).mean())
        .sort_index()
    )


def chart_compare_two(
    raw_pct: float,
    mvp_pct: float,
    full_pct: float,
    out_path: Path,
) -> None:
    labels = [
        "Actual 5%\n(no sanitization)",
        "MVP sanitized\n(Tier1 + Tier2)",
        "Full stack\n(+ Tier3 IF)",
    ]
    values = [raw_pct, mvp_pct, full_pct]
    colors = ["#4C78A8", "#54A24B", "#72B7B2"]

    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.bar(labels, values, color=colors, width=0.55)
    for bar, v in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            v + 0.25,
            f"{v:.2f}%",
            ha="center",
            va="bottom",
            fontsize=12,
            fontweight="bold",
        )
    ax.set_ylim(max(55, min(values) - 4), min(75, max(values) + 3))
    ax.set_ylabel("5% score (top-box share, %)")
    ax.set_title("Network 5%: actual vs sanitized")
    ax.annotate(
        f"MVP Δ = {raw_pct - mvp_pct:.2f} pp",
        xy=(0.5, (raw_pct + mvp_pct) / 2),
        ha="center",
        fontsize=10,
    )
    ax.annotate(
        f"Full Δ = {raw_pct - full_pct:.2f} pp",
        xy=(2, (raw_pct + full_pct) / 2),
        ha="center",
        fontsize=10,
    )
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def chart_pipeline(steps: list[str], values: list[float], out_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(9, 5))
    x = range(len(steps))
    ax.plot(x, values, marker="o", linewidth=2, color="#E45756")
    ax.fill_between(x, values, alpha=0.12, color="#E45756")
    for i, v in enumerate(values):
        ax.text(i, v + 0.2, f"{v:.2f}%", ha="center", fontweight="bold")
    ax.set_xticks(list(x))
    ax.set_xticklabels(steps)
    ax.set_ylabel("5% score (%)")
    ax.set_title("5% change across sanitization pipeline")
    ymin = min(values) - 1.5
    ymax = max(values) + 1.0
    ax.set_ylim(ymin, ymax)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def chart_monthly(
    before: pd.Series,
    mvp: pd.Series,
    full: pd.Series,
    out_path: Path,
) -> None:
    labels = [f"{y}-{m:02d}" for y, m in before.index]
    x = range(len(labels))

    fig, ax = plt.subplots(figsize=(14, 5))
    ax.plot(x, before.values, label="Actual", marker="o", markersize=4, alpha=0.85)
    ax.plot(
        x,
        mvp.values,
        label="MVP sanitized (T1+T2)",
        marker="o",
        markersize=4,
        alpha=0.85,
    )
    ax.plot(
        x,
        full.values,
        label="Full stack (T1+T2+T3)",
        marker="o",
        markersize=3,
        alpha=0.75,
        linestyle="--",
    )
    step = max(1, len(labels) // 12)
    ax.set_xticks(x[::step])
    ax.set_xticklabels(labels[::step], rotation=45, ha="right")
    ax.set_ylabel("5% (%)")
    ax.set_title("Monthly 5%: actual vs sanitized")
    ax.legend()
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    engine = get_engine()
    df = pd.read_sql(f"SELECT * FROM {VIEW}", engine)

    work = filter_answered_metric_rows(df)
    t1 = keep_clean_rows(apply_tier1(work, config=Tier1Config(enable_always_topbox=False)))
    t2 = keep_clean_rows_tier2(apply_tier2(t1, config=Tier2Config()))
    t3 = keep_clean_rows_tier3(
        apply_tier3(t2, config=Tier3Config(contamination=0.005))
    )

    raw_pct = _pct(top_box_rate(work))
    t1_pct = _pct(top_box_rate(t1))
    mvp_pct = _pct(top_box_rate(t2))
    full_pct = _pct(top_box_rate(t3))

    print(f"rows work={len(work)} t1={len(t1)} t2={len(t2)} t3={len(t3)}")
    print(
        f"5% raw={raw_pct}% tier1={t1_pct}% mvp={mvp_pct}% "
        f"full={full_pct}% mvp_delta={raw_pct - mvp_pct:.2f}pp "
        f"full_delta={raw_pct - full_pct:.2f}pp"
    )

    chart_compare_two(raw_pct, mvp_pct, full_pct, OUT_DIR / "five_pct_actual_vs_sanitized.png")
    chart_pipeline(
        ["Raw", "Tier1", "T1+T2", "T1+T2+T3"],
        [raw_pct, t1_pct, mvp_pct, full_pct],
        OUT_DIR / "five_pct_pipeline_steps.png",
    )
    chart_monthly(
        monthly_five_pct(work),
        monthly_five_pct(t2),
        monthly_five_pct(t3),
        OUT_DIR / "five_pct_monthly_actual_vs_sanitized.png",
    )

    print("saved:")
    for p in sorted(OUT_DIR.glob("*.png")):
        print(" ", p.relative_to(ROOT))


if __name__ == "__main__":
    main()
