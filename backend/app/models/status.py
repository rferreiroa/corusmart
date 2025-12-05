"""
StationStatus model - represents a snapshot of a station's status at a point in time.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional, Any
from sqlalchemy import DateTime, Integer, ForeignKey, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.station import Station


class StationStatus(Base):
    """
    A snapshot of a station's status at a specific timestamp.
    This table stores historical data for analytics.

    Attributes:
        id: Auto-generated internal ID
        station_id: Reference to the station
        timestamp: When this status was recorded
        bikes_available: Total bikes available (all types)
        docks_available: Empty docks available
        ebikes_available: Electric bikes available (subset of bikes_available)
        is_renting: Whether station is accepting rentals
        is_returning: Whether station is accepting returns
        raw_payload: Complete JSON response from source API
    """

    __tablename__ = "station_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stations.id"), nullable=False, index=True
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, index=True, default=datetime.utcnow
    )

    # Availability counts
    bikes_available: Mapped[int] = mapped_column(Integer, default=0)
    docks_available: Mapped[int] = mapped_column(Integer, default=0)
    ebikes_available: Mapped[int] = mapped_column(Integer, default=0)

    # Calculated fields
    occupancy_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Station operational status
    is_renting: Mapped[bool] = mapped_column(default=True)
    is_returning: Mapped[bool] = mapped_column(default=True)
    is_installed: Mapped[bool] = mapped_column(default=True)

    # Raw data for debugging/future analysis
    raw_payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    station: Mapped["Station"] = relationship("Station", back_populates="statuses")

    def __repr__(self) -> str:
        return (
            f"<StationStatus(station_id={self.station_id}, "
            f"bikes={self.bikes_available}, docks={self.docks_available}, "
            f"timestamp={self.timestamp})>"
        )

    @property
    def availability_status(self) -> str:
        """Calculate availability status based on bikes."""
        if self.bikes_available == 0:
            return "empty"
        capacity = self.bikes_available + self.docks_available
        if capacity == 0:
            return "unknown"
        ratio = self.bikes_available / capacity
        if ratio >= 0.5:
            return "available"
        elif ratio >= 0.2:
            return "low_bikes"
        else:
            return "critical"

    @property
    def normal_bikes_available(self) -> int:
        """Calculate normal (non-electric) bikes."""
        return max(0, self.bikes_available - self.ebikes_available)
