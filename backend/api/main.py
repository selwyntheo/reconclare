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
)
from services.validation_engine import ValidationEngine, VALIDATION_CHECKS
from services.ai_analysis import AIAnalysisService


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
# Health Check
# ══════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
