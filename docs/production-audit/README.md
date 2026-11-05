# Production audit (SDD)

Specs live in `specs/`. Implementation reports live in `reports/`.

## Naming

| Kind   | Pattern                | Example                          |
|--------|------------------------|----------------------------------|
| Spec   | `SPEC-A###-<slug>.md`  | `SPEC-A001-architecture-coupling.md` |
| Report | `REPORT-A###-<slug>.md`| `REPORT-A001-architecture-coupling.md` |

- `A###` is sequential for this audit track.
- Same number links one spec to its report.
- Slug: lowercase, kebab-case, short.

## Index

| ID   | Spec | Report | Status |
|------|------|--------|--------|
| A001 | [SPEC-A001-architecture-coupling.md](./specs/SPEC-A001-architecture-coupling.md) | [REPORT-A001-architecture-coupling.md](./reports/REPORT-A001-architecture-coupling.md) | Report ready (G-1 pending) |
| A002 | [SPEC-A002-db-data-integrity.md](./specs/SPEC-A002-db-data-integrity.md) | [REPORT-A002-db-data-integrity.md](./reports/REPORT-A002-db-data-integrity.md) | Report ready (G-1 / freshness SLA pending) |
| A003 | [SPEC-A003-security-hardening.md](./specs/SPEC-A003-security-hardening.md) | [REPORT-A003-security-hardening.md](./reports/REPORT-A003-security-hardening.md) | Report ready (IdP / git history / pepper open) |
| A004 | [SPEC-A004-testing-quality.md](./specs/SPEC-A004-testing-quality.md) | [REPORT-A004-testing-quality.md](./reports/REPORT-A004-testing-quality.md) | Report ready (G-1 / smoke owners open) |
| A005 | [SPEC-A005-observability.md](./specs/SPEC-A005-observability.md) | [REPORT-A005-observability.md](./reports/REPORT-A005-observability.md) | Report ready (G-5 / alert channel / freshness SLA open) |
| A006 | [SPEC-A006-cicd-release-dr.md](./specs/SPEC-A006-cicd-release-dr.md) | [REPORT-A006-cicd-release-dr.md](./reports/REPORT-A006-cicd-release-dr.md) | Report ready (registry / host / RPO-RTO open) |
| A007 | [SPEC-A007-performance-scalability.md](./specs/SPEC-A007-performance-scalability.md) | [REPORT-A007-performance-scalability.md](./reports/REPORT-A007-performance-scalability.md) | Report ready (G-1 / concurrent users / latency SLA open) |
| A008 | [SPEC-A008-maintainability.md](./specs/SPEC-A008-maintainability.md) | [REPORT-A008-maintainability.md](./reports/REPORT-A008-maintainability.md) | Report ready (product-lock / lint tools / legacy api/ open) |
| A009 | [SPEC-A009-production-readiness-golive.md](./specs/SPEC-A009-production-readiness-golive.md) | [REPORT-A009-production-readiness-golive.md](./reports/REPORT-A009-production-readiness-golive.md) | Report ready (G-1 / SLA / alerts / registry / waivers open) |
| A010 | [SPEC-A010-api-contracts-mocking.md](./specs/SPEC-A010-api-contracts-mocking.md) | [REPORT-A010-api-contracts-mocking.md](./reports/REPORT-A010-api-contracts-mocking.md) | Report ready (codegen / MSW / contract-CI owner open) |
| A011 | [SPEC-A011-change-management-governance.md](./specs/SPEC-A011-change-management-governance.md) | [REPORT-A011-change-management-governance.md](./reports/REPORT-A011-change-management-governance.md) | Report ready (host owner / freeze window / main protection open) |
| A012 | [SPEC-A012-integration-transition-cutover.md](./specs/SPEC-A012-integration-transition-cutover.md) | [REPORT-A012-integration-transition-cutover.md](./reports/REPORT-A012-integration-transition-cutover.md) | Report ready (G-1 / row floor / freshness SLA / refresh host open) |
