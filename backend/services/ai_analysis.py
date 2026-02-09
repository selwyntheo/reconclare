"""
AI Analysis Service — Analyzes breaks detected by the validation engine.

After CPU validation finds breaks, this service:
1. Reads break records from MongoDB
2. Gathers context (positions, transactions, security info, ledger data)
3. Uses the LLM to analyze root cause
4. Produces confidence score, evidence chain, and recommended actions
5. Updates break records with AI analysis
6. Routes high-confidence breaks to AI_PASSED, low-confidence to HUMAN_REVIEW_PENDING
"""
import uuid
from datetime import datetime
from typing import Optional

from pymongo.database import Database

from config.settings import settings
from db.mongodb import get_sync_db, COLLECTIONS
from db.schemas import (
    AIAnalysisDoc, EvidenceStep, ActionItem, BreakState,
)


class AIAnalysisService:
    """Analyzes break records using LLM and canonical data context."""

    def __init__(self, db: Optional[Database] = None):
        self.db = db or get_sync_db()
        self._llm = None

    @property
    def llm(self):
        if self._llm is None:
            try:
                if settings.LLM_PROVIDER == "anthropic" and settings.ANTHROPIC_API_KEY:
                    from langchain_anthropic import ChatAnthropic
                    self._llm = ChatAnthropic(
                        model=settings.LLM_MODEL,
                        temperature=settings.LLM_TEMPERATURE,
                        anthropic_api_key=settings.ANTHROPIC_API_KEY,
                    )
                elif settings.OPENAI_API_KEY:
                    from langchain_openai import ChatOpenAI
                    self._llm = ChatOpenAI(
                        model=settings.LLM_MODEL,
                        temperature=settings.LLM_TEMPERATURE,
                        api_key=settings.OPENAI_API_KEY,
                    )
            except Exception as e:
                print(f"Failed to initialize LLM: {e}")
                self._llm = None
        return self._llm

    def analyze_run_breaks(self, run_id: str) -> list[dict]:
        """Analyze all breaks from a validation run."""
        breaks = list(self.db[COLLECTIONS["breakRecords"]].find({
            "validationRunId": run_id,
            "state": BreakState.DETECTED.value,
        }))

        results = []
        for brk in breaks:
            # Update state to ANALYZING
            self.db[COLLECTIONS["breakRecords"]].update_one(
                {"breakId": brk["breakId"]},
                {"$set": {"state": BreakState.ANALYZING.value}},
            )

            analysis = self._analyze_break(brk)
            results.append(analysis)

        # Log activity
        if breaks:
            event_id = self._get_event_for_run(run_id)
            if event_id:
                self._log_activity(
                    event_id=event_id,
                    msg=f"AI analysis complete for {len(breaks)} breaks in run {run_id}",
                    activity_type="AI_ANALYSIS",
                )

        return results

    def _analyze_break(self, brk: dict) -> dict:
        """Analyze a single break record."""
        break_id = brk["breakId"]
        fund_account = brk["fundAccount"]
        check_type = brk["checkType"]
        level = brk["level"]
        variance = brk["variance"]
        lhs_value = brk["lhsValue"]
        rhs_value = brk["rhsValue"]
        gl_category = brk.get("glCategory", "")
        security_id = brk.get("securityId", "")

        # Gather context from canonical data
        context = self._gather_context(brk)

        # Generate analysis using LLM or fallback
        analysis = self._generate_analysis(brk, context)

        # Determine break state based on confidence
        confidence = analysis.get("confidenceScore", 0)
        if confidence >= settings.CONFIDENCE_ESCALATION_THRESHOLD + 0.15:  # >= 0.85
            new_state = BreakState.AI_PASSED.value
        else:
            new_state = BreakState.HUMAN_REVIEW_PENDING.value

        # Build the AI analysis document
        analysis_doc = AIAnalysisDoc(
            analysisId=f"AI-{uuid.uuid4().hex[:8].upper()}",
            rootCauseSummary=analysis.get("rootCauseSummary", "Analysis pending"),
            confidenceScore=confidence,
            evidenceChain=analysis.get("evidenceChain", []),
            breakCategory=analysis.get("breakCategory", "UNKNOWN"),
            similarBreaks=analysis.get("similarBreaks", []),
            recommendedActions=analysis.get("recommendedActions", []),
        )

        # Update break record
        self.db[COLLECTIONS["breakRecords"]].update_one(
            {"breakId": break_id},
            {
                "$set": {
                    "state": new_state,
                    "aiAnalysis": analysis_doc.model_dump(),
                }
            },
        )

        # Update fund AI status on event
        run = self.db[COLLECTIONS["validationRuns"]].find_one(
            {"runId": brk["validationRunId"]}
        )
        if run:
            event_id = run.get("eventId")
            # Check if all breaks for this fund are analyzed
            fund_breaks = list(self.db[COLLECTIONS["breakRecords"]].find({
                "validationRunId": brk["validationRunId"],
                "fundAccount": fund_account,
            }))
            all_analyzed = all(
                b.get("state") not in (BreakState.DETECTED.value, BreakState.ANALYZING.value)
                for b in fund_breaks
            )
            avg_confidence = sum(
                (b.get("aiAnalysis", {}) or {}).get("confidenceScore", 0)
                for b in fund_breaks
            ) / max(len(fund_breaks), 1)

            if all_analyzed:
                self.db[COLLECTIONS["events"]].update_one(
                    {"eventId": event_id, "funds.account": fund_account},
                    {
                        "$set": {
                            "funds.$.aiStatus": "COMPLETE",
                            "funds.$.aiConfidence": round(avg_confidence, 2),
                            "funds.$.humanReview": "PENDING" if any(
                                b.get("state") == BreakState.HUMAN_REVIEW_PENDING.value
                                for b in fund_breaks
                            ) else "APPROVED",
                        }
                    },
                )

        return analysis_doc.model_dump()

    def _gather_context(self, brk: dict) -> dict:
        """Gather canonical data context for a break."""
        fund_account = brk["fundAccount"]
        # We don't have valuationDt on break, get it from the run
        run = self.db[COLLECTIONS["validationRuns"]].find_one(
            {"runId": brk["validationRunId"]}
        )
        valuation_dt = run.get("valuationDt", "") if run else ""

        context = {
            "fund_account": fund_account,
            "valuation_dt": valuation_dt,
            "check_type": brk["checkType"],
            "variance": brk["variance"],
            "gl_category": brk.get("glCategory", ""),
        }

        # Get fund info
        fund_ref = self.db[COLLECTIONS["refFund"]].find_one({"account": fund_account})
        if fund_ref:
            context["fund_name"] = fund_ref.get("accountName", "")

        # Get positions if relevant
        if brk.get("securityId"):
            sec = self.db[COLLECTIONS["refSecurity"]].find_one(
                {"assetId": brk["securityId"]}
            )
            if sec:
                context["security"] = {
                    "assetId": sec.get("assetId"),
                    "description": sec.get("issueDescription"),
                    "secType": sec.get("secType"),
                    "dayCount": sec.get("dayCount"),
                    "couponRate": sec.get("couponRate"),
                    "assetCurrency": sec.get("assetCurrency"),
                }

            # Get position data
            pos = self.db[COLLECTIONS["dataSubLedgerPosition"]].find_one({
                "account": fund_account,
                "assetId": brk["securityId"],
                "valuationDt": valuation_dt,
            })
            if pos:
                context["position"] = {
                    "shares": pos.get("posShares"),
                    "marketValue": pos.get("posMarketValueBase"),
                    "bookValue": pos.get("posBookValueBase"),
                    "income": pos.get("posIncomeBase"),
                    "price": pos.get("posMarketPrice"),
                }

        # Get ledger data
        ledger_entries = list(self.db[COLLECTIONS["ledger"]].find({
            "account": fund_account,
            "valuationDt": valuation_dt,
            "userBank": "CPU",
        }).limit(20))
        if ledger_entries:
            gl_refs = {r["glAccountNumber"]: r for r in self.db[COLLECTIONS["refLedger"]].find({})}
            context["ledger_summary"] = [
                {
                    "glAccount": e.get("glAccountNumber"),
                    "category": gl_refs.get(e.get("glAccountNumber", ""), {}).get("glCategory", ""),
                    "description": gl_refs.get(e.get("glAccountNumber", ""), {}).get("glDescription", ""),
                    "balance": e.get("endingBalance"),
                }
                for e in ledger_entries
            ]

        return context

    def _generate_analysis(self, brk: dict, context: dict) -> dict:
        """Generate AI analysis using LLM or deterministic fallback."""
        variance = brk["variance"]
        gl_category = brk.get("glCategory", "")
        check_type = brk["checkType"]
        security = context.get("security", {})
        position = context.get("position", {})

        # Try LLM analysis first
        if self.llm:
            try:
                return self._llm_analysis(brk, context)
            except Exception:
                pass

        # Deterministic fallback analysis
        return self._deterministic_analysis(brk, context)

    def _llm_analysis(self, brk: dict, context: dict) -> dict:
        """Use LLM to generate root cause analysis."""
        from langchain_core.messages import HumanMessage, SystemMessage

        system_prompt = (
            "You are a senior fund accounting analyst performing reconciliation analysis. "
            "Analyze the break and determine the root cause. Respond in JSON format with: "
            "rootCauseSummary (2-3 sentences), confidenceScore (0.0-1.0), "
            "breakCategory (one of: TIMING, METHODOLOGY, DATA, PRICING, FX, ACCRUAL, CORPORATE_ACTION, POSITION, MAPPING, UNKNOWN), "
            "evidenceChain (array of {stepNumber, description}), "
            "recommendedActions (array of {id, description})."
        )

        user_prompt = (
            f"Break Details:\n"
            f"- Check: {brk['checkType']}, Level: {brk['level']}\n"
            f"- Fund: {brk['fundAccount']} ({brk['fundName']})\n"
            f"- LHS Value: {brk['lhsValue']:,.2f}\n"
            f"- RHS Value: {brk['rhsValue']:,.2f}\n"
            f"- Variance: {brk['variance']:,.2f}\n"
            f"- GL Category: {brk.get('glCategory', 'N/A')}\n"
        )

        if context.get("security"):
            sec = context["security"]
            user_prompt += (
                f"\nSecurity Context:\n"
                f"- Asset: {sec.get('assetId')} - {sec.get('description')}\n"
                f"- Type: {sec.get('secType')}, Currency: {sec.get('assetCurrency')}\n"
                f"- Day Count: {sec.get('dayCount')}, Coupon: {sec.get('couponRate')}\n"
            )

        if context.get("position"):
            pos = context["position"]
            user_prompt += (
                f"\nPosition Context:\n"
                f"- Shares: {pos.get('shares')}, Price: {pos.get('price')}\n"
                f"- Market Value: {pos.get('marketValue'):,.2f}\n"
                f"- Book Value: {pos.get('bookValue'):,.2f}\n"
                f"- Accrued Income: {pos.get('income')}\n"
            )

        if context.get("ledger_summary"):
            user_prompt += "\nLedger Summary:\n"
            for entry in context["ledger_summary"][:10]:
                user_prompt += (
                    f"- {entry['category']}: {entry['description']} = {entry['balance']:,.2f}\n"
                )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]

        # Anthropic doesn't support response_format; OpenAI does
        if settings.LLM_PROVIDER == "anthropic":
            response = self.llm.invoke(messages)
        else:
            response = self.llm.invoke(
                messages,
                response_format={"type": "json_object"},
            )

        import json
        # Extract JSON from response (Anthropic may wrap it in markdown)
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(content)

        # Normalize the response
        evidence = [
            EvidenceStep(stepNumber=e.get("stepNumber", i + 1), description=e.get("description", ""))
            for i, e in enumerate(result.get("evidenceChain", []))
        ]
        actions = [
            ActionItem(id=a.get("id", f"act-{i}"), description=a.get("description", ""))
            for i, a in enumerate(result.get("recommendedActions", []))
        ]

        return {
            "rootCauseSummary": result.get("rootCauseSummary", ""),
            "confidenceScore": min(max(float(result.get("confidenceScore", 0.5)), 0), 1),
            "breakCategory": result.get("breakCategory", "UNKNOWN"),
            "evidenceChain": [e.model_dump() for e in evidence],
            "recommendedActions": [a.model_dump() for a in actions],
            "similarBreaks": [],
        }

    def _deterministic_analysis(self, brk: dict, context: dict) -> dict:
        """Fallback deterministic analysis when LLM is unavailable."""
        variance = brk["variance"]
        gl_category = brk.get("glCategory", "")
        check_type = brk["checkType"]
        security = context.get("security", {})

        # Classify based on patterns
        if "Income" in gl_category or "Accrual" in gl_category:
            category = "ACCRUAL"
            if security.get("dayCount"):
                summary = (
                    f"Accrual variance of ${abs(variance):,.2f} detected in {gl_category}. "
                    f"Security {security.get('assetId', 'N/A')} uses {security.get('dayCount', 'N/A')} day count convention. "
                    f"Likely day count or accrual period mismatch between CPU and incumbent systems."
                )
                confidence = 0.82
            else:
                summary = (
                    f"Income accrual variance of ${abs(variance):,.2f} in {gl_category}. "
                    f"Possible causes: day count convention mismatch, accrual start date difference, or rate discrepancy."
                )
                confidence = 0.72
            evidence = [
                {"stepNumber": 1, "description": f"Variance of ${abs(variance):,.2f} traced to {gl_category}"},
                {"stepNumber": 2, "description": f"Check type: {check_type}, Level: {brk['level']}"},
            ]
            actions = [
                {"id": "act-1", "description": "Compare day count conventions between CPU and incumbent"},
                {"id": "act-2", "description": "Verify accrual period start/end dates"},
            ]
        elif "Market" in gl_category or "Investment" in gl_category:
            category = "PRICING"
            summary = (
                f"Market value variance of ${abs(variance):,.2f} in {gl_category}. "
                f"Likely pricing source difference or snap time mismatch between systems."
            )
            confidence = 0.78
            evidence = [
                {"stepNumber": 1, "description": f"Market value variance of ${abs(variance):,.2f}"},
                {"stepNumber": 2, "description": "Pricing source or snap time difference suspected"},
            ]
            actions = [
                {"id": "act-1", "description": "Verify pricing sources and cutoff times"},
            ]
        elif "Receivable" in gl_category or "Payable" in gl_category:
            category = "TIMING"
            summary = (
                f"Timing difference of ${abs(variance):,.2f} in {gl_category}. "
                f"Settlement date or posting date difference between systems."
            )
            confidence = 0.88
            evidence = [
                {"stepNumber": 1, "description": f"Timing variance of ${abs(variance):,.2f} in {gl_category}"},
                {"stepNumber": 2, "description": "Settlement timing difference between CPU and incumbent"},
            ]
            actions = [
                {"id": "act-1", "description": "Verify settlement dates align between systems"},
            ]
        elif "NAV" in gl_category or check_type == "NAV_TO_LEDGER":
            category = "DATA"
            summary = (
                f"NAV-level variance of ${abs(variance):,.2f}. "
                f"Multiple components may contribute. Further drill-down into GL categories recommended."
            )
            confidence = 0.65
            evidence = [
                {"stepNumber": 1, "description": f"NAV variance of ${abs(variance):,.2f} detected"},
                {"stepNumber": 2, "description": "Requires L1 GL decomposition for root cause"},
            ]
            actions = [
                {"id": "act-1", "description": "Review GL category breakdown for variance drivers"},
            ]
        else:
            category = "UNKNOWN"
            summary = (
                f"Variance of ${abs(variance):,.2f} detected in {gl_category or check_type}. "
                f"Manual investigation required to determine root cause."
            )
            confidence = 0.50
            evidence = [
                {"stepNumber": 1, "description": f"Variance of ${abs(variance):,.2f} in {gl_category or check_type}"},
            ]
            actions = [
                {"id": "act-1", "description": "Manual investigation required"},
            ]

        if security.get("assetId"):
            evidence.append({
                "stepNumber": len(evidence) + 1,
                "description": f"Security {security['assetId']} ({security.get('description', 'N/A')}) involved",
            })

        return {
            "rootCauseSummary": summary,
            "confidenceScore": confidence,
            "breakCategory": category,
            "evidenceChain": evidence,
            "recommendedActions": actions,
            "similarBreaks": [],
        }

    def _get_event_for_run(self, run_id: str) -> Optional[str]:
        run = self.db[COLLECTIONS["validationRuns"]].find_one({"runId": run_id})
        return run.get("eventId") if run else None

    def _log_activity(self, event_id: str, msg: str, activity_type: str):
        self.db[COLLECTIONS["activityFeed"]].insert_one({
            "id": f"act-{uuid.uuid4().hex[:8]}",
            "type": activity_type,
            "message": msg,
            "eventId": event_id,
            "timestamp": datetime.utcnow().isoformat(),
            "userId": "ai-agent",
            "userName": "AI Agent",
        })
