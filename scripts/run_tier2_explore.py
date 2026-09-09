"""Run Tier 2 exploration (same logic as notebooks/02_tier2_experiments.ipynb)."""

from __future__ import annotations

import pandas as pd

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


def five_pct(s: pd.Series) -> float:
    return 100.0 * (s == 5).mean()


def main() -> None:
    engine = get_engine()
    view = "dbo.TargetsByMetrics_RateGetAnswers"
    df = pd.read_sql(f"SELECT * FROM {view}", engine)
    print("shape:", df.shape)

    work = filter_answered_metric_rows(df)
    flagged = apply_tier1(work, config=Tier1Config(enable_always_topbox=False))
    clean = keep_clean_rows(flagged)
    print("answered:", len(work), "top-box:", round(top_box_rate(work), 4))
    print("after Tier1 MVP:", len(clean), "top-box:", round(top_box_rate(clean), 4))

    panel = (
        clean.groupby(["PrintStore", "Year", "Month"], dropna=False)["Answer_Value"]
        .agg(volume="count", five_pct=five_pct)
        .reset_index()
    )
    panel = panel[panel["volume"] >= 30].copy()
    mu = float(panel["five_pct"].mean())
    sigma = float(panel["five_pct"].std(ddof=0))
    panel["z"] = (panel["five_pct"] - mu) / sigma

    print("panel rows (vol>=30):", len(panel))
    print("mean five_pct:", round(mu, 2), "std:", round(sigma, 2))
    print(panel["z"].describe(percentiles=[0.01, 0.05, 0.5, 0.95, 0.99]))
    print("z > 3:", int((panel["z"] > 3).sum()))
    print("z < -3:", int((panel["z"] < -3).sum()))

    high = panel[panel["z"] > 3].sort_values("z", ascending=False)
    print("high outliers (z>3):", len(high))
    print(high.head(15).to_string(index=False))

    low = panel[panel["z"] < -3].sort_values("z")
    print("low outliers (z<-3):", len(low))
    print(low.head(10).to_string(index=False))

    high_keys = set(zip(high["PrintStore"], high["Year"], high["Month"]))
    key = list(zip(clean["PrintStore"], clean["Year"], clean["Month"]))
    mask_high = [k in high_keys for k in key]
    after_t2 = clean.loc[[not m for m in mask_high]].copy()

    print("clean rows:", len(clean))
    print(
        "dropped high-z store-months:",
        int(sum(mask_high)),
        "share:",
        round(sum(mask_high) / len(clean), 4),
    )
    print("after Tier2 high-z drop:", len(after_t2))
    print("top-box before T2:", round(top_box_rate(clean), 4))
    print("top-box after T2:", round(top_box_rate(after_t2), 4))
    if sum(mask_high):
        print("top-box in dropped:", round(top_box_rate(clean.loc[mask_high]), 4))


if __name__ == "__main__":
    main()
