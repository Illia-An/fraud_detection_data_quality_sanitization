# Planner Target & Simulation Planning (SDD)

Specs and contracts for the Survey Planner evolution: cumulative targets,
mean-distance boost/slopes, frozen baseline plan versions, live simulation,
unreachable recommendations, and Excel month matrix.

## Naming

| Kind     | Pattern                       | Example |
|----------|-------------------------------|---------|
| Spec     | `SPEC-P###-<slug>.md`         | `SPEC-P001-target-simulation-planning.md` |
| Contract | `contracts/<name>.md`         | `contracts/api-v1.md` |
| Report   | `REPORT-P###-<slug>.md` (later) | after a phase lands |

- `P###` is sequential for this track.
- Same number links one spec to its later report when useful.

## Index

| ID   | Artifact | Status |
|------|----------|--------|
| P001 | [SPEC-P001-target-simulation-planning.md](./SPEC-P001-target-simulation-planning.md) | Draft (locked decisions Q1–Q10) |
| —    | [contracts/domain-model.md](./contracts/domain-model.md) | Draft |
| —    | [contracts/api-v1.md](./contracts/api-v1.md) | Draft |

## Branch

`feat/planner-target-simulation`

## Implementation phases (from plan)

| Phase | Focus | Depends on |
|-------|--------|------------|
| 0 | SPEC & contracts (this folder) | — |
| 1 | Pure domain engine + tests | P001 + domain-model |
| 2 | Plan versions DB + API | api-v1 |
| 3 | FE Plan / Actual / Sim layers + toggles | Phase 1–2 |
| 4 | Excel store×M1–12 matrix | domain-model + Phase 2 |
| 5 | Hardening, handoff doc updates, runbook | Phases 1–4 |

## Related product docs

- [sanitized panel handoff](../contracts/sanitized_panel_handoff.md) — cleansed panel → Planner (TASK-14/15). Plan DB Save was out of scope there; **superseded for plan versions** by SPEC-P001.
- [TASKS.md](../../TASKS.md) — TASK-15 Phase A–C baseline allocator.
- Legacy allocator remains available behind `solver: "legacy"` until Phase 5.
