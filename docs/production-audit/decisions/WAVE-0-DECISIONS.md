# Wave 0 — Production decisions register

| Field | Value |
|-------|--------|
| **Branch** | `feat/prod-source-truth` |
| **Plan** | [`PRODUCTION_PLAN.md`](../../../PRODUCTION_PLAN.md) Wave 0 |
| **Date opened** | 2026-11-11 |
| **Status** | **PARTIAL** — Wave 1 blockers signed; ops placeholders still open |

This file is the runbook for launch decisions. It does **not** invent business answers.  
Where the owner has not signed, status is `PENDING` and the “Audit recommendation” column is guidance only.

**Status legend**

| Status | Meaning |
|--------|---------|
| `PENDING` | Not signed; do not treat as production policy |
| `PROPOSED` | Engineering default for the next wave *if* owner confirms |
| `SIGNED` | Owner confirmed; safe to implement / operate against |
| `WAIVED` | Explicit written waiver with owner + date |

---

## 1. Launch decisions (Wave 0 table)

| ID | Decision | Audit refs | Audit recommendation | Status | Signed by / date | Notes |
|----|----------|------------|----------------------|--------|------------------|-------|
| **G-1** | Production data source | A001, A009 O-1, A012 | **Prod = snapshot-only; VIEW = dev only** | `SIGNED` | Owner / 2026-11-11 | Confirmed: prod always snapshot; VIEW only for local/dev |
| **FRESH** | Snapshot freshness SLA | A002 O-1, A009 O-2 | Threshold for later `GET /ready` (Wave 4); value TBD (e.g. 7d / 14d / 30d) | `PENDING` | — | Placeholder until product/ops pick a number |
| **NET** | Network lock until auth | A003 S-02 P0, A009 O-5 | Port reachable only on trusted LAN / internal bind until AuthN (Wave 6) | `PENDING` | — | Ops control, not app code in Wave 0–1 |
| **PII** | Snapshot PII at rest | A003 S-04/S-05, A009 O-5 | **Either** keyed hash at refresh **or** signed disk-encryption / access waiver | `PENDING` | — | Choose one path before Wave 6; no implementation in this branch |
| **ALERT** | Alert channel | A005 G-5, A009 O-3 | Where freshness / process failures page (email / Teams / other) | `PENDING` | — | Needed for Wave 4–5 ops; placeholder |
| **REG** | Image registry | A006 O-1, A009 O-4 | Private GHCR or internal registry + publish rights | `PENDING` | — | Wave 5 |
| **HOST** | Deploy / refresh host | A006, A011 O-1, A002 O-2 | Named host + who may edit `.env.docker` / run refresh | `PENDING` | — | Wave 5 / cutover |
| **DR** | RPO / RTO for snapshot copies | A006 O-5, A009 O-4 | Proposal in A006 pending sign-off (keep `.prev` / N copies) | `PENDING` | — | Wave 2 keeps `.prev`; numeric RPO/RTO still open |

---

## 2. Wave 1 policy (needed before code; not silent defaults)

These are product/engineering choices that shape Wave 1 implementation. Recorded here so Wave 1 does not invent them.

| ID | Question | Options | Audit refs | Status | Working note |
|----|----------|---------|------------|--------|--------------|
| **W1-SRC** | Same as **G-1** for this branch | snapshot-only prod; VIEW = dev | A-04, 1.4 | `SIGNED` | Owner / 2026-11-11 — default source snapshot; warn when VIEW outside Docker |
| **W1-MID** | Mid-month custom range on snapshot | **(A)** normalize bounds to calendar months · **(B)** HTTP 422 if not month-aligned | A-02, T-02 | `SIGNED` | Owner / 2026-11-11 — **(A)** snap `from`→1st, `to`→last day of month |
| **W1-VIEW** | VIEW + tiers 2/3 enabled | **(A)** HTTP 422 · **(B)** allow with explicit meta flag + UI warning | A-01, T-06, ARCH-01 | `SIGNED` | Owner / 2026-11-11 — **(B)** allow; meta `tiers_23_skipped` + UI alert |

---

## 3. Explicitly deferred (out of this branch)

Per `PRODUCTION_PLAN.md` and handoff: Wave 2+ (atomic refresh, `schema_version`, `/ready`, auth, routers, planner twins, Celery, security P0 beyond recording network lock) are **out of scope** for `feat/prod-source-truth`.

---

## 4. Sign-off log

| Date | Who | What changed |
|------|-----|--------------|
| 2026-11-11 | Agent (Wave 0) | Register created; all rows `PENDING`; audit recommendations copied, not assumed signed |
| 2026-11-11 | Owner | **G-1 / W1-SRC** yes (prod snapshot-only); **W1-MID** (A) month normalize; **W1-VIEW** (B) allow + UI flag |
