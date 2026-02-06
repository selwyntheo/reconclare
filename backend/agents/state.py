"""
Agent State Model for RECON-AI Multi-Agent Orchestration.

Defines the shared state that flows through the LangGraph workflow.
Per Architecture Specification §3.2: Supervisor manages agent state,
conversation memory, and escalation decisions.
"""
import enum
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional


class AnalysisPhase(str, enum.Enum):
    """Current phase of the reconciliation analysis workflow."""
    INITIATED = "INITIATED"
    L0_NAV_ANALYSIS = "L0_NAV_ANALYSIS"
    L1_GL_ANALYSIS = "L1_GL_ANALYSIS"
    L2_SUBLEDGER_ANALYSIS = "L2_SUBLEDGER_ANALYSIS"
    L3_TRANSACTION_ANALYSIS = "L3_TRANSACTION_ANALYSIS"
    SPECIALIST_ANALYSIS = "SPECIALIST_ANALYSIS"
    PATTERN_MATCHING = "PATTERN_MATCHING"
    REPORT_GENERATION = "REPORT_GENERATION"
    ESCALATED = "ESCALATED"
    COMPLETED = "COMPLETED"


class BreakDriver(str, enum.Enum):
    """Primary driver categories for NAV breaks (L0 classification)."""
    INCOME_DRIVEN = "INCOME_DRIVEN"
    EXPENSE_DRIVEN = "EXPENSE_DRIVEN"
    POSITION_DRIVEN = "POSITION_DRIVEN"
    CAPITAL_ACTIVITY_DRIVEN = "CAPITAL_ACTIVITY_DRIVEN"
    MULTI_FACTOR = "MULTI_FACTOR"


@dataclass
class VarianceDetail:
    """Variance data at any reconciliation level."""
    component: str
    cpu_value: float
    incumbent_value: float
    variance_absolute: float
    variance_relative: float
    is_material: bool = False
    sub_details: list["VarianceDetail"] = field(default_factory=list)


@dataclass
class AgentFinding:
    """A single finding from an agent's analysis."""
    agent_name: str
    level: str
    timestamp: str = ""
    description: str = ""
    evidence: dict = field(default_factory=dict)
    confidence: float = 0.0
    recommended_action: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat()


@dataclass
class EscalationReason:
    """Reason for escalating to human analyst."""
    reason_type: str  # LOW_CONFIDENCE, NOVEL_PATTERN, CRITICAL_MAGNITUDE, CONFLICTING_CAUSES, CONFIG_CHANGE
    description: str
    threshold_value: Optional[float] = None
    actual_value: Optional[float] = None


@dataclass
class BreakAlert:
    """Incoming break alert from the CPU reconciliation engine."""
    break_id: str
    account: str
    share_class: str
    valuation_dt: date
    cpu_nav: float
    incumbent_nav: float
    variance_absolute: float
    variance_relative: float
    shares_outstanding: float
    nav_per_share_variance: float
    fund_type: Optional[str] = None
    source_system: Optional[str] = None
    metadata: dict = field(default_factory=dict)


@dataclass
class AgentState:
    """
    Shared state flowing through the LangGraph reconciliation workflow.
    This is the central data structure that all agents read from and write to.
    """

    # --- Input: Break Alert ---
    break_alert: Optional[BreakAlert] = None

    # --- Workflow Control ---
    phase: AnalysisPhase = AnalysisPhase.INITIATED
    current_agent: str = ""
    step_count: int = 0
    max_steps: int = 50

    # --- L0 NAV Analysis Results ---
    nav_variance: Optional[VarianceDetail] = None
    primary_driver: Optional[BreakDriver] = None
    l0_findings: list[AgentFinding] = field(default_factory=list)

    # --- L1 GL Analysis Results ---
    gl_variances: list[VarianceDetail] = field(default_factory=list)
    breaking_gl_buckets: list[str] = field(default_factory=list)
    l1_findings: list[AgentFinding] = field(default_factory=list)

    # --- L2 Sub-Ledger Analysis Results ---
    position_variances: list[VarianceDetail] = field(default_factory=list)
    breaking_positions: list[dict] = field(default_factory=list)
    l2_findings: list[AgentFinding] = field(default_factory=list)

    # --- L3 Transaction Analysis Results ---
    transaction_matches: list[dict] = field(default_factory=list)
    orphan_transactions: list[dict] = field(default_factory=list)
    amount_differences: list[dict] = field(default_factory=list)
    l3_findings: list[AgentFinding] = field(default_factory=list)

    # --- Specialist Agent Results ---
    specialist_findings: list[AgentFinding] = field(default_factory=list)
    specialists_invoked: list[str] = field(default_factory=list)

    # --- Pattern Matching Results ---
    matched_patterns: list[dict] = field(default_factory=list)
    historical_similar_breaks: list[dict] = field(default_factory=list)
    pattern_findings: list[AgentFinding] = field(default_factory=list)

    # --- Aggregated Results ---
    all_findings: list[AgentFinding] = field(default_factory=list)
    root_causes: list[dict] = field(default_factory=list)
    overall_confidence: float = 0.0
    root_cause_narrative: str = ""

    # --- Escalation ---
    should_escalate: bool = False
    escalation_reasons: list[EscalationReason] = field(default_factory=list)

    # --- Conversation Memory ---
    messages: list[dict] = field(default_factory=list)

    # --- Audit Trail ---
    agent_trace: list[dict] = field(default_factory=list)
    queries_executed: list[dict] = field(default_factory=list)
    graph_traversals: list[dict] = field(default_factory=list)

    def add_finding(self, finding: AgentFinding):
        """Add a finding and update the all_findings aggregate."""
        self.all_findings.append(finding)
        self.step_count += 1

    def add_trace(self, agent: str, action: str, details: dict = None):
        """Add an audit trace entry."""
        self.agent_trace.append({
            "agent": agent,
            "action": action,
            "timestamp": datetime.utcnow().isoformat(),
            "step": self.step_count,
            "details": details or {},
        })

    def check_escalation(
        self,
        confidence_threshold: float = 0.70,
        critical_nav_threshold: float = 0.0005,
    ) -> bool:
        """Check if the analysis should be escalated to a human."""
        reasons = []

        if self.overall_confidence < confidence_threshold and self.phase not in (
            AnalysisPhase.INITIATED, AnalysisPhase.L0_NAV_ANALYSIS
        ):
            reasons.append(EscalationReason(
                reason_type="LOW_CONFIDENCE",
                description=f"Confidence {self.overall_confidence:.2%} below threshold {confidence_threshold:.2%}",
                threshold_value=confidence_threshold,
                actual_value=self.overall_confidence,
            ))

        if self.break_alert and abs(self.break_alert.variance_relative) > critical_nav_threshold:
            reasons.append(EscalationReason(
                reason_type="CRITICAL_MAGNITUDE",
                description=f"Break magnitude {self.break_alert.variance_relative:.4%} exceeds critical threshold",
                threshold_value=critical_nav_threshold,
                actual_value=abs(self.break_alert.variance_relative),
            ))

        if not self.matched_patterns and self.phase in (
            AnalysisPhase.PATTERN_MATCHING, AnalysisPhase.REPORT_GENERATION
        ):
            reasons.append(EscalationReason(
                reason_type="NOVEL_PATTERN",
                description="No matching historical patterns found",
            ))

        if len(self.root_causes) > 1:
            confidences = [rc.get("confidence", 0) for rc in self.root_causes]
            if len(confidences) >= 2:
                sorted_c = sorted(confidences, reverse=True)
                if sorted_c[0] - sorted_c[1] < 0.15:
                    reasons.append(EscalationReason(
                        reason_type="CONFLICTING_CAUSES",
                        description="Multiple root causes with similar confidence scores",
                    ))

        self.escalation_reasons = reasons
        self.should_escalate = len(reasons) > 0
        return self.should_escalate
