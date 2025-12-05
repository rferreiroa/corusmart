"""
API endpoints for bike-sharing systems.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.repositories import SystemRepository, StationRepository, StationStatusRepository
from app.api.v1.schemas import (
    SystemResponse,
    SystemListResponse,
    SystemCreate,
    SystemStatsResponse
)

router = APIRouter()


@router.get("", response_model=SystemListResponse)
async def list_systems(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """
    Listar todos los sistemas de bicicletas disponibles.

    - **active_only**: Si es True, solo devuelve sistemas activos (por defecto: True)
    """
    repo = SystemRepository(db)
    station_repo = StationRepository(db)

    systems = await repo.get_all(active_only=active_only)

    # Add station count to each system
    response_systems = []
    for system in systems:
        count = await station_repo.count(system.id)
        system_dict = {
            "id": system.id,
            "name": system.name,
            "type": system.type,
            "city": system.city,
            "country": system.country,
            "gbfs_url": system.gbfs_url,
            "timezone": system.timezone,
            "is_active": system.is_active,
            "created_at": system.created_at,
            "updated_at": system.updated_at,
            "station_count": count
        }
        response_systems.append(SystemResponse(**system_dict))

    return SystemListResponse(systems=response_systems, total=len(systems))


@router.get("/{system_id}", response_model=SystemResponse)
async def get_system(
    system_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtener un sistema específico por su ID.

    - **system_id**: Identificador del sistema (ej: 'bicicoruna')
    """
    repo = SystemRepository(db)
    station_repo = StationRepository(db)

    system = await repo.get_by_id(system_id)
    if not system:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sistema '{system_id}' no encontrado"
        )

    count = await station_repo.count(system_id)

    return SystemResponse(
        id=system.id,
        name=system.name,
        type=system.type,
        city=system.city,
        country=system.country,
        gbfs_url=system.gbfs_url,
        timezone=system.timezone,
        is_active=system.is_active,
        created_at=system.created_at,
        updated_at=system.updated_at,
        station_count=count
    )


@router.post("", response_model=SystemResponse, status_code=status.HTTP_201_CREATED)
async def create_system(
    system_data: SystemCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Crear un nuevo sistema de bicicletas.

    - **id**: Identificador único (ej: 'bicicoruna', 'bicimad')
    - **name**: Nombre para mostrar
    - **city**: Ciudad
    """
    repo = SystemRepository(db)

    # Check if already exists
    existing = await repo.get_by_id(system_data.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sistema '{system_data.id}' ya existe"
        )

    system = await repo.upsert(system_data.model_dump())
    await db.commit()

    return SystemResponse(
        id=system.id,
        name=system.name,
        type=system.type,
        city=system.city,
        country=system.country,
        gbfs_url=system.gbfs_url,
        timezone=system.timezone,
        is_active=system.is_active,
        created_at=system.created_at,
        updated_at=system.updated_at,
        station_count=0
    )


@router.get("/{system_id}/stats", response_model=SystemStatsResponse)
async def get_system_stats(
    system_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtener estadísticas agregadas de un sistema.

    Incluye:
    - Total de estaciones
    - Total de bicicletas disponibles
    - Total de huecos disponibles
    - Estaciones vacías/llenas
    - Ocupación media
    """
    system_repo = SystemRepository(db)
    status_repo = StationStatusRepository(db)

    # Verify system exists
    system = await system_repo.get_by_id(system_id)
    if not system:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sistema '{system_id}' no encontrado"
        )

    stats = await status_repo.get_stats(system_id)

    return SystemStatsResponse(
        system_id=system_id,
        **stats,
        last_updated=system.updated_at
    )
