"""Reviewer Allocation CRUD + audit endpoints."""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from db.mongodb import get_async_db, COLLECTIONS

router = APIRouter(prefix="/api", tags=["allocations"])


@router.get("/events/{event_id}/allocations")
async def list_allocations(
    event_id: str,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
):
    """Retrieve all reviewer allocations for an event, optionally filtered by date range."""
    db = get_async_db()
    query: dict = {"eventId": event_id}
    if from_date or to_date:
        date_filter: dict = {}
        if from_date:
            date_filter["$gte"] = from_date
        if to_date:
            date_filter["$lte"] = to_date
        query["valuationDate"] = date_filter
    allocations = await db[COLLECTIONS["reviewerAllocations"]].find(
        query, {"_id": 0}
    ).to_list(5000)
    return allocations


@router.get("/events/{event_id}/allocations/{date}")
async def get_allocations_for_date(event_id: str, date: str):
    """Get allocations for a specific valuation date."""
    db = get_async_db()
    allocations = await db[COLLECTIONS["reviewerAllocations"]].find(
        {"eventId": event_id, "valuationDate": date}, {"_id": 0}
    ).to_list(500)
    return allocations


@router.put("/events/{event_id}/allocations")
async def bulk_update_allocations(event_id: str, updates: list[dict]):
    """Bulk update allocations (array of allocationId + reviewerId pairs)."""
    db = get_async_db()
    results = []
    for update in updates:
        allocation_id = update.get("allocationId")
        reviewer_id = update.get("reviewerId")
        reviewer_name = update.get("reviewerName", "")
        changed_by = update.get("changedBy", "system")

        # Fetch current for audit
        current = await db[COLLECTIONS["reviewerAllocations"]].find_one(
            {"allocationId": allocation_id}, {"_id": 0}
        )
        previous_reviewer = current.get("assignedReviewerName", "") if current else ""

        result = await db[COLLECTIONS["reviewerAllocations"]].update_one(
            {"allocationId": allocation_id},
            {"$set": {
                "assignedReviewerId": reviewer_id,
                "assignedReviewerName": reviewer_name,
                "createdBy": changed_by,
                "updatedAt": datetime.utcnow().isoformat(),
            }},
        )

        # Audit log
        await db[COLLECTIONS["auditLogs"]].insert_one({
            "eventId": event_id,
            "action": "ALLOCATION_CHANGED",
            "entityReference": f"{current.get('bnyAccount', '')}/{current.get('valuationDate', '')}",
            "previousValue": previous_reviewer,
            "newValue": reviewer_name,
            "changedBy": changed_by,
            "timestamp": datetime.utcnow().isoformat(),
        })
        results.append({"allocationId": allocation_id, "updated": result.modified_count > 0})
    return results


@router.post("/events/{event_id}/allocations/copy")
async def copy_allocations(event_id: str, body: dict):
    """Copy allocations from one date to another."""
    db = get_async_db()
    source_date = body.get("sourceDate")
    target_date = body.get("targetDate")
    if not source_date or not target_date:
        raise HTTPException(status_code=400, detail="sourceDate and targetDate are required")

    source_allocations = await db[COLLECTIONS["reviewerAllocations"]].find(
        {"eventId": event_id, "valuationDate": source_date}, {"_id": 0}
    ).to_list(500)

    import uuid
    copied = 0
    for alloc in source_allocations:
        new_alloc = {**alloc}
        new_alloc["allocationId"] = str(uuid.uuid4())
        new_alloc["valuationDate"] = target_date
        new_alloc["updatedAt"] = datetime.utcnow().isoformat()
        await db[COLLECTIONS["reviewerAllocations"]].update_one(
            {"eventId": event_id, "bnyAccount": alloc["bnyAccount"], "valuationDate": target_date},
            {"$set": new_alloc},
            upsert=True,
        )
        copied += 1
    return {"copied": copied, "sourceDate": source_date, "targetDate": target_date}


@router.get("/users/reviewers")
async def list_reviewers():
    """List available reviewers with team and availability status."""
    # Returns configured reviewer list — in production, this would query a users collection
    return [
        {"userId": "u-conv1", "userName": "Conv User 1", "team": "FA Conversions", "available": True},
        {"userId": "u-tc1", "userName": "TC User 1", "team": "BNY Trade Capture", "available": True},
        {"userId": "u-tc2", "userName": "TC User 2", "team": "BNY Trade Capture", "available": True},
        {"userId": "u-tc3", "userName": "TC User 3", "team": "BNY Trade Capture", "available": False},
        {"userId": "u-pr1", "userName": "Pricing User 1", "team": "BNY Pricing", "available": True},
        {"userId": "u-pr2", "userName": "Pricing User 2", "team": "BNY Pricing", "available": True},
        {"userId": "u-ca1", "userName": "CA User 1", "team": "BNY Corporate Actions", "available": True},
        {"userId": "u-nav1", "userName": "NAV User 1", "team": "BNY NAV Ops", "available": True},
        {"userId": "u-fa", "userName": "Jane Doe", "team": "FA Conversions", "available": True},
        {"userId": "u-fa2", "userName": "John Smith", "team": "FA Conversions", "available": True},
    ]


@router.get("/events/{event_id}/allocations/audit")
async def get_allocation_audit(event_id: str):
    """Retrieve allocation change history with full audit trail."""
    db = get_async_db()
    logs = await db[COLLECTIONS["auditLogs"]].find(
        {"eventId": event_id, "action": "ALLOCATION_CHANGED"}, {"_id": 0}
    ).sort("timestamp", -1).to_list(500)
    return logs
