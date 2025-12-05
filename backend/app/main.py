"""
Main FastAPI application entry point.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.api.v1.router import api_router
from app.db.database import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events."""
    # Startup
    print(f"🚀 Starting {settings.app_name} v{settings.app_version}")
    print(f"📍 Environment: {settings.environment}")

    # Create database tables (in production, use Alembic migrations)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    # Shutdown
    print("👋 Shutting down application...")
    await engine.dispose()


def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="""
        API para monitorización de sistemas de bicicletas compartidas.

        ## Funcionalidades

        * **Sistemas**: Gestión de sistemas de bicicletas (Bicicoruña, BiciMAD, etc.)
        * **Estaciones**: Consulta de estaciones y su ubicación
        * **Estado**: Estado actual e histórico de disponibilidad
        * **Webhooks**: Integración con n8n para automatizaciones

        ## Sistemas soportados

        - 🚲 Bicicoruña (A Coruña)
        - 🔜 BiciMAD (Madrid) - Próximamente
        - 🔜 Renfe - Próximamente
        """,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # Configure CORS
    origins = settings.cors_origins.split(",") if settings.cors_origins != "*" else ["*"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API router
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    # Root endpoint
    @app.get("/", tags=["Health"])
    async def root():
        """Root endpoint with API information."""
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "status": "running",
            "docs": "/api/docs",
            "environment": settings.environment
        }

    # Health check
    @app.get("/health", tags=["Health"])
    async def health_check():
        """Health check endpoint for monitoring."""
        return {"status": "healthy"}

    return app


app = create_application()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
