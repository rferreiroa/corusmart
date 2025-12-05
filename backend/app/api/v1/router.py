"""
Main API v1 router that combines all endpoint routers.
"""

from fastapi import APIRouter

from app.api.v1.systems import router as systems_router
from app.api.v1.stations import router as stations_router
from app.api.v1.webhooks import router as webhooks_router

api_router = APIRouter()

# Include all routers
api_router.include_router(
    systems_router,
    prefix="/systems",
    tags=["Sistemas"]
)

api_router.include_router(
    stations_router,
    prefix="/stations",
    tags=["Estaciones"]
)

api_router.include_router(
    webhooks_router,
    prefix="/webhooks",
    tags=["Webhooks"]
)
