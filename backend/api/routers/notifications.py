"""In-app notification endpoints."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from db.mongodb import get_async_db, COLLECTIONS

router = APIRouter(prefix="/api", tags=["notifications"])


@router.get("/notifications")
async def list_notifications(
    is_read: Optional[bool] = Query(None, alias="isRead"),
    user_id: str = Query("system", alias="userId"),
):
    """List notifications for current user, filtered by isRead."""
    db = get_async_db()
    query: dict = {"assignedOwner": user_id}
    if is_read is not None:
        query["isRead"] = is_read
    notifications = await db[COLLECTIONS["notifications"]].find(
        query, {"_id": 0}
    ).sort("createdAt", -1).to_list(100)
    return notifications


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read."""
    db = get_async_db()
    result = await db[COLLECTIONS["notifications"]].update_one(
        {"notificationId": notification_id},
        {"$set": {"isRead": True, "readAt": datetime.utcnow().isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Notification {notification_id} not found")
    return {"updated": True}


@router.get("/notifications/count")
async def get_notification_count(
    user_id: str = Query("system", alias="userId"),
):
    """Return unread notification count for the current user."""
    db = get_async_db()
    count = await db[COLLECTIONS["notifications"]].count_documents(
        {"assignedOwner": user_id, "isRead": False}
    )
    return {"unreadCount": count}
