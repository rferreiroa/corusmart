"""
GBFS (General Bikeshare Feed Specification) client.
Handles fetching data from bike-sharing APIs that implement GBFS.
"""

from typing import Optional, Any
from dataclasses import dataclass
import httpx

from app.config import settings


@dataclass
class StationInfo:
    """Parsed station information."""
    station_id: str
    name: str
    lat: float
    lon: float
    address: Optional[str] = None
    capacity: int = 0


@dataclass
class StationStatus:
    """Parsed station status."""
    station_id: str
    num_bikes_available: int
    num_docks_available: int
    num_ebikes_available: int = 0
    is_renting: bool = True
    is_returning: bool = True
    is_installed: bool = True
    last_reported: Optional[int] = None
    vehicle_types: Optional[list[dict]] = None


class GBFSClient:
    """
    Client for fetching data from GBFS-compliant bike-sharing APIs.

    GBFS is an open standard for bike-sharing system data.
    See: https://github.com/MobilityData/gbfs
    """

    def __init__(self, base_url: str = None, timeout: float = 30.0):
        """
        Initialize the GBFS client.

        Args:
            base_url: Base URL for the GBFS feed (e.g., https://example.com/gbfs/v2)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url or settings.gbfs_base_url
        self.timeout = timeout
        self._feeds: dict[str, str] = {}

    async def _fetch_json(self, url: str) -> dict[str, Any]:
        """Fetch JSON from a URL."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()

    async def discover_feeds(self) -> dict[str, str]:
        """
        Discover available GBFS feeds from the discovery endpoint.

        Returns:
            Dictionary mapping feed names to URLs
        """
        if self._feeds:
            return self._feeds

        discovery_url = f"{self.base_url}/gbfs.json"
        data = await self._fetch_json(discovery_url)

        # Parse feed URLs from discovery response
        feeds_data = data.get("data", {})

        # Handle both v1 and v2 format
        if "en" in feeds_data:
            feeds_list = feeds_data["en"].get("feeds", [])
        elif "feeds" in feeds_data:
            feeds_list = feeds_data["feeds"]
        else:
            feeds_list = []

        self._feeds = {
            feed["name"]: feed["url"]
            for feed in feeds_list
        }

        return self._feeds

    async def get_station_information(self) -> list[StationInfo]:
        """
        Fetch station information (static data).

        Returns:
            List of StationInfo objects
        """
        feeds = await self.discover_feeds()
        url = feeds.get("station_information")

        if not url:
            raise ValueError("station_information feed not found")

        data = await self._fetch_json(url)
        stations_data = data.get("data", {}).get("stations", [])

        stations = []
        for s in stations_data:
            stations.append(StationInfo(
                station_id=str(s.get("station_id", "")),
                name=s.get("name", ""),
                lat=float(s.get("lat", 0)),
                lon=float(s.get("lon", 0)),
                address=s.get("address"),
                capacity=int(s.get("capacity", 0))
            ))

        return stations

    async def get_station_status(self) -> list[StationStatus]:
        """
        Fetch current station status (dynamic data).

        Returns:
            List of StationStatus objects
        """
        feeds = await self.discover_feeds()
        url = feeds.get("station_status")

        if not url:
            raise ValueError("station_status feed not found")

        data = await self._fetch_json(url)
        stations_data = data.get("data", {}).get("stations", [])

        statuses = []
        for s in stations_data:
            # Handle vehicle types (for e-bikes)
            vehicle_types = s.get("vehicle_types_available", [])
            num_ebikes = 0
            for vt in vehicle_types:
                if vt.get("vehicle_type_id") in ["EFIT", "efit", "ebike"]:
                    num_ebikes += vt.get("count", 0)

            # If no vehicle types breakdown, try num_ebikes_available
            if num_ebikes == 0:
                num_ebikes = s.get("num_ebikes_available", 0)

            statuses.append(StationStatus(
                station_id=str(s.get("station_id", "")),
                num_bikes_available=int(s.get("num_bikes_available", 0)),
                num_docks_available=int(s.get("num_docks_available", 0)),
                num_ebikes_available=num_ebikes,
                is_renting=bool(s.get("is_renting", True)),
                is_returning=bool(s.get("is_returning", True)),
                is_installed=bool(s.get("is_installed", True)),
                last_reported=s.get("last_reported"),
                vehicle_types=vehicle_types if vehicle_types else None
            ))

        return statuses

    async def get_combined_data(self) -> list[dict[str, Any]]:
        """
        Fetch and combine station info and status.

        Returns:
            List of dictionaries with combined station data
        """
        info_list = await self.get_station_information()
        status_list = await self.get_station_status()

        # Create lookup by station_id
        status_by_id = {s.station_id: s for s in status_list}

        combined = []
        for info in info_list:
            status = status_by_id.get(info.station_id)

            station_data = {
                "station_id": info.station_id,
                "name": info.name,
                "address": info.address,
                "lat": info.lat,
                "lon": info.lon,
                "capacity": info.capacity,
                "num_bikes_available": status.num_bikes_available if status else 0,
                "num_docks_available": status.num_docks_available if status else 0,
                "num_ebikes_available": status.num_ebikes_available if status else 0,
                "is_renting": status.is_renting if status else False,
                "is_returning": status.is_returning if status else False,
                "is_installed": status.is_installed if status else False,
            }
            combined.append(station_data)

        return combined


# Pre-configured clients for known systems
class BiciCorunaClient(GBFSClient):
    """Pre-configured client for Bicicoruña."""

    def __init__(self):
        super().__init__(
            base_url="https://acoruna.publicbikesystem.net/customer/gbfs/v2"
        )


class BiciMADClient(GBFSClient):
    """Pre-configured client for BiciMAD (Madrid)."""

    def __init__(self):
        super().__init__(
            base_url="https://openapi.emtmadrid.es/v1/transport/bicimad/stations"
        )
        # Note: BiciMAD uses a different API format, may need customization
