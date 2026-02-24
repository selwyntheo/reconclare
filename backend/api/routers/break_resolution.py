"""Break category assignment, team assignment, review status endpoints."""
import asyncio
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db.mongodb import get_async_db, COLLECTIONS
from api.websocket import manager

router = APIRouter(prefix="/api", tags=["break-resolution"])

# ── TB Taxonomy: maps sub-classification to BS/P&L category ─────
TB_TAXONOMY: dict[str, dict[str, str]] = {
    "Cash": {"tbCategory": "Balance Sheet", "tbClassification": "Assets"},
    "Securities at Value": {"tbCategory": "Balance Sheet", "tbClassification": "Assets"},
    "Dividends Receivable": {"tbCategory": "Balance Sheet", "tbClassification": "Assets"},
    "Interest Receivable": {"tbCategory": "Balance Sheet", "tbClassification": "Assets"},
    "Accounts Payable": {"tbCategory": "Balance Sheet", "tbClassification": "Liabilities"},
    "Management Fee Payable": {"tbCategory": "Balance Sheet", "tbClassification": "Liabilities"},
    "Capital Stock": {"tbCategory": "Balance Sheet", "tbClassification": "Capital"},
    "Retained Earnings": {"tbCategory": "Balance Sheet", "tbClassification": "Capital"},
    "Dividend Income": {"tbCategory": "P&L", "tbClassification": "Income"},
    "Interest Income": {"tbCategory": "P&L", "tbClassification": "Income"},
    "Realised Gains": {"tbCategory": "P&L", "tbClassification": "Income"},
    "Unrealised Gains": {"tbCategory": "P&L", "tbClassification": "Income"},
    "Management Fees": {"tbCategory": "P&L", "tbClassification": "Expenses"},
    "Custody Fees": {"tbCategory": "P&L", "tbClassification": "Expenses"},
    "Administration Fees": {"tbCategory": "P&L", "tbClassification": "Expenses"},
}


@router.put("/breaks/{entity_ref}/category")
async def update_break_category(entity_ref: str, body: dict):
    """Update break category for an entity (position, income, derivative)."""
    db = get_async_db()
    new_category = body.get("breakCategory")
    event_id = body.get("eventId")
    changed_by = body.get("changedBy", "system")

    # Update break assignment
    current = await db[COLLECTIONS["breakAssignments"]].find_one(
        {"entityReference": entity_ref, "eventId": event_id}, {"_id": 0}
    )
    previous_category = current.get("breakCategory", "") if current else ""

    await db[COLLECTIONS["breakAssignments"]].update_one(
        {"entityReference": entity_ref, "eventId": event_id},
        {"$set": {
            "breakCategory": new_category,
            "updatedAt": datetime.utcnow().isoformat(),
            "updatedBy": changed_by,
        }},
        upsert=True,
    )

    # Audit log
    await db[COLLECTIONS["auditLogs"]].insert_one({
        "eventId": event_id,
        "action": "BREAK_CATEGORY_CHANGED",
        "entityReference": entity_ref,
        "previousValue": previous_category,
        "newValue": new_category,
        "changedBy": changed_by,
        "timestamp": datetime.utcnow().isoformat(),
    })
    return {"updated": True, "entityReference": entity_ref, "breakCategory": new_category}


@router.put("/breaks/{entity_ref}/team")
async def update_break_team(entity_ref: str, body: dict):
    """Update break team assignment for an entity."""
    db = get_async_db()
    new_team = body.get("assignedTeam")
    new_owner = body.get("assignedOwner", "")
    event_id = body.get("eventId")
    changed_by = body.get("changedBy", "system")

    current = await db[COLLECTIONS["breakAssignments"]].find_one(
        {"entityReference": entity_ref, "eventId": event_id}, {"_id": 0}
    )
    previous_team = current.get("assignedTeam", "") if current else ""
    previous_owner = current.get("assignedOwner", "") if current else ""

    await db[COLLECTIONS["breakAssignments"]].update_one(
        {"entityReference": entity_ref, "eventId": event_id},
        {"$set": {
            "assignedTeam": new_team,
            "assignedOwner": new_owner,
            "updatedAt": datetime.utcnow().isoformat(),
            "updatedBy": changed_by,
        }},
        upsert=True,
    )

    # Audit log
    await db[COLLECTIONS["auditLogs"]].insert_one({
        "eventId": event_id,
        "action": "BREAK_TEAM_CHANGED",
        "entityReference": entity_ref,
        "previousValue": f"{previous_team}/{previous_owner}",
        "newValue": f"{new_team}/{new_owner}",
        "changedBy": changed_by,
        "timestamp": datetime.utcnow().isoformat(),
    })
    return {"updated": True, "entityReference": entity_ref, "assignedTeam": new_team}


@router.get("/events/{event_id}/break-summary")
async def get_break_summary(
    event_id: str,
    valuation_dt: Optional[str] = Query(None, alias="valuationDt"),
):
    """Get summary of breaks by category for an event."""
    db = get_async_db()
    match_stage: dict = {"eventId": event_id}
    if valuation_dt:
        match_stage["valuationDate"] = valuation_dt

    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": "$breakCategory",
            "count": {"$sum": 1},
            "totalAmount": {"$sum": {"$abs": "$breakAmount"}},
        }},
    ]
    results = await db[COLLECTIONS["breakAssignments"]].aggregate(pipeline).to_list(20)
    return {r["_id"]: {"count": r["count"], "totalAmount": r["totalAmount"]} for r in results if r["_id"]}


@router.put("/events/{event_id}/funds/{account}/review-status")
async def update_review_status(event_id: str, account: str, body: dict):
    """Update review status for a fund/date."""
    db = get_async_db()
    new_status = body.get("reviewStatus")
    valuation_dt = body.get("valuationDt")
    changed_by = body.get("changedBy", "system")

    # Store review status in the allocations collection for simplicity
    current = await db[COLLECTIONS["reviewerAllocations"]].find_one(
        {"eventId": event_id, "bnyAccount": account, "valuationDate": valuation_dt}, {"_id": 0}
    )
    previous_status = current.get("reviewStatus", "Not Started") if current else "Not Started"

    await db[COLLECTIONS["reviewerAllocations"]].update_one(
        {"eventId": event_id, "bnyAccount": account, "valuationDate": valuation_dt},
        {"$set": {"reviewStatus": new_status, "updatedAt": datetime.utcnow().isoformat()}},
        upsert=True,
    )

    # Audit log
    await db[COLLECTIONS["auditLogs"]].insert_one({
        "eventId": event_id,
        "action": "REVIEW_STATUS_CHANGED",
        "entityReference": f"{account}/{valuation_dt}",
        "previousValue": previous_status,
        "newValue": new_status,
        "changedBy": changed_by,
        "timestamp": datetime.utcnow().isoformat(),
    })
    return {"updated": True, "account": account, "reviewStatus": new_status}


# ══════════════════════════════════════════════════════════════
# Task 9.5 — Enhanced Trial Balance with sub-classification
# ══════════════════════════════════════════════════════════════

@router.get("/events/{event_id}/funds/{account}/trial-balance/enhanced")
async def get_enhanced_trial_balance(
    event_id: str,
    account: str,
    valuationDt: Optional[str] = Query(None),
):
    """
    Return trial-balance categories enriched with BS/P&L taxonomy
    and break resolution fields from breakAssignments.
    """
    db = get_async_db()
    base_query: dict = {"account": account}
    if valuationDt:
        base_query["valuationDt"] = valuationDt

    # Fetch GL category mappings to derive sub-classification per GL
    gl_mappings = await db["refGLCategoryMapping"].find({}, {"_id": 0}).to_list(500)
    gl_to_cat: dict[str, str] = {
        m["glAccountNumber"]: m["conversionCategory"] for m in gl_mappings
    }

    # Fetch ledger rows for BNY (CPU) and Incumbent
    cpu_ledger = await db[COLLECTIONS["ledger"]].find(
        {**base_query, "userBank": "CPU"}, {"_id": 0}
    ).to_list(1000)
    inc_ledger = await db[COLLECTIONS["ledger"]].find(
        {**base_query, "userBank": "INCUMBENT"}, {"_id": 0}
    ).to_list(1000)

    # Aggregate balances by sub-classification (conversion category)
    cpu_by_cat: dict[str, float] = {}
    for e in cpu_ledger:
        gl = e.get("glAccountNumber", e.get("eagleLedgerAcct", ""))
        cat = gl_to_cat.get(gl, "OTHER")
        cpu_by_cat[cat] = cpu_by_cat.get(cat, 0) + e.get("endingBalance", 0)

    inc_by_cat: dict[str, float] = {}
    for e in inc_ledger:
        gl = e.get("glAccountNumber", e.get("eagleLedgerAcct", ""))
        cat = gl_to_cat.get(gl, "OTHER")
        inc_by_cat[cat] = inc_by_cat.get(cat, 0) + e.get("endingBalance", 0)

    all_cats = sorted(set(list(cpu_by_cat.keys()) + list(inc_by_cat.keys())))

    # Fetch break assignments for this fund/event to enrich rows
    break_assignments = await db[COLLECTIONS["breakAssignments"]].find(
        {"eventId": event_id, "entityReference": {"$regex": f"^{account}/tb/"}},
        {"_id": 0},
    ).to_list(500)
    assignment_by_cat: dict[str, dict] = {}
    for ba in break_assignments:
        # entityReference format: {account}/tb/{category}
        parts = ba.get("entityReference", "").split("/tb/")
        if len(parts) == 2:
            assignment_by_cat[parts[1]] = ba

    rows = []
    for cat in all_cats:
        cpu_bal = cpu_by_cat.get(cat, 0)
        inc_bal = inc_by_cat.get(cat, 0)
        diff = cpu_bal - inc_bal
        bp = (diff / inc_bal * 10000) if inc_bal != 0 else 0

        taxonomy = TB_TAXONOMY.get(cat, {"tbCategory": "Other", "tbClassification": "Other"})
        assignment = assignment_by_cat.get(cat, {})

        rows.append({
            "valuationDt": valuationDt or "",
            "account": account,
            "subClassification": cat,
            "tbCategory": taxonomy["tbCategory"],
            "tbClassification": taxonomy["tbClassification"],
            "incumbentBalance": inc_bal,
            "bnyBalance": cpu_bal,
            "balanceDiff": diff,
            "balanceDiffBP": round(bp, 2),
            "validationStatus": "pass" if abs(diff) <= 0.01 else ("marginal" if abs(bp) < 5 else "break"),
            "breakCategory": assignment.get("breakCategory", ""),
            "breakTeam": assignment.get("assignedTeam", ""),
            "breakOwner": assignment.get("assignedOwner", ""),
            "comment": assignment.get("comment", ""),
        })
    return rows


# ══════════════════════════════════════════════════════════════
# Task 18.3 — Auto-assignment validation endpoint
# ══════════════════════════════════════════════════════════════

class AutoAssignRequest(BaseModel):
    valuationDt: str
    breaks: list[dict]


@router.post("/events/{event_id}/validate/auto-assign")
async def validate_and_auto_assign(event_id: str, req: AutoAssignRequest):
    """
    Accept detected breaks and auto-assign each to the appropriate
    team/owner via the rule-based auto-assignment engine.
    """
    from services.auto_assignment import auto_assign_breaks_batch

    loop = asyncio.get_event_loop()
    assignments = await loop.run_in_executor(
        None,
        auto_assign_breaks_batch,
        event_id,
        req.valuationDt,
        req.breaks,
    )

    # Task 18.5 — Broadcast each assignment via WebSocket
    for assignment in assignments:
        try:
            await manager.broadcast(event_id, {
                "type": "BREAK_UPDATED",
                "entityReference": assignment.get("entityReference", ""),
                "assignedTeam": assignment.get("assignedTeam", ""),
                "assignedOwner": assignment.get("assignedOwner", ""),
            })
        except Exception:
            pass  # WebSocket broadcast is best-effort

    return {"eventId": event_id, "assigned": len(assignments), "assignments": assignments}
