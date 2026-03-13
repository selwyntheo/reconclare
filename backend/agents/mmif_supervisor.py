"""
MMIF Supervisor Agent — Central orchestrator for the MMIF 6-Agent workflow.

Responsibilities:
- Initialize the MMIF analysis: load event context, determine strategy
- Finalize the analysis: aggregate findings, compute confidence, generate narrative,
  check attestation readiness
- Manage escalation decisions

Follows supervisor.py patterns exactly, adapted for MmifAgentState.
"""
from datetime import datetime
from typing import Optional

from agents.mmif_level_agents import MmifBaseAgent
from agents.mmif_state import (
    MmifAgentState, MmifAnalysisPhase, MmifBreakInput,
    AgentFinding, MmifEscalationReason,
)
from db.mongodb import COLLECTIONS


class MmifSupervisorAgent(MmifBaseAgent):
    """
    Central coordinator for the MMIF multi-agent analysis workflow.
    Orchestrates the full L0→L1→L2→L3→Specialist→Attestation pipeline.
    """

    # Confidence weights per analysis level (must sum sensibly)
    LEVEL_WEIGHTS = {
        "L0_TOTAL_ASSETS": 0.10,
        "L1_SECTION_SUBTOTALS": 0.20,
        "L2_SECURITY_MATCH": 0.25,
        "L3_MOVEMENT_RECON": 0.25,
        "SPECIALIST_SCHEMA_MAPPER": 0.10,
        "SPECIALIST_BALANCE_EXTRACTOR": 0.10,
        "SPECIALIST_BREAK_ANALYST": 0.15,
        "SPECIALIST_ATTESTATION": 0.15,
    }

    def __init__(self):
        super().__init__(
            name="MmifSupervisor",
            description="Central orchestrator for MMIF regulatory filing reconciliation analysis",
        )

    def analyze(self, state: MmifAgentState) -> MmifAgentState:
        """
        The Supervisor is called at two points:
        1. At workflow start to initialize and load context (INITIATED phase)
        2. At workflow end to aggregate findings and produce final report
        """
        if state.phase == MmifAnalysisPhase.INITIATED:
            return self._initialize_analysis(state)
        else:
            return self._finalize_analysis(state)

    # =========================================================================
    # Initialization
    # =========================================================================

    def _initialize_analysis(self, state: MmifAgentState) -> MmifAgentState:
        """Initialize the MMIF analysis: load event and fund context."""
        brk = state.mmif_break
        if not brk:
            state.add_trace(self.name, "error", {"msg": "No MmifBreakInput provided"})
            state.phase = MmifAnalysisPhase.COMPLETED
            return state

        state.add_trace(self.name, "initializing", {
            "break_id": brk.break_id,
            "event_id": brk.event_id,
            "fund_account": brk.fund_account,
            "rule_id": brk.rule_id,
            "variance": brk.variance,
        })

        # Load MMIF event document
        event_doc = self.query_mongo_one(
            COLLECTIONS["mmifEvents"],
            {"eventId": brk.event_id},
        )
        state.event_doc = event_doc

        # Load fund document from event
        if event_doc:
            funds = event_doc.get("funds", [])
            for fund in funds:
                if fund.get("account") == brk.fund_account:
                    state.fund_doc = fund
                    break

        # Load mapping configuration
        mapping_config = self.query_mongo_one(
            COLLECTIONS["mmifMappingConfigs"],
            {"eventId": brk.event_id, "account": brk.fund_account},
        )
        state.mapping_config = mapping_config

        # Determine analysis strategy
        strategy = self._determine_strategy(brk)

        state.messages.append({
            "role": "supervisor",
            "content": (
                f"MMIF analysis initiated: Fund {brk.fund_account} ({brk.fund_name}), "
                f"Filing Period {brk.filing_period}, "
                f"Rule {brk.rule_id} ({brk.rule_name}), "
                f"Variance={brk.variance:,.2f}. "
                f"Strategy: {strategy}. Dispatching to L0 Total Assets Agent."
            ),
            "timestamp": datetime.utcnow().isoformat(),
        })

        return state

    def _determine_strategy(self, brk: MmifBreakInput) -> str:
        """Determine analysis strategy based on break severity and variance."""
        severity = brk.severity
        variance = abs(brk.variance)

        if severity == "HARD" and variance > 100_000:
            return "CRITICAL_FULL_ANALYSIS"
        elif severity == "HARD":
            return "STANDARD_FULL_ANALYSIS"
        elif severity == "SOFT":
            return "SOFT_BREAK_ANALYSIS"
        elif severity == "DERIVED":
            return "DERIVED_BREAK_ANALYSIS"
        else:
            return "ADVISORY_QUICK_CHECK"

    # =========================================================================
    # Finalization
    # =========================================================================

    def _finalize_analysis(self, state: MmifAgentState) -> MmifAgentState:
        """Aggregate all MMIF findings and produce the final analysis report."""
        state.add_trace(self.name, "finalizing_analysis")

        # Aggregate root causes from all findings
        if not state.root_causes:
            state.root_causes = self._aggregate_root_causes(state)

        # Calculate overall confidence
        state.overall_confidence = self._calculate_confidence(state)

        # Generate root cause narrative if not already set by break analyst
        if not state.root_cause_narrative:
            state.root_cause_narrative = self._generate_narrative(state)

        # Check escalation
        state.check_escalation(
            confidence_threshold=0.70,
            critical_variance_threshold=100_000.0,
        )

        # Persist agent analysis to MongoDB
        self._persist_analysis(state)

        brk = state.mmif_break
        if state.should_escalate:
            state.phase = MmifAnalysisPhase.ESCALATED
            state.messages.append({
                "role": "supervisor",
                "content": (
                    f"MMIF analysis escalated to human review. "
                    f"Reasons: {[r.description for r in state.escalation_reasons]}"
                ),
                "timestamp": datetime.utcnow().isoformat(),
            })
        else:
            state.phase = MmifAnalysisPhase.COMPLETED
            clearance_str = (
                "CLEARED FOR FILING" if state.filing_clearance else "BLOCKED — CANNOT FILE"
            )
            state.messages.append({
                "role": "supervisor",
                "content": (
                    f"MMIF analysis complete. "
                    f"{len(state.root_causes)} root cause(s) identified with "
                    f"{state.overall_confidence:.0%} overall confidence. "
                    f"Attestation: {clearance_str} "
                    f"(readiness={state.attestation_readiness_score:.0%}). "
                    f"Summary: {state.root_cause_narrative[:200]}"
                ),
                "timestamp": datetime.utcnow().isoformat(),
            })

        return state

    def _aggregate_root_causes(self, state: MmifAgentState) -> list[dict]:
        """Aggregate and deduplicate root causes from all findings."""
        root_causes = []
        seen = set()

        sorted_findings = sorted(
            state.all_findings,
            key=lambda f: f.confidence,
            reverse=True,
        )

        for finding in sorted_findings:
            if finding.confidence < 0.60:
                continue
            desc_key = finding.description[:80].lower()
            if desc_key in seen:
                continue
            seen.add(desc_key)
            root_causes.append({
                "agent": finding.agent_name,
                "level": finding.level,
                "description": finding.description,
                "confidence": finding.confidence,
                "evidence": finding.evidence,
                "recommended_action": finding.recommended_action,
            })

        return root_causes[:10]

    def _calculate_confidence(self, state: MmifAgentState) -> float:
        """Calculate overall analysis confidence as weighted average."""
        if not state.all_findings:
            return 0.0

        total_weight = 0.0
        weighted_confidence = 0.0

        for finding in state.all_findings:
            weight = self.LEVEL_WEIGHTS.get(finding.level, 0.10)
            weighted_confidence += finding.confidence * weight
            total_weight += weight

        if total_weight == 0:
            return 0.0

        return min(weighted_confidence / total_weight, 1.0)

    def _generate_narrative(self, state: MmifAgentState) -> str:
        """Generate a plain-language root cause narrative using LLM."""
        brk = state.mmif_break
        if not state.root_causes or not brk:
            return "No root causes identified. Manual investigation required."

        findings_summary = "\n".join(
            f"- [{rc['level']}] {rc['description'][:150]} (confidence: {rc['confidence']:.0%})"
            for rc in state.root_causes[:5]
        )

        attestation_context = (
            f"Filing clearance: {'YES' if state.filing_clearance else 'NO'}. "
            f"Readiness score: {state.attestation_readiness_score:.0%}. "
            f"Hard blockers: {len(state.attestation_blockers)}."
        )

        try:
            return self.llm_reason(
                system_prompt=(
                    "You are a senior MMIF regulatory filing analyst. Write a clear, "
                    "concise root cause analysis for an MMIF reconciliation break. "
                    "Structure: 1) Summary, 2) Root Cause(s), 3) Recommended Actions. "
                    "Use plain language suitable for operations managers."
                ),
                user_prompt=(
                    f"Fund: {brk.fund_name} ({brk.fund_account})\n"
                    f"Filing Period: {brk.filing_period}\n"
                    f"Rule: {brk.rule_id} — {brk.rule_name}\n"
                    f"Eagle: {brk.eagle_value:,.2f}, MMIF: {brk.mmif_value:,.2f}, "
                    f"Variance: {brk.variance:,.2f}\n\n"
                    f"Analysis Findings:\n{findings_summary}\n\n"
                    f"Attestation Status:\n{attestation_context}\n\n"
                    f"Generate the root cause narrative report."
                ),
            )
        except Exception:
            causes = "; ".join(
                rc["description"][:100] for rc in state.root_causes[:3]
            )
            return (
                f"Analysis identified {len(state.root_causes)} root cause(s) for "
                f"{brk.rule_name} variance of {brk.variance:,.2f} "
                f"in fund {brk.fund_account}: {causes}"
            )

    def _persist_analysis(self, state: MmifAgentState) -> None:
        """Persist the completed agent analysis to MongoDB."""
        brk = state.mmif_break
        if not brk:
            return

        doc = {
            "breakId": brk.break_id,
            "eventId": brk.event_id,
            "fundAccount": brk.fund_account,
            "filingPeriod": brk.filing_period,
            "ruleId": brk.rule_id,
            "analysisPhase": state.phase.value,
            "overallConfidence": state.overall_confidence,
            "rootCauses": state.root_causes,
            "rootCauseNarrative": state.root_cause_narrative,
            "rootCauseClassification": state.root_cause_classification,
            "breakPatternSummary": state.break_pattern_summary,
            "primaryDriver": state.primary_driver.value if state.primary_driver else None,
            "breakingSections": state.breaking_sections,
            "isinCoverage": state.isin_coverage_pct,
            "attestationReadinessScore": state.attestation_readiness_score,
            "filingClearance": state.filing_clearance,
            "attestationReport": state.attestation_report,
            "shouldEscalate": state.should_escalate,
            "escalationReasons": [
                {"type": r.reason_type, "description": r.description}
                for r in state.escalation_reasons
            ],
            "agentTrace": state.agent_trace,
            "allFindings": [
                {
                    "agent": f.agent_name,
                    "level": f.level,
                    "description": f.description,
                    "confidence": f.confidence,
                    "recommended_action": f.recommended_action,
                    "timestamp": f.timestamp,
                    "evidence": f.evidence,
                }
                for f in state.all_findings
            ],
            "createdAt": datetime.utcnow().isoformat(),
        }

        try:
            self.db[COLLECTIONS["mmifAgentAnalysis"]].update_one(
                {"breakId": brk.break_id},
                {"$set": doc},
                upsert=True,
            )
        except Exception as e:
            print(f"[{self.name}] Failed to persist analysis: {e}")
