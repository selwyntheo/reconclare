"""
Supervisor Agent (Orchestrator) for RECON-AI.

Per Architecture Specification §3.2.1:
- Receives NAV break alerts from the CPU reconciliation engine
- Determines analysis strategy based on break magnitude, fund type, historical patterns
- Dispatches work to Level Agents in sequence (L0 → L1 → L2 → L3)
- Aggregates findings into a coherent root-cause narrative
- Manages agent state, conversation memory, and escalation decisions
- Produces final analysis report with confidence scores
"""
from datetime import datetime
from typing import Optional

from src.agents.base import BaseAgent
from src.agents.state import (
    AgentState, AnalysisPhase, BreakAlert,
    AgentFinding, EscalationReason,
)
from src.config.settings import settings


class SupervisorAgent(BaseAgent):
    """
    Central coordinator for the multi-agent reconciliation workflow.
    Orchestrates the full L0→L1→L2→L3→Specialist→Pattern pipeline.
    """

    def __init__(self):
        super().__init__(
            name="Supervisor",
            description="Central orchestrator for multi-level reconciliation analysis"
        )

    def analyze(self, state: AgentState) -> AgentState:
        """
        The Supervisor's analyze is called at two points:
        1. At the start to initialize and triage
        2. At the end to aggregate and produce the final report
        """
        if state.phase == AnalysisPhase.INITIATED:
            return self._initialize_analysis(state)
        else:
            return self._finalize_analysis(state)

    # =========================================================================
    # Initialization & Triage
    # =========================================================================

    def _initialize_analysis(self, state: AgentState) -> AgentState:
        """Initialize the analysis workflow from a break alert."""
        alert = state.break_alert
        if not alert:
            state.add_trace(self.name, "error", {"msg": "No break alert provided"})
            state.phase = AnalysisPhase.COMPLETED
            return state

        state.add_trace(self.name, "initializing", {
            "break_id": alert.break_id,
            "account": alert.account,
            "variance": alert.variance_absolute,
        })

        # Query pattern graph for historical context on this fund
        historical_context = self._get_historical_context(alert)

        # Determine analysis strategy
        strategy = self._determine_strategy(alert, historical_context)

        state.messages.append({
            "role": "supervisor",
            "content": (
                f"Received break alert: Fund {alert.account}, "
                f"NAV Date {alert.valuation_dt}, "
                f"Variance = {alert.variance_absolute:,.2f} "
                f"({alert.variance_relative:.4%}). "
                f"Strategy: {strategy}. Dispatching to L0 NAV Agent."
            ),
            "timestamp": datetime.utcnow().isoformat(),
        })

        return state

    def _get_historical_context(self, alert: BreakAlert) -> dict:
        """Query the pattern graph for historical breaks on this fund."""
        try:
            results = self.query_graph("""
                MATCH (bi:BreakInstance {account: $account})
                WHERE bi.status IN ['RESOLVED', 'ACCEPTED']
                RETURN bi.break_category as category,
                       count(*) as count,
                       avg(bi.confidence_score) as avg_confidence
                ORDER BY count DESC
                LIMIT 5
            """, {"account": alert.account})
            return {
                "has_history": len(results) > 0,
                "common_categories": results,
            }
        except Exception:
            return {"has_history": False, "common_categories": []}

    def _determine_strategy(
        self, alert: BreakAlert, historical_context: dict
    ) -> str:
        """Determine analysis strategy based on break characteristics."""
        variance_pct = abs(alert.variance_relative)

        if variance_pct > settings.CRITICAL_BREAK_THRESHOLD:
            return "CRITICAL_FULL_DRILL_DOWN"
        elif variance_pct > settings.MATERIALITY_THRESHOLD_RELATIVE:
            return "STANDARD_DRILL_DOWN"
        else:
            return "QUICK_CHECK"

    # =========================================================================
    # Finalization & Report Generation
    # =========================================================================

    def _finalize_analysis(self, state: AgentState) -> AgentState:
        """Aggregate all findings and produce the final analysis report."""
        state.phase = AnalysisPhase.REPORT_GENERATION
        state.add_trace(self.name, "finalizing_analysis")

        # Aggregate root causes from all findings
        root_causes = self._aggregate_root_causes(state)
        state.root_causes = root_causes

        # Calculate overall confidence
        state.overall_confidence = self._calculate_confidence(state)

        # Generate root cause narrative using LLM
        state.root_cause_narrative = self._generate_narrative(state)

        # Check escalation criteria
        state.check_escalation(
            confidence_threshold=settings.CONFIDENCE_ESCALATION_THRESHOLD,
            critical_nav_threshold=settings.CRITICAL_BREAK_THRESHOLD,
        )

        if state.should_escalate:
            state.phase = AnalysisPhase.ESCALATED
            state.messages.append({
                "role": "supervisor",
                "content": (
                    f"Analysis escalated to human review. "
                    f"Reasons: {[r.description for r in state.escalation_reasons]}"
                ),
                "timestamp": datetime.utcnow().isoformat(),
            })
        else:
            state.phase = AnalysisPhase.COMPLETED
            state.messages.append({
                "role": "supervisor",
                "content": (
                    f"Analysis complete. {len(root_causes)} root cause(s) identified "
                    f"with {state.overall_confidence:.0%} overall confidence. "
                    f"Summary: {state.root_cause_narrative[:200]}"
                ),
                "timestamp": datetime.utcnow().isoformat(),
            })

        return state

    def _aggregate_root_causes(self, state: AgentState) -> list[dict]:
        """Aggregate and deduplicate root causes from all findings."""
        root_causes = []
        seen_descriptions = set()

        # Prioritize findings by confidence
        sorted_findings = sorted(
            state.all_findings,
            key=lambda f: f.confidence,
            reverse=True,
        )

        for finding in sorted_findings:
            if finding.confidence < 0.60:
                continue

            # Simple deduplication by description similarity
            desc_key = finding.description[:100].lower()
            if desc_key in seen_descriptions:
                continue
            seen_descriptions.add(desc_key)

            root_causes.append({
                "agent": finding.agent_name,
                "level": finding.level,
                "description": finding.description,
                "confidence": finding.confidence,
                "evidence": finding.evidence,
                "recommended_action": finding.recommended_action,
            })

        return root_causes[:10]  # Top 10 root causes

    def _calculate_confidence(self, state: AgentState) -> float:
        """Calculate overall analysis confidence score."""
        if not state.all_findings:
            return 0.0

        # Weighted average: higher-level findings get more weight
        level_weights = {
            "L0_NAV": 0.10,
            "L1_GL": 0.20,
            "L2_SUBLEDGER": 0.25,
            "L3_TRANSACTION": 0.25,
            "SPECIALIST_PRICING": 0.15,
            "SPECIALIST_CA": 0.15,
            "SPECIALIST_ACCRUAL": 0.15,
            "SPECIALIST_FX": 0.15,
            "PATTERN_MATCH": 0.20,
        }

        total_weight = 0.0
        weighted_confidence = 0.0

        for finding in state.all_findings:
            weight = level_weights.get(finding.level, 0.10)
            weighted_confidence += finding.confidence * weight
            total_weight += weight

        if total_weight == 0:
            return 0.0

        return min(weighted_confidence / total_weight, 1.0)

    def _generate_narrative(self, state: AgentState) -> str:
        """Generate a plain-language root cause narrative using LLM."""
        if not state.root_causes:
            return "No root causes identified. Manual investigation required."

        # Build context from findings
        findings_summary = "\n".join([
            f"- [{rc['level']}] {rc['description']} (confidence: {rc['confidence']:.0%})"
            for rc in state.root_causes[:5]
        ])

        alert = state.break_alert
        alert_context = ""
        if alert:
            alert_context = (
                f"Fund: {alert.account}, Share Class: {alert.share_class}, "
                f"NAV Date: {alert.valuation_dt}, "
                f"Variance: {alert.variance_absolute:,.2f} ({alert.variance_relative:.4%})"
            )

        pattern_context = ""
        if state.matched_patterns:
            pattern_context = (
                f"Historical patterns matched: "
                + ", ".join(p.get("pattern_name", "") for p in state.matched_patterns[:3])
            )

        try:
            narrative = self.llm_reason(
                system_prompt=(
                    "You are a senior fund accounting analyst writing a root cause "
                    "analysis report. Write a clear, concise narrative explaining "
                    "the NAV break root cause(s). Use plain language suitable for "
                    "operations managers. Include specific numbers and evidence. "
                    "Structure: 1) Summary, 2) Root Cause(s), 3) Recommended Actions."
                ),
                user_prompt=(
                    f"Break Context:\n{alert_context}\n\n"
                    f"Analysis Findings:\n{findings_summary}\n\n"
                    f"Pattern Context:\n{pattern_context}\n\n"
                    f"Generate the root cause narrative report."
                ),
            )
            return narrative
        except Exception:
            # Fallback: construct narrative from findings
            causes = "; ".join(
                rc["description"][:100] for rc in state.root_causes[:3]
            )
            return (
                f"Analysis identified {len(state.root_causes)} root cause(s) "
                f"for the NAV variance of {alert.variance_absolute:,.2f} "
                f"in fund {alert.account}: {causes}"
            )
