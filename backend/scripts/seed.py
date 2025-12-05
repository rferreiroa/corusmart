#!/usr/bin/env python3
"""
Seed script to initialize the database with default data.
Run this after database migrations to populate initial systems.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.database import AsyncSessionLocal, engine, Base
from app.models import System


# Default systems to seed
DEFAULT_SYSTEMS = [
    {
        "id": "bicicoruna",
        "name": "Bicicoruña",
        "type": "bike_sharing",
        "city": "A Coruña",
        "country": "ES",
        "gbfs_url": "https://acoruna.publicbikesystem.net/customer/gbfs/v2",
        "timezone": "Europe/Madrid",
        "is_active": True
    },
    {
        "id": "bicimad",
        "name": "BiciMAD",
        "type": "bike_sharing",
        "city": "Madrid",
        "country": "ES",
        "gbfs_url": None,  # Coming soon
        "timezone": "Europe/Madrid",
        "is_active": False
    },
    {
        "id": "renfe",
        "name": "Renfe Cercanías",
        "type": "rail",
        "city": "España",
        "country": "ES",
        "gbfs_url": None,
        "timezone": "Europe/Madrid",
        "is_active": False
    }
]


async def seed_database():
    """Seed the database with initial data."""
    print("🌱 Starting database seed...")

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("✅ Tables created")

    # Seed systems
    async with AsyncSessionLocal() as session:
        for system_data in DEFAULT_SYSTEMS:
            # Check if exists
            from sqlalchemy import select
            result = await session.execute(
                select(System).where(System.id == system_data["id"])
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"⏭️  System '{system_data['id']}' already exists, skipping")
            else:
                system = System(**system_data)
                session.add(system)
                print(f"✅ Created system: {system_data['name']}")

        await session.commit()

    print("\n🎉 Database seeding complete!")


async def run_initial_ingestion():
    """Run initial data ingestion for active systems."""
    from app.services.ingestion import IngestionService

    print("\n📥 Running initial data ingestion...")

    for system_data in DEFAULT_SYSTEMS:
        if not system_data["is_active"] or not system_data["gbfs_url"]:
            continue

        print(f"   Ingesting data for {system_data['name']}...")

        try:
            service = IngestionService(
                system_id=system_data["id"],
                gbfs_url=system_data["gbfs_url"]
            )
            count = await service.ingest_once()
            print(f"   ✅ Ingested {count} stations")
        except Exception as e:
            print(f"   ❌ Error: {e}")

    print("\n🎉 Initial ingestion complete!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed the database")
    parser.add_argument(
        "--with-data",
        action="store_true",
        help="Also run initial data ingestion"
    )
    args = parser.parse_args()

    asyncio.run(seed_database())

    if args.with_data:
        asyncio.run(run_initial_ingestion())
