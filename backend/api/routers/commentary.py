"""Commentary CRUD + rollup calculation endpoints."""
import time
from datetime import datetime
from typing import Optional
import uuid

from fastapi import APIRouter, HTTPException, Query
from db.mongodb import get_async_db, COLLECTIONS
from api.websocket import manager

router = APIRouter(prefix="/api", tags=["commentary"])

# ── Task 19.3 — In-memory rollup cache with 60s TTL ─────────
_rollup_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL = 60  # seconds


def _cache_key(event_id: str, account: str, level: Optional[str]) -> str:
    return f"{event_id}:{account}:{level or ''}"


def _invalidate_fund_cache(event_id: str, account: str) -> None:
    """Remove all cached rollup entries for a given fund."""
    prefix = f"{event_id}:{account}:"
    keys_to_remove = [k for k in _rollup_cache if k.startswith(prefix)]
    for k in keys_to_remove:
        del _rollup_cache[k]


@router.get("/events/{event_id}/funds/{account}/commentary")
async def list_commentary(
    event_id: str,
    account: str,
    level: Optional[str] = Query(None),
    entity: Optional[str] = Query(None),
):
    """Get commentary for a fund, optional level and entity filters."""
    db = get_async_db()
    query: dict = {"eventId": event_id, "entityReference": {"$regex": f"^{account}"}}
    if level:
        query["reconciliationLevel"] = level
    if entity:
        query["entityReference"] = entity
    comments = await db[COLLECTIONS["commentary"]].find(
        query, {"_id": 0}
    ).sort("createdAt", -1).to_list(1000)
    return comments


@router.post("/events/{event_id}/funds/{account}/commentary", status_code=201)
async def create_commentary(event_id: str, account: str, body: dict):
    """Create new commentary."""
    db = get_async_db()
    doc = {
        "commentId": str(uuid.uuid4()),
        "eventId": event_id,
        "parentCommentId": body.get("parentCommentId"),
        "reconciliationLevel": body.get("reconciliationLevel", "L2_POSITION"),
        "entityReference": body.get("entityReference", account),
        "breakCategory": body.get("breakCategory"),
        "amount": body.get("amount", 0),
        "text": body.get("text", ""),
        "knownDifferenceRef": body.get("knownDifferenceRef"),
        "authorId": body.get("authorId", "system"),
        "createdAt": datetime.utcnow().isoformat(),
        "isRolledUp": False,
    }
    await db[COLLECTIONS["commentary"]].insert_one(doc)

    # Audit log
    await db[COLLECTIONS["auditLogs"]].insert_one({
        "eventId": event_id,
        "action": "COMMENTARY_ADDED",
        "entityReference": doc["entityReference"],
        "previousValue": None,
        "newValue": doc["text"][:200],
        "changedBy": doc["authorId"],
        "timestamp": doc["createdAt"],
    })

    # Task 19.3 — Invalidate rollup cache for this fund
    _invalidate_fund_cache(event_id, account)

    # Task 19.6 — Broadcast COMMENTARY_ADDED via WebSocket
    try:
        await manager.broadcast(event_id, {
            "type": "COMMENTARY_ADDED",
            "commentId": doc["commentId"],
            "entityReference": doc["entityReference"],
            "breakCategory": doc.get("breakCategory"),
        })
    except Exception:
        pass  # WebSocket broadcast is best-effort

    doc.pop("_id", None)
    return doc


@router.put("/commentary/{comment_id}")
async def update_commentary(comment_id: str, body: dict):
    """Update existing commentary."""
    db = get_async_db()
    update_fields = {k: v for k, v in body.items() if k in (
        "text", "breakCategory", "amount", "knownDifferenceRef"
    )}

    # Fetch the comment first so we can invalidate the right cache
    existing = await db[COLLECTIONS["commentary"]].find_one(
        {"commentId": comment_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail=f"Comment {comment_id} not found")

    result = await db[COLLECTIONS["commentary"]].update_one(
        {"commentId": comment_id},
        {"$set": update_fields},
    )

    # Task 19.3 — Invalidate rollup cache for this fund
    entity_ref = existing.get("entityReference", "")
    event_id = existing.get("eventId", "")
    fund_account = entity_ref.split("/")[0] if "/" in entity_ref else entity_ref
    _invalidate_fund_cache(event_id, fund_account)

    return {"updated": True, "commentId": comment_id}


@router.delete("/commentary/{comment_id}")
async def delete_commentary(comment_id: str):
    """Delete commentary."""
    db = get_async_db()

    # Fetch before delete so we can invalidate the right cache
    existing = await db[COLLECTIONS["commentary"]].find_one(
        {"commentId": comment_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail=f"Comment {comment_id} not found")

    result = await db[COLLECTIONS["commentary"]].delete_one({"commentId": comment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Comment {comment_id} not found")

    # Task 19.3 — Invalidate rollup cache for this fund
    entity_ref = existing.get("entityReference", "")
    event_id = existing.get("eventId", "")
    fund_account = entity_ref.split("/")[0] if "/" in entity_ref else entity_ref
    _invalidate_fund_cache(event_id, fund_account)

    return {"deleted": True, "commentId": comment_id}


@router.get("/events/{event_id}/funds/{account}/commentary/rollup")
async def get_commentary_rollup(
    event_id: str,
    account: str,
    level: Optional[str] = Query(None),
):
    """Get rolled-up commentary for a specific hierarchy level."""

    # Task 19.3 — Check cache first
    ck = _cache_key(event_id, account, level)
    cached = _rollup_cache.get(ck)
    if cached:
        cached_time, cached_result = cached
        if time.time() - cached_time < CACHE_TTL:
            return cached_result

    db = get_async_db()
    match_stage: dict = {
        "eventId": event_id,
        "entityReference": {"$regex": f"^{account}"},
    }

    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": "$breakCategory",
            "totalAmount": {"$sum": "$amount"},
            "count": {"$sum": 1},
            "entries": {"$push": {
                "commentId": "$commentId",
                "text": "$text",
                "amount": "$amount",
                "entityReference": "$entityReference",
                "knownDifferenceRef": "$knownDifferenceRef",
                "reconciliationLevel": "$reconciliationLevel",
            }},
        }},
        {"$sort": {"totalAmount": -1}},
    ]
    results = await db[COLLECTIONS["commentary"]].aggregate(pipeline).to_list(20)
    response = {
        "fundAccount": account,
        "categories": [
            {
                "breakCategory": r["_id"],
                "totalAmount": r["totalAmount"],
                "count": r["count"],
                "entries": r["entries"][:10],  # Limit entries per category
            }
            for r in results if r["_id"]
        ],
    }

    # Task 19.3 — Store in cache
    _rollup_cache[ck] = (time.time(), response)
    return response
