"""MMIF Regulatory Filing API endpoints."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from db.mongodb import get_async_db, COLLECTIONS
from db.schemas import (
    MmifEventDoc, MmifEventStatus, RunMmifValidationRequest,
    MmifValidationRunDoc, MmifBreakRecordDoc, MmifSectionSummary,
    ValidationResultStatus,
)

router = APIRouter(prefix="/api/mmif", tags=["mmif"])


# ── MMIF Events ──────────────────────────────────────────────

@router.get("/events")
async def list_mmif_events(status: Optional[str] = Query(None)):
    """List all MMIF regulatory filing events."""
    db = get_async_db()
    query: dict = {}
    if status and status != "ALL":
        query["status"] = status
    events = await db[COLLECTIONS["mmifEvents"]].find(
        query, {"_id": 0}
    ).sort("filingDeadline", 1).to_list(100)
    return events


@router.get("/events/{event_id}")
async def get_mmif_event(event_id: str):
    """Get a single MMIF event."""
    db = get_async_db()
    event = await db[COLLECTIONS["mmifEvents"]].find_one(
        {"eventId": event_id}, {"_id": 0}
    )
    if not event:
        raise HTTPException(404, f"MMIF Event {event_id} not found")
    return event


@router.post("/events")
async def create_mmif_event(event: MmifEventDoc):
    """Create a new MMIF regulatory filing event."""
    db = get_async_db()
    existing = await db[COLLECTIONS["mmifEvents"]].find_one(
        {"eventId": event.eventId}
    )
    if existing:
        raise HTTPException(409, f"Event {event.eventId} already exists")
    await db[COLLECTIONS["mmifEvents"]].insert_one(event.model_dump())
    return {"status": "created", "eventId": event.eventId}


@router.put("/events/{event_id}")
async def update_mmif_event(event_id: str, updates: dict):
    """Update an MMIF event."""
    db = get_async_db()
    updates.pop("eventId", None)
    updates.pop("_id", None)
    result = await db[COLLECTIONS["mmifEvents"]].update_one(
        {"eventId": event_id}, {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(404, f"MMIF Event {event_id} not found")
    return {"status": "updated"}


# ── MMIF Validation Runs ─────────────────────────────────────

@router.post("/events/{event_id}/validate")
async def run_mmif_validation(event_id: str, request: RunMmifValidationRequest):
    """Trigger MMIF validation run."""
    from mmif.engine import MmifValidationEngine
    engine = MmifValidationEngine()
    try:
        run_doc = await engine.run_validation(
            event_id=event_id,
            filing_period=request.filingPeriod,
            check_suite=request.checkSuite,
            fund_selection=request.fundSelection,
        )
        return run_doc.model_dump()
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/events/{event_id}/runs")
async def list_mmif_runs(event_id: str):
    """List validation runs for an MMIF event."""
    db = get_async_db()
    runs = await db[COLLECTIONS["mmifValidationRuns"]].find(
        {"eventId": event_id}, {"_id": 0}
    ).sort("executionTime", -1).to_list(100)
    return runs


@router.get("/events/{event_id}/runs/{run_id}")
async def get_mmif_run(event_id: str, run_id: str):
    """Get a specific validation run."""
    db = get_async_db()
    run = await db[COLLECTIONS["mmifValidationRuns"]].find_one(
        {"eventId": event_id, "runId": run_id}, {"_id": 0}
    )
    if not run:
        raise HTTPException(404, f"Run {run_id} not found")
    return run


# ── MMIF Breaks ──────────────────────────────────────────────

@router.get("/events/{event_id}/breaks")
async def list_mmif_breaks(
    event_id: str,
    rule_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
):
    """List breaks for an MMIF event, optionally filtered by rule or severity."""
    db = get_async_db()
    query: dict = {"eventId": event_id}
    if rule_id:
        query["ruleId"] = rule_id
    if severity:
        query["severity"] = severity
    breaks = await db[COLLECTIONS["mmifBreakRecords"]].find(
        query, {"_id": 0}
    ).to_list(1000)
    return breaks


# ── MMIF Dashboard Summary ───────────────────────────────────

@router.get("/events/{event_id}/summary")
async def get_mmif_summary(event_id: str):
    """Get MMIF dashboard summary with section totals and break counts."""
    db = get_async_db()

    event = await db[COLLECTIONS["mmifEvents"]].find_one(
        {"eventId": event_id}, {"_id": 0}
    )
    if not event:
        raise HTTPException(404, f"MMIF Event {event_id} not found")

    # Get latest validation run
    latest_run = await db[COLLECTIONS["mmifValidationRuns"]].find_one(
        {"eventId": event_id},
        {"_id": 0},
        sort=[("executionTime", -1)],
    )

    # Get break counts by rule
    breaks = await db[COLLECTIONS["mmifBreakRecords"]].find(
        {"eventId": event_id}, {"_id": 0}
    ).to_list(5000)

    break_by_rule: dict = {}
    break_by_severity: dict = {}
    for b in breaks:
        rid = b.get("ruleId", "UNKNOWN")
        sev = b.get("severity", "UNKNOWN")
        break_by_rule[rid] = break_by_rule.get(rid, 0) + 1
        break_by_severity[sev] = break_by_severity.get(sev, 0) + 1

    total_breaks = len(breaks)
    total_funds = len(event.get("funds", []))
    funds_with_breaks = len(set(b.get("fundAccount") for b in breaks))

    return {
        "eventId": event_id,
        "eventName": event.get("eventName"),
        "status": event.get("status"),
        "filingPeriod": event.get("filingPeriod"),
        "filingDeadline": event.get("filingDeadline"),
        "totalFunds": total_funds,
        "fundsWithBreaks": funds_with_breaks,
        "totalBreaks": total_breaks,
        "breaksByRule": break_by_rule,
        "breaksBySeverity": break_by_severity,
        "latestRun": latest_run,
    }


# ── MMIF Mapping Config ─────────────────────────────────────

@router.get("/events/{event_id}/mapping")
async def get_mmif_mapping(event_id: str, account: Optional[str] = Query(None)):
    """Get MMIF mapping configurations for an event."""
    db = get_async_db()
    query: dict = {"eventId": event_id}
    if account:
        query["account"] = account
    configs = await db[COLLECTIONS["mmifMappingConfigs"]].find(
        query, {"_id": 0}
    ).to_list(100)
    return configs


@router.put("/events/{event_id}/mapping")
async def update_mmif_mapping(event_id: str, config: dict):
    """Update or create MMIF mapping configuration."""
    db = get_async_db()
    account = config.get("account")
    if not account:
        raise HTTPException(400, "account is required")

    config["eventId"] = event_id
    config["updatedAt"] = datetime.utcnow().isoformat()

    result = await db[COLLECTIONS["mmifMappingConfigs"]].update_one(
        {"eventId": event_id, "account": account},
        {"$set": config},
        upsert=True,
    )
    return {"status": "updated", "matched": result.matched_count}


@router.delete("/events/{event_id}/mapping/{account}")
async def delete_mmif_mapping(event_id: str, account: str):
    """Delete a mapping configuration for a specific fund."""
    db = get_async_db()
    result = await db[COLLECTIONS["mmifMappingConfigs"]].delete_one(
        {"eventId": event_id, "account": account}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Mapping config not found")
    return {"status": "deleted"}


# ── MMIF Reconciliation Detail ──────────────────────────────

@router.get("/events/{event_id}/reconciliation/{account}")
async def get_reconciliation_detail(event_id: str, account: str):
    """Return full reconciliation detail (Accounting vs MMIF side-by-side) for a fund."""
    db = get_async_db()
    doc = await db[COLLECTIONS["mmifReconciliationDetails"]].find_one(
        {"eventId": event_id, "account": account},
        {"_id": 0},
    )
    if doc is None:
        raise HTTPException(404, f"No reconciliation detail for {account} in {event_id}")
    return doc


@router.get("/events/{event_id}/reconciliation")
async def list_reconciliation_details(event_id: str):
    """Return all reconciliation details for an event."""
    db = get_async_db()
    cursor = db[COLLECTIONS["mmifReconciliationDetails"]].find(
        {"eventId": event_id},
        {"_id": 0},
    )
    return await cursor.to_list(length=100)


# ── MMIF Mapping Templates ──────────────────────────────────

@router.get("/mapping-templates")
async def list_mapping_templates():
    """Return summary of available fund type mapping templates."""
    from mmif.mapping_templates import list_templates
    return list_templates()


@router.get("/mapping-templates/{fund_type}")
async def get_mapping_template(fund_type: str):
    """Return full mapping template for a fund type."""
    from mmif.mapping_templates import get_mapping_template as _get
    template = _get(fund_type)
    if template is None:
        raise HTTPException(404, f"No template for fund type: {fund_type}")
    return template


# ── MMIF Validation Rules Reference ─────────────────────────

@router.get("/validation-rules")
async def list_validation_rules():
    """Return all MMIF validation rules (DSL overrides + legacy fallback)."""
    from mmif.dsl_rule_loader import DslRuleLoader
    loader = DslRuleLoader()
    return await loader.load_all_rules()


@router.get("/check-suite-options")
async def list_check_suite_options():
    """Return check suite options for the UI (merged DSL + legacy)."""
    from mmif.dsl_rule_loader import DslRuleLoader
    loader = DslRuleLoader()
    rules = await loader.load_all_rules()
    return [
        {
            "value": r["ruleId"],
            "label": f'{r["ruleId"].replace("_", "-")}: {r["ruleName"]}',
        }
        for r in rules
    ]


@router.get("/validation-rules/functions")
async def list_cel_functions():
    """Return available CEL functions for the DSL editor."""
    from services.mapping.cel_evaluator import FUNCTION_DOCS
    return FUNCTION_DOCS


@router.post("/validation-rules/validate-expr")
async def validate_cel_expression(request: dict):
    """Validate a CEL expression without saving."""
    from mmif.dsl_rule_loader import DslRuleLoader
    expr = request.get("expression", "")
    is_valid, error = DslRuleLoader.validate_expression(expr)
    return {"isValid": is_valid, "error": error}


@router.post("/validation-rules/ai-suggest")
async def ai_suggest_rule(request: dict):
    """Generate a validation rule suggestion from natural language."""
    from mmif.ai_rule_suggest import MmifRuleSuggester

    prompt = request.get("prompt", "")
    if not prompt:
        raise HTTPException(400, "prompt is required")

    suggester = MmifRuleSuggester()
    try:
        result = await suggester.suggest_rule(
            prompt=prompt,
            data_source=request.get("dataSource"),
            existing_lhs_expr=request.get("existingLhsExpr"),
            existing_rhs_expr=request.get("existingRhsExpr"),
        )
        return result
    except Exception as e:
        raise HTTPException(500, f"AI suggestion failed: {str(e)}")


@router.get("/validation-rules/{rule_id}")
async def get_validation_rule(rule_id: str):
    """Get a single validation rule by ID."""
    from mmif.dsl_rule_loader import DslRuleLoader
    loader = DslRuleLoader()
    try:
        rule = await loader.load_rule(rule_id)
        return rule
    except ValueError:
        raise HTTPException(404, f"Rule {rule_id} not found")


@router.post("/validation-rules")
async def create_validation_rule(rule: dict):
    """Create a new DSL validation rule."""
    from mmif.dsl_rule_loader import DslRuleLoader
    db = get_async_db()

    rule_id = rule.get("ruleId")
    if not rule_id:
        raise HTTPException(400, "ruleId is required")

    # Validate CEL expressions
    lhs = rule.get("lhs", {})
    rhs = rule.get("rhs", {})
    for side_name, side in [("lhs", lhs), ("rhs", rhs)]:
        expr = side.get("expr", "")
        if expr:
            is_valid, error = DslRuleLoader.validate_expression(expr)
            if not is_valid:
                raise HTTPException(400, f"Invalid {side_name} expression: {error}")

    # Check for existing
    existing = await db[COLLECTIONS["mmifValidationRuleDefs"]].find_one(
        {"ruleId": rule_id, "deletedAt": None}
    )
    if existing:
        raise HTTPException(409, f"Rule {rule_id} already exists")

    rule["isDsl"] = True
    rule["version"] = 1
    rule["isActive"] = rule.get("isActive", True)
    rule["createdAt"] = datetime.utcnow().isoformat()
    rule["updatedAt"] = rule["createdAt"]
    rule["deletedAt"] = None

    await db[COLLECTIONS["mmifValidationRuleDefs"]].insert_one(rule)
    rule.pop("_id", None)
    return {"status": "created", "ruleId": rule_id}


@router.put("/validation-rules/{rule_id}")
async def update_validation_rule(rule_id: str, updates: dict):
    """Update an existing DSL validation rule."""
    from mmif.dsl_rule_loader import DslRuleLoader
    db = get_async_db()

    existing = await db[COLLECTIONS["mmifValidationRuleDefs"]].find_one(
        {"ruleId": rule_id, "deletedAt": None}
    )
    if not existing:
        raise HTTPException(404, f"DSL Rule {rule_id} not found")

    # Validate CEL expressions if provided
    for side_name in ("lhs", "rhs"):
        side = updates.get(side_name)
        if side and side.get("expr"):
            is_valid, error = DslRuleLoader.validate_expression(side["expr"])
            if not is_valid:
                raise HTTPException(400, f"Invalid {side_name} expression: {error}")

    updates.pop("ruleId", None)
    updates.pop("_id", None)
    updates["updatedAt"] = datetime.utcnow().isoformat()
    updates["version"] = existing.get("version", 1) + 1

    await db[COLLECTIONS["mmifValidationRuleDefs"]].update_one(
        {"ruleId": rule_id, "deletedAt": None},
        {"$set": updates},
    )
    return {"status": "updated", "ruleId": rule_id, "version": updates["version"]}


@router.delete("/validation-rules/{rule_id}")
async def delete_validation_rule(rule_id: str):
    """Soft delete a DSL validation rule."""
    db = get_async_db()
    result = await db[COLLECTIONS["mmifValidationRuleDefs"]].update_one(
        {"ruleId": rule_id, "deletedAt": None},
        {"$set": {"deletedAt": datetime.utcnow().isoformat(), "isActive": False}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, f"DSL Rule {rule_id} not found")
    return {"status": "deleted", "ruleId": rule_id}


@router.post("/validation-rules/test")
async def test_dsl_rule(request: dict):
    """Test a DSL rule against real data without saving."""
    from services.mapping.cel_evaluator import CelEvaluator, python_to_cel, cel_to_python
    from mmif.validation_rules import evaluate_rule
    from db.schemas import MmifSeverity

    db = get_async_db()
    evaluator = CelEvaluator()

    lhs_expr = request.get("lhsExpr", "0.0")
    rhs_expr = request.get("rhsExpr", "0.0")
    data_source = request.get("dataSource", "mmifLedgerData")
    fund_account = request.get("fundAccount", "")
    filing_period = request.get("filingPeriod", "")
    tolerance = float(request.get("tolerance", 0.0))
    severity_str = request.get("severity", "HARD")
    lhs_label = request.get("lhsLabel", "LHS")
    rhs_label = request.get("rhsLabel", "RHS")

    try:
        collection = COLLECTIONS.get(data_source, data_source)
        rule_id = request.get("ruleId", "")
        query: dict = {"account": fund_account, "filingPeriod": filing_period}
        if data_source == "mmifSampleData" and rule_id:
            query["ruleId"] = rule_id
        cursor = db[collection].find(query, {"_id": 0})
        rows = await cursor.to_list(10000)

        cel_rows = python_to_cel(rows)
        activation = {
            "ledger": cel_rows,
            "sample": cel_rows,
            "meta": python_to_cel({
                "account": fund_account,
                "filingPeriod": filing_period,
            }),
        }

        _, lhs_prog = evaluator.compile(lhs_expr)
        _, rhs_prog = evaluator.compile(rhs_expr)

        lhs_value = float(cel_to_python(lhs_prog.evaluate(activation)))
        rhs_value = float(cel_to_python(rhs_prog.evaluate(activation)))
        variance = abs(lhs_value - rhs_value)

        # Determine status
        severity = MmifSeverity(severity_str)
        from db.schemas import ValidationResultStatus
        if variance <= tolerance:
            status = ValidationResultStatus.PASSED
        elif severity == MmifSeverity.SOFT:
            status = ValidationResultStatus.WARNING
        else:
            status = ValidationResultStatus.FAILED

        return {
            "lhsValue": lhs_value,
            "rhsValue": rhs_value,
            "variance": variance,
            "status": status.value,
            "lhsLabel": lhs_label,
            "rhsLabel": rhs_label,
            "rowCount": len(rows),
            "error": None,
        }
    except Exception as e:
        return {
            "lhsValue": 0,
            "rhsValue": 0,
            "variance": 0,
            "status": "FAILED",
            "lhsLabel": lhs_label,
            "rhsLabel": rhs_label,
            "rowCount": 0,
            "error": str(e),
        }


# ── MMIF Agent Analysis Endpoints ─────────────────────────────

def _finding_to_dict(f) -> dict:
    """Convert an AgentFinding to a JSON-serializable dict."""
    return {
        "agentName": f.agent_name,
        "level": f.level,
        "timestamp": f.timestamp,
        "description": f.description,
        "evidence": f.evidence if isinstance(f.evidence, dict) else {},
        "confidence": f.confidence,
        "recommendedAction": f.recommended_action,
    }


def _build_pipeline_steps(state) -> list:
    """Build pipeline step summaries from the agent trace."""
    from agents.mmif_state import MmifAnalysisPhase

    steps = [
        ("supervisor_init", "Supervisor Init", state.l0_findings is not None),
        ("l0_total_assets", "L0: Total Assets", True),
        ("l1_section", "L1: Section Subtotals", bool(state.l1_findings)),
        ("l2_security", "L2: Security Match", bool(state.l2_findings)),
        ("l3_movement", "L3: Movement Recon", bool(state.l3_findings)),
        ("specialists", "Specialist Agents", bool(state.specialist_findings)),
        ("attestation", "Attestation", bool(state.attestation_report)),
        ("supervisor_finalize", "Complete", state.phase == MmifAnalysisPhase.COMPLETED),
    ]
    result = []
    phase_reached = True
    for name, label, was_run in steps:
        if was_run and phase_reached:
            findings_for_step = [f for f in state.all_findings if name.split("_")[0] in f.level.lower() or (name == "specialists" and "specialist" in f.level.lower())]
            result.append({
                "name": name,
                "label": label,
                "status": "complete",
                "findingsCount": len(findings_for_step),
            })
        elif phase_reached:
            result.append({"name": name, "label": label, "status": "skipped", "findingsCount": 0})
            if name not in ("supervisor_init",):
                phase_reached = False
        else:
            result.append({"name": name, "label": label, "status": "skipped", "findingsCount": 0})
    return result


def _state_to_analysis_response(state, event_id: str) -> dict:
    """Convert a final MmifAgentState to the MmifAgentAnalysis shape the frontend expects."""
    attestation_report = None
    if state.attestation_report:
        ar = state.attestation_report
        attestation_report = {
            "attestationId": ar.get("attestation_id", f"ATT-{event_id}"),
            "fundAccount": ar.get("fund_account", state.mmif_break.fund_account if state.mmif_break else ""),
            "filingPeriod": ar.get("filing_period", state.mmif_break.filing_period if state.mmif_break else ""),
            "totalRules": ar.get("total_rules", 15),
            "passed": ar.get("passed", 0),
            "warnings": ar.get("warnings", 0),
            "failed": ar.get("failed", 0),
            "hardFailures": ar.get("hard_failures", 0),
            "submissionClearance": state.filing_clearance,
            "readinessScore": round(state.attestation_readiness_score * 100),
            "ruleResults": [
                {
                    "ruleId": rr.get("rule_id", ""),
                    "ruleName": rr.get("rule_name", ""),
                    "severity": rr.get("severity", ""),
                    "status": rr.get("status", "PASSED"),
                    "variance": rr.get("variance"),
                    "rootCause": rr.get("root_cause"),
                    "confidence": rr.get("confidence"),
                }
                for rr in ar.get("rule_results", [])
            ],
        }

    return {
        "eventId": event_id,
        "phase": state.phase.value,
        "overallConfidence": state.overall_confidence,
        "rootCauseNarrative": state.root_cause_narrative,
        "l0Findings": [_finding_to_dict(f) for f in state.l0_findings],
        "l1Findings": [_finding_to_dict(f) for f in state.l1_findings],
        "l2Findings": [_finding_to_dict(f) for f in state.l2_findings],
        "l3Findings": [_finding_to_dict(f) for f in state.l3_findings],
        "specialistFindings": [_finding_to_dict(f) for f in state.specialist_findings],
        "rootCauses": [
            {
                "agent": rc.get("agent", ""),
                "level": rc.get("level", ""),
                "description": rc.get("description", ""),
                "confidence": rc.get("confidence", 0),
            }
            for rc in state.root_causes
        ],
        "shouldEscalate": state.should_escalate,
        "attestationStatus": "CLEARED" if state.filing_clearance else "BLOCKED" if state.attestation_report else "PENDING",
        "attestationReport": attestation_report,
        "pipelineSteps": _build_pipeline_steps(state),
    }


@router.post("/events/{event_id}/analyze")
async def trigger_agent_analysis(event_id: str):
    """
    Trigger the MMIF 6-agent analysis pipeline for an entire event.

    Finds all breaks for the event and runs the full workflow:
    Supervisor → L0 → L1 → L2 → L3 → Specialists → Attestation → Supervisor

    If no breaks exist, runs a synthetic analysis to evaluate overall filing readiness.
    Returns the aggregated MmifAgentAnalysis matching the frontend type contract.
    """
    import asyncio
    db = get_async_db()

    # Fetch event to ensure it exists
    event = await db[COLLECTIONS["mmifEvents"]].find_one(
        {"eventId": event_id}, {"_id": 0}
    )
    if not event:
        raise HTTPException(404, f"Event {event_id} not found")

    # Fetch all breaks for this event
    breaks = await db[COLLECTIONS["mmifBreakRecords"]].find(
        {"eventId": event_id}, {"_id": 0}
    ).to_list(500)

    from agents.mmif_state import MmifBreakInput

    # Build break inputs — if no breaks, create a synthetic one for the first fund
    mmif_break_inputs = []
    if breaks:
        for brk in breaks:
            mmif_break_inputs.append(MmifBreakInput(
                break_id=brk["breakId"],
                event_id=brk["eventId"],
                fund_account=brk["fundAccount"],
                fund_name=brk.get("fundName", brk["fundAccount"]),
                filing_period=event.get("filingPeriod", ""),
                rule_id=brk["ruleId"],
                rule_name=brk["ruleName"],
                severity=brk["severity"],
                mmif_section=brk.get("mmifSection"),
                eagle_value=float(brk.get("lhsValue", 0)),
                mmif_value=float(brk.get("rhsValue", 0)),
                variance=float(brk.get("variance", 0)),
                tolerance=float(brk.get("tolerance", 0)),
                metadata={},
            ))
    else:
        # Synthetic scan — use first fund for a VR-001 total assets check
        funds = event.get("funds", [])
        first_fund = funds[0] if funds else {"account": event_id, "fundName": event.get("eventName", event_id)}
        mmif_break_inputs.append(MmifBreakInput(
            break_id=f"SYNTH-{event_id}",
            event_id=event_id,
            fund_account=first_fund.get("account", ""),
            fund_name=first_fund.get("fundName", ""),
            filing_period=event.get("filingPeriod", ""),
            rule_id="VR_001",
            rule_name="Total Assets Tie-Out (Synthetic Scan)",
            severity="HARD",
            mmif_section="4.3",
            eagle_value=0.0,
            mmif_value=0.0,
            variance=0.0,
            tolerance=0.0,
            metadata={"synthetic": True},
        ))

    # Run analysis for each break (or synthetic input)
    def _run_all():
        from agents.mmif_workflow import run_mmif_analysis
        results = []
        for bi in mmif_break_inputs:
            try:
                final_state = run_mmif_analysis(bi)
                results.append(final_state)
            except Exception as e:
                # Log but continue with remaining breaks
                import traceback
                traceback.print_exc()
        return results

    try:
        loop = asyncio.get_event_loop()
        all_states = await loop.run_in_executor(None, _run_all)

        if not all_states:
            raise HTTPException(500, "Agent analysis produced no results")

        # If single break, return its analysis directly
        if len(all_states) == 1:
            response = _state_to_analysis_response(all_states[0], event_id)
        else:
            # Aggregate multiple break analyses into one response
            merged = all_states[0]  # Use first as base
            for state in all_states[1:]:
                merged.l0_findings.extend(state.l0_findings)
                merged.l1_findings.extend(state.l1_findings)
                merged.l2_findings.extend(state.l2_findings)
                merged.l3_findings.extend(state.l3_findings)
                merged.specialist_findings.extend(state.specialist_findings)
                merged.all_findings.extend(state.all_findings)
                merged.root_causes.extend(state.root_causes)

            # Use worst-case attestation
            merged.overall_confidence = sum(s.overall_confidence for s in all_states) / len(all_states)
            merged.filing_clearance = all(s.filing_clearance for s in all_states)
            merged.attestation_readiness_score = min(s.attestation_readiness_score for s in all_states)
            merged.should_escalate = any(s.should_escalate for s in all_states)

            # Build combined narrative
            narratives = [s.root_cause_narrative for s in all_states if s.root_cause_narrative]
            merged.root_cause_narrative = " | ".join(narratives) if narratives else "Analysis complete."

            # Merge attestation report rule results from all states
            all_rule_results = []
            seen_rules = set()
            for s in all_states:
                if s.attestation_report and "rule_results" in s.attestation_report:
                    for rr in s.attestation_report["rule_results"]:
                        key = rr.get("rule_id", "")
                        if key not in seen_rules:
                            seen_rules.add(key)
                            all_rule_results.append(rr)

            if all_rule_results and merged.attestation_report:
                merged.attestation_report["rule_results"] = all_rule_results

            response = _state_to_analysis_response(merged, event_id)

        # Persist the analysis result
        from datetime import datetime
        response["createdAt"] = datetime.utcnow().isoformat()
        await db[COLLECTIONS["mmifAgentAnalysis"]].update_one(
            {"eventId": event_id},
            {"$set": response},
            upsert=True,
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Agent analysis failed: {str(e)}")


@router.get("/events/{event_id}/agent-analysis")
async def get_agent_analysis(event_id: str):
    """
    Get the latest MMIF agent analysis for an event.
    Returns the aggregated MmifAgentAnalysis matching the frontend type.
    """
    db = get_async_db()
    analysis = await db[COLLECTIONS["mmifAgentAnalysis"]].find_one(
        {"eventId": event_id}, {"_id": 0}
    )

    if not analysis:
        return None

    return analysis


@router.get("/events/{event_id}/attestation")
async def get_attestation_report(event_id: str):
    """
    Get the MMIF attestation report from the latest agent analysis.
    Returns the attestationReport field from the stored analysis.
    """
    db = get_async_db()
    analysis = await db[COLLECTIONS["mmifAgentAnalysis"]].find_one(
        {"eventId": event_id}, {"_id": 0, "attestationReport": 1, "attestationStatus": 1}
    )

    if not analysis or not analysis.get("attestationReport"):
        raise HTTPException(
            404,
            f"No attestation data found for event {event_id}. Run agent analysis first.",
        )

    return analysis["attestationReport"]
