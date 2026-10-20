# Synthetic PoC note — `V_TTS_OrderBump`

**Branch:** `exp/tts-order-bump-synth`  
**Code:** `src/tts_order_bump/synthetic.py`  
**Contract columns:** `src/tts_order_bump/columns.py` (mirrors `02_TTS_Order_Bump_Technical_Specification.md` §3)

## Purpose

Generate flat bump-rows shaped like the future DB view so we can validate cleaning / impact logic **before** DBA delivers TransH↔monitor history.

This is **not** production data. `source_view_mckiti` is labeled `synthetic.V_TTS_OrderBump_PoC`.

## How to dump a sample

```powershell
uv run python -c "from tts_order_bump import generate_order_bump_preset, order_bump_preset_meta; import json; rows=generate_order_bump_preset('small'); print(json.dumps({'meta': order_bump_preset_meta('small', rows), 'sample_rows': rows[:3]}, indent=2, ensure_ascii=False))"
```

Presets: `small` | `medium` | `stress`.

## Invariants (tested)

- All ТЗ §3 columns present, stable order
- Same `order_tts_sec` for every bump of an `order_key`
- `order_tts_sec` in ~150–420 (seconds, not minutes)
- Mix of bumps &lt;30s and ≥30s; `bump_ge30` / `bump_valid` consistent with timestamps
- `join_match=1` for PoC impact path
- ≥2 calendar months per preset
