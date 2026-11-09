"""Build an .xlsx workbook from a finished report document."""

from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook

from excel_report.document import ExcelReportDocument, PlanMonthScore

_SUMMARY = "Summary"
_SANITIZATION = "Sanitization"
_PLAN = "Plan"


def _month_label(point: PlanMonthScore) -> str:
    return f"{point.year:04d}-{point.month:02d}"


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

    buffer = BytesIO()
    book.save(buffer)
    return buffer.getvalue()
