"""Derivatives: Forwards and Futures reconciliation endpoints."""
from typing import Optional

from fastapi import APIRouter, Query
from db.mongodb import get_async_db, COLLECTIONS

router = APIRouter(prefix="/api", tags=["derivatives-views"])


@router.get("/events/{event_id}/funds/{account}/derivatives/forwards")
async def get_forwards_for_fund(
    event_id: str,
    account: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get FX forward reconciliation for a fund."""
    db = get_async_db()
    query: dict = {"account": account}
    if valuationDt:
        query["valuationDt"] = valuationDt

    # Fetch forward positions (assetType or secType indicates forward)
    bny_positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        {**query, "userBank": "BNY"}, {"_id": 0}
    ).to_list(5000)

    # Get security reference to filter forwards
    asset_ids = list({p.get("assetId") for p in bny_positions})
    fwd_securities = await db[COLLECTIONS["refSecurity"]].find(
        {"assetId": {"$in": asset_ids}, "secType": {"$in": ["FORWARD", "FWD", "FX_FORWARD"]}},
        {"_id": 0},
    ).to_list(1000)
    fwd_asset_ids = {s["assetId"] for s in fwd_securities}

    inc_positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        {**query, "userBank": {"$ne": "BNY"}}, {"_id": 0}
    ).to_list(5000)
    inc_by_key = {(p.get("account"), p.get("assetId")): p for p in inc_positions}

    results = []
    for bny in bny_positions:
        if bny.get("assetId") not in fwd_asset_ids:
            continue
        key = (bny.get("account"), bny.get("assetId"))
        inc = inc_by_key.get(key, {})
        bny_urgl = bny.get("posUnrealizedBase", 0) or 0
        inc_urgl = inc.get("posUnrealizedBase", 0) or 0
        results.append({
            "account": bny.get("account"),
            "assetId": bny.get("assetId"),
            "assetType": "Forward",
            "valuationDate": bny.get("valuationDt"),
            "bnyUnrealisedGL": bny_urgl,
            "incumbentUnrealisedGL": inc_urgl,
            "unrealisedGLDifference": bny_urgl - inc_urgl,
        })
    return results


@router.get("/events/{event_id}/derivatives/forwards")
async def get_forwards_all_funds(
    event_id: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get forward reconciliation across all funds."""
    db = get_async_db()
    event = await db[COLLECTIONS["events"]].find_one({"eventId": event_id}, {"_id": 0})
    if not event:
        return []
    all_fwd = []
    for fund in event.get("funds", []):
        fwd = await get_forwards_for_fund(event_id, fund["account"], valuationDt)
        all_fwd.extend(fwd)
    return all_fwd


@router.get("/events/{event_id}/funds/{account}/derivatives/futures")
async def get_futures_for_fund(
    event_id: str,
    account: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get futures reconciliation for a fund."""
    db = get_async_db()
    query: dict = {"account": account}
    if valuationDt:
        query["valuationDt"] = valuationDt

    bny_positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        {**query, "userBank": "BNY"}, {"_id": 0}
    ).to_list(5000)

    asset_ids = list({p.get("assetId") for p in bny_positions})
    fut_securities = await db[COLLECTIONS["refSecurity"]].find(
        {"assetId": {"$in": asset_ids}, "secType": {"$in": ["FUTURE", "FUT"]}},
        {"_id": 0},
    ).to_list(1000)
    fut_asset_ids = {s["assetId"] for s in fut_securities}

    inc_positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        {**query, "userBank": {"$ne": "BNY"}}, {"_id": 0}
    ).to_list(5000)
    inc_by_key = {(p.get("account"), p.get("assetId")): p for p in inc_positions}

    results = []
    for bny in bny_positions:
        if bny.get("assetId") not in fut_asset_ids:
            continue
        key = (bny.get("account"), bny.get("assetId"))
        inc = inc_by_key.get(key, {})
        sec = next((s for s in fut_securities if s["assetId"] == bny["assetId"]), {})
        bny_price = bny.get("posMarketPrice", 0)
        inc_price = inc.get("posMarketPrice", 0)
        bny_mv = bny.get("posMarketValueBase", 0)
        inc_mv = inc.get("posMarketValueBase", 0)
        results.append({
            "account": bny.get("account"),
            "assetId": bny.get("assetId"),
            "securityName": sec.get("issueDescription", ""),
            "assetType": "Future",
            "valuationDate": bny.get("valuationDt"),
            "bnyPrice": bny_price,
            "incumbentPrice": inc_price,
            "priceDifference": bny_price - inc_price,
            "priceDifferencePct": ((bny_price - inc_price) / inc_price * 100) if inc_price else 0,
            "bnyMarketValueBase": bny_mv,
            "incumbentMarketValueBase": inc_mv,
            "marketValueDifferenceBase": bny_mv - inc_mv,
        })
    return results


@router.get("/events/{event_id}/derivatives/futures")
async def get_futures_all_funds(
    event_id: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get futures reconciliation across all funds."""
    db = get_async_db()
    event = await db[COLLECTIONS["events"]].find_one({"eventId": event_id}, {"_id": 0})
    if not event:
        return []
    all_fut = []
    for fund in event.get("funds", []):
        fut = await get_futures_for_fund(event_id, fund["account"], valuationDt)
        all_fut.extend(fut)
    return all_fut
