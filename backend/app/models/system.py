"""
System model - represents a bike-sharing system (Bicicoruña, BiciMAD, etc.)
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.station import Station


class System(Base):
    """
    A bike-sharing system like Bicicoruña, BiciMAD, etc.

    Attributes:
        id: Unique identifier (e.g., 'bicicoruna', 'bicimad')
        name: Display name (e.g., 'Bicicoruña')
        type: System type (e.g., 'bike_sharing', 'scooter_sharing')
        city: City name
        country: Country code (e.g., 'ES')
        gbfs_url: Base URL for GBFS feed (if applicable)
        is_active: Whether the system is currently active
        created_at: When the system was added
        updated_at: Last update timestamp
    """

    __tablename__ = "systems"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="bike_sharing")
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(5), default="ES")
    gbfs_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    timezone: Mapped[str] = mapped_column(String(50), default="Europe/Madrid")

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    stations: Mapped[list["Station"]] = relationship(
        "Station", back_populates="system", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<System(id={self.id}, name={self.name}, city={self.city})>"
