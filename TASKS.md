# Prototype Tasks Queue

- [x] **TASK-01 [Contract Engineer]**: Refactor `src/schemas/` to implement `PipelineConfig` with `echo_config` and clean domain naming (replace legacy fraud naming with sanitization).
  - *Contract:* `SPEC.md#2`
  - *Verify:* `pytest tests/test_contracts.py` (or existing schema tests).

- [x] **TASK-02 [Engine Optimizer]**: Remove `sys.path` hacks across `src/` and ensure clean absolute module imports using standard package resolution (`uv`/pyproject).
  - *Contract:* `SPEC.md#4`
  - *Verify:* Run CLI/FastAPI app import without path mutations.

- [x] **TASK-03 [Drift Verifier]**: Run full test suite, verify end-to-end `/process` output matches `SanitizationResponse` without schema breaks.

- [x] **TASK-04 [Engine Optimizer]**: Refactor Tier 1 and Tier 2 processing pipelines in `src/fraud_guard/` to strictly satisfy Invariants 1, 2, 3, and 5 from `SPEC.md#3`. Ensure PII hashing occurs before any grouping.
  - *Contract:* `SPEC.md#3`
  - *Verify:* `pytest tests/test_tier1.py tests/test_tier2.py`

- [x] **TASK-05 [Contract Engineer]**: Wire the `/api/v1/process` FastAPI endpoint to return the exact `SanitizationResponse` payload with `echo_config`.
  - *Contract:* `SPEC.md#2`
  - *Verify:* Run integration test against `/api/v1/process`.
