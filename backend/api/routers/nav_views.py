"""NAV Share Class, Client Scorecard, RAG Tracker endpoints."""
from typing import Optional

from fastapi import APIRouter, Query
from db.mongodb import get_async_db, COLLECTIONS

router = APIRouter(prefix="/api", tags=["nav-views"])


@router.get("/events/{event_id}/funds/{account}/share-classes")
async def get_share_classes(
    event_id: str,
    account: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get share class level NAV decomposition for a fund."""
    db = get_async_db()
    query: dict = {"account": account}
    if valuationDt:
        query["valuationDt"] = valuationDt

    # Fetch BNY and Incumbent NAV data at share class level
    bny_data = await db[COLLECTIONS["navSummary"]].find(
        {**query, "userBank": "BNY"}, {"_id": 0}
    ).to_list(200)
    inc_data = await db[COLLECTIONS["navSummary"]].find(
        {**query, "userBank": {"$ne": "BNY"}}, {"_id": 0}
    ).to_list(200)

    # Build share class comparison
    inc_by_class = {r["shareClass"]: r for r in inc_data}
    results = []
    for bny in bny_data:
        sc = bny["shareClass"]
        inc = inc_by_class.get(sc, {})
        bny_units = bny.get("sharesOutstanding", 0)
        inc_units = inc.get("sharesOutstanding", 0)
        bny_nav = bny.get("netAssets", 0)
        inc_nav = inc.get("netAssets", 0)
        results.append({
            "valuationDate": bny.get("valuationDt"),
            "bnyAccount": account,
            "bnyShareClass": sc,
            "incumbentShareClass": sc,
            "shareClassName": sc,
            "bnyUnits": bny_units,
            "incumbentUnits": inc_units,
            "unitsDifference": bny_units - inc_units,
            "bnyNetAssetsBase": bny_nav,
            "incumbentNetAssetsBase": inc_nav,
            "netAssetsDifferenceBase": bny_nav - inc_nav,
            "bnyNavPerShareBase": bny_nav / bny_units if bny_units else 0,
            "incumbentNavPerShareBase": inc_nav / inc_units if inc_units else 0,
        })
    return results


@router.get("/events/{event_id}/scorecard")
async def get_client_scorecard(
    event_id: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get client scorecard with adjusted RAG calculations."""
    db = get_async_db()

    # Fetch active KDs for this event
    kds = await db[COLLECTIONS["knownDifferences"]].find(
        {"$or": [{"eventId": event_id}, {"eventId": None}], "isActive": True},
        {"_id": 0},
    ).to_list(50)

    # Fetch fund-level NAV comparison data
    event = await db[COLLECTIONS["events"]].find_one(
        {"eventId": event_id}, {"_id": 0}
    )
    if not event:
        return []

    funds = event.get("funds", [])
    scorecard_rows = []
    for fund in funds:
        account = fund["account"]
        query: dict = {"account": account}
        if valuationDt:
            query["valuationDt"] = valuationDt

        # Aggregate NAV by fund
        bny_nav_records = await db[COLLECTIONS["navSummary"]].find(
            {**query, "userBank": "BNY"}, {"_id": 0}
        ).to_list(100)
        inc_nav_records = await db[COLLECTIONS["navSummary"]].find(
            {**query, "userBank": {"$ne": "BNY"}}, {"_id": 0}
        ).to_list(100)

        bny_total = sum(r.get("netAssets", 0) for r in bny_nav_records)
        inc_total = sum(r.get("netAssets", 0) for r in inc_nav_records)
        difference = bny_total - inc_total
        bp = (difference / inc_total * 10000) if inc_total else 0

        # Fetch KD amounts from break assignments
        kd_amounts: dict = {}
        for kd in kds:
            kd_amounts[kd["reference"]] = 0  # Default; overridden by actual data

        # Check for KD overrides
        overrides = await db[COLLECTIONS["breakAssignments"]].find(
            {"eventId": event_id, "entityReference": {"$regex": f"^{account}/scorecard/"}},
            {"_id": 0},
        ).to_list(50)
        for ov in overrides:
            ref = ov.get("entityReference", "").split("/")[-1]
            if ref in kd_amounts:
                kd_amounts[ref] = ov.get("breakAmount", 0)

        total_kd = sum(kd_amounts.values())
        incumbent_to_resolve = 0  # Populated from break assignments
        adjusted_difference = difference - total_kd - incumbent_to_resolve
        adjusted_bp = (adjusted_difference / inc_total * 10000) if inc_total else 0

        # Determine RAG
        def rag_status(bp_val):
            abs_bp = abs(bp_val)
            if abs_bp <= 5.0:
                return "Green"
            elif abs_bp <= 50.0:
                return "Amber"
            return "Red"

        # Get reviewer info
        alloc = await db[COLLECTIONS["reviewerAllocations"]].find_one(
            {"eventId": event_id, "bnyAccount": account, "valuationDate": valuationDt},
            {"_id": 0},
        )

        scorecard_rows.append({
            "fundAccount": account,
            "fundName": fund.get("fundName", account),
            "bnyNetAssets": bny_total,
            "incumbentNetAssets": inc_total,
            "netAssetsDifference": difference,
            "basisPointsDifference": round(bp, 2),
            "rag": rag_status(bp),
            "kdAmounts": kd_amounts,
            "incumbentToResolve": incumbent_to_resolve,
            "adjustedNetAssetsDifference": adjusted_difference,
            "adjustedBasisPointsDifference": round(adjusted_bp, 2),
            "adjustedRag": rag_status(adjusted_bp),
            "reviewer": alloc.get("assignedReviewerName", "") if alloc else "",
            "reviewStatus": alloc.get("reviewStatus", "Not Started") if alloc else "Not Started",
        })

    return {"knownDifferences": [{"reference": kd["reference"], "summary": kd["summary"]} for kd in kds], "rows": scorecard_rows}


@router.get("/events/{event_id}/rag-tracker")
async def get_rag_tracker(event_id: str):
    """Get day-over-day RAG status matrix for all funds across parallel period."""
    db = get_async_db()
    event = await db[COLLECTIONS["events"]].find_one(
        {"eventId": event_id}, {"_id": 0}
    )
    if not event:
        return {"funds": [], "dates": []}

    # Get all distinct valuation dates for this event's NAV data
    funds = event.get("funds", [])
    accounts = [f["account"] for f in funds]

    dates = await db[COLLECTIONS["navSummary"]].distinct(
        "valuationDt", {"account": {"$in": accounts}}
    )
    dates = sorted(dates) if dates else []

    # Build matrix: for each fund, for each date, compute adjusted BP
    matrix = []
    for fund in funds:
        row = {
            "fundAccount": fund["account"],
            "fundName": fund.get("fundName", fund["account"]),
            "dates": {},
        }
        for dt in dates:
            bny_records = await db[COLLECTIONS["navSummary"]].find(
                {"account": fund["account"], "valuationDt": dt, "userBank": "BNY"}, {"_id": 0}
            ).to_list(100)
            inc_records = await db[COLLECTIONS["navSummary"]].find(
                {"account": fund["account"], "valuationDt": dt, "userBank": {"$ne": "BNY"}}, {"_id": 0}
            ).to_list(100)
            bny_total = sum(r.get("netAssets", 0) for r in bny_records)
            inc_total = sum(r.get("netAssets", 0) for r in inc_records)
            bp = (bny_total - inc_total) / inc_total * 10000 if inc_total else 0
            row["dates"][dt] = round(bp, 2)
        matrix.append(row)

    return {"funds": matrix, "dates": dates}


@router.get("/events/{event_id}/rag-thresholds")
async def get_rag_thresholds(event_id: str):
    """Get RAG threshold configuration for an event."""
    # Default thresholds; could be stored per-event in the future
    return {"green": 5.0, "amber": 50.0}


@router.put("/events/{event_id}/rag-thresholds")
async def update_rag_thresholds(event_id: str, body: dict):
    """Update RAG thresholds for an event."""
    # Placeholder for per-event threshold storage
    return {"updated": True, "green": body.get("green", 5.0), "amber": body.get("amber", 50.0)}


@router.put("/events/{event_id}/scorecard/overrides")
async def update_scorecard_override(event_id: str, body: dict):
    """Override a KD column value in the scorecard."""
    from datetime import datetime
    db = get_async_db()
    account = body.get("fundAccount")
    kd_reference = body.get("kdReference")
    override_value = body.get("overrideValue")
    changed_by = body.get("changedBy", "system")

    entity_ref = f"{account}/scorecard/{kd_reference}"

    # Get current value for audit
    current = await db[COLLECTIONS["breakAssignments"]].find_one(
        {"eventId": event_id, "entityReference": entity_ref}, {"_id": 0}
    )
    previous_value = current.get("breakAmount", 0) if current else 0

    await db[COLLECTIONS["breakAssignments"]].update_one(
        {"eventId": event_id, "entityReference": entity_ref},
        {"$set": {
            "breakAmount": override_value,
            "updatedAt": datetime.utcnow().isoformat(),
            "updatedBy": changed_by,
        }},
        upsert=True,
    )

    # Audit log
    await db[COLLECTIONS["auditLogs"]].insert_one({
        "eventId": event_id,
        "action": "KD_OVERRIDE",
        "entityReference": entity_ref,
        "previousValue": previous_value,
        "newValue": override_value,
        "changedBy": changed_by,
        "timestamp": datetime.utcnow().isoformat(),
    })
    return {"updated": True}
