"""
Data ingestion service.
Handles periodic fetching and storing of bike-sharing data.
"""

import asyncio
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import AsyncSessionLocal
from app.db.repositories import SystemRepository, StationRepository, StationStatusRepository
from app.models import StationStatus
from app.services.gbfs import GBFSClient


class IngestionService:
    """
    Service for ingesting bike-sharing data from external APIs.

    This service can be run as a background task to periodically
    fetch and store station data.
    """

    def __init__(self, system_id: str, gbfs_url: str):
        """
        Initialize the ingestion service.

        Args:
            system_id: ID of the system to ingest data for
            gbfs_url: Base URL for the GBFS feed
        """
        self.system_id = system_id
        self.gbfs_client = GBFSClient(base_url=gbfs_url)
        self._running = False

    async def ingest_once(self, db: Optional[AsyncSession] = None) -> int:
        """
        Perform a single ingestion cycle.

        Args:
            db: Optional database session. If not provided, creates a new one.

        Returns:
            Number of stations processed
        """
        close_session = False
        if db is None:
            db = AsyncSessionLocal()
            close_session = True

        try:
            station_repo = StationRepository(db)
            status_repo = StationStatusRepository(db)

            # Fetch combined data from GBFS
            stations_data = await self.gbfs_client.get_combined_data()
            timestamp = datetime.utcnow()

            stations_processed = 0
            for data in stations_data:
                # Upsert station
                station = await station_repo.upsert(
                    system_id=self.system_id,
                    station_data={
                        "external_id": data["station_id"],
                        "name": data["name"],
                        "address": data.get("address"),
                        "lat": data["lat"],
                        "lon": data["lon"],
                        "capacity": data.get("capacity", 0)
                    }
                )

                # Calculate occupancy
                bikes = data["num_bikes_available"]
                docks = data["num_docks_available"]
                capacity = bikes + docks
                occupancy = (bikes / capacity * 100) if capacity > 0 else 0

                # Create status record
                status = StationStatus(
                    station_id=station.id,
                    timestamp=timestamp,
                    bikes_available=bikes,
                    docks_available=docks,
                    ebikes_available=data.get("num_ebikes_available", 0),
                    occupancy_rate=round(occupancy, 2),
                    is_renting=data.get("is_renting", True),
                    is_returning=data.get("is_returning", True),
                    is_installed=data.get("is_installed", True),
                    raw_payload=data
                )
                await status_repo.create(status)
                stations_processed += 1

            await db.commit()
            return stations_processed

        except Exception as e:
            await db.rollback()
            raise e
        finally:
            if close_session:
                await db.close()

    async def run_periodic(self, interval_seconds: Optional[int] = None):
        """
        Run the ingestion service periodically.

        Args:
            interval_seconds: Seconds between ingestion cycles.
                            Defaults to settings.ingestion_interval_seconds
        """
        interval = interval_seconds or settings.ingestion_interval_seconds
        self._running = True

        print(f"🔄 Starting periodic ingestion for {self.system_id}")
        print(f"   Interval: {interval} seconds")

        while self._running:
            try:
                count = await self.ingest_once()
                print(f"✅ Ingested {count} stations for {self.system_id}")
            except Exception as e:
                print(f"❌ Ingestion error for {self.system_id}: {e}")

            await asyncio.sleep(interval)

    def stop(self):
        """Stop the periodic ingestion."""
        self._running = False
        print(f"⏹️ Stopping ingestion for {self.system_id}")


async def run_bicicoruna_ingestion():
    """Run ingestion for Bicicoruña."""
    service = IngestionService(
        system_id="bicicoruna",
        gbfs_url="https://acoruna.publicbikesystem.net/customer/gbfs/v2"
    )
    await service.run_periodic()


if __name__ == "__main__":
    # Allow running as a standalone script
    asyncio.run(run_bicicoruna_ingestion())
