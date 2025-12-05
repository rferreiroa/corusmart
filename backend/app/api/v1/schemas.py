"""
Pydantic schemas for API request/response validation.
"""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict


# ============ System Schemas ============

class SystemBase(BaseModel):
    """Base schema for system data."""
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(default="bike_sharing", max_length=50)
    city: str = Field(..., min_length=1, max_length=100)
    country: str = Field(default="ES", max_length=5)
    gbfs_url: Optional[str] = None
    timezone: str = Field(default="Europe/Madrid", max_length=50)


class SystemCreate(SystemBase):
    """Schema for creating a system."""
    id: str = Field(..., min_length=1, max_length=50)


class SystemResponse(SystemBase):
    """Schema for system response."""
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    station_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class SystemListResponse(BaseModel):
    """Schema for list of systems."""
    systems: list[SystemResponse]
    total: int


# ============ Station Schemas ============

class StationBase(BaseModel):
    """Base schema for station data."""
    external_id: str = Field(..., max_length=100)
    name: str = Field(..., min_length=1, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    capacity: int = Field(default=0, ge=0)
    extra: Optional[dict[str, Any]] = None


class StationCreate(StationBase):
    """Schema for creating a station."""
    system_id: str


class StationResponse(StationBase):
    """Schema for station response."""
    id: int
    system_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StationWithStatusResponse(StationResponse):
    """Schema for station with current status."""
    current_status: Optional["StationStatusResponse"] = None


class StationListResponse(BaseModel):
    """Schema for paginated list of stations."""
    stations: list[StationWithStatusResponse]
    total: int
    limit: int
    offset: int


# ============ Station Status Schemas ============

class StationStatusBase(BaseModel):
    """Base schema for station status."""
    bikes_available: int = Field(..., ge=0)
    docks_available: int = Field(..., ge=0)
    ebikes_available: int = Field(default=0, ge=0)
    is_renting: bool = True
    is_returning: bool = True
    is_installed: bool = True


class StationStatusCreate(StationStatusBase):
    """Schema for creating a status record."""
    station_id: int
    timestamp: Optional[datetime] = None
    raw_payload: Optional[dict[str, Any]] = None


class StationStatusResponse(StationStatusBase):
    """Schema for status response."""
    id: int
    station_id: int
    timestamp: datetime
    occupancy_rate: Optional[float] = None
    availability_status: Optional[str] = None
    normal_bikes_available: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class StationStatusHistoryResponse(BaseModel):
    """Schema for status history."""
    station_id: int
    station_name: str
    history: list[StationStatusResponse]
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None


# ============ Statistics Schemas ============

class SystemStatsResponse(BaseModel):
    """Schema for system statistics."""
    system_id: str
    total_stations: int
    total_bikes: int
    total_docks: int
    total_ebikes: int
    total_normal_bikes: int
    empty_stations: int
    full_stations: int
    avg_occupancy: float
    last_updated: Optional[datetime] = None


# ============ Webhook Schemas ============

class WebhookPayload(BaseModel):
    """Schema for incoming webhook data from n8n."""
    system_id: str
    timestamp: Optional[datetime] = None
    stations: list[dict[str, Any]]


class WebhookResponse(BaseModel):
    """Schema for webhook response."""
    success: bool
    message: str
    stations_processed: int
    timestamp: datetime


# Update forward references
StationWithStatusResponse.model_rebuild()
