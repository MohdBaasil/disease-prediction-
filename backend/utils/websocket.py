from typing import List, Dict
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Store active connections: can list all or categorize by channels/user groups if needed.
        # For simplicity and effectiveness, we maintain a list of active WebSockets.
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"WebSocket client disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast(self, message: dict):
        """
        Broadcast updates to all connected dashboard clients.
        Sends payload like: {"event": "queue_update", "department_id": 1}
        """
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Failed to send message to connection: {e}")
                disconnected.append(connection)
                
        # Clean up stale connections
        for conn in disconnected:
            self.disconnect(conn)

# Singleton manager
manager = ConnectionManager()
