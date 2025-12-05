"""
Station model - represents a bike station within a system.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional, Any
from sqlalchemy import String, DateTime, Float, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.system import System
    from app.models.status import StationStatus


class Station(Base):
    """
    A bike station within a bike-sharing system.

    Attributes:
        id: Auto-generated internal ID
        system_id: Reference to the parent system
        external_id: ID from the external API (e.g., GBFS station_id)
        name: Station name
        address: Full address
        lat: Latitude coordinate
        lon: Longitude coordinate
        capacity: Total number of docks
        extra: Additional JSON data from source
        created_at: When the station was first seen
        updated_at: Last update timestamp
    """

    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    system_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("systems.id"), nullable=False, index=True
    )
    external_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=0)
    extra: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    system: Mapped["System"] = relationship("System", back_populates="stations")
    statuses: Mapped[list["StationStatus"]] = relationship(
        "StationStatus", back_populates="station", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Station(id={self.id}, name={self.name}, system={self.system_id})>"

    @property
    def coordinates(self) -> tuple[float, float]:
        """Return (lat, lon) tuple."""
        return (self.lat, self.lon)
