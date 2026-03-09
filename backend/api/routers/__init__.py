"""
Break Resolution & Dashboarding API Routers.

Each module handles a specific domain of the break resolution lifecycle.
"""
from fastapi import APIRouter

from .allocations import router as allocations_router
from .known_differences import router as known_differences_router
from .break_resolution import router as break_resolution_router
from .nav_views import router as nav_views_router
from .positions_views import router as positions_views_router
from .income_views import router as income_views_router
from .derivatives_views import router as derivatives_views_router
from .commentary import router as commentary_router
from .notifications import router as notifications_router
from .export import router as export_router
from .audit import router as audit_router
from .mapping import router as mapping_router

all_routers: list[APIRouter] = [
    allocations_router,
    known_differences_router,
    break_resolution_router,
    nav_views_router,
    positions_views_router,
    income_views_router,
    derivatives_views_router,
    commentary_router,
    notifications_router,
    export_router,
    audit_router,
    mapping_router,
]
