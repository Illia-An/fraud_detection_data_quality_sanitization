"""Excel report download."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from backend.app_common import API_PREFIX
from backend.report_schemas import ExcelReportRequest, to_excel_report_document

router = APIRouter(prefix=API_PREFIX, tags=["reports"])


@router.post(
    "/reports/excel",
    responses={
        200: {
            "content": {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}
            }
        },
        422: {"description": "Validation error"},
    },
)
def create_excel_report(body: ExcelReportRequest) -> Response:
    """Pack a finished sanitization and plan into an Excel file."""
    from excel_report.workbook import build_excel_report

    try:
        payload = build_excel_report(to_excel_report_document(body))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return Response(
        content=payload,
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": 'attachment; filename="sanitization-plan-report.xlsx"'
        },
    )