"""Write synthetic survey JSON for local demos (no DB)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from fraud_guard.synthetic import PRESETS, PresetName, SyntheticConfig, generate_preset, generate_synthetic_rows

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic RateGetAnswers-like JSON")
    parser.add_argument(
        "--preset",
        choices=list(PRESETS.keys()),
        default="medium",
        help="small | medium | stress",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT / "tests" / "fixtures" / "synthetic_medium.json",
        help="Output JSON path",
    )
    parser.add_argument("--seed", type=int, default=None, help="Override random seed")
    parser.add_argument("--stores", type=int, default=None, help="Override store count")
    parser.add_argument("--months", type=int, default=None, help="Override month count")
    args = parser.parse_args()

    preset: PresetName = args.preset
    if args.seed is not None or args.stores is not None or args.months is not None:
        base = PRESETS[preset]
        cfg = SyntheticConfig(
            seed=args.seed if args.seed is not None else base.seed,
            n_stores=args.stores if args.stores is not None else base.n_stores,
            n_months=args.months if args.months is not None else base.n_months,
            rows_per_store_month=base.rows_per_store_month,
            include_farming=base.include_farming,
            include_inflated_months=base.include_inflated_months,
            include_always5=base.include_always5,
            include_mega_entity=base.include_mega_entity,
            inflated_store_months=base.inflated_store_months,
        )
        rows = generate_synthetic_rows(cfg)
    else:
        rows = generate_preset(preset)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {len(rows)} rows -> {args.out}")


if __name__ == "__main__":
    main()
