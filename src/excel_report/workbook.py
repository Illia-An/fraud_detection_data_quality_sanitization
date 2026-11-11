"""Build an .xlsx workbook from a finished report document."""

from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook

from excel_report.document import ExcelReportDocument, PlanMonthScore, StoreMonthMatrix

_SUMMARY = "Summary"
_SANITIZATION = "Sanitization"
_PLAN = "Plan"
_STORE_MATRIX = "StoreMatrix"

_MATRIX_METRICS: tuple[tuple[str, str], ...] = (
    ("monthly_target", "monthly_target"),
    ("cumulative_planned", "cumulative_planned"),
    ("actual", "actual"),
    ("cumulative_actual_or_simulation", "cumulative_actual_or_simulation"),
    ("required_monthly", "required_monthly"),
    ("required_cumulative", "required_cumulative"),
)


def _month_label(point: PlanMonthScore) -> str:
    return f"{point.year:04d}-{point.month:02d}"


def _append_store_matrix(book: Workbook, matrices: tuple[StoreMonthMatrix, ...]) -> None:
    sheet = book.create_sheet(_STORE_MATRIX)
    header = ["store_id", "metric", *[str(m) for m in range(1, 13)]]
    sheet.append(header)
    for store in matrices:
        series = {
            "monthly_target": store.monthly_target,
            "cumulative_planned": store.cumulative_planned,
            "actual": store.actual,
            "cumulative_actual_or_simulation": store.cumulative_actual_or_simulation,
            "required_monthly": store.required_monthly,
            "required_cumulative": store.required_cumulative,
        }
        for metric_key, _ in _MATRIX_METRICS:
            sheet.append([store.store_id, metric_key, *series[metric_key]])


def build_excel_report(document: ExcelReportDocument) -> bytes:
    """Return xlsx bytes. Raises ValueError when sanitization or the plan is missing."""
    if not document.method.strip():
        raise ValueError("Excel report requires a sanitization method")
    if not document.sanitization_rows:
        raise ValueError("Excel report requires sanitization rows")
    if not document.chain_months or not document.store_plans:
        raise ValueError("Excel report requires a plan")

    book = Workbook()
    summary = book.active
    summary.title = _SUMMARY
    summary.append(["field", "value"])
    summary.append(["method", document.method])
    summary.append(["period_start", document.period_start or ""])
    summary.append(["period_end", document.period_end or ""])
    summary.append(["target", document.target])
    summary.append(["current_chain", document.current_chain])
    summary.append(["final_chain", document.final_chain])
    summary.append(["feasible", "yes" if document.feasible else "no"])

    version = document.plan_version
    if version is not None:
        summary.append(["plan_version_id", version.version_id or ""])
        summary.append(["plan_version_created_at", version.created_at or ""])
        summary.append(["plan_version_label", version.label or ""])
        summary.append(
            [
                "plan_version_network_target",
                version.network_target if version.network_target is not None else "",
            ]
        )
        summary.append(
            [
                "plan_version_as_of",
                (
                    f"{version.as_of_year:04d}-{version.as_of_month:02d}"
                    if version.as_of_year is not None and version.as_of_month is not None
                    else ""
                ),
            ]
        )
        summary.append(
            [
                "plan_version_planning_year",
                version.planning_year if version.planning_year is not None else "",
            ]
        )
        summary.append(
            [
                "plan_version_network_mean_at_save",
                (
                    version.network_mean_at_save
                    if version.network_mean_at_save is not None
                    else ""
                ),
            ]
        )

    cleansed = book.create_sheet(_SANITIZATION)
    cleansed.append(["store_id", "year", "month", "score"])
    for row in document.sanitization_rows:
        cleansed.append([row.store_id, row.year, row.month, row.score])

    plan = book.create_sheet(_PLAN)
    labels = [_month_label(point) for point in document.chain_months]
    plan.append(["store_id", *labels])
    plan.append(["chain", *[point.score for point in document.chain_months]])
    for store in document.store_plans:
        by_month = {(point.year, point.month): point.score for point in store.months}
        plan.append(
            [
                store.store_id,
                *[by_month.get((point.year, point.month)) for point in document.chain_months],
            ]
        )

    if document.store_matrices:
        _append_store_matrix(book, document.store_matrices)

    buffer = BytesIO()
    book.save(buffer)
    return buffer.getvalue()
