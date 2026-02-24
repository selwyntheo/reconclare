"""WebSocket ConnectionManager for real-time break resolution updates."""
from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections per event for real-time broadcasting."""

    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, event_id: str, websocket: WebSocket):
        await websocket.accept()
        if event_id not in self.active_connections:
            self.active_connections[event_id] = []
        self.active_connections[event_id].append(websocket)

    def disconnect(self, event_id: str, websocket: WebSocket):
        if event_id in self.active_connections:
            self.active_connections[event_id] = [
                conn for conn in self.active_connections[event_id] if conn != websocket
            ]
            if not self.active_connections[event_id]:
                del self.active_connections[event_id]

    async def broadcast(self, event_id: str, message: dict):
        """Broadcast a message to all connections for an event."""
        if event_id not in self.active_connections:
            return
        disconnected = []
        for connection in self.active_connections[event_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(event_id, conn)


# Singleton instance
manager = ConnectionManager()
