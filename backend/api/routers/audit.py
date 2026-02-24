"""Audit trail query endpoints."""
from typing import Optional

from fastapi import APIRouter, Query
from db.mongodb import get_async_db, COLLECTIONS

router = APIRouter(prefix="/api", tags=["audit"])


@router.get("/events/{event_id}/audit")
async def list_audit_logs(
    event_id: str,
    action: Optional[str] = Query(None),
    entity: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
):
    """List audit records filtered by action type, entity, date range, and user."""
    db = get_async_db()
    query: dict = {"eventId": event_id}

    if action:
        query["action"] = action
    if entity:
        query["entityReference"] = {"$regex": entity}
    if user:
        query["changedBy"] = user
    if from_date or to_date:
        date_filter: dict = {}
        if from_date:
            date_filter["$gte"] = from_date
        if to_date:
            date_filter["$lte"] = to_date
        query["timestamp"] = date_filter

    logs = await db[COLLECTIONS["auditLogs"]].find(
        query, {"_id": 0}
    ).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)

    total = await db[COLLECTIONS["auditLogs"]].count_documents(query)

    return {"logs": logs, "total": total, "limit": limit, "offset": offset}
