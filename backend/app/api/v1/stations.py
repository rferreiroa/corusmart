"""
API endpoints for bike stations.
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.repositories import StationRepository, StationStatusRepository
from app.api.v1.schemas import (
    StationResponse,
    StationWithStatusResponse,
    StationListResponse,
    StationStatusResponse,
    StationStatusHistoryResponse
)

router = APIRouter()


@router.get("", response_model=StationListResponse)
async def list_stations(
    system: Optional[str] = Query(None, description="Filtrar por sistema (ej: 'bicicoruna')"),
    limit: int = Query(100, ge=1, le=500, description="Número máximo de resultados"),
    offset: int = Query(0, ge=0, description="Offset para paginación"),
    db: AsyncSession = Depends(get_db)
):
    """
    Listar estaciones con su estado actual.

    - **system**: Filtrar por ID de sistema
    - **limit**: Máximo de resultados (1-500, por defecto 100)
    - **offset**: Número de resultados a saltar (paginación)
    """
    station_repo = StationRepository(db)
    status_repo = StationStatusRepository(db)

    stations = await station_repo.get_all(
        system_id=system,
        limit=limit,
        offset=offset
    )
    total = await station_repo.count(system_id=system)

    # Get current status for each station
    stations_with_status = []
    for station in stations:
        current_status = await status_repo.get_current(station.id)

        status_data = None
        if current_status:
            status_data = StationStatusResponse(
                id=current_status.id,
                station_id=current_status.station_id,
                timestamp=current_status.timestamp,
                bikes_available=current_status.bikes_available,
                docks_available=current_status.docks_available,
                ebikes_available=current_status.ebikes_available,
                is_renting=current_status.is_renting,
                is_returning=current_status.is_returning,
                is_installed=current_status.is_installed,
                occupancy_rate=current_status.occupancy_rate,
                availability_status=current_status.availability_status,
                normal_bikes_available=current_status.normal_bikes_available
            )

        stations_with_status.append(StationWithStatusResponse(
            id=station.id,
            system_id=station.system_id,
            external_id=station.external_id,
            name=station.name,
            address=station.address,
            lat=station.lat,
            lon=station.lon,
            capacity=station.capacity,
            extra=station.extra,
            created_at=station.created_at,
            updated_at=station.updated_at,
            current_status=status_data
        ))

    return StationListResponse(
        stations=stations_with_status,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/{station_id}", response_model=StationWithStatusResponse)
async def get_station(
    station_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtener una estación específica con su estado actual.

    - **station_id**: ID interno de la estación
    """
    station_repo = StationRepository(db)
    status_repo = StationStatusRepository(db)

    station = await station_repo.get_by_id(station_id)
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estación con ID {station_id} no encontrada"
        )

    current_status = await status_repo.get_current(station_id)

    status_data = None
    if current_status:
        status_data = StationStatusResponse(
            id=current_status.id,
            station_id=current_status.station_id,
            timestamp=current_status.timestamp,
            bikes_available=current_status.bikes_available,
            docks_available=current_status.docks_available,
            ebikes_available=current_status.ebikes_available,
            is_renting=current_status.is_renting,
            is_returning=current_status.is_returning,
            is_installed=current_status.is_installed,
            occupancy_rate=current_status.occupancy_rate,
            availability_status=current_status.availability_status,
            normal_bikes_available=current_status.normal_bikes_available
        )

    return StationWithStatusResponse(
        id=station.id,
        system_id=station.system_id,
        external_id=station.external_id,
        name=station.name,
        address=station.address,
        lat=station.lat,
        lon=station.lon,
        capacity=station.capacity,
        extra=station.extra,
        created_at=station.created_at,
        updated_at=station.updated_at,
        current_status=status_data
    )


@router.get("/{station_id}/status/current", response_model=StationStatusResponse)
async def get_station_current_status(
    station_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtener el estado actual de una estación.

    - **station_id**: ID interno de la estación
    """
    station_repo = StationRepository(db)
    status_repo = StationStatusRepository(db)

    # Verify station exists
    station = await station_repo.get_by_id(station_id)
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estación con ID {station_id} no encontrada"
        )

    current_status = await status_repo.get_current(station_id)
    if not current_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No hay datos de estado para la estación {station_id}"
        )

    return StationStatusResponse(
        id=current_status.id,
        station_id=current_status.station_id,
        timestamp=current_status.timestamp,
        bikes_available=current_status.bikes_available,
        docks_available=current_status.docks_available,
        ebikes_available=current_status.ebikes_available,
        is_renting=current_status.is_renting,
        is_returning=current_status.is_returning,
        is_installed=current_status.is_installed,
        occupancy_rate=current_status.occupancy_rate,
        availability_status=current_status.availability_status,
        normal_bikes_available=current_status.normal_bikes_available
    )


@router.get("/{station_id}/status", response_model=StationStatusHistoryResponse)
async def get_station_status_history(
    station_id: int,
    from_date: Optional[datetime] = Query(None, alias="from", description="Fecha inicio (ISO 8601)"),
    to_date: Optional[datetime] = Query(None, alias="to", description="Fecha fin (ISO 8601)"),
    limit: int = Query(100, ge=1, le=1000, description="Máximo de registros"),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtener el histórico de estados de una estación.

    - **station_id**: ID interno de la estación
    - **from**: Fecha de inicio (formato ISO 8601)
    - **to**: Fecha de fin (formato ISO 8601)
    - **limit**: Máximo de registros (1-1000, por defecto 100)

    Ejemplo:
    ```
    GET /api/v1/stations/1/status?from=2024-01-01T00:00:00&to=2024-01-31T23:59:59
    ```
    """
    station_repo = StationRepository(db)
    status_repo = StationStatusRepository(db)

    # Verify station exists
    station = await station_repo.get_by_id(station_id)
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Estación con ID {station_id} no encontrada"
        )

    history = await status_repo.get_history(
        station_id=station_id,
        from_date=from_date,
        to_date=to_date,
        limit=limit
    )

    history_data = [
        StationStatusResponse(
            id=s.id,
            station_id=s.station_id,
            timestamp=s.timestamp,
            bikes_available=s.bikes_available,
            docks_available=s.docks_available,
            ebikes_available=s.ebikes_available,
            is_renting=s.is_renting,
            is_returning=s.is_returning,
            is_installed=s.is_installed,
            occupancy_rate=s.occupancy_rate,
            availability_status=s.availability_status,
            normal_bikes_available=s.normal_bikes_available
        )
        for s in history
    ]

    return StationStatusHistoryResponse(
        station_id=station_id,
        station_name=station.name,
        history=history_data,
        from_date=from_date,
        to_date=to_date
    )
