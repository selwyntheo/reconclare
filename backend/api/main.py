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

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

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
    # Startup
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
        ai_service = AIAnalysisService()
        ai_results = ai_service.analyze_run_breaks(run_doc.runId)

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
# Health Check
# ══════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
