# Specification: Survey KPI What-If Sanitization Engine
**Version:** 1.0.0-prototype  
**Status:** Approved  
**Domain:** Q10012 Top-Box Network Impact Engine

---

## 1. Context & Boundaries
- **Objective:** Compute survey sanitization deltas (Actual -> Tier1 -> Tier2) on Q10012 five-star percentage.
- **In-Scope:** 
  - Tier 1: BlackList filtering (Hebrew: 'לא'), frequency rule (>= N per entity×store×day), optional always-5.
  - Tier 2: Store×Month anomaly flagging (volume >= 30, z > 2.0 OR top_box >= 90%).
- **Out-of-Scope (Non-Goals):**
  - No Tier 3 research / ML models in production API pipeline.
  - No raw survey responses emitted to UI if source=db.
  - No writing/mutating SQL Server DB (strictly read-only).

---

## 2. Shared Data Contracts (Pydantic v2)

```python
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

class PipelineConfig(BaseModel):
    tier1_blacklist_enabled: bool = True
    tier1_freq_threshold: int = Field(default=3, ge=1)
    tier1_always_five_enabled: bool = False
    tier1_always_five_min_n: int = 10
    tier2_min_volume: int = Field(default=30, ge=1)
    tier2_z_threshold: float = Field(default=2.0, ge=0.0)
    tier2_pct_threshold: float = Field(default=90.0, ge=0.0, le=100.0)

class StepMetric(BaseModel):
    step_name: Literal["actual", "tier1", "tier2"]
    rows_in: int
    rows_out: int
    rows_dropped: int
    top_box_pct: float

class SanitizationResponse(BaseModel):
    baseline_top_box_pct: float
    final_top_box_pct: float
    network_delta_pp: float
    steps: list[StepMetric]
    high_store_months: list[dict]
    store_impact_series: list[dict]
    echo_config: PipelineConfig
    meta: dict
```

---
### 3. Architecture & Invariants
- **Invariant 1 (PII Hashing): Any incoming UserContact or PhoneFromLog MUST be hashed using SHA-256 (truncated to 32 chars) prior to any processing or in-memory grouping.
- **Invariant 2 (Entity Identity Fallback): Identity key resolution must be deterministic:
contact -> phone -> ext_user_id (if != 0) -> None.
- **Invariant 3 (Top-Box KPI Definition): Target question is strictly Question_ID = 10012. Top-box value is strictly Answer_Value = 5.
- **Invariant 4 (SQL Boundary): Raw SQL queries MUST NOT execute SELECT *. Only audit-approved must-columns are allowed.
- **Invariant 5 (Deterministic Diff): network_delta_pp = final_top_box_pct - baseline_top_box_pct.

---

### 4. Acceptance Criteria
- [x] Response echoes back the complete effective PipelineConfig for reproducibility.
- [x] No sys.path.insert workarounds anywhere in src/.
- [x] 100% of existing tests pass with zero schema regression.
