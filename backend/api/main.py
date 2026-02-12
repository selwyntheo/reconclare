"""
FastAPI Application — RECON-AI Control Center API.

Provides REST endpoints for:
- Events CRUD
- Validation run execution
- Break records and AI analysis
- Human review annotations
- Activity feed
"""
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

import asyncio
import json

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from config.settings import settings
from db.mongodb import get_async_db, get_sync_db, close_async_db, COLLECTIONS
from db.schemas import (
    EventDoc, RunValidationRequest, AnnotationRequest,
    BreakState, ReviewAction,
    MappingType, MappingStatus,
    GLAccountMappingDoc, CreateMappingRequest, UpdateMappingRequest,
    BulkMappingRequest, BulkDeleteRequest,
)
from services.validation_engine import ValidationEngine, VALIDATION_CHECKS
from services.ai_analysis import AIAnalysisService
from services.derived_subledger import DerivedSubledgerService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — ensure compound indexes for comparison query performance
    db = get_async_db()
    await db[COLLECTIONS["navSummary"]].create_index(
        [("valuationDt", 1), ("account", 1), ("userBank", 1)], background=True
    )
    await db[COLLECTIONS["ledger"]].create_index(
        [("valuationDt", 1), ("account", 1), ("userBank", 1)], background=True
    )
    await db[COLLECTIONS["dataSubLedgerPosition"]].create_index(
        [("valuationDt", 1), ("account", 1), ("userBank", 1)], background=True
    )
    yield
    # Shutdown
    await close_async_db()


app = FastAPI(
    title="RECON-AI Control Center API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════
# Events
# ══════════════════════════════════════════════════════════════

@app.get("/api/events")
async def list_events(status: Optional[str] = None):
    """List all conversion events."""
    db = get_async_db()
    query = {}
    if status and status != "ALL":
        query["status"] = status
    events = await db[COLLECTIONS["events"]].find(query, {"_id": 0}).to_list(100)
    return events


@app.get("/api/events/{event_id}")
async def get_event(event_id: str):
    """Get a single event by ID."""
    db = get_async_db()
    event = await db[COLLECTIONS["events"]].find_one({"eventId": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return event


@app.post("/api/events")
async def create_event(event: EventDoc):
    """Create a new conversion event."""
    db = get_async_db()
    existing = await db[COLLECTIONS["events"]].find_one({"eventId": event.eventId})
    if existing:
        raise HTTPException(status_code=409, detail=f"Event {event.eventId} already exists")
    await db[COLLECTIONS["events"]].insert_one(event.model_dump())
    return {"status": "created", "eventId": event.eventId}


# ══════════════════════════════════════════════════════════════
# Validation Checks (reference data)
# ══════════════════════════════════════════════════════════════

@app.get("/api/validation-checks")
async def list_validation_checks():
    """List available validation check definitions."""
    return VALIDATION_CHECKS


# ══════════════════════════════════════════════════════════════
# Validation Runs
# ══════════════════════════════════════════════════════════════

@app.get("/api/events/{event_id}/runs")
async def list_runs(event_id: str):
    """List validation runs for an event."""
    db = get_async_db()
    runs = await db[COLLECTIONS["validationRuns"]].find(
        {"eventId": event_id}, {"_id": 0}
    ).sort("executionTime", -1).to_list(50)
    return runs


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    """Get a single validation run."""
    db = get_async_db()
    run = await db[COLLECTIONS["validationRuns"]].find_one({"runId": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return run


@app.post("/api/validation/run")
async def run_validation(req: RunValidationRequest):
    """
    Execute a validation run.
    This is the main action: user selects event + date + checks → CPU runs validations.
    After validation, AI agent automatically analyzes any breaks found.
    """
    # Use sync DB for the engine (runs in thread)
    import asyncio

    def _execute():
        engine = ValidationEngine()
        fund_accounts = None
        if req.fundSelection and req.fundSelection != "all":
            fund_accounts = [a.strip() for a in req.fundSelection.split(",")]

        run_doc = engine.run_validation(
            event_id=req.eventId,
            valuation_dt=req.valuationDt,
            check_suite=req.checkSuite,
            fund_accounts=fund_accounts,
            incumbent_event_id=req.incumbentEventId,
        )

        # After validation, run AI analysis on detected breaks
        try:
            ai_service = AIAnalysisService()
            ai_service.analyze_run_breaks(run_doc.runId)
        except Exception:
            pass  # AI analysis is best-effort; don't block validation response

        # Refresh the run doc to include updated results
        db = get_sync_db()
        updated_run = db[COLLECTIONS["validationRuns"]].find_one(
            {"runId": run_doc.runId}, {"_id": 0}
        )
        return updated_run

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _execute)
    return result


# ══════════════════════════════════════════════════════════════
# Validation Results
# ══════════════════════════════════════════════════════════════

@app.get("/api/runs/{run_id}/results")
async def get_run_results(run_id: str):
    """Get validation results for a run."""
    db = get_async_db()
    run = await db[COLLECTIONS["validationRuns"]].find_one({"runId": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return run.get("results", [])


# ══════════════════════════════════════════════════════════════
# Break Records
# ══════════════════════════════════════════════════════════════

@app.get("/api/breaks")
async def list_breaks(
    run_id: Optional[str] = None,
    fund_account: Optional[str] = None,
    state: Optional[str] = None,
):
    """List break records with optional filters."""
    db = get_async_db()
    query: dict = {}
    if run_id:
        query["validationRunId"] = run_id
    if fund_account:
        query["fundAccount"] = fund_account
    if state:
        query["state"] = state
    breaks = await db[COLLECTIONS["breakRecords"]].find(query, {"_id": 0}).to_list(500)
    return breaks


@app.get("/api/breaks/reviewable")
async def list_reviewable_breaks():
    """List breaks needing human review."""
    db = get_async_db()
    breaks = await db[COLLECTIONS["breakRecords"]].find(
        {"state": {"$in": [
            BreakState.HUMAN_REVIEW_PENDING.value,
            BreakState.IN_REVIEW.value,
            BreakState.ANALYZING.value,
            BreakState.DETECTED.value,
        ]}},
        {"_id": 0},
    ).to_list(500)
    return breaks


@app.get("/api/breaks/{break_id}")
async def get_break(break_id: str):
    """Get a single break record."""
    db = get_async_db()
    brk = await db[COLLECTIONS["breakRecords"]].find_one({"breakId": break_id}, {"_id": 0})
    if not brk:
        raise HTTPException(status_code=404, detail=f"Break {break_id} not found")
    return brk


# ══════════════════════════════════════════════════════════════
# Human Review / Annotations
# ══════════════════════════════════════════════════════════════

@app.post("/api/breaks/{break_id}/annotate")
async def annotate_break(break_id: str, req: AnnotationRequest):
    """Submit a human annotation for a break."""
    db = get_async_db()
    brk = await db[COLLECTIONS["breakRecords"]].find_one({"breakId": break_id})
    if not brk:
        raise HTTPException(status_code=404, detail=f"Break {break_id} not found")

    # Determine new state based on action
    action_to_state = {
        ReviewAction.ACCEPT.value: BreakState.APPROVED.value,
        ReviewAction.MODIFY.value: BreakState.MODIFIED.value,
        ReviewAction.REJECT.value: BreakState.ESCALATED.value,
    }
    new_state = action_to_state.get(req.action.value, BreakState.IN_REVIEW.value)

    annotation = {
        "annotationId": f"ANN-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        "reviewerUserId": req.reviewerUserId,
        "reviewerName": req.reviewerName,
        "reviewerRole": req.reviewerRole,
        "action": req.action.value,
        "notes": req.notes,
        "resolutionCategory": req.resolutionCategory,
        "timestamp": datetime.utcnow().isoformat(),
    }

    await db[COLLECTIONS["breakRecords"]].update_one(
        {"breakId": break_id},
        {
            "$set": {
                "state": new_state,
                "humanAnnotation": annotation,
            }
        },
    )

    # Log activity
    await db[COLLECTIONS["activityFeed"]].insert_one({
        "id": f"act-{break_id[-8:]}",
        "type": "HUMAN_ANNOTATION",
        "message": f"{req.reviewerName} {req.action.value.lower()}ed break {break_id}: {req.notes[:100]}",
        "eventId": None,
        "timestamp": datetime.utcnow().isoformat(),
        "userId": req.reviewerUserId,
        "userName": req.reviewerName,
    })

    return {"status": "annotated", "breakId": break_id, "newState": new_state}


# ══════════════════════════════════════════════════════════════
# Activity Feed
# ══════════════════════════════════════════════════════════════

@app.get("/api/activity")
async def list_activity(limit: int = Query(default=20, le=100)):
    """Get recent activity feed items."""
    db = get_async_db()
    items = await db[COLLECTIONS["activityFeed"]].find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).to_list(limit)
    return items


# ══════════════════════════════════════════════════════════════
# Fund-level data (for FundBreakDetail view)
# ══════════════════════════════════════════════════════════════

@app.get("/api/funds/{fund_account}/waterfall")
async def get_fund_waterfall(fund_account: str, valuation_dt: Optional[str] = None):
    """Get NAV waterfall data for a fund."""
    db = get_async_db()

    # Get NAV summary
    nav_query = {"account": fund_account, "userBank": "CPU"}
    if valuation_dt:
        nav_query["valuationDt"] = valuation_dt
    navs = await db[COLLECTIONS["navSummary"]].find(nav_query, {"_id": 0}).to_list(10)

    # Get ledger breakdown by GL category
    ledger_query = {"account": fund_account, "userBank": "CPU"}
    if valuation_dt:
        ledger_query["valuationDt"] = valuation_dt
    ledger_entries = await db[COLLECTIONS["ledger"]].find(ledger_query, {"_id": 0}).to_list(100)

    # Get GL refs
    gl_refs_list = await db[COLLECTIONS["refLedger"]].find({}, {"_id": 0}).to_list(100)
    gl_refs = {r["glAccountNumber"]: r for r in gl_refs_list}

    # Build waterfall
    cpu_nav = sum(n.get("netAssets", 0) for n in navs)

    # Get incumbent NAV
    inc_query = {"account": fund_account, "userBank": "INCUMBENT"}
    if valuation_dt:
        inc_query["valuationDt"] = valuation_dt
    inc_navs = await db[COLLECTIONS["navSummary"]].find(inc_query, {"_id": 0}).to_list(10)
    inc_nav = sum(n.get("netAssets", 0) for n in inc_navs)

    # Group ledger by category
    category_totals: dict[str, float] = {}
    for entry in ledger_entries:
        gl_num = entry.get("glAccountNumber", "")
        ref = gl_refs.get(gl_num, {})
        cat = ref.get("glCategory", "OTHER")
        category_totals[cat] = category_totals.get(cat, 0) + entry.get("endingBalance", 0)

    # Build waterfall items
    waterfall = [
        {"label": "Incumbent NAV", "value": inc_nav or cpu_nav, "type": "start", "hasBreak": False},
    ]
    for cat, total in sorted(category_totals.items()):
        waterfall.append({
            "label": cat.title(),
            "value": total,
            "type": "component",
            "hasBreak": abs(total) > 100,
        })
    waterfall.append({
        "label": "CPU NAV",
        "value": cpu_nav,
        "type": "end",
        "hasBreak": False,
    })

    return waterfall


@app.get("/api/funds/{fund_account}/transactions")
async def get_fund_transactions(fund_account: str, valuation_dt: Optional[str] = None):
    """Get transaction details for a fund."""
    db = get_async_db()
    query: dict = {"account": fund_account}
    if valuation_dt:
        query["valuationDt"] = valuation_dt
    txns = await db[COLLECTIONS["dataDailyTransactions"]].find(
        query, {"_id": 0}
    ).to_list(200)
    return txns


@app.get("/api/funds/{fund_account}/positions")
async def get_fund_positions(fund_account: str, valuation_dt: Optional[str] = None):
    """Get position data for a fund."""
    db = get_async_db()
    query: dict = {"account": fund_account}
    if valuation_dt:
        query["valuationDt"] = valuation_dt
    positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        query, {"_id": 0}
    ).to_list(200)
    return positions


# ══════════════════════════════════════════════════════════════
# Ledger to Subledger Validation (per spec ledger_subledger.md)
# ══════════════════════════════════════════════════════════════

@app.get("/api/funds/{fund_account}/ledger-subledger")
async def get_ledger_subledger_summary(
    fund_account: str,
    valuation_dt: Optional[str] = None,
    user_bank: str = "CPU"
):
    """
    Get Ledger to Subledger summary comparison (Section 2.1).

    Returns a grid comparing ledger balances against derived subledger values,
    grouped by account and category.
    """
    import asyncio

    def _execute():
        service = DerivedSubledgerService()
        val_dt = valuation_dt or "2026-02-07"  # Default for demo
        return service.get_ledger_subledger_summary(fund_account, val_dt, user_bank)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _execute)
    return result


@app.get("/api/funds/{fund_account}/ledger-detail")
async def get_ledger_detail(
    fund_account: str,
    category: str,
    valuation_dt: Optional[str] = None,
    user_bank: str = "CPU"
):
    """
    Get Ledger Detail drill-down (Section 4.2).

    Shows individual GL accounts within the selected category.
    """
    import asyncio

    def _execute():
        service = DerivedSubledgerService()
        val_dt = valuation_dt or "2026-02-07"
        return service.get_ledger_detail(fund_account, val_dt, category, user_bank)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _execute)
    return result


@app.get("/api/funds/{fund_account}/position-totals")
async def get_position_totals(
    fund_account: str,
    category: str,
    valuation_dt: Optional[str] = None,
    user_bank: str = "CPU"
):
    """
    Get Position Totals drill-down (Section 5).

    Shows position-level data aggregated by security type for the selected category.
    """
    import asyncio

    def _execute():
        service = DerivedSubledgerService()
        val_dt = valuation_dt or "2026-02-07"
        return service.get_position_totals_by_category(fund_account, val_dt, category, user_bank)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _execute)
    return result


@app.get("/api/funds/{fund_account}/unsettled-totals")
async def get_unsettled_totals(
    fund_account: str,
    category: str,
    valuation_dt: Optional[str] = None,
):
    """
    Get Unsettled Totals drill-down (Section 7).

    Shows unsettled transaction amounts grouped by transaction code for the selected category.
    """
    import asyncio

    def _execute():
        service = DerivedSubledgerService()
        val_dt = valuation_dt or "2026-02-07"
        return service.get_unsettled_totals_by_category(fund_account, val_dt, category)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _execute)
    return result


@app.get("/api/reference/ledger-categories")
async def get_ledger_categories():
    """Get all ledger conversion categories with their subledger support status."""
    db = get_async_db()
    categories = await db["refLedgerCategory"].find(
        {}, {"_id": 0}
    ).sort("displayOrder", 1).to_list(50)
    return categories


@app.get("/api/reference/gl-category-mappings")
async def get_gl_category_mappings(chart_of_accounts: Optional[str] = None):
    """Get GL account to category mappings."""
    db = get_async_db()
    query = {}
    if chart_of_accounts:
        query["chartOfAccounts"] = chart_of_accounts
    mappings = await db["refGLCategoryMapping"].find(
        query, {"_id": 0}
    ).to_list(200)
    return mappings


@app.post("/api/reference/gl-category-mappings")
async def create_gl_category_mapping(mapping: dict):
    """Create a new GL account to category mapping."""
    db = get_async_db()

    # Validate required fields
    required = ["chartOfAccounts", "glAccountNumber", "glAccountDescription", "ledgerSection", "bsIncst", "conversionCategory"]
    for field in required:
        if field not in mapping:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    # Check for duplicate
    existing = await db["refGLCategoryMapping"].find_one({
        "chartOfAccounts": mapping["chartOfAccounts"],
        "glAccountNumber": mapping["glAccountNumber"],
    })
    if existing:
        raise HTTPException(status_code=409, detail="Mapping already exists for this GL account")

    await db["refGLCategoryMapping"].insert_one(mapping)
    return {"message": "Mapping created", "mapping": mapping}


@app.put("/api/reference/gl-category-mappings/{gl_account_number}")
async def update_gl_category_mapping(gl_account_number: str, mapping: dict, chart_of_accounts: str = "investone mufg"):
    """Update an existing GL account to category mapping."""
    db = get_async_db()

    result = await db["refGLCategoryMapping"].update_one(
        {"chartOfAccounts": chart_of_accounts, "glAccountNumber": gl_account_number},
        {"$set": mapping}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mapping not found")

    return {"message": "Mapping updated"}


@app.delete("/api/reference/gl-category-mappings/{gl_account_number}")
async def delete_gl_category_mapping(gl_account_number: str, chart_of_accounts: str = "investone mufg"):
    """Delete a GL account to category mapping."""
    db = get_async_db()

    result = await db["refGLCategoryMapping"].delete_one({
        "chartOfAccounts": chart_of_accounts,
        "glAccountNumber": gl_account_number,
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mapping not found")

    return {"message": "Mapping deleted"}


# ══════════════════════════════════════════════════════════════
# GL Account Mapping (Incumbent to Eagle)
# ══════════════════════════════════════════════════════════════

@app.get("/api/reference/incumbent-gl-accounts")
async def list_incumbent_gl_accounts(provider: Optional[str] = None):
    """List Incumbent GL accounts, optionally filtered by provider."""
    db = get_async_db()
    query = {}
    if provider:
        query["provider"] = provider
    accounts = await db[COLLECTIONS["refIncumbentGLAccounts"]].find(
        query, {"_id": 0}
    ).sort("glAccountNumber", 1).to_list(500)
    return accounts


@app.get("/api/reference/eagle-gl-accounts")
async def list_eagle_gl_accounts(ledger_section: Optional[str] = None):
    """List Eagle GL accounts, optionally filtered by ledger section."""
    db = get_async_db()
    query = {}
    if ledger_section:
        query["ledgerSection"] = ledger_section
    accounts = await db[COLLECTIONS["refEagleGLAccounts"]].find(
        query, {"_id": 0}
    ).sort("glAccountNumber", 1).to_list(500)
    return accounts


@app.get("/api/events/{event_id}/gl-mappings")
async def list_gl_mappings(
    event_id: str,
    status: Optional[str] = None,
    source_provider: Optional[str] = None,
):
    """List GL mappings for an event."""
    db = get_async_db()
    query: dict = {"eventId": event_id}
    if status:
        query["status"] = status
    if source_provider:
        query["sourceProvider"] = source_provider
    mappings = await db[COLLECTIONS["glAccountMappings"]].find(
        query, {"_id": 0}
    ).sort("sourceGlAccountNumber", 1).to_list(1000)
    return mappings


@app.post("/api/events/{event_id}/gl-mappings")
async def create_gl_mapping(event_id: str, req: CreateMappingRequest):
    """Create a single GL mapping."""
    if req.eventId != event_id:
        raise HTTPException(status_code=400, detail="Event ID mismatch")

    db = get_async_db()

    # Fetch source account details
    source_account = await db[COLLECTIONS["refIncumbentGLAccounts"]].find_one({
        "glAccountNumber": req.sourceGlAccountNumber,
        "provider": req.sourceProvider,
    })
    if not source_account:
        raise HTTPException(status_code=404, detail=f"Source GL account {req.sourceGlAccountNumber} not found")

    # Fetch target account details
    target_account = await db[COLLECTIONS["refEagleGLAccounts"]].find_one({
        "glAccountNumber": req.targetGlAccountNumber,
    })
    if not target_account:
        raise HTTPException(status_code=404, detail=f"Target GL account {req.targetGlAccountNumber} not found")

    mapping_id = f"MAP-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{req.sourceGlAccountNumber[:6]}"
    now = datetime.utcnow().isoformat()

    mapping_doc = {
        "mappingId": mapping_id,
        "eventId": event_id,
        "sourceProvider": req.sourceProvider,
        "sourceGlAccountNumber": req.sourceGlAccountNumber,
        "sourceGlAccountDescription": source_account.get("glAccountDescription", ""),
        "sourceLedgerSection": source_account.get("ledgerSection", ""),
        "targetGlAccountNumber": req.targetGlAccountNumber,
        "targetGlAccountDescription": target_account.get("glAccountDescription", ""),
        "targetLedgerSection": target_account.get("ledgerSection", ""),
        "mappingType": req.mappingType.value,
        "splitWeight": req.splitWeight,
        "groupId": req.groupId,
        "effectiveDate": req.effectiveDate,
        "status": MappingStatus.DRAFT.value,
        "createdBy": req.createdBy,
        "createdAt": now,
        "updatedAt": now,
    }

    await db[COLLECTIONS["glAccountMappings"]].insert_one(mapping_doc)
    del mapping_doc["_id"]
    return mapping_doc


@app.put("/api/gl-mappings/{mapping_id}")
async def update_gl_mapping(mapping_id: str, req: UpdateMappingRequest):
    """Update an existing GL mapping."""
    db = get_async_db()

    existing = await db[COLLECTIONS["glAccountMappings"]].find_one({"mappingId": mapping_id})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Mapping {mapping_id} not found")

    update_data: dict = {"updatedAt": datetime.utcnow().isoformat()}
    if req.mappingType is not None:
        update_data["mappingType"] = req.mappingType.value
    if req.splitWeight is not None:
        update_data["splitWeight"] = req.splitWeight
    if req.groupId is not None:
        update_data["groupId"] = req.groupId
    if req.effectiveDate is not None:
        update_data["effectiveDate"] = req.effectiveDate
    if req.status is not None:
        update_data["status"] = req.status.value

    await db[COLLECTIONS["glAccountMappings"]].update_one(
        {"mappingId": mapping_id},
        {"$set": update_data}
    )

    updated = await db[COLLECTIONS["glAccountMappings"]].find_one(
        {"mappingId": mapping_id}, {"_id": 0}
    )
    return updated


@app.delete("/api/gl-mappings/{mapping_id}")
async def delete_gl_mapping(mapping_id: str):
    """Delete a GL mapping."""
    db = get_async_db()
    result = await db[COLLECTIONS["glAccountMappings"]].delete_one({"mappingId": mapping_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Mapping {mapping_id} not found")
    return {"status": "deleted", "mappingId": mapping_id}


@app.post("/api/events/{event_id}/gl-mappings/bulk")
async def bulk_create_gl_mappings(event_id: str, req: BulkMappingRequest):
    """Bulk create GL mappings."""
    db = get_async_db()
    created = []
    errors = []

    # Pre-fetch all reference data for efficiency
    incumbent_accounts = await db[COLLECTIONS["refIncumbentGLAccounts"]].find({}).to_list(500)
    incumbent_map = {(a["glAccountNumber"], a["provider"]): a for a in incumbent_accounts}

    eagle_accounts = await db[COLLECTIONS["refEagleGLAccounts"]].find({}).to_list(500)
    eagle_map = {a["glAccountNumber"]: a for a in eagle_accounts}

    now = datetime.utcnow().isoformat()

    for i, mapping_req in enumerate(req.mappings):
        if mapping_req.eventId != event_id:
            errors.append({"index": i, "error": "Event ID mismatch"})
            continue

        source_key = (mapping_req.sourceGlAccountNumber, mapping_req.sourceProvider)
        source_account = incumbent_map.get(source_key)
        if not source_account:
            errors.append({"index": i, "error": f"Source account {mapping_req.sourceGlAccountNumber} not found"})
            continue

        target_account = eagle_map.get(mapping_req.targetGlAccountNumber)
        if not target_account:
            errors.append({"index": i, "error": f"Target account {mapping_req.targetGlAccountNumber} not found"})
            continue

        mapping_id = f"MAP-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')[:17]}-{mapping_req.sourceGlAccountNumber[:6]}-{i}"

        mapping_doc = {
            "mappingId": mapping_id,
            "eventId": event_id,
            "sourceProvider": mapping_req.sourceProvider,
            "sourceGlAccountNumber": mapping_req.sourceGlAccountNumber,
            "sourceGlAccountDescription": source_account.get("glAccountDescription", ""),
            "sourceLedgerSection": source_account.get("ledgerSection", ""),
            "targetGlAccountNumber": mapping_req.targetGlAccountNumber,
            "targetGlAccountDescription": target_account.get("glAccountDescription", ""),
            "targetLedgerSection": target_account.get("ledgerSection", ""),
            "mappingType": mapping_req.mappingType.value,
            "splitWeight": mapping_req.splitWeight,
            "groupId": mapping_req.groupId,
            "effectiveDate": mapping_req.effectiveDate,
            "status": MappingStatus.DRAFT.value,
            "createdBy": mapping_req.createdBy,
            "createdAt": now,
            "updatedAt": now,
        }
        created.append(mapping_doc)

    if created:
        await db[COLLECTIONS["glAccountMappings"]].insert_many(created)
        # Remove _id from response
        for doc in created:
            if "_id" in doc:
                del doc["_id"]

    return {"created": len(created), "errors": errors, "mappings": created}


@app.delete("/api/events/{event_id}/gl-mappings/bulk")
async def bulk_delete_gl_mappings(event_id: str, req: BulkDeleteRequest):
    """Bulk delete GL mappings."""
    db = get_async_db()

    result = await db[COLLECTIONS["glAccountMappings"]].delete_many({
        "eventId": event_id,
        "mappingId": {"$in": req.mappingIds}
    })

    return {"deleted": result.deleted_count, "requested": len(req.mappingIds)}


@app.get("/api/events/{event_id}/gl-mappings/unmapped")
async def get_unmapped_accounts(event_id: str, source_provider: Optional[str] = None):
    """Get unmapped accounts for an event."""
    db = get_async_db()

    # Get event to determine the incumbent provider
    event = await db[COLLECTIONS["events"]].find_one({"eventId": event_id})
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")

    provider = source_provider or event.get("incumbentProvider", "").upper().replace(" ", "_")

    # Get all incumbent accounts for the provider
    incumbent_query = {"provider": provider} if provider else {}
    incumbent_accounts = await db[COLLECTIONS["refIncumbentGLAccounts"]].find(
        incumbent_query, {"_id": 0}
    ).to_list(500)

    # Get all mapped source account numbers for this event
    mappings = await db[COLLECTIONS["glAccountMappings"]].find(
        {"eventId": event_id},
        {"sourceGlAccountNumber": 1}
    ).to_list(1000)
    mapped_source_numbers = {m["sourceGlAccountNumber"] for m in mappings}

    # Get all Eagle accounts
    eagle_accounts = await db[COLLECTIONS["refEagleGLAccounts"]].find(
        {}, {"_id": 0}
    ).to_list(500)

    # Get all mapped target account numbers
    target_mappings = await db[COLLECTIONS["glAccountMappings"]].find(
        {"eventId": event_id},
        {"targetGlAccountNumber": 1}
    ).to_list(1000)
    mapped_target_numbers = {m["targetGlAccountNumber"] for m in target_mappings}

    unmapped_incumbent = [a for a in incumbent_accounts if a["glAccountNumber"] not in mapped_source_numbers]
    unmapped_eagle = [a for a in eagle_accounts if a["glAccountNumber"] not in mapped_target_numbers]

    return {
        "unmappedIncumbent": unmapped_incumbent,
        "unmappedEagle": unmapped_eagle,
    }


@app.post("/api/events/{event_id}/gl-mappings/validate")
async def validate_mappings(event_id: str):
    """Validate GL mappings for an event."""
    db = get_async_db()

    mappings = await db[COLLECTIONS["glAccountMappings"]].find(
        {"eventId": event_id}, {"_id": 0}
    ).to_list(1000)

    errors = []
    warnings = []

    # Group mappings by source account for 1:N validation
    source_groups: dict = {}
    for m in mappings:
        key = m["sourceGlAccountNumber"]
        if key not in source_groups:
            source_groups[key] = []
        source_groups[key].append(m)

    # Validate split weights for 1:N mappings
    for source, group in source_groups.items():
        if len(group) > 1:
            total_weight = sum(m.get("splitWeight", 1.0) for m in group)
            if abs(total_weight - 1.0) > 0.001:
                errors.append({
                    "type": "INVALID_SPLIT_WEIGHT",
                    "sourceGlAccountNumber": source,
                    "message": f"Split weights sum to {total_weight:.4f}, expected 1.0",
                    "mappingIds": [m["mappingId"] for m in group],
                })

    # Check for unmapped accounts
    event = await db[COLLECTIONS["events"]].find_one({"eventId": event_id})
    if event:
        provider = event.get("incumbentProvider", "").upper().replace(" ", "_")
        incumbent_accounts = await db[COLLECTIONS["refIncumbentGLAccounts"]].find(
            {"provider": provider}, {"_id": 0}
        ).to_list(500)

        mapped_source_numbers = {m["sourceGlAccountNumber"] for m in mappings}
        unmapped_count = len([a for a in incumbent_accounts if a["glAccountNumber"] not in mapped_source_numbers])

        if unmapped_count > 0:
            warnings.append({
                "type": "UNMAPPED_ACCOUNTS",
                "message": f"{unmapped_count} incumbent GL accounts are not mapped",
            })

    # Check for ledger section mismatches
    for m in mappings:
        if m.get("sourceLedgerSection") != m.get("targetLedgerSection"):
            warnings.append({
                "type": "LEDGER_SECTION_MISMATCH",
                "mappingId": m["mappingId"],
                "message": f"Source ({m.get('sourceLedgerSection')}) and target ({m.get('targetLedgerSection')}) ledger sections differ",
            })

    is_valid = len(errors) == 0

    return {
        "isValid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "mappingCount": len(mappings),
    }


# ══════════════════════════════════════════════════════════════
# Process Flow Drill-Down Endpoints
# ══════════════════════════════════════════════════════════════

VARIANCE_THRESHOLD = 0.01


async def _get_event_or_404(db, event_id: str) -> dict:
    event = await db[COLLECTIONS["events"]].find_one({"eventId": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return event


# ── 1. NAV Compare ──────────────────────────────────────────

@app.get("/api/events/{event_id}/nav-compare")
async def nav_compare(event_id: str, valuationDt: Optional[str] = None):
    """NAV TNA comparison between CPU and incumbent, aggregated by fund account."""
    db = get_async_db()
    event = await _get_event_or_404(db, event_id)
    fund_accounts = [f["account"] for f in event.get("funds", [])]
    if not fund_accounts:
        return []

    base_query: dict = {"account": {"$in": fund_accounts}}
    if valuationDt:
        base_query["valuationDt"] = valuationDt

    cpu_navs = await db[COLLECTIONS["navSummary"]].find(
        {**base_query, "userBank": "CPU"}, {"_id": 0}
    ).to_list(2000)
    inc_navs = await db[COLLECTIONS["navSummary"]].find(
        {**base_query, "userBank": "INCUMBENT"}, {"_id": 0}
    ).to_list(2000)

    # Aggregate by account
    cpu_by_acct: dict[str, float] = {}
    for n in cpu_navs:
        acct = n.get("account", "")
        cpu_by_acct[acct] = cpu_by_acct.get(acct, 0) + n.get("netAssets", 0)

    inc_by_acct: dict[str, float] = {}
    for n in inc_navs:
        acct = n.get("account", "")
        inc_by_acct[acct] = inc_by_acct.get(acct, 0) + n.get("netAssets", 0)

    fund_name_map = {f["account"]: f.get("fundName", f["account"]) for f in event.get("funds", [])}
    rows = []
    for acct in sorted(set(list(cpu_by_acct.keys()) + list(inc_by_acct.keys()))):
        cpu_tna = cpu_by_acct.get(acct, 0)
        inc_tna = inc_by_acct.get(acct, 0)
        diff = cpu_tna - inc_tna
        bp = (diff / inc_tna * 10000) if inc_tna != 0 else 0
        status = "pass" if abs(diff) <= VARIANCE_THRESHOLD else ("marginal" if abs(bp) < 5 else "break")
        rows.append({
            "valuationDt": valuationDt or "",
            "account": acct,
            "accountName": fund_name_map.get(acct, acct),
            "incumbentTNA": inc_tna,
            "bnyTNA": cpu_tna,
            "tnaDifference": diff,
            "tnaDifferenceBP": round(bp, 2),
            "validationStatus": status,
        })
    return rows


# ── 2. NAV Cross-Checks ────────────────────────────────────

@app.get("/api/events/{event_id}/nav-compare/{account}/cross-checks")
async def nav_cross_checks(event_id: str, account: str, valuationDt: Optional[str] = None):
    """Cross-check validations: Ledger BS vs NAV, Ledger INCST vs BS remainder."""
    db = get_async_db()
    base_query: dict = {"account": account}
    if valuationDt:
        base_query["valuationDt"] = valuationDt

    # Get GL category mappings to determine BS vs INCST
    gl_mappings = await db["refGLCategoryMapping"].find({}, {"_id": 0}).to_list(200)
    bs_gl_numbers = {m["glAccountNumber"] for m in gl_mappings if m.get("bsIncst") == "BS"}
    incst_gl_numbers = {m["glAccountNumber"] for m in gl_mappings if m.get("bsIncst") == "INCST"}

    # Fetch CPU ledger
    cpu_ledger = await db[COLLECTIONS["ledger"]].find(
        {**base_query, "userBank": "CPU"}, {"_id": 0}
    ).to_list(500)

    bs_total = sum(e.get("endingBalance", 0) for e in cpu_ledger
                   if e.get("glAccountNumber", e.get("eagleLedgerAcct", "")) in bs_gl_numbers)
    incst_total = sum(e.get("endingBalance", 0) for e in cpu_ledger
                      if e.get("glAccountNumber", e.get("eagleLedgerAcct", "")) in incst_gl_numbers)

    # NAV net assets
    navs = await db[COLLECTIONS["navSummary"]].find(
        {**base_query, "userBank": "CPU"}, {"_id": 0}
    ).to_list(100)
    nav_net_assets = sum(n.get("netAssets", 0) for n in navs)

    bs_diff = bs_total - nav_net_assets
    incst_diff = incst_total - (bs_total - nav_net_assets)

    return {
        "bsCheck": {
            "label": "Ledger BS Compare Check",
            "lhsValue": bs_total,
            "rhsValue": nav_net_assets,
            "difference": bs_diff,
            "validationStatus": "pass" if abs(bs_diff) <= VARIANCE_THRESHOLD else "break",
        },
        "incstCheck": {
            "label": "Ledger INCST Compare Check",
            "lhsValue": incst_total,
            "rhsValue": bs_total - nav_net_assets,
            "difference": incst_diff,
            "validationStatus": "pass" if abs(incst_diff) <= VARIANCE_THRESHOLD else "break",
        },
    }


# ── 3. Trial Balance Compare ───────────────────────────────

@app.get("/api/funds/{account}/trial-balance-compare")
async def trial_balance_compare(account: str, valuationDt: Optional[str] = None):
    """Ledger balance comparison grouped by GL conversion category."""
    db = get_async_db()
    base_query: dict = {"account": account}
    if valuationDt:
        base_query["valuationDt"] = valuationDt

    gl_mappings = await db["refGLCategoryMapping"].find({}, {"_id": 0}).to_list(200)
    gl_to_cat = {m["glAccountNumber"]: m["conversionCategory"] for m in gl_mappings}

    cpu_ledger = await db[COLLECTIONS["ledger"]].find(
        {**base_query, "userBank": "CPU"}, {"_id": 0}
    ).to_list(500)
    inc_ledger = await db[COLLECTIONS["ledger"]].find(
        {**base_query, "userBank": "INCUMBENT"}, {"_id": 0}
    ).to_list(500)

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
    rows = []
    for cat in all_cats:
        cpu_bal = cpu_by_cat.get(cat, 0)
        inc_bal = inc_by_cat.get(cat, 0)
        diff = cpu_bal - inc_bal
        bp = (diff / inc_bal * 10000) if inc_bal != 0 else 0
        status = "pass" if abs(diff) <= VARIANCE_THRESHOLD else ("marginal" if abs(bp) < 5 else "break")
        rows.append({
            "valuationDt": valuationDt or "",
            "account": account,
            "category": cat,
            "incumbentBalance": inc_bal,
            "bnyBalance": cpu_bal,
            "balanceDiff": diff,
            "balanceDiffBP": round(bp, 2),
            "validationStatus": status,
        })
    return rows


# ── 4. Subledger Compare Check ─────────────────────────────

@app.get("/api/funds/{account}/trial-balance-compare/{category}/subledger-check")
async def subledger_check(account: str, category: str, valuationDt: Optional[str] = None):
    """Compare ledger balance against derived subledger rollup for a category."""
    db = get_async_db()
    base_query: dict = {"account": account}
    if valuationDt:
        base_query["valuationDt"] = valuationDt

    gl_mappings = await db["refGLCategoryMapping"].find(
        {"conversionCategory": category}, {"_id": 0}
    ).to_list(200)
    cat_gl_numbers = {m["glAccountNumber"] for m in gl_mappings}

    cpu_ledger = await db[COLLECTIONS["ledger"]].find(
        {**base_query, "userBank": "CPU"}, {"_id": 0}
    ).to_list(500)
    ledger_total = sum(
        e.get("endingBalance", 0) for e in cpu_ledger
        if e.get("glAccountNumber", e.get("eagleLedgerAcct", "")) in cat_gl_numbers
    )

    def _get_subledger():
        service = DerivedSubledgerService()
        val_dt = valuationDt or "2026-02-07"
        return service.get_ledger_subledger_summary(account, val_dt, "CPU")

    loop = asyncio.get_event_loop()
    subledger_data = await loop.run_in_executor(None, _get_subledger)

    subledger_total = 0.0
    if isinstance(subledger_data, dict):
        for row in subledger_data.get("rows", []):
            if row.get("category", "") == category:
                subledger_total = row.get("subLedger", 0) or 0
                break

    diff = ledger_total - subledger_total
    return {
        "category": category,
        "ledgerValue": ledger_total,
        "subledgerValue": subledger_total,
        "difference": diff,
        "validationStatus": "pass" if abs(diff) <= VARIANCE_THRESHOLD else "break",
    }


# ── 5. Position Compare ────────────────────────────────────

@app.get("/api/funds/{account}/position-compare")
async def position_compare(account: str, valuationDt: Optional[str] = None, category: Optional[str] = None):
    """Position-level comparison between CPU and incumbent by asset."""
    db = get_async_db()
    base_query: dict = {"account": account}
    if valuationDt:
        base_query["valuationDt"] = valuationDt

    cpu_positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        {**base_query, "userBank": "CPU"}, {"_id": 0}
    ).to_list(1000)
    inc_positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        {**base_query, "userBank": "INCUMBENT"}, {"_id": 0}
    ).to_list(1000)

    def _pos_key(p: dict) -> str:
        return f"{p.get('assetId', '')}|{p.get('longShortInd', 'L')}"

    cpu_map: dict[str, dict] = {}
    for p in cpu_positions:
        key = _pos_key(p)
        if key not in cpu_map:
            cpu_map[key] = {"assetId": p.get("assetId", ""), "longShortInd": p.get("longShortInd", "L"),
                            "shareClass": p.get("shareClass", ""), "secType": p.get("secType", ""),
                            "issueDescription": p.get("issueDescription", ""), "cusip": p.get("cusip", ""),
                            "shares": 0, "marketValue": 0, "bookValue": 0}
        cpu_map[key]["shares"] += p.get("posShares", 0)
        cpu_map[key]["marketValue"] += p.get("posMarketValueBase", 0)
        cpu_map[key]["bookValue"] += p.get("posBookValueBase", 0)

    inc_map: dict[str, dict] = {}
    for p in inc_positions:
        key = _pos_key(p)
        if key not in inc_map:
            inc_map[key] = {"assetId": p.get("assetId", ""), "longShortInd": p.get("longShortInd", "L"),
                            "shareClass": p.get("shareClass", ""), "secType": p.get("secType", ""),
                            "issueDescription": p.get("issueDescription", ""), "cusip": p.get("cusip", ""),
                            "shares": 0, "marketValue": 0, "bookValue": 0}
        inc_map[key]["shares"] += p.get("posShares", 0)
        inc_map[key]["marketValue"] += p.get("posMarketValueBase", 0)
        inc_map[key]["bookValue"] += p.get("posBookValueBase", 0)

    all_keys = sorted(set(list(cpu_map.keys()) + list(inc_map.keys())))
    rows = []
    for key in all_keys:
        cpu = cpu_map.get(key, {"shares": 0, "marketValue": 0, "bookValue": 0})
        inc = inc_map.get(key, {"shares": 0, "marketValue": 0, "bookValue": 0})
        ref = cpu_map.get(key) or inc_map.get(key) or {}
        mv_var = cpu["marketValue"] - inc["marketValue"]
        bv_var = cpu["bookValue"] - inc["bookValue"]
        shares_var = cpu["shares"] - inc["shares"]
        has_break = abs(mv_var) > VARIANCE_THRESHOLD or abs(bv_var) > VARIANCE_THRESHOLD or abs(shares_var) > VARIANCE_THRESHOLD
        rows.append({
            "assetId": ref.get("assetId", key.split("|")[0]),
            "securityType": ref.get("secType", ""),
            "issueDescription": ref.get("issueDescription", ""),
            "cusip": ref.get("cusip", ""),
            "longShortInd": ref.get("longShortInd", "L"),
            "shareClass": ref.get("shareClass", ""),
            "comparisonFields": [
                {"fieldName": "Market Value", "incumbent": inc["marketValue"], "bny": cpu["marketValue"], "variance": mv_var},
                {"fieldName": "Book Value", "incumbent": inc["bookValue"], "bny": cpu["bookValue"], "variance": bv_var},
                {"fieldName": "Shares", "incumbent": inc["shares"], "bny": cpu["shares"], "variance": shares_var},
            ],
            "validationStatus": "break" if has_break else "pass",
        })
    return rows


# ── 6. Tax Lot Detail ──────────────────────────────────────

@app.get("/api/funds/{account}/position-compare/{asset_id}/tax-lots")
async def tax_lot_detail(account: str, asset_id: str, valuationDt: Optional[str] = None):
    """Tax lot detail comparison for a specific asset."""
    db = get_async_db()
    base_query: dict = {"account": account, "assetId": asset_id}
    if valuationDt:
        base_query["valuationDt"] = valuationDt

    cpu_lots = await db[COLLECTIONS["dataSubLedgerTrans"]].find(
        {**base_query, "userBank": "CPU"}, {"_id": 0}
    ).to_list(500)
    inc_lots = await db[COLLECTIONS["dataSubLedgerTrans"]].find(
        {**base_query, "userBank": "INCUMBENT"}, {"_id": 0}
    ).to_list(500)

    # Fallback: if no userBank filter produced results
    if not cpu_lots and not inc_lots:
        cpu_lots = await db[COLLECTIONS["dataSubLedgerTrans"]].find(
            base_query, {"_id": 0}
        ).to_list(500)

    def _make_field(cpu_val: float, inc_val: float) -> dict:
        return {"incumbent": inc_val, "bny": cpu_val, "variance": cpu_val - inc_val}

    # Match lots by transactionId
    cpu_by_txn = {l.get("transactionId", ""): l for l in cpu_lots}
    inc_by_txn = {l.get("transactionId", ""): l for l in inc_lots}
    all_txns = sorted(set(list(cpu_by_txn.keys()) + list(inc_by_txn.keys())))

    rows = []
    for txn in all_txns:
        c = cpu_by_txn.get(txn, {})
        i = inc_by_txn.get(txn, {})
        rows.append({
            "transactionId": txn,
            "lotTradeDate": c.get("lotTradeDate", i.get("lotTradeDate", "")),
            "lotSettleDate": c.get("lotSettleDate", i.get("lotSettleDate", "")),
            "shares": _make_field(c.get("shares", 0), i.get("shares", 0)),
            "originalFace": _make_field(c.get("originalFace", 0), i.get("originalFace", 0)),
            "origCostLocal": _make_field(c.get("origCostLocal", 0), i.get("origCostLocal", 0)),
            "origCostBase": _make_field(c.get("origCostBase", 0), i.get("origCostBase", 0)),
            "bookValueLocal": _make_field(c.get("bookValueLocal", 0), i.get("bookValueLocal", 0)),
            "bookValueBase": _make_field(c.get("bookValueBase", 0), i.get("bookValueBase", 0)),
            "marketValueLocal": _make_field(c.get("marketValueLocal", 0), i.get("marketValueLocal", 0)),
            "marketValueBase": _make_field(c.get("marketValueBase", 0), i.get("marketValueBase", 0)),
            "incomeLocal": _make_field(c.get("incomeLocal", 0), i.get("incomeLocal", 0)),
            "brokerCode": c.get("brokerCode", i.get("brokerCode", "")),
        })
    return rows


# ── 7. Basis Lot Check ─────────────────────────────────────

@app.get("/api/funds/{account}/basis-lot-check")
async def basis_lot_check(account: str, valuationDt: Optional[str] = None):
    """Compare position-level shares against lot-level shares per asset."""
    db = get_async_db()
    base_query: dict = {"account": account}
    if valuationDt:
        base_query["valuationDt"] = valuationDt

    positions = await db[COLLECTIONS["dataSubLedgerPosition"]].find(
        {**base_query, "userBank": "CPU"}, {"_id": 0}
    ).to_list(1000)
    lots = await db[COLLECTIONS["dataSubLedgerTrans"]].find(
        base_query, {"_id": 0}
    ).to_list(2000)

    pos_by_asset: dict[str, float] = {}
    desc_by_asset: dict[str, str] = {}
    for p in positions:
        aid = p.get("assetId", "")
        pos_by_asset[aid] = pos_by_asset.get(aid, 0) + p.get("posShares", 0)
        if aid not in desc_by_asset:
            desc_by_asset[aid] = p.get("issueDescription", "")

    lot_by_asset: dict[str, float] = {}
    for lot in lots:
        aid = lot.get("assetId", "")
        lot_by_asset[aid] = lot_by_asset.get(aid, 0) + lot.get("shares", 0)

    all_assets = sorted(set(list(pos_by_asset.keys()) + list(lot_by_asset.keys())))
    rows = []
    for aid in all_assets:
        primary = pos_by_asset.get(aid, 0)
        non_primary = lot_by_asset.get(aid, 0)
        var = primary - non_primary
        rows.append({
            "assetId": aid,
            "issueDescription": desc_by_asset.get(aid, ""),
            "primaryShares": primary,
            "nonPrimaryShares": non_primary,
            "shareVariance": var,
            "validationStatus": "pass" if abs(var) <= VARIANCE_THRESHOLD else "break",
        })
    return rows


# ── 8. Available Dates ─────────────────────────────────────

@app.get("/api/events/{event_id}/available-dates")
async def available_dates(event_id: str):
    """Return distinct valuation dates available for the event's funds."""
    db = get_async_db()
    event = await _get_event_or_404(db, event_id)
    fund_accounts = [f["account"] for f in event.get("funds", [])]
    if not fund_accounts:
        return []

    acct_filter = {"account": {"$in": fund_accounts}}
    nav_dates = await db[COLLECTIONS["navSummary"]].distinct("valuationDt", acct_filter)
    ledger_dates = await db[COLLECTIONS["ledger"]].distinct("valuationDt", acct_filter)
    all_dates = sorted(set(nav_dates + ledger_dates), reverse=True)
    return all_dates


# ── 9. AI Analysis Aggregation ─────────────────────────────

@app.get("/api/ai/analysis")
async def ai_analysis_aggregation(
    eventId: Optional[str] = None,
    account: Optional[str] = None,
    category: Optional[str] = None,
):
    """Contextual AI analysis aggregated from break records for the commentary panel.

    Produces different analysis depending on drill-down level:
    - NAV level (eventId only): fund-level trend narrative, cross-fund patterns
    - Trial Balance level (eventId + account): category variance drivers, drill-down priorities
    - Position level (eventId + account + category): root cause per position, evidence chain
    """
    db = get_async_db()

    # Find the latest validation run
    if not eventId:
        return {"trendSummary": "Select an event to see analysis.", "patternRecognition": [],
                "confidenceScore": 0, "recommendedNextStep": "Navigate to an event first."}

    latest_run = await db[COLLECTIONS["validationRuns"]].find_one(
        {"eventId": eventId}, {"runId": 1, "results": 1}, sort=[("_id", -1)],
    )
    if not latest_run:
        return {"trendSummary": "No validation data available.", "patternRecognition": [],
                "confidenceScore": 0, "recommendedNextStep": "Run a validation first."}

    run_id = latest_run["runId"]

    # Query breaks for this run
    query: dict = {"validationRunId": run_id}
    if account:
        query["fundAccount"] = account
    if category:
        query["glCategory"] = category

    breaks = await db[COLLECTIONS["breakRecords"]].find(query, {"_id": 0}).to_list(500)

    if not breaks:
        if account and category:
            return {"trendSummary": f"No breaks detected for {category}. Ledger and subledger are in agreement.",
                    "patternRecognition": [], "confidenceScore": 100,
                    "recommendedNextStep": "No action required for this category."}
        if account:
            return {"trendSummary": "No breaks detected for this fund. All validation checks passed.",
                    "patternRecognition": [], "confidenceScore": 100,
                    "recommendedNextStep": "No further investigation needed."}
        return {"trendSummary": "No breaks detected across all funds. All validations passed.",
                "patternRecognition": [], "confidenceScore": 100,
                "recommendedNextStep": "No action required."}

    # ── Position level (most granular) ────────────────────────
    if account and category:
        return _build_position_level_analysis(breaks, account, category)

    # ── Trial Balance level (fund + categories) ──────────────
    if account:
        return _build_trial_balance_analysis(breaks, account)

    # ── NAV level (all funds) ────────────────────────────────
    return _build_nav_level_analysis(breaks, latest_run.get("results", []))


def _build_nav_level_analysis(breaks: list[dict], run_results: list[dict]) -> dict:
    """NAV Dashboard: fund-level trend narrative with cross-fund patterns."""
    # Group breaks by fund
    by_fund: dict[str, list] = {}
    for b in breaks:
        by_fund.setdefault(b["fundAccount"], []).append(b)

    # Group breaks by category (breakCategory from AI)
    by_ai_category: dict[str, int] = {}
    confidence_vals = []
    for b in breaks:
        ai = b.get("aiAnalysis") or {}
        cat = ai.get("breakCategory", "UNKNOWN")
        by_ai_category[cat] = by_ai_category.get(cat, 0) + 1
        c = ai.get("confidenceScore", 0)
        if c:
            confidence_vals.append(c)

    avg_conf = (sum(confidence_vals) / len(confidence_vals)) if confidence_vals else 0

    # Find the fund with the largest total variance
    fund_variances = []
    for fa, fund_breaks in by_fund.items():
        total_var = sum(abs(b.get("variance", 0)) for b in fund_breaks)
        name = fund_breaks[0].get("fundName", fa)
        fund_variances.append((fa, name, total_var, len(fund_breaks)))
    fund_variances.sort(key=lambda x: x[2], reverse=True)

    # Build trend narrative
    total_funds_with_breaks = len(by_fund)
    total_breaks = len(breaks)
    parts = [f"{total_breaks} breaks across {total_funds_with_breaks} fund(s)."]

    if fund_variances:
        top = fund_variances[0]
        parts.append(f"Largest exposure: {top[1]} ({top[0]}) with ${top[2]:,.2f} total variance across {top[3]} break(s).")

    # Describe dominant break category
    if by_ai_category:
        dominant = max(by_ai_category, key=by_ai_category.get)  # type: ignore[arg-type]
        count = by_ai_category[dominant]
        parts.append(f"Primary pattern: {dominant.replace('_', ' ').title()} ({count}/{total_breaks} breaks).")

    # Build pattern recognition from cross-fund similarities
    patterns = []
    for cat, count in sorted(by_ai_category.items(), key=lambda x: x[1], reverse=True)[:3]:
        if count >= 2:
            affected = [fa for fa, fbreaks in by_fund.items()
                        if any((b.get("aiAnalysis") or {}).get("breakCategory") == cat for b in fbreaks)]
            patterns.append({
                "fundName": f"{count} breaks ({len(affected)} funds)",
                "date": cat.replace("_", " ").title(),
                "variance": count,
            })

    # Recommended next step — suggest the fund with highest variance
    if fund_variances:
        top = fund_variances[0]
        next_step = f"Drill into {top[1]} ({top[0]}) to investigate ${top[2]:,.2f} in variances. Double-click the fund row to view Trial Balance."
    else:
        next_step = "Review breaks with lowest confidence scores first."

    return {
        "trendSummary": " ".join(parts),
        "patternRecognition": patterns,
        "confidenceScore": round(avg_conf * 100, 1),
        "recommendedNextStep": next_step,
    }


def _build_trial_balance_analysis(breaks: list[dict], account: str) -> dict:
    """Trial Balance: category variance drivers and drill-down priority."""
    # Group breaks by GL category
    by_category: dict[str, list] = {}
    for b in breaks:
        cat = b.get("glCategory", "Unknown")
        by_category.setdefault(cat, []).append(b)

    confidence_vals = []
    for b in breaks:
        c = (b.get("aiAnalysis") or {}).get("confidenceScore", 0)
        if c:
            confidence_vals.append(c)
    avg_conf = (sum(confidence_vals) / len(confidence_vals)) if confidence_vals else 0

    # Rank categories by absolute variance
    cat_variances = []
    for cat, cat_breaks in by_category.items():
        total_var = sum(abs(b.get("variance", 0)) for b in cat_breaks)
        cat_variances.append((cat, total_var, len(cat_breaks), cat_breaks))
    cat_variances.sort(key=lambda x: x[1], reverse=True)

    # Build trend narrative
    total = sum(cv[1] for cv in cat_variances)
    parts = [f"{len(breaks)} breaks across {len(by_category)} GL categories for this fund."]

    if cat_variances:
        top = cat_variances[0]
        pct = (top[1] / total * 100) if total else 0
        parts.append(f"Primary variance driver: {top[0]} with ${top[1]:,.2f} ({pct:.0f}% of total variance).")

        # Get AI root cause for the largest category
        top_breaks = top[3]
        ai_summaries = [
            (b.get("aiAnalysis") or {}).get("rootCauseSummary", "")
            for b in top_breaks if (b.get("aiAnalysis") or {}).get("rootCauseSummary")
        ]
        if ai_summaries:
            parts.append(ai_summaries[0])

    # Show secondary drivers
    if len(cat_variances) > 1:
        secondary = [f"{cv[0]} (${cv[1]:,.2f})" for cv in cat_variances[1:3]]
        parts.append(f"Other contributors: {', '.join(secondary)}.")

    # Upward propagation
    total_signed = sum(b.get("variance", 0) for b in breaks)
    parts.append(f"Net category variance of ${total_signed:,.2f} propagates to the NAV-level difference.")

    # Pattern recognition — show which categories have what type of break
    patterns = []
    for cat, var, count, cat_breaks in cat_variances[:3]:
        ai_cat = "UNKNOWN"
        for b in cat_breaks:
            ai_cat = (b.get("aiAnalysis") or {}).get("breakCategory", "UNKNOWN")
            break
        patterns.append({
            "fundName": cat,
            "date": ai_cat.replace("_", " ").title(),
            "variance": round(var, 2),
        })

    # Recommended next step — suggest drill into highest-variance category
    if cat_variances:
        top = cat_variances[0]
        # Find the lowest-confidence category for priority
        low_conf_cats = []
        for cat, _, _, cat_breaks in cat_variances:
            cat_confs = [(b.get("aiAnalysis") or {}).get("confidenceScore", 1) for b in cat_breaks]
            avg_cat_conf = sum(cat_confs) / len(cat_confs) if cat_confs else 1
            low_conf_cats.append((cat, avg_cat_conf))
        low_conf_cats.sort(key=lambda x: x[1])

        if low_conf_cats[0][1] < 0.7:
            next_step = f"Investigate {low_conf_cats[0][0]} (lowest confidence at {low_conf_cats[0][1]*100:.0f}%). Double-click the category row to drill into positions."
        else:
            next_step = f"Drill into {top[0]} to investigate the ${top[1]:,.2f} variance at position level. Double-click the category row."
    else:
        next_step = "All categories within tolerance."

    return {
        "trendSummary": " ".join(parts),
        "patternRecognition": patterns,
        "confidenceScore": round(avg_conf * 100, 1),
        "recommendedNextStep": next_step,
    }


def _build_position_level_analysis(breaks: list[dict], account: str, category: str) -> dict:
    """Position Drill-Down: root cause per security, evidence chain, cross-position patterns."""
    confidence_vals = []
    root_causes = []
    evidence_chain = []
    actions = []
    by_ai_category: dict[str, int] = {}

    for b in breaks:
        ai = b.get("aiAnalysis") or {}
        c = ai.get("confidenceScore", 0)
        if c:
            confidence_vals.append(c)
        if ai.get("rootCauseSummary"):
            root_causes.append({
                "security": b.get("securityId", ""),
                "summary": ai["rootCauseSummary"],
                "variance": b.get("variance", 0),
            })
        for step in ai.get("evidenceChain", []):
            evidence_chain.append(step)
        for act in ai.get("recommendedActions", []):
            if act.get("description") and act["description"] not in [a.get("description") for a in actions]:
                actions.append(act)
        cat = ai.get("breakCategory", "UNKNOWN")
        by_ai_category[cat] = by_ai_category.get(cat, 0) + 1

    avg_conf = (sum(confidence_vals) / len(confidence_vals)) if confidence_vals else 0

    # Build position-level trend narrative
    total_var = sum(abs(b.get("variance", 0)) for b in breaks)
    parts = [f"{len(breaks)} position-level breaks in {category} totaling ${total_var:,.2f}."]

    # Show root cause summary from highest-variance break
    if root_causes:
        root_causes.sort(key=lambda x: abs(x["variance"]), reverse=True)
        parts.append(root_causes[0]["summary"])

    # Cross-position pattern recognition
    if by_ai_category:
        dominant = max(by_ai_category, key=by_ai_category.get)  # type: ignore[arg-type]
        count = by_ai_category[dominant]
        if count >= 2:
            parts.append(f"Pattern: {count} positions share a {dominant.replace('_', ' ').lower()} root cause.")

    # Build pattern recognition for similar securities
    patterns = []
    for rc in root_causes[:3]:
        patterns.append({
            "fundName": rc["security"] or category,
            "date": rc["summary"][:50],
            "variance": round(abs(rc["variance"]), 2),
        })

    # Recommended next step
    if actions:
        next_step = actions[0].get("description", "Review positions with largest variances.")
    elif root_causes:
        next_step = f"Verify {root_causes[0]['summary'][:80]}."
    else:
        next_step = "Review positions with largest variances for manual investigation."

    return {
        "trendSummary": " ".join(parts),
        "patternRecognition": patterns,
        "confidenceScore": round(avg_conf * 100, 1),
        "recommendedNextStep": next_step,
        "rootCauseSummary": root_causes[0]["summary"] if root_causes else None,
        "evidenceChain": evidence_chain[:10],
    }


# ── 10. SSE Endpoint ───────────────────────────────────────

@app.get("/api/events/{event_id}/sse")
async def event_sse(event_id: str):
    """Server-Sent Events stream for real-time updates on an event."""
    db = get_async_db()
    event = await db[COLLECTIONS["events"]].find_one({"eventId": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")

    async def _stream():
        while True:
            try:
                run_count = await db[COLLECTIONS["validationRuns"]].count_documents({"eventId": event_id})
                runs = await db[COLLECTIONS["validationRuns"]].find(
                    {"eventId": event_id}, {"runId": 1}
                ).to_list(100)
                run_ids = [r["runId"] for r in runs]
                break_count = 0
                if run_ids:
                    break_count = await db[COLLECTIONS["breakRecords"]].count_documents({
                        "validationRunId": {"$in": run_ids},
                        "state": {"$nin": [BreakState.APPROVED.value, "RESOLVED"]},
                    })
                payload = {
                    "type": "status_change",
                    "eventId": event_id,
                    "data": {"runCount": run_count, "openBreakCount": break_count,
                             "timestamp": datetime.utcnow().isoformat()},
                }
                yield f"data: {json.dumps(payload)}\n\n"
            except Exception as exc:
                yield f"event: error\ndata: {json.dumps({'error': str(exc)})}\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ── 11. Sequential Validation ──────────────────────────────

@app.post("/api/validation/run-sequential")
async def run_sequential_validation_endpoint(req: RunValidationRequest):
    """Execute validation checks sequentially across all funds, then run AI analysis."""
    def _execute():
        engine = ValidationEngine()
        fund_accounts = None
        if req.fundSelection and req.fundSelection != "all":
            fund_accounts = [a.strip() for a in req.fundSelection.split(",")]

        run_doc = engine.run_validation(
            event_id=req.eventId,
            valuation_dt=req.valuationDt,
            check_suite=req.checkSuite,
            fund_accounts=fund_accounts,
            incumbent_event_id=req.incumbentEventId,
        )

        # Run AI analysis on detected breaks (best-effort)
        try:
            ai_service = AIAnalysisService()
            ai_service.analyze_run_breaks(run_doc.runId)
        except Exception:
            pass

        db = get_sync_db()
        return db[COLLECTIONS["validationRuns"]].find_one(
            {"runId": run_doc.runId}, {"_id": 0}
        )

    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, _execute)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return result


# ══════════════════════════════════════════════════════════════
# Health Check
# ══════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
