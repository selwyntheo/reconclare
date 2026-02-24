"""Income: Dividends and Fixed Income reconciliation endpoints."""
from typing import Optional

from fastapi import APIRouter, Query
from db.mongodb import get_async_db, COLLECTIONS

router = APIRouter(prefix="/api", tags=["income-views"])


@router.get("/events/{event_id}/funds/{account}/income/dividends")
async def get_dividends_for_fund(
    event_id: str,
    account: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get high-level dividend reconciliation for a fund."""
    db = get_async_db()
    query: dict = {"account": account}
    if valuationDt:
        query["valuationDt"] = valuationDt

    # Fetch positions with income data
    bny_positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        {**query, "userBank": "BNY", "posIncomeBase": {"$ne": None}}, {"_id": 0}
    ).to_list(2000)
    inc_positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        {**query, "userBank": {"$ne": "BNY"}, "posIncomeBase": {"$ne": None}}, {"_id": 0}
    ).to_list(2000)

    inc_by_key = {}
    for p in inc_positions:
        key = (p.get("account"), p.get("assetId"))
        inc_by_key[key] = p

    results = []
    for bny in bny_positions:
        key = (bny.get("account"), bny.get("assetId"))
        inc = inc_by_key.get(key, {})
        bny_income = bny.get("posIncomeBase", 0) or 0
        inc_income = inc.get("posIncomeBase", 0) or 0
        results.append({
            "account": bny.get("account"),
            "assetId": bny.get("assetId"),
            "valuationDate": bny.get("valuationDt"),
            "bnyIncomeCurrency": bny.get("posIncomeCurrency", "USD"),
            "incumbentIncomeCurrency": inc.get("posIncomeCurrency", "USD"),
            "bnyNetIncomeBase": bny_income,
            "incumbentNetIncomeBase": inc_income,
            "netIncomeDifferenceBase": bny_income - inc_income,
        })
    return results


@router.get("/events/{event_id}/income/dividends")
async def get_dividends_all_funds(
    event_id: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get dividend reconciliation across all funds."""
    db = get_async_db()
    event = await db[COLLECTIONS["events"]].find_one({"eventId": event_id}, {"_id": 0})
    if not event:
        return []
    all_dividends = []
    for fund in event.get("funds", []):
        dividends = await get_dividends_for_fund(event_id, fund["account"], valuationDt)
        all_dividends.extend(dividends)
    return all_dividends


@router.get("/events/{event_id}/funds/{account}/income/fixed-income")
async def get_fixed_income_for_fund(
    event_id: str,
    account: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get fixed income (coupon) reconciliation for a fund."""
    db = get_async_db()
    query: dict = {"account": account}
    if valuationDt:
        query["valuationDt"] = valuationDt

    # Fetch positions with income data for fixed income securities
    bny_positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        {**query, "userBank": "BNY", "posIncomeBase": {"$ne": None}}, {"_id": 0}
    ).to_list(2000)

    # Get security reference data to filter fixed income
    asset_ids = list({p.get("assetId") for p in bny_positions})
    fi_securities = await db[COLLECTIONS["refSecurity"]].find(
        {"assetId": {"$in": asset_ids}, "secType": {"$in": ["BOND", "FIXED_INCOME", "FI"]}},
        {"_id": 0},
    ).to_list(2000)
    fi_asset_ids = {s["assetId"] for s in fi_securities}

    fi_positions = [p for p in bny_positions if p.get("assetId") in fi_asset_ids]

    results = []
    for bny in fi_positions:
        sec = next((s for s in fi_securities if s["assetId"] == bny["assetId"]), {})
        results.append({
            "account": bny.get("account"),
            "assetId": bny.get("assetId"),
            "securityName": sec.get("issueDescription", ""),
            "valuationDate": bny.get("valuationDt"),
            "bnyNetIncomeBase": bny.get("posIncomeBase", 0) or 0,
            "couponRate": sec.get("couponRate"),
            "paymentFrequency": sec.get("paymentFrequency"),
            "maturityDate": sec.get("maturityDt"),
        })
    return results


@router.get("/events/{event_id}/income/fixed-income")
async def get_fixed_income_all_funds(
    event_id: str,
    valuationDt: Optional[str] = Query(None),
):
    """Get fixed income reconciliation across all funds."""
    db = get_async_db()
    event = await db[COLLECTIONS["events"]].find_one({"eventId": event_id}, {"_id": 0})
    if not event:
        return []
    all_fi = []
    for fund in event.get("funds", []):
        fi = await get_fixed_income_for_fund(event_id, fund["account"], valuationDt)
        all_fi.extend(fi)
    return all_fi
