# SPEC-F003 - Export / save chrome (optional)

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | F002 report green + user "go"; skip if F001–F002 diff already large |
| Risk | Low |
| Report | `reports/REPORT-F003-export-chrome.md` |

## Goal

Extract excel/csv/save error flags and thin handlers where safe without moving
simulation orchestration.

## In scope

- Shared state pattern for `excelExporting` / `excelExportError` (and analogous
  save errors if identical).
- Thin wrappers that call existing request builders; builders stay where they are.

## Out of scope

- Changing Excel payload shape.
- Moving `handleRun` or slope simulation.

## Acceptance

| Check | Expected |
|-------|----------|
| tsc / lint / unit / Playwright | green |
| Behavior | identical export/save UX |

## Decision

If F001–F002 already produce a large PR, leave this SPEC PLANNED and ship F000–F002
first; F003 becomes a follow-up PR on the same or a new branch.
