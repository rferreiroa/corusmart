"""
n8n workflow automation integration.
Provides a client for triggering n8n webhooks and workflows.
"""

from typing import Any, Optional
import httpx

from app.config import settings


class N8NClient:
    """
    Client for interacting with n8n workflows.

    This client can trigger webhooks and poll workflow status.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: float = 30.0
    ):
        """
        Initialize the n8n client.

        Args:
            base_url: Base URL for n8n instance
            timeout: Request timeout in seconds
        """
        self.base_url = base_url or settings.n8n_base_url
        self.timeout = timeout

    async def trigger_webhook(
        self,
        webhook_path: str,
        data: dict[str, Any] = None,
        method: str = "POST"
    ) -> dict[str, Any]:
        """
        Trigger an n8n webhook.

        Args:
            webhook_path: The webhook path (e.g., 'bicicoruna-alert')
            data: Data to send to the webhook
            method: HTTP method (GET or POST)

        Returns:
            Response from the webhook
        """
        url = f"{self.base_url}/webhook/{webhook_path}"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            if method.upper() == "GET":
                response = await client.get(url, params=data)
            else:
                response = await client.post(url, json=data or {})

            response.raise_for_status()

            if response.text:
                return response.json()
            return {"success": True}

    async def send_alert(
        self,
        alert_type: str,
        message: str,
        data: dict[str, Any] = None
    ) -> dict[str, Any]:
        """
        Send an alert via n8n.

        Args:
            alert_type: Type of alert (e.g., 'station_empty', 'system_down')
            message: Human-readable alert message
            data: Additional data to include

        Returns:
            Response from the alert webhook
        """
        payload = {
            "type": alert_type,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data or {}
        }

        try:
            return await self.trigger_webhook("alerts", payload)
        except httpx.HTTPError as e:
            # Log but don't fail if alerting fails
            print(f"Failed to send alert: {e}")
            return {"success": False, "error": str(e)}

    async def notify_ingestion_complete(
        self,
        system_id: str,
        stations_count: int,
        stats: dict[str, Any] = None
    ) -> dict[str, Any]:
        """
        Notify n8n that ingestion has completed.

        This can be used to trigger downstream workflows
        like analytics, reporting, etc.

        Args:
            system_id: The system that was ingested
            stations_count: Number of stations processed
            stats: Optional statistics about the ingestion

        Returns:
            Response from the webhook
        """
        payload = {
            "event": "ingestion_complete",
            "system_id": system_id,
            "stations_count": stations_count,
            "stats": stats or {}
        }

        return await self.trigger_webhook("ingestion-complete", payload)

    async def health_check(self) -> bool:
        """
        Check if n8n is reachable.

        Returns:
            True if n8n is healthy, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Try to reach n8n healthcheck endpoint
                response = await client.get(f"{self.base_url}/healthz")
                return response.status_code == 200
        except Exception:
            return False


# Import datetime for send_alert
from datetime import datetime


# Singleton instance
_n8n_client: Optional[N8NClient] = None


def get_n8n_client() -> N8NClient:
    """Get or create the n8n client singleton."""
    global _n8n_client
    if _n8n_client is None:
        _n8n_client = N8NClient()
    return _n8n_client
