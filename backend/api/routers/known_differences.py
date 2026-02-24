"""Known Differences configuration CRUD endpoints."""
from datetime import datetime
from typing import Optional
import uuid

from fastapi import APIRouter, HTTPException, Query
from db.mongodb import get_async_db, COLLECTIONS

router = APIRouter(prefix="/api", tags=["known-differences"])


@router.get("/events/{event_id}/known-differences")
async def list_known_differences(
    event_id: str,
    active: Optional[bool] = Query(None),
):
    """List KDs for an event, optional active filter."""
    db = get_async_db()
    query: dict = {"$or": [{"eventId": event_id}, {"eventId": None}]}
    if active is not None:
        query["isActive"] = active
    kds = await db[COLLECTIONS["knownDifferences"]].find(
        query, {"_id": 0}
    ).to_list(200)
    return kds


@router.post("/events/{event_id}/known-differences", status_code=201)
async def create_known_difference(event_id: str, body: dict):
    """Create a new Known Difference entry."""
    db = get_async_db()
    reference = body.get("reference")
    if not reference:
        raise HTTPException(status_code=400, detail="reference is required")

    existing = await db[COLLECTIONS["knownDifferences"]].find_one(
        {"eventId": event_id, "reference": reference}
    )
    if existing:
        raise HTTPException(status_code=409, detail=f"KD '{reference}' already exists for this event")

    doc = {
        "reference": reference,
        "type": body.get("type", "Methodology"),
        "summary": body.get("summary", ""),
        "issueDescription": body.get("issueDescription"),
        "comment": body.get("comment", ""),
        "isActive": body.get("isActive", True),
        "eventId": event_id,
        "createdAt": datetime.utcnow().isoformat(),
        "updatedBy": body.get("updatedBy", "system"),
    }
    await db[COLLECTIONS["knownDifferences"]].insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/events/{event_id}/known-differences/{reference}")
async def update_known_difference(event_id: str, reference: str, body: dict):
    """Update an existing Known Difference entry."""
    db = get_async_db()
    update_fields = {k: v for k, v in body.items() if k in (
        "type", "summary", "issueDescription", "comment", "isActive", "updatedBy"
    )}
    update_fields["updatedBy"] = body.get("updatedBy", "system")

    result = await db[COLLECTIONS["knownDifferences"]].update_one(
        {"eventId": event_id, "reference": reference},
        {"$set": update_fields},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"KD '{reference}' not found")
    return {"updated": True, "reference": reference}


@router.delete("/events/{event_id}/known-differences/{reference}")
async def delete_known_difference(event_id: str, reference: str):
    """Soft-delete by setting isActive=false."""
    db = get_async_db()
    result = await db[COLLECTIONS["knownDifferences"]].update_one(
        {"eventId": event_id, "reference": reference},
        {"$set": {"isActive": False}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"KD '{reference}' not found")
    return {"deleted": True, "reference": reference}
