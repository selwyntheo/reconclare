"""Positions: Share Breaks, Price Breaks, Tax Lots endpoints."""
from typing import Optional

from fastapi import APIRouter, Query
from db.mongodb import get_async_db, COLLECTIONS

router = APIRouter(prefix="/api", tags=["positions-views"])


async def _get_position_data(account: Optional[str], valuationDt: Optional[str]):
    """Shared helper to fetch position comparison data."""
    db = get_async_db()
    query: dict = {}
    if account:
        query["account"] = account
    if valuationDt:
        query["valuationDt"] = valuationDt

    bny_positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        {**query, "userBank": "BNY"}, {"_id": 0}
    ).to_list(5000)
    inc_positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        {**query, "userBank": {"$ne": "BNY"}}, {"_id": 0}
    ).to_list(5000)

    # Join on (account, assetId, shareClass, longShortInd)
    inc_by_key = {}
    for p in inc_positions:
        key = (p.get("account"), p.get("assetId"), p.get("shareClass"), p.get("longShortInd"))
        inc_by_key[key] = p

    results = []
    matched_keys = set()
    for bny in bny_positions:
        key = (bny.get("account"), bny.get("assetId"), bny.get("shareClass"), bny.get("longShortInd"))
        inc = inc_by_key.get(key, {})
        matched_keys.add(key)

        bny_shares = bny.get("posShares", 0)
        inc_shares = inc.get("posShares", 0)
        bny_price = bny.get("posMarketPrice", 0)
        inc_price = inc.get("posMarketPrice", 0)
        bny_mv = bny.get("posMarketValueBase", 0)
        inc_mv = inc.get("posMarketValueBase", 0)

        match_status = "Match"
        if not inc:
            match_status = "BNY Only"
        elif abs(bny_shares - inc_shares) > 0.001:
            match_status = "Matched with Differences"
        elif abs(bny_price - inc_price) > 0.001:
            match_status = "Matched with Differences"

        results.append({
            "account": bny.get("account"),
            "assetId": bny.get("assetId"),
            "shareClass": bny.get("shareClass"),
            "longShortInd": bny.get("longShortInd"),
            "matchStatus": match_status,
            "bnyShares": bny_shares,
            "incumbentShares": inc_shares,
            "sharesDifference": bny_shares - inc_shares,
            "bnyPrice": bny_price,
            "incumbentPrice": inc_price,
            "priceDifference": bny_price - inc_price,
            "priceDifferencePct": ((bny_price - inc_price) / inc_price * 100) if inc_price else 0,
            "bnyMarketValueBase": bny_mv,
            "incumbentMarketValueBase": inc_mv,
            "marketValueDifferenceBase": bny_mv - inc_mv,
            "bnyCostBase": bny.get("posBookValueBase", 0),
            "incumbentCostBase": inc.get("posBookValueBase", 0),
            "costDifferenceBase": bny.get("posBookValueBase", 0) - inc.get("posBookValueBase", 0),
            "bnyUnrealisedBase": bny.get("posUnrealizedBase", 0) or 0,
            "incumbentUnrealisedBase": inc.get("posUnrealizedBase", 0) or 0,
            "unrealisedDifferenceBase": (bny.get("posUnrealizedBase", 0) or 0) - (inc.get("posUnrealizedBase", 0) or 0),
            "valuationDate": bny.get("valuationDt"),
        })

    # Add Incumbent Only positions
    for p in inc_positions:
        key = (p.get("account"), p.get("assetId"), p.get("shareClass"), p.get("longShortInd"))
        if key not in matched_keys:
            results.append({
                "account": p.get("account"),
                "assetId": p.get("assetId"),
                "shareClass": p.get("shareClass"),
                "longShortInd": p.get("longShortInd"),
                "matchStatus": "Incumbent Only",
                "bnyShares": 0,
                "incumbentShares": p.get("posShares", 0),
                "sharesDifference": -p.get("posShares", 0),
                "bnyPrice": 0,
                "incumbentPrice": p.get("posMarketPrice", 0),
                "priceDifference": -p.get("posMarketPrice", 0),
                "priceDifferencePct": -100,
                "bnyMarketValueBase": 0,
                "incumbentMarketValueBase": p.get("posMarketValueBase", 0),
                "marketValueDifferenceBase": -p.get("posMarketValueBase", 0),
                "bnyCostBase": 0,
                "incumbentCostBase": p.get("posBookValueBase", 0),
                "costDifferenceBase": -p.get("posBookValueBase", 0),
                "bnyUnrealisedBase": 0,
                "incumbentUnrealisedBase": p.get("posUnrealizedBase", 0) or 0,
                "unrealisedDifferenceBase": -(p.get("posUnrealizedBase", 0) or 0),
                "valuationDate": p.get("valuationDt"),
            })
    return results


@router.get("/events/{event_id}/funds/{account}/positions/share-breaks")
async def get_share_breaks_for_fund(
    event_id: str,
    account: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get share breaks for a specific fund."""
    positions = await _get_position_data(account, valuationDt)
    return [p for p in positions if abs(p["sharesDifference"]) > 0.001 or p["matchStatus"] in ("BNY Only", "Incumbent Only")]


@router.get("/events/{event_id}/positions/share-breaks")
async def get_share_breaks_all_funds(
    event_id: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get share breaks across all funds in the event."""
    db = get_async_db()
    event = await db[COLLECTIONS["events"]].find_one({"eventId": event_id}, {"_id": 0})
    if not event:
        return []
    all_breaks = []
    for fund in event.get("funds", []):
        positions = await _get_position_data(fund["account"], valuationDt)
        breaks = [p for p in positions if abs(p["sharesDifference"]) > 0.001 or p["matchStatus"] in ("BNY Only", "Incumbent Only")]
        all_breaks.extend(breaks)
    return all_breaks


@router.get("/events/{event_id}/funds/{account}/positions/price-breaks")
async def get_price_breaks_for_fund(
    event_id: str,
    account: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get price breaks for a specific fund."""
    positions = await _get_position_data(account, valuationDt)
    return [p for p in positions if abs(p["priceDifference"]) > 0.001 and p["matchStatus"] != "BNY Only" and p["matchStatus"] != "Incumbent Only"]


@router.get("/events/{event_id}/positions/price-breaks")
async def get_price_breaks_all_funds(
    event_id: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get price breaks across all funds in the event."""
    db = get_async_db()
    event = await db[COLLECTIONS["events"]].find_one({"eventId": event_id}, {"_id": 0})
    if not event:
        return []
    all_breaks = []
    for fund in event.get("funds", []):
        positions = await _get_position_data(fund["account"], valuationDt)
        breaks = [p for p in positions if abs(p["priceDifference"]) > 0.001 and p["matchStatus"] not in ("BNY Only", "Incumbent Only")]
        all_breaks.extend(breaks)
    return all_breaks


@router.get("/events/{event_id}/funds/{account}/positions/tax-lots")
async def get_tax_lots(
    event_id: str,
    account: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get lot-level position reconciliation for a fund."""
    db = get_async_db()
    query: dict = {"account": account}
    if valuationDt:
        query["valuationDt"] = valuationDt

    bny_lots = await db[COLLECTIONS["dataSubLedgerTrans"]].find(
        {**query, "userBank": "BNY"} if "userBank" in db[COLLECTIONS["dataSubLedgerTrans"]].find_one({}) or {} else query,
        {"_id": 0},
    ).to_list(5000)
    # Simplified: return raw lot data grouped by assetId
    lots_by_asset: dict = {}
    for lot in bny_lots:
        asset = lot.get("assetId", "unknown")
        if asset not in lots_by_asset:
            lots_by_asset[asset] = []
        lots_by_asset[asset].append(lot)
    return lots_by_asset
