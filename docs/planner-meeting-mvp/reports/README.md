# Reports (M-series)

Write one report **after** each SPEC is implemented and verified.

## Naming

`REPORT-M00N-<slug>.md` matching the SPEC slug, e.g.
`REPORT-M001-fresh-cleansed-slice.md`.

## Template

```markdown
# REPORT-M00N - <Title>

| Field | Value |
|-------|-------|
| Spec | [SPEC-M00N](../SPEC-M00N-….md) |
| Date | YYYY-MM-DD |
| Branch | `feat/planner-meeting-mvp` |
| Result | **GREEN** \| **YELLOW** \| **RED** |
| Commit | `<sha>` or “not committed” |

## What was done

1. …

## Checks (actually run)

| Check | Command | Result |
|-------|---------|--------|
| … | … | exit 0 / fail notes |

## Acceptance vs SPEC

| Criterion | Met? | Notes |
|-----------|------|-------|
| … | yes/no | … |

## Risks / follow-ups

- …

## Rollback

- …
```

## Rules

- Do not mark a SPEC DONE without a report.
- Record pre-existing failures as **pre-existing** (do not fix outside SPEC scope).
- Prefer focused test commands from the SPEC; full suite when the SPEC says so.
