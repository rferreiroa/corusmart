"""
Webhook endpoints for n8n integration.
"""

from datetime import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.db.repositories import SystemRepository, StationRepository, StationStatusRepository
from app.models import Station, StationStatus
from app.api.v1.schemas import WebhookPayload, WebhookResponse, SystemStatsResponse

router = APIRouter()


def verify_webhook_secret(
    x_webhook_secret: str = Header(None, alias="X-Webhook-Secret")
) -> bool:
    """Verify the webhook secret if configured."""
    if settings.n8n_webhook_secret:
        if x_webhook_secret != settings.n8n_webhook_secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook secret"
            )
    return True


@router.post("/ingest", response_model=WebhookResponse)
async def ingest_station_data(
    payload: WebhookPayload,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_webhook_secret)
):
    """
    Recibir datos de estaciones desde n8n.

    Este endpoint recibe un payload con datos de todas las estaciones
    de un sistema y los almacena en la base de datos.

    El payload esperado:
    ```json
    {
        "system_id": "bicicoruna",
        "timestamp": "2024-01-15T10:30:00Z",
        "stations": [
            {
                "station_id": "1",
                "name": "Plaza de María Pita",
                "address": "Plaza de María Pita, 1",
                "lat": 43.3715,
                "lon": -8.3962,
                "capacity": 20,
                "num_bikes_available": 5,
                "num_docks_available": 15,
                "num_ebikes_available": 2,
                "is_renting": true,
                "is_returning": true,
                "is_installed": true
            }
        ]
    }
    ```
    """
    system_repo = SystemRepository(db)
    station_repo = StationRepository(db)
    status_repo = StationStatusRepository(db)

    # Verify system exists
    system = await system_repo.get_by_id(payload.system_id)
    if not system:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sistema '{payload.system_id}' no encontrado. Créelo primero."
        )

    timestamp = payload.timestamp or datetime.utcnow()
    stations_processed = 0

    for station_data in payload.stations:
        try:
            # Extract station info
            external_id = str(station_data.get("station_id", ""))
            if not external_id:
                continue

            # Upsert station
            station = await station_repo.upsert(
                system_id=payload.system_id,
                station_data={
                    "external_id": external_id,
                    "name": station_data.get("name", f"Estación {external_id}"),
                    "address": station_data.get("address"),
                    "lat": float(station_data.get("lat", 0)),
                    "lon": float(station_data.get("lon", 0)),
                    "capacity": int(station_data.get("capacity", 0)),
                    "extra": {
                        k: v for k, v in station_data.items()
                        if k not in ["station_id", "name", "address", "lat", "lon", "capacity"]
                    }
                }
            )

            # Calculate occupancy rate
            bikes = int(station_data.get("num_bikes_available", 0))
            docks = int(station_data.get("num_docks_available", 0))
            capacity = bikes + docks
            occupancy = (bikes / capacity * 100) if capacity > 0 else 0

            # Create status record
            status_record = StationStatus(
                station_id=station.id,
                timestamp=timestamp,
                bikes_available=bikes,
                docks_available=docks,
                ebikes_available=int(station_data.get("num_ebikes_available", 0)),
                occupancy_rate=round(occupancy, 2),
                is_renting=bool(station_data.get("is_renting", True)),
                is_returning=bool(station_data.get("is_returning", True)),
                is_installed=bool(station_data.get("is_installed", True)),
                raw_payload=station_data
            )

            await status_repo.create(status_record)
            stations_processed += 1

        except Exception as e:
            # Log error but continue processing other stations
            print(f"Error processing station {station_data}: {e}")
            continue

    await db.commit()

    return WebhookResponse(
        success=True,
        message=f"Datos procesados correctamente para {payload.system_id}",
        stations_processed=stations_processed,
        timestamp=timestamp
    )


@router.get("/stats/{system_id}", response_model=SystemStatsResponse)
async def get_stats_for_n8n(
    system_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtener estadísticas para uso en n8n.

    Este endpoint está diseñado para ser llamado desde n8n
    para obtener métricas agregadas que pueden usarse en
    alertas y automatizaciones.
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


@router.post("/trigger/{workflow_name}")
async def trigger_n8n_workflow(
    workflow_name: str,
    data: dict[str, Any] = {}
):
    """
    Disparar un workflow de n8n.

    Este endpoint permite a la aplicación disparar workflows
    de n8n para automatizaciones como alertas, notificaciones, etc.

    Nota: Requiere que n8n esté configurado y accesible.
    """
    import httpx

    if not settings.n8n_base_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="n8n no está configurado"
        )

    webhook_url = f"{settings.n8n_base_url}/webhook/{workflow_name}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(webhook_url, json=data)
            response.raise_for_status()
            return {
                "success": True,
                "workflow": workflow_name,
                "response": response.json() if response.text else None
            }
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Timeout al conectar con n8n workflow '{workflow_name}'"
        )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al disparar workflow: {str(e)}"
        )
