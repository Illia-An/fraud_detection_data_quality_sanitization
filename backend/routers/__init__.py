"""Domain APIRouters mounted by ``backend.main.create_app``."""

from __future__ import annotations

from fastapi import FastAPI

from backend.routers import health, plans, process, reports, sample, tts_kitchen, tts_kpi


def include_routers(app: FastAPI) -> None:
    """Register all domain routers. Order: sample/db before sample/{preset}."""
    app.include_router(health.router)
    app.include_router(sample.router_db)
    app.include_router(tts_kpi.router_sample)
    app.include_router(tts_kpi.router_ap)
    app.include_router(sample.router_preset)
    app.include_router(process.router)
    app.include_router(plans.router)
    app.include_router(reports.router)
    app.include_router(tts_kitchen.router)
