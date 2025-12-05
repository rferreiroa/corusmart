"""
Repository pattern for database operations.
Provides clean abstraction over SQLAlchemy queries.
"""

from datetime import datetime
from typing import Optional, Sequence
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import System, Station, StationStatus


class SystemRepository:
    """Repository for System operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self, active_only: bool = True) -> Sequence[System]:
        """Get all systems, optionally filtering by active status."""
        query = select(System)
        if active_only:
            query = query.where(System.is_active == True)
        result = await self.db.execute(query.order_by(System.name))
        return result.scalars().all()

    async def get_by_id(self, system_id: str) -> Optional[System]:
        """Get a system by ID."""
        result = await self.db.execute(
            select(System).where(System.id == system_id)
        )
        return result.scalar_one_or_none()

    async def create(self, system: System) -> System:
        """Create a new system."""
        self.db.add(system)
        await self.db.flush()
        return system

    async def upsert(self, system_data: dict) -> System:
        """Create or update a system."""
        existing = await self.get_by_id(system_data["id"])
        if existing:
            for key, value in system_data.items():
                setattr(existing, key, value)
            existing.updated_at = datetime.utcnow()
            return existing
        else:
            system = System(**system_data)
            return await self.create(system)


class StationRepository:
    """Repository for Station operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(
        self,
        system_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Sequence[Station]:
        """Get all stations, optionally filtered by system."""
        query = select(Station)
        if system_id:
            query = query.where(Station.system_id == system_id)
        query = query.order_by(Station.name).limit(limit).offset(offset)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_by_id(self, station_id: int) -> Optional[Station]:
        """Get a station by internal ID."""
        result = await self.db.execute(
            select(Station).where(Station.id == station_id)
        )
        return result.scalar_one_or_none()

    async def get_by_external_id(
        self, system_id: str, external_id: str
    ) -> Optional[Station]:
        """Get a station by its external ID within a system."""
        result = await self.db.execute(
            select(Station).where(
                and_(
                    Station.system_id == system_id,
                    Station.external_id == external_id
                )
            )
        )
        return result.scalar_one_or_none()

    async def count(self, system_id: Optional[str] = None) -> int:
        """Count stations, optionally filtered by system."""
        query = select(func.count(Station.id))
        if system_id:
            query = query.where(Station.system_id == system_id)
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def create(self, station: Station) -> Station:
        """Create a new station."""
        self.db.add(station)
        await self.db.flush()
        return station

    async def upsert(self, system_id: str, station_data: dict) -> Station:
        """Create or update a station."""
        external_id = station_data.get("external_id")
        existing = await self.get_by_external_id(system_id, external_id)

        if existing:
            for key, value in station_data.items():
                if key != "external_id":
                    setattr(existing, key, value)
            existing.updated_at = datetime.utcnow()
            return existing
        else:
            station = Station(system_id=system_id, **station_data)
            return await self.create(station)


class StationStatusRepository:
    """Repository for StationStatus operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_current(self, station_id: int) -> Optional[StationStatus]:
        """Get the most recent status for a station."""
        result = await self.db.execute(
            select(StationStatus)
            .where(StationStatus.station_id == station_id)
            .order_by(StationStatus.timestamp.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_history(
        self,
        station_id: int,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        limit: int = 100
    ) -> Sequence[StationStatus]:
        """Get historical statuses for a station within a date range."""
        query = select(StationStatus).where(StationStatus.station_id == station_id)

        if from_date:
            query = query.where(StationStatus.timestamp >= from_date)
        if to_date:
            query = query.where(StationStatus.timestamp <= to_date)

        query = query.order_by(StationStatus.timestamp.desc()).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_all_current(
        self, system_id: Optional[str] = None
    ) -> Sequence[tuple[Station, StationStatus]]:
        """Get current status for all stations, optionally filtered by system."""
        # Subquery to get latest timestamp per station
        subquery = (
            select(
                StationStatus.station_id,
                func.max(StationStatus.timestamp).label("max_ts")
            )
            .group_by(StationStatus.station_id)
            .subquery()
        )

        # Main query joining with latest status
        query = (
            select(Station, StationStatus)
            .join(StationStatus, Station.id == StationStatus.station_id)
            .join(
                subquery,
                and_(
                    StationStatus.station_id == subquery.c.station_id,
                    StationStatus.timestamp == subquery.c.max_ts
                )
            )
        )

        if system_id:
            query = query.where(Station.system_id == system_id)

        result = await self.db.execute(query.order_by(Station.name))
        return result.all()

    async def create(self, status: StationStatus) -> StationStatus:
        """Create a new status record."""
        self.db.add(status)
        await self.db.flush()
        return status

    async def bulk_create(self, statuses: list[StationStatus]) -> int:
        """Create multiple status records at once."""
        self.db.add_all(statuses)
        await self.db.flush()
        return len(statuses)

    async def get_stats(self, system_id: str) -> dict:
        """Get aggregated statistics for a system."""
        # Get all current statuses
        current_statuses = await self.get_all_current(system_id)

        if not current_statuses:
            return {
                "total_stations": 0,
                "total_bikes": 0,
                "total_docks": 0,
                "total_ebikes": 0,
                "empty_stations": 0,
                "full_stations": 0,
                "avg_occupancy": 0.0
            }

        total_bikes = 0
        total_docks = 0
        total_ebikes = 0
        empty_stations = 0
        full_stations = 0
        occupancy_sum = 0.0

        for station, status in current_statuses:
            total_bikes += status.bikes_available
            total_docks += status.docks_available
            total_ebikes += status.ebikes_available

            if status.bikes_available == 0:
                empty_stations += 1
            if status.docks_available == 0:
                full_stations += 1

            capacity = status.bikes_available + status.docks_available
            if capacity > 0:
                occupancy_sum += status.bikes_available / capacity

        total_stations = len(current_statuses)
        avg_occupancy = (occupancy_sum / total_stations * 100) if total_stations > 0 else 0

        return {
            "total_stations": total_stations,
            "total_bikes": total_bikes,
            "total_docks": total_docks,
            "total_ebikes": total_ebikes,
            "total_normal_bikes": total_bikes - total_ebikes,
            "empty_stations": empty_stations,
            "full_stations": full_stations,
            "avg_occupancy": round(avg_occupancy, 1)
        }
